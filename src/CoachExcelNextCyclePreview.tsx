import { useEffect, useRef, useState, type ReactNode } from 'react'
import { describeGroup } from './CoachCycleServerPreview'
import { coachExcelBetaPublicationRecoveryKey, readCoachExcelBetaPublicationRecovery, COACH_EXCEL_BETA_RECOVERY_CHANGED } from './coach-excel-publication-recovery'
import { readNextCycleRecovery, storeNextCycleRecovery, nextCycleRecoveryKey, type NextCycleRecovery } from './coach-excel-next-cycle-recovery'
import { CoachExcelNextCycleError, type CoachExcelNextCycleApi } from './lib/coach-excel-next-cycle-client'
import { COACH_EXCEL_NEXT_CYCLE_TIMEOUT_MS, isCoachExcelNextCyclePreviewPage, type CoachExcelNextCyclePreviewInput, type CoachExcelNextCyclePreviewPage, type CoachExcelNextCycleStatus, type CoachExcelNextCycleLastError } from './lib/coach-excel-next-cycle-api'
import { ModalDialog } from './ModalDialog'

type Props = {
  api: CoachExcelNextCycleApi; gateEpoch: number; athleteName: string; currentProgram?: { id: string; name: string } | null
  input: Pick<CoachExcelNextCyclePreviewInput, 'gym' | 'athlete' | 'draft' | 'expected_revision'>
  reviewEpoch?: number; sourceHash: string; ownerSubject?: string; disabled: boolean; recoveryOnly?: boolean
  /** Each new value asks for one preview as soon as the saved draft is previewable (the worksheet's Publish button). */
  autoPreview?: number
  /** One-click publish (Joe, Nov 16 review 3): publish right after the auto preview when it is publishable. */
  autoPublish?: boolean
  onBusyChange?(busy: boolean): void
  /** Something needs the coach (an error, a replace confirmation or an unconfirmed publish). */
  onNeedsAttention?(): void
  onPublished?(message: string): void
  onConflict(): void; onAccessEnded(allowHistoricalRecovery?: boolean): void
}
type KnownStatus = Exclude<CoachExcelNextCycleStatus, { status: 'not_found' }>
const sendFailed = "Couldn't send this cycle. Nothing changed on the phone."
const sendUnconfirmed = "Couldn't confirm the send. Check whether it reached the phone."
function isAccessError(cause: unknown): cause is CoachExcelNextCycleError & { code: 'session_expired' | 'access_denied' } {
  return cause instanceof CoachExcelNextCycleError && (cause.code === 'session_expired' || cause.code === 'access_denied')
}
const reasons: Record<string, string> = {
  predecessor_replaced_or_closed: 'the current program changed', another_active_assignment: 'another program is active',
  membership_revoked: 'athlete access ended', membership_revoked_or_replaced: 'athlete access changed', pairing_changed: 'the athlete connection changed',
  enrollment_revoked_or_replaced: 'beta enrollment changed', coach_membership_revoked: 'coach access ended', coach_roster_revoked: 'coach access ended',
  materialized_hash_drift: 'the saved program changed', finish_time_missing: 'the finish date is missing', activation_failed: 'activation failed',
  athlete_erasure: 'the athlete was removed', athlete_disconnected: 'the athlete disconnected', activation_refused: 'activation was refused',
  draft_deleted: 'the draft was deleted', coach_cancelled: 'it was cancelled', replaced: 'it was replaced',
}
export function nextCycleFailureNote(error: CoachExcelNextCycleLastError) {
  if (error.reason === 'replaced') return 'Replaced by a newer publish.'
  if (error.reason === 'coach_cancelled') return 'Cancelled.'
  return error.terminal ? `This program could not start: ${reasons[error.reason] ?? 'activation failed'}. Publish again.` : 'Will retry automatically.'
}
export function nextCyclePublishedMessage(athlete: string, predecessor: string | null, remaining: number, closed: boolean, status: string) {
  if (status === 'pending' && remaining === 0) return 'Published. The new program is waiting to start.'
  if (status === 'pending') return `Published. ${athlete} is still on ${predecessor ?? 'their current program'} (${remaining} workout${remaining === 1 ? '' : 's'} left). The new program will start once those are completed or skipped.`
  if (status === 'cancelled') return 'The program did not start. Checking the reason…'
  return closed ? 'The finished cycle was closed and the new program published.' : 'The server confirmed publication by its immutable receipt.'
}
export default function CoachExcelNextCyclePreview(props: Props) {
  return <NextCyclePreview key={`${props.ownerSubject}:${props.input.gym}:${props.input.athlete}`} {...props} />
}
function NextCyclePreview({ api, gateEpoch, athleteName, currentProgram, input, sourceHash, ownerSubject, disabled, recoveryOnly = false, reviewEpoch, autoPreview, autoPublish = false, onBusyChange, onNeedsAttention, onPublished, onAccessEnded, onConflict }: Props) {
  const scope = { gym: input.gym, athlete: input.athlete }
  const [page, setPage] = useState<CoachExcelNextCyclePreviewPage | null>(null)
  const [record, setRecord] = useState<NextCycleRecovery | null>(null), recordRef = useRef<NextCycleRecovery | null>(null)
  const [status, setStatus] = useState<KnownStatus | null>(null)
  const [queued, setQueued] = useState<{ id: string; version: number } | null>(null)
  // Joe, Nov 16: no confirm checkbox; the dated preview plus one Publish button is the check.
  const [, setConfirmed] = useState(false), [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false), busyRef = useRef(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [recoveryError, setRecoveryError] = useState('')
  const [sendRetry, setSendRetry] = useState<{ epoch: number; index: number; sendAfterPreview: boolean } | null>(null)
  const [checkedRequest, setCheckedRequest] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'cancel' | 'replace' | 'abandon' | null>(null)
  const [abandonable, setAbandonable] = useState(false)
  const rejectedRetry = useRef<string | null>(null), previousQueue = useRef<NextCycleRecovery | null>(null)
  const statusRegion = useRef<HTMLParagraphElement>(null)
  const alive = useRef(true), generation = useRef(0)
  const binding = JSON.stringify([input, sourceHash, gateEpoch, reviewEpoch, disabled, recoveryOnly]), bindingRef = useRef(binding)
  if (bindingRef.current !== binding) { bindingRef.current = binding; generation.current++ }
  const unknown = Boolean(record && !record.resolved)
  function retain(value: NextCycleRecovery | null, request: string) {
    storeNextCycleRecovery(ownerSubject, scope, value, request)
    recordRef.current = value; setRecord(value)
  }
  async function coordinated(action: () => Promise<unknown>, wait = false) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setSendRetry(null)
    if (sendRetry) setPage(null)
    try {
      if (typeof navigator.locks?.request !== 'function') throw new Error('This browser cannot safely coordinate publication recovery across tabs.')
      await navigator.locks.request(coachExcelBetaPublicationRecoveryKey(ownerSubject, scope), { mode: 'exclusive', ifAvailable: !wait }, async lock => {
        if (!lock) throw new Error('Another tab is checking or publishing this client cycle. Wait for it to finish.')
        if (alive.current) await action()
      })
    } catch (cause) {
      if (!alive.current) return
      if (isAccessError(cause)) { setPage(null); setStatus(null); setQueued(null); onAccessEnded(cause.code === 'access_denied'); return }
      if (cause instanceof CoachExcelNextCycleError && cause.code === 'conflict' && ['excel_preview_revision_stale', 'excel_preview_source_integrity'].includes(cause.reason ?? '')) onConflict()
      setError(cause instanceof Error ? cause.message : 'The server response could not be confirmed.')
    } finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  async function checkStatus(saved = recordRef.current, announce = true) {
    if (!saved) return false
    // Use the start of the read, so a delayed response cannot age an early snapshot into eligibility.
    const checkedAt = Date.now()
    const result = await api.status({ ...scope, request_id: saved.input.request_id })
    if (!alive.current) return false
    if (result.status === 'not_found') {
      setCheckedRequest(saved.input.request_id)
      const canAbandon = rejectedRetry.current === saved.input.request_id && saved.firstSentAt !== undefined
        && checkedAt - saved.firstSentAt > COACH_EXCEL_NEXT_CYCLE_TIMEOUT_MS + 30000
      setAbandonable(canAbandon)
      if (saved.rejected) {
        retain(previousQueue.current, saved.input.request_id); setPage(null); setConfirmed(false)
        setNotice('The request was rejected. Preview the saved cycle again before publishing.')
      } else setNotice(canAbandon ? 'The original request was refused and a later status check found no publication. You can abandon this publish attempt and review a fresh preview.' : rejectedRetry.current === saved.input.request_id ? 'The original request was refused. Wait at least 40 seconds after sending, then check status again before abandoning this publish attempt.' : 'No publication was visible at this status snapshot. Retry keeps the original request ID and saved revision.')
      return false
    }
    setStatus(result); setCheckedRequest(null); setAbandonable(false)
    setQueued(result.status === 'pending' ? { id: result.queue_id, version: result.queue_version } : null)
    // Retain only metadata needed to find this queue again on this browser.
    retain({ ...saved, queueId: result.queue_id, resolved: true, rejected: false }, saved.input.request_id)
    if (result.status === 'cancelled') setNotice(result.last_error ? nextCycleFailureNote(result.last_error) : 'This program is no longer queued. Check its status before publishing again.')
    else if (announce) setNotice(nextCyclePublishedMessage(athleteName, saved.predecessorName, result.remaining.length, result.status === 'activated' && saved.predecessorId !== null, result.status))
    else setNotice('')
    return true
  }
  async function checkRetainedStatus(saved = recordRef.current, announce = true) {
    try { await checkStatus(saved, announce) }
    catch (cause) {
      // An unresolved request already shows the status-check message and action.
      if (!saved || saved.resolved || isAccessError(cause)) throw cause
    }
  }
  async function refreshStoredStatus() {
    // Another tab may finish or replace the record while this tab waits for its lock.
    const latest = readNextCycleRecovery(ownerSubject, scope)
    recordRef.current = latest; setRecord(latest)
    if (latest) await checkRetainedStatus(latest, false)
  }
  useEffect(() => {
    alive.current = true
    try {
      if (typeof navigator.locks?.request !== 'function') throw new Error('This browser cannot safely coordinate publication recovery across tabs.')
      const saved = readNextCycleRecovery(ownerSubject, scope)
      recordRef.current = saved; setRecord(saved); setReady(true)
      if (saved) void coordinated(refreshStoredStatus, true)
    } catch (cause) { setRecoveryError(cause instanceof Error ? cause.message : 'Safe publication recovery is unavailable.') }
    const update = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== null && event.key !== nextCycleRecoveryKey(ownerSubject, scope)) return
      if (event instanceof CustomEvent && event.detail !== coachExcelBetaPublicationRecoveryKey(ownerSubject, scope)) return
      if (busyRef.current) return
      setDialog(null); setNotice(''); setAbandonable(false)
      try {
        const saved = readNextCycleRecovery(ownerSubject, scope)
        recordRef.current = saved; setRecord(saved); setPage(null); setConfirmed(false); setStatus(null); setQueued(null)
        if (saved) void coordinated(refreshStoredStatus, true)
      } catch { setRecoveryError('Safe publication recovery could not be read. Recover the original request before publishing.') }
    }
    window.addEventListener('storage', update)
    window.addEventListener(COACH_EXCEL_BETA_RECOVERY_CHANGED, update)
    return () => { alive.current = false; window.removeEventListener('storage', update); window.removeEventListener(COACH_EXCEL_BETA_RECOVERY_CHANGED, update) }
    // Scope is keyed by the parent. Never discard a retained request on draft edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { setPage(null); setConfirmed(false); setDialog(null) }, [binding])
  // A request waits until the save that precedes it has made the draft previewable.
  const autoHandled = useRef(autoPreview ?? 0)
  // A Publish request belongs to the draft it was made for; switching drafts drops it.
  useEffect(() => { autoHandled.current = autoPreview ?? 0 }, [input.draft]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!autoPreview || autoPreview === autoHandled.current || disabled || recoveryOnly || unknown || !ready || recoveryError || busyRef.current) return
    autoHandled.current = autoPreview
    void coordinated(() => reviewForPublish(0, null, autoPublish))
  }) // eslint-disable-line react-hooks/exhaustive-deps
  // Only once the work settles: an in-flight publish is briefly "unknown" by design.
  const retrySend = sendRetry?.epoch === generation.current && !unknown ? sendRetry : null
  const attention = !busy && Boolean(error || retrySend || recoveryError || dialog || unknown)
  const latestHandlers = useRef({ onBusyChange, onNeedsAttention }); latestHandlers.current = { onBusyChange, onNeedsAttention }
  useEffect(() => { latestHandlers.current.onBusyChange?.(busy) }, [busy])
  useEffect(() => { if (attention) latestHandlers.current.onNeedsAttention?.() }, [attention])
  async function preview(index = 0, previous = page): Promise<CoachExcelNextCyclePreviewPage | null> {
    if (disabled || recoveryOnly || recordRef.current && !recordRef.current.resolved) return null
    const epoch = generation.current
    const request = { ...input, page_index: index, expected_review_hash: previous?.summary.review_hash ?? null, expected_gate_epoch: previous?.summary.authorization.gate_epoch ?? gateEpoch }
    setConfirmed(false)
    let result: CoachExcelNextCyclePreviewPage
    try { result = await api.preview(request, previous?.summary) }
    catch (cause) { if (alive.current && epoch === generation.current) setPage(null); throw cause }
    if (!alive.current || epoch !== generation.current) return null
    if (!isCoachExcelNextCyclePreviewPage(result, request) || result.summary.owner_subject !== ownerSubject || result.summary.source_hash !== sourceHash
      || previous && (index === previous.page_index + 1 && result.items[0].item_index !== previous.items.at(-1)!.item_index + 1
        || index === previous.page_index - 1 && result.items.at(-1)!.item_index !== previous.items[0].item_index - 1)) { setPage(null); throw new CoachExcelNextCycleError('network') }
    setPage(result); setConfirmed(false)
    setQueued(result.summary.expected_pending_id ? { id: result.summary.expected_pending_id, version: result.summary.expected_queue_version } : null)
    if (status && status.queue_id !== result.summary.expected_pending_id) setStatus(null)
    return result
  }
  async function reviewForPublish(index: number, previous: CoachExcelNextCyclePreviewPage | null, sendAfterPreview = false) {
    const epoch = generation.current
    let reviewed
    try { reviewed = await preview(index, previous) }
    catch (cause) {
      if (!alive.current || epoch !== generation.current) return
      if (cause instanceof CoachExcelNextCycleError && !['network', 'invalid', 'ambiguous', 'retryable'].includes(cause.code)) throw cause
      // Keep the last reviewed page for navigation retries, including a return to page zero.
      setPage(previous)
      setSendRetry({ epoch, index, sendAfterPreview })
      return
    }
    if (!sendAfterPreview || !reviewed || !alive.current) return
    if (!reviewed.summary.publishable) { setNotice('The server found a problem with this cycle. Check the details below.'); onNeedsAttention?.(); return }
    if (reviewed.summary.expected_pending_id) { setDialog('replace'); return }
    await publish(false, reviewed)
  }
  async function refreshStale() {
    setPage(null); setConfirmed(false); setDialog(null); setQueued(null); setStatus(null)
    if (!disabled && !recoveryOnly && !(recordRef.current && !recordRef.current.resolved)) {
      setNotice('The queued program or saved review changed. Refreshing the preview…')
      try { await preview(0, null) } catch (cause) { setNotice('The preview could not be refreshed. Preview again before publishing or cancelling.'); throw cause }
      setNotice('The queued program or saved review changed. The preview was refreshed. Review it again before publishing or cancelling.')
    } else {
      if (recordRef.current && !recordRef.current.resolved) { setNotice('The original request was refused because the queue or review changed. Check status again before abandoning this publish attempt.'); return }
      if (recordRef.current?.resolved) await checkStatus()
      setNotice('The queued program changed. Open or save a draft, then preview again before publishing or cancelling.')
    }
  }
  async function publish(retry = false, reviewed = page) {
    if (recoveryOnly || !ready || recoveryError) return
    if (!retry && (disabled || !reviewed || !reviewed.summary.publishable)) return
    if (readCoachExcelBetaPublicationRecovery(ownerSubject, scope)) throw new Error('Check the earlier publish before publishing again.')
    let saved = readNextCycleRecovery(ownerSubject, scope)
    if (retry) {
      if (!saved || saved.resolved || saved.input.request_id !== checkedRequest) return
      // Older records have no send time. Waiting from this retry cannot shorten the original wait.
      if (saved.firstSentAt === undefined) { saved = { ...saved, firstSentAt: Date.now() }; retain(saved, saved.input.request_id) }
    } else {
      if (saved && !saved.resolved) { recordRef.current = saved; setRecord(saved); setCheckedRequest(null); return }
      previousQueue.current = saved?.resolved ? saved : null
      const s = reviewed!.summary
      const predecessor = currentProgram?.id === s.expected_current_assignment ? currentProgram.name : null
      saved = { contract: 'coach-excel-pending/3', input: { ...input, request_id: crypto.randomUUID(), expected_review_hash: s.review_hash,
        expected_gate_epoch: s.authorization.gate_epoch, expected_queue_version: s.expected_queue_version }, rejected: false, resolved: false,
        queueId: null, name: s.name, predecessorName: predecessor, predecessorId: s.expected_current_assignment, firstSentAt: Date.now() }
      retain(saved, saved.input.request_id)
    }
    const original = saved!
    const previouslyUncertain = retry && !original.rejected
    const epoch = generation.current
    setCheckedRequest(null); setAbandonable(false); rejectedRetry.current = null; setConfirmed(false); setDialog(null); setNotice('')
    let needsStatus = retry
    try {
      // A serialization retry always checks the exact original request first.
      let result
      try { result = await api.publish(original.input) }
      catch (cause) {
        if (!(cause instanceof CoachExcelNextCycleError) || cause.code !== 'retryable') throw cause
        needsStatus = true
        if (await checkStatus(original)) return
        result = await api.publish(original.input)
      }
      if (!alive.current) return
      retain({ ...original, queueId: result.queue_id, resolved: true }, original.input.request_id)
      setPage(null)
      setStatus(null); setQueued(result.status === 'pending' ? { id: result.queue_id, version: result.queue_version } : null)
      const published = nextCyclePublishedMessage(athleteName, original.predecessorName, result.remaining, result.closed_predecessor, result.status)
      setNotice(published)
      if (result.status !== 'cancelled') onPublished?.(published)
      // The compact publish response has no remaining labels/dates. Read them by the same request ID.
      if (result.status === 'pending' || result.status === 'cancelled') {
        try { await checkStatus({ ...original, resolved: true }) } catch { if (alive.current) setError(result.status === 'cancelled' ? 'The program did not start. Check publication status for the reason.' : 'Published. Remaining workout details could not be loaded. Check publication status to retry.') }
      }
    } catch (cause) {
      if (!alive.current) return
      if (isAccessError(cause)) throw cause
      // For publish, the client uses these codes only before transport or for explicit refusals.
      if (!needsStatus && cause instanceof CoachExcelNextCycleError && ['network', 'invalid'].includes(cause.code)) {
        retain(previousQueue.current, original.input.request_id); setPage(null)
        if (epoch === generation.current) setSendRetry({ epoch, index: 0, sendAfterPreview: true })
        return
      }
      const rejected = !previouslyUncertain && cause instanceof CoachExcelNextCycleError && ['conflict', 'blocked'].includes(cause.code)
      if (previouslyUncertain && cause instanceof CoachExcelNextCycleError && cause.code === 'conflict') rejectedRetry.current = original.input.request_id
      retain({ ...original, rejected, resolved: false }, original.input.request_id); setPage(null)
      try {
        const refused = rejectedRetry.current; rejectedRetry.current = null
        try { if (await checkStatus({ ...original, rejected, resolved: false })) return } finally { rejectedRetry.current = refused }
        if (cause instanceof CoachExcelNextCycleError && ['NEXT_CYCLE_QUEUE_VERSION_STALE', 'NEXT_CYCLE_REVIEW_STALE'].includes(cause.reason ?? '')) { await refreshStale(); return }
      } catch (statusFailure) {
        if (isAccessError(statusFailure)) throw statusFailure
      }
      if (cause instanceof CoachExcelNextCycleError && ['conflict', 'blocked', 'unavailable'].includes(cause.code)) setError(cause.message)
    }
  }
  async function cancel() {
    if (!queued || recoveryOnly || unknown) return
    setDialog(null)
    try {
      await api.cancel({ ...scope, queue_id: queued.id, expected_queue_version: queued.version })
      if (!alive.current) return
      setQueued(null); setStatus(null); setPage(null); setConfirmed(false)
      if (recordRef.current?.resolved) retain(null, recordRef.current.input.request_id)
      setNotice('The queued program was cancelled.'); queueMicrotask(() => statusRegion.current?.focus())
    } catch (cause) {
      if (cause instanceof CoachExcelNextCycleError && ['NEXT_CYCLE_QUEUE_VERSION_STALE', 'NEXT_CYCLE_REVIEW_STALE'].includes(cause.reason ?? '')) { await refreshStale(); return }
      throw cause
    }
  }
  async function abandon() {
    if (!abandonable || !recordRef.current) return
    const request = recordRef.current.input.request_id
    // coordinated() holds the athlete lock. Never trust the dialog's in-memory snapshot.
    const latest = readNextCycleRecovery(ownerSubject, scope)
    recordRef.current = latest; setRecord(latest); setDialog(null); setAbandonable(false)
    if (!latest || latest.resolved || latest.input.request_id !== request) {
      setPage(null); setConfirmed(false); setStatus(null); setQueued(null); setCheckedRequest(null)
      throw new Error('Publication recovery changed in another tab. Check the stored request status before continuing.')
    }
    // Even a previously qualifying not_found is insufficient to clear custody now.
    if (await checkStatus(latest)) return
    if (rejectedRetry.current !== request || latest.firstSentAt === undefined
      || Date.now() - latest.firstSentAt <= COACH_EXCEL_NEXT_CYCLE_TIMEOUT_MS + 30000) return
    retain(previousQueue.current, request); setPage(null); setConfirmed(false); setAbandonable(false); setCheckedRequest(null)
    setNotice('Publish attempt abandoned. Preview the saved cycle again before publishing.')
  }
  const summary = disabled || recoveryOnly || sendRetry ? null : page?.summary
  const queuedKnown = queued && status?.status === 'pending' && status.queue_id === queued.id && status.queue_version === queued.version
  const queueMetadata = record?.resolved && record.queueId === queued?.id ? record : previousQueue.current?.queueId === queued?.id ? previousQueue.current : null
  const queuedName = queueMetadata?.name ?? 'Program details unavailable'
  return <section className="ccd-library" aria-label="Publish">
    <h2>{recoveryOnly ? 'Publish recovery' : `Publish to ${athleteName}`}</h2>
    {!recoveryOnly && !input.draft && <p>Choose a saved cycle at the top of the page or start a new one, then press Publish on its sheet.</p>}
    {!recoveryOnly && input.draft && <><p>What was sent to the phone, and anything that needs you.</p>
      <button disabled={disabled || busy || unknown || !ready || Boolean(recoveryError)} onClick={() => void coordinated(() => reviewForPublish(0, null))}>Preview</button>
      {disabled && <p>Save the worksheet to preview it.</p>}</>}
    {busy && <p role="status">Checking the saved cycle…</p>}
    {error && <p role="alert">{error}</p>}{recoveryError && <p role="alert">{recoveryError}</p>}
    {retrySend && <div className="ccd-actions">
      <p role="alert">{sendFailed}</p>
      <button disabled={disabled || busy || recoveryOnly || Boolean(recoveryError)} onClick={() => void coordinated(async () => {
        if (retrySend.epoch === generation.current) await reviewForPublish(retrySend.index, page, retrySend.sendAfterPreview)
      })}>Try again</button>
    </div>}
    {queued && <section aria-label="Queued next program" className="ccd-library">
      <h3>Next program queued</h3><p>{queuedName}{queuedKnown ? ` · ${status.remaining.length ? `${status.remaining.length} workout${status.remaining.length === 1 ? '' : 's'} left` : 'Waiting to start'}` : ''}</p>
      {queuedKnown ? <ul aria-label="Remaining workouts">{status.remaining.map(row => <li key={row.instance_id}>{row.label} · {row.scheduled_on === null ? 'No date' : <time dateTime={row.scheduled_on}>{row.scheduled_on}</time>}</li>)}</ul>
        : <p>Remaining workout details are unavailable in this browser.</p>}
      {queuedKnown && status.last_error && <p role="status">{nextCycleFailureNote(status.last_error)}</p>}
      <button disabled={busy || unknown || recoveryOnly} onClick={() => setDialog('cancel')}>Cancel queued program</button>
    </section>}
    {summary && page && <div aria-label="Publish preview">
      <h3>{summary.name}</h3>
      <p>{summary.start_on} to {summary.end_on} · default unit {summary.unit}</p>
      <p>{summary.week_count} weeks · {summary.totals.exercises} exercise prescriptions · {summary.totals.skipped} explicit skips · {summary.totals.groups} set groups · {summary.totals.sets} physical sets</p>
      <details><summary>Workout dates</summary><ul>{summary.schedule.map(day => <li key={`${day.week}:${day.weekday}`}>Week {day.week} · {day.day} · {day.scheduled_date}{day.marked_rest ? ' · explicit rest' : ''}</li>)}</ul></details>
      <p>Detail page {page.page_index + 1} of {summary.detail_page_count} · {summary.detail_item_count} exercise slots total</p>
      <div className="ccd-actions"><button disabled={busy || page.page_index === 0} onClick={() => void coordinated(() => reviewForPublish(page.page_index - 1, page))}>Previous page</button><button disabled={busy || page.page_index + 1 >= summary.detail_page_count} onClick={() => void coordinated(() => reviewForPublish(page.page_index + 1, page))}>Next page</button></div>
      <ol start={page.items[0].item_index + 1}>{page.items.map(item => <li key={item.item_index}>
        <h4>Week {item.week} · {item.day} · {item.scheduled_date} · {item.name}</h4>
        <p>Worksheet {item.source.name.sheet}!{item.source.name.address} · prescription {item.source.prescription.address} · instructions {item.source.instruction.address}</p>
        {item.status === 'skipped' ? <p>Explicitly skipped.</p> : <><p>Coach prescription: {item.prescription}</p><ol>{item.set_groups.map(group => <li key={group.ordinal}>{describeGroup(group, summary.unit)}</li>)}</ol></>}
        {item.instruction && <p>Coach instructions: {item.instruction}</p>}
      </li>)}</ol>
    </div>}
    <section aria-label="Publish and recovery">
      {!recoveryOnly && input.draft && <button disabled={!ready || Boolean(recoveryError) || disabled || !summary?.publishable || busy || unknown} onClick={() => { if (summary?.expected_pending_id) setDialog('replace'); else void coordinated(() => publish()) }}>Publish to {athleteName}</button>}
      {record && <div><div className="ccd-actions">
        {unknown && !busy && <p role="alert">{sendUnconfirmed}</p>}
        <button disabled={busy} onClick={() => void coordinated(() => checkRetainedStatus())}>Check publish status</button>
        </div>
        {unknown && !recoveryOnly && <button disabled={busy || checkedRequest !== record.input.request_id} onClick={() => void coordinated(() => publish(true))}>Retry publish</button>}
      </div>}
      {unknown && <button disabled={busy || !abandonable} onClick={() => setDialog('abandon')}>Abandon this publish attempt</button>}
      <p ref={statusRegion} tabIndex={-1} role="status" aria-live="polite">{notice}</p>
    </section>
    {dialog === 'abandon' && <QueueDialog label="Abandon this publish attempt" onClose={() => setDialog(null)}>
      <h2>Abandon this publish attempt?</h2><p>The server refused this request and a later status check found no publication. Clear this attempt and review a fresh preview before publishing again.</p>
      <button onClick={() => setDialog(null)}>Keep checking status</button><button onClick={() => void coordinated(abandon)}>Abandon this publish attempt</button>
    </QueueDialog>}
    {(dialog === 'cancel' || dialog === 'replace') && <QueueDialog label={dialog === 'cancel' ? 'Cancel queued program' : 'Replace queued program'} onClose={() => setDialog(null)}>
      <h2>{dialog === 'cancel' ? 'Cancel queued program?' : 'Replace queued program?'}</h2>
      <p>{dialog === 'cancel' ? 'Cancel the queued program? The athlete will stay on their current program.' : `This replaces the queued program${queuedKnown ? ` “${queuedName}”` : ''} with “${summary?.name ?? 'the reviewed program'}”. It will start after the current program is completed or skipped.`}</p>
      <div className="dialog-actions"><button className="button outline" onClick={() => setDialog(null)}>Keep queued program</button><button className="button primary" onClick={() => void coordinated(dialog === 'cancel' ? cancel : () => publish())}>{dialog === 'cancel' ? 'Cancel queued program' : 'Replace and publish'}</button></div>
    </QueueDialog>}
  </section>
}
function QueueDialog({ label, onClose, children }: { label: string; onClose(): void; children: ReactNode }) {
  return <ModalDialog className="modal-backdrop" label={label} onEscape={onClose}><section className="dialog phase4-dialog">{children}</section></ModalDialog>
}
