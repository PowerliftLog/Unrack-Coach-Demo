import { useEffect, useRef, useState } from 'react'
import { CoachExcelBetaPublishError, type createCoachExcelBetaPublishApi, type CoachExcelBetaPublishInput, type CoachExcelBetaPublishReceipt } from './lib/coach-excel-beta-publish-api'
import { coachExcelBetaPublicationRecoveryKey, readCoachExcelBetaPublicationRecovery, COACH_EXCEL_BETA_RECOVERY_CHANGED, type CoachExcelBetaPublicationRecovery } from './coach-excel-publication-recovery'
import { describeGroup } from './CoachCycleServerPreview'
import { CoachExcelBetaPreviewError, isCoachExcelBetaPreviewPage, type CoachExcelBetaPreviewInput, type CoachExcelBetaPreviewPage, type createCoachExcelBetaPreviewApi } from './lib/coach-excel-beta-preview-api'

/** Saved Excel review, gated publication, and recovery of the exact original request. */
type Props = {
  publishApi?: ReturnType<typeof createCoachExcelBetaPublishApi> | null; reviewEpoch?: number
  api: ReturnType<typeof createCoachExcelBetaPreviewApi>; input: Pick<CoachExcelBetaPreviewInput, 'gym' | 'athlete' | 'draft' | 'expected_revision'>
  recoveryOnly?: boolean; gateEpoch: number; sourceHash: string; ownerSubject?: string; disabled: boolean; onConflict(): void; onAccessEnded(allowHistoricalRecovery?: boolean): void
}
type Recovery = CoachExcelBetaPublicationRecovery
export default function CoachExcelBetaSavedDraftPreview(props: Props) {
  return <ExcelPreview key={`${props.ownerSubject}:${props.input.gym}:${props.input.athlete}`} {...props} />
}
function ExcelPreview({ recoveryOnly = false, gateEpoch, api, publishApi, reviewEpoch, input, sourceHash, ownerSubject, disabled, onConflict, onAccessEnded }: Props) {
  let recoveryKey: string | null = null
  try { recoveryKey = coachExcelBetaPublicationRecoveryKey(ownerSubject, { gym: input.gym, athlete: input.athlete }) } catch { /* The initialization effect reports the invalid owner/scope. */ }
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const rejected = useRef(false)
  function readRecovery(): Recovery | null {
    return readCoachExcelBetaPublicationRecovery(ownerSubject, { gym: input.gym, athlete: input.athlete })
  }
  function storeRecovery(value: Recovery | null, resolvedRequest?: string) {
    if (!recoveryKey) throw new Error('Safe publication recovery is unavailable.')
    const existing = readRecovery()
    if (existing && existing.input.request_id !== (value?.input.request_id ?? resolvedRequest)) throw new Error('Another publication request needs recovery before this record can change.')
    if (value && pendingRef.current && !existing) throw new Error('Publication recovery was cleared. Sign in and review again before another request.')
    if (value) window.localStorage.setItem(recoveryKey, JSON.stringify(value))
    else window.localStorage.removeItem(recoveryKey)
    window.dispatchEvent(new CustomEvent(COACH_EXCEL_BETA_RECOVERY_CHANGED, { detail: recoveryKey }))
  }
  const [page, setPage] = useState<CoachExcelBetaPreviewPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState<CoachExcelBetaPublishInput | null>(null)
  const pendingRef = useRef<CoachExcelBetaPublishInput | null>(null)
  const [receipt, setReceipt] = useState<CoachExcelBetaPublishReceipt | null>(null)
  const activeReceipt = recoveryOnly || receipt?.draft_id === input.draft ? receipt : null
  const [publishing, setPublishing] = useState(false)
  const [statusChecked, setStatusChecked] = useState(false)
  const [publicationMessage, setPublicationMessage] = useState('')
  const publicationBusy = useRef(false), generation = useRef(0)
  const binding = JSON.stringify([input.gym, input.athlete, input.draft, input.expected_revision, sourceHash, reviewEpoch, gateEpoch])
  const currentBinding = useRef(binding)
  if (currentBinding.current !== binding) { currentBinding.current = binding; generation.current++ }
  const alive = useRef(true), busy = useRef(false), disabledRef = useRef(disabled)
  disabledRef.current = disabled
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!publishApi) return
    try {
      if (typeof navigator.locks?.request !== 'function') throw new Error('This browser cannot safely coordinate publication recovery across tabs.')
      const saved = readRecovery()
      if (saved) { pendingRef.current = saved.input; rejected.current = saved.rejected; setPending(saved.input); setPublicationMessage('An earlier publication request needs a historical status check before any retry.') }
      setRecoveryReady(true)
    } catch (cause) { setRecoveryError(cause instanceof Error ? cause.message : 'Safe publication recovery is unavailable.') }
    // This component is remounted whenever the authenticated owner or client scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishApi])
  useEffect(() => { setReceipt(null); setPublicationMessage('') }, [input.draft])
  useEffect(() => {
    generation.current++; setPage(null); setConfirmed(false)
  }, [binding, disabled])
  async function checkStatus(original: CoachExcelBetaPublishInput) {
    if (!publishApi) return
    const status = await publishApi.status({ gym: original.gym, athlete: original.athlete, request_id: original.request_id }, original)
    if (!alive.current) return
    if (status.status === 'committed' && status.receipt) {
      storeRecovery(null, original.request_id); pendingRef.current = null; setPending(null); setReceipt(status.receipt); setStatusChecked(false)
      setPublicationMessage('The server confirmed the original request by its immutable receipt.')
    } else if (rejected.current) {
      storeRecovery(null, original.request_id); rejected.current = false; pendingRef.current = null; setPending(null); setStatusChecked(false); setPage(null); setConfirmed(false)
      setPublicationMessage('The server rejected this request and no receipt exists. Reload or re-review the saved draft before preparing a new publication.')
    } else {
      setStatusChecked(true)
      setPublicationMessage('No receipt was visible at this status snapshot. The original request may still complete. Retry keeps the same request ID and saved revision.')
    }
  }
  async function publish(action: 'publish' | 'status' | 'retry') {
    if (!recoveryKey || typeof navigator.locks?.request !== 'function') { setRecoveryError('This browser cannot safely coordinate publication recovery across tabs.'); return }
    try {
      await navigator.locks.request(recoveryKey, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) throw new Error('Another tab is checking or publishing this client cycle. Wait for it to finish, then check the retained request.')
        if (alive.current) await runPublication(action)
      })
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Safe publication coordination is unavailable.') }
  }
  async function runPublication(action: 'publish' | 'status' | 'retry') {
    if (!publishApi || publicationBusy.current || !recoveryReady || recoveryError) return
    if (recoveryOnly && action !== 'status') return
    if (action === 'publish' && (disabled || !page || !confirmed || !authorized || pendingRef.current || activeReceipt)) return
    if (action === 'retry' && (!pendingRef.current || !statusChecked)) return
    if (action === 'status' && !pendingRef.current) return
    publicationBusy.current = true; setPublishing(true); setError('')
    let original = pendingRef.current
    const previouslyUncertain = Boolean(original && !rejected.current)
    try {
      if (action === 'status') { await checkStatus(original!); return }
      if (!original) {
        const stored = readRecovery()
        if (stored) { pendingRef.current = stored.input; rejected.current = stored.rejected; setPending(stored.input); setStatusChecked(false); setPublicationMessage('An earlier publication request needs a status check.'); return }
        original = { ...input, request_id: crypto.randomUUID(), expected_review_hash: page!.summary.review_hash, expected_gate_epoch: gateEpoch }
        storeRecovery({ contract: 'coach-excel-beta-pending/2', input: original, rejected: false }); rejected.current = false
        pendingRef.current = original; setPending(original)
      }
      setStatusChecked(false); setConfirmed(false)
      storeRecovery({ contract: 'coach-excel-beta-pending/2', input: original, rejected: false })
      const result = await publishApi.publish(original, action === 'publish' ? page!.summary : undefined)
      if (!alive.current) return
      storeRecovery(null, original.request_id); pendingRef.current = null; setPending(null); setReceipt(result)
      setPublicationMessage('The server confirmed publication by its immutable receipt.')
    } catch (failure) {
      if (!alive.current) return
      setError(failure instanceof Error ? failure.message : 'The publication outcome could not be confirmed.')
      if (failure instanceof CoachExcelBetaPublishError && ['session_expired','access_denied'].includes(failure.code)) { onAccessEnded(action !== 'status' && failure.code === 'access_denied'); return }
      if (action !== 'status' && original && pendingRef.current) {
        rejected.current = !previouslyUncertain && failure instanceof CoachExcelBetaPublishError && ['blocked','conflict','invalid'].includes(failure.code)
        try { storeRecovery({ contract: 'coach-excel-beta-pending/2', input: original, rejected: rejected.current }) } catch { setRecoveryError('Safe publication recovery could not be updated. Keep the original request for recovery.') }
        setPage(null); setConfirmed(false)
        try { await checkStatus(original) }
        catch (recoveryFailure) {
          if (alive.current && recoveryFailure instanceof CoachExcelBetaPublishError && ['session_expired','access_denied'].includes(recoveryFailure.code)) { onAccessEnded(false); return }
          if (alive.current) setPublicationMessage('Outcome unknown. Check the original request status before retrying. No replacement request has been created.')
        }
      }
    } finally { publicationBusy.current = false; if (alive.current) setPublishing(false) }
  }
  async function preview(pageIndex = 0, retained = page) {
    if (recoveryOnly || disabled || busy.current || publicationBusy.current || pendingRef.current) return
    busy.current = true; setLoading(true); setError('')
    const requestedGeneration = generation.current
    const request = { ...input, page_index: pageIndex, expected_review_hash: retained?.summary.review_hash ?? null, expected_gate_epoch: gateEpoch }
    try {
      const result = await api.preview(request, retained?.summary)
      if (!alive.current || disabledRef.current || generation.current !== requestedGeneration) return
      if (!isCoachExcelBetaPreviewPage(result, request, retained?.summary, ownerSubject) || result.summary.source_hash !== sourceHash
        || retained && (pageIndex === retained.page_index+1 && result.items[0].item_index !== retained.items.at(-1)!.item_index+1
          || pageIndex === retained.page_index-1 && result.items.at(-1)!.item_index !== retained.items[0].item_index-1)) throw new CoachExcelBetaPreviewError('network')
      setPage(result); setConfirmed(false)
    } catch (failure) {
      if (!alive.current || disabledRef.current || generation.current !== requestedGeneration) return
      setPage(null)
      if (failure instanceof CoachExcelBetaPreviewError && ['session_expired','access_denied'].includes(failure.code)) { onAccessEnded(failure.code === 'access_denied'); return }
      if (failure instanceof CoachExcelBetaPreviewError && failure.code === 'conflict') { onConflict(); return }
      setError(failure instanceof CoachExcelBetaPreviewError ? failure.message : 'The Excel preview could not be completed. Try again.')
    } finally { busy.current = false; if (alive.current) setLoading(false) }
  }
  const summary = disabled || recoveryOnly ? null : page?.summary
  // Only a validated /2 preview may authorize a fresh publication.
  const authorized = Boolean(summary?.publication_authorized) && Boolean(summary?.publishable)
  return <section className="ccd-library" aria-label="Excel saved draft preview">
    <h2>{recoveryOnly ? 'Excel publication recovery' : 'Excel saved draft preview'}</h2>
    {recoveryOnly ? <p>Draft access is unavailable. Check the retained request’s historical status before leaving this client.</p> : <p>Preview the saved worksheet and its exact workout dates before reviewing publication.</p>}
    {!recoveryOnly && <><button disabled={disabled || loading || publishing || Boolean(pending)} onClick={() => void preview(0, null)}>Preview saved Excel cycle</button>
    {disabled && <p>Open or save a private draft and verify all worksheet edits before previewing.</p>}</>}
    {loading && <p role="status">Checking the saved Excel revision…</p>}
    {error && <p role="alert">{error}</p>}
    {summary && page && <div aria-label="Excel preview results">
      <h3>{summary.name} · saved revision {summary.draft_revision}</h3>
      <p>{summary.start_on} to {summary.end_on} · default unit {summary.unit}</p>
      <p>{summary.week_count} weeks · {summary.totals.exercises} exercise prescriptions · {summary.totals.skipped} explicit skips · {summary.totals.groups} set groups · {summary.totals.sets} physical sets</p>
      <details><summary>Workout dates</summary><ul>{summary.schedule.map(day => <li key={`${day.week}:${day.weekday}`}>Week {day.week} · {day.day} · {day.scheduled_date}{day.marked_rest ? ' · explicit rest' : ''}</li>)}</ul></details>
      <p>Detail page {page.page_index+1} of {summary.detail_page_count} · {summary.detail_item_count} exercise slots total</p>
      <div className="ccd-actions"><button disabled={disabled || loading || publishing || Boolean(pending) || page.page_index === 0} onClick={() => void preview(page.page_index-1)}>Previous Excel preview page</button><button disabled={disabled || loading || publishing || Boolean(pending) || page.page_index+1 >= summary.detail_page_count} onClick={() => void preview(page.page_index+1)}>Next Excel preview page</button></div>
      <ol start={page.items[0].item_index+1}>{page.items.map(item => <li key={item.item_index}>
        <h4>Week {item.week} · {item.day} · {item.scheduled_date} · {item.name}</h4>
        <p>Worksheet {item.source.name.sheet}!{item.source.name.address} · prescription {item.source.prescription.address} · instructions {item.source.instruction.address}</p>
        {item.status === 'skipped' ? <p>Explicitly skipped.</p> : <><p>Coach prescription: {item.prescription}</p><ol>{item.set_groups.map(group => <li key={group.ordinal}>{describeGroup(group, summary.unit)}</li>)}</ol></>}
        {item.instruction && <p>Coach instructions: {item.instruction}</p>}
      </li>)}</ol>
    </div>}
    {publishApi && <section aria-label="Excel publication and recovery">
      {recoveryError && <p role="alert">{recoveryError}</p>}
      {summary && <label><input type="checkbox" checked={confirmed} disabled={!authorized || publishing || Boolean(pending) || Boolean(activeReceipt)} onChange={event => setConfirmed(event.target.checked)} /> I reviewed saved revision {summary.draft_revision}, including every workout date, exercise, set, instruction and explicit skip.</label>}
      {!recoveryOnly && <><button disabled={!recoveryReady || Boolean(recoveryError) || disabled || !authorized || !confirmed || publishing || Boolean(pending) || Boolean(activeReceipt)} onClick={() => void publish('publish')}>Publish reviewed Excel cycle</button>
      {!authorized && <p>Excel publication is unavailable. The saved server preview must explicitly authorize publishing.</p>}</>}
      {pending && <div><p>Retained request {pending.request_id} · saved revision {pending.expected_revision}. Recover this original request before starting another publication.</p>
        <button disabled={publishing} onClick={() => void publish('status')}>Check Excel publication status</button>
        {!recoveryOnly && <button disabled={publishing || !statusChecked} onClick={() => void publish('retry')}>Retry same Excel publication request</button>}
      </div>}
      {activeReceipt && <p>Server receipt for request {activeReceipt.request_id} · program {activeReceipt.program_id} · assignment {activeReceipt.assignment_id} · immutable revision {activeReceipt.immutable_revision_number}. Authorized when committed; this receipt does not establish current beta access.</p>}
      {publicationMessage && <p role="status">{publicationMessage}</p>}
    </section>}
  </section>
}
