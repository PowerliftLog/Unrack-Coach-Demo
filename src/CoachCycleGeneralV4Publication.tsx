import { useEffect, useRef, useState } from 'react'
import { describeGroup } from './CoachCycleServerPreview'
import type { CoachCycleGeneralV4ClientScope, CoachCycleGeneralV4DraftRecord } from './lib/coach-cycle-general-v4-api'
import { CoachCycleGeneralV4PublicationError, isCoachCycleGeneralV4Preview, isCoachCycleGeneralV4PreviewDetail, isCoachCycleGeneralV4PublishReceipt, isCoachCycleGeneralV4PublicationResult, type createCoachCycleGeneralV4PublicationApi, type CoachCycleGeneralV4Preview, type CoachCycleGeneralV4PublishReceipt } from './lib/coach-cycle-general-v4-publication-api'
import { coachCycleGeneralV4PublicationPending, coachCycleGeneralV4PublicationResolveInput, type CoachCycleGeneralV4PublicationPending } from './lib/coach-cycle-general-v4-publication-pending'
import type { CoachCyclePreviewV2Item } from './lib/coach-cycle-preview-v2-api'
import { archiveCoachCycleGeneralV4PublicationPending, isCoachCycleGeneralV4PublicationFenced, readCoachCycleGeneralV4PublicationPending, removeCoachCycleGeneralV4PublicationPending, storeCoachCycleGeneralV4PublicationPending } from './coach-cycle-general-v4-publication-recovery'

type Review = { summary: CoachCycleGeneralV4Preview; items: CoachCyclePreviewV2Item[]; version: number }
type Historical = { receipt: CoachCycleGeneralV4PublishReceipt; identity: CoachCycleGeneralV4PublicationPending; epoch: number; dismissible: boolean }
const sameIdentity = (left: CoachCycleGeneralV4PublicationPending | null, right: CoachCycleGeneralV4PublicationPending) => Boolean(left && left.owner === right.owner && left.operation === right.operation && left.request === right.request
  && left.scope.gym === right.scope.gym && left.scope.athlete === right.scope.athlete && left.scope.library_generation === right.scope.library_generation && left.scope.client_generation === right.scope.client_generation)
export type CoachCycleGeneralV4PublicationProps = {
  api?: ReturnType<typeof createCoachCycleGeneralV4PublicationApi> | null
  owner: string; scope: CoachCycleGeneralV4ClientScope; athleteName: string
  draft: CoachCycleGeneralV4DraftRecord | null; clean: boolean; version: number; busy: boolean; blocked: boolean
  blockNew?: boolean
  isCurrent(version: number): boolean
  runLocked(action: () => Promise<void>, recovery?: boolean): Promise<void>
  onPendingChange(blocked: boolean): void
  onStorageFailure(): void
  onAccessEnded(code: 'session_expired' | 'access_denied'): void
  checkAuthority(): Promise<boolean>
  onRebind(): void
}

/** This panel shares the worksheet's operation lock. Only the request identity
 * survives reload; the server must reproduce the review from saved source. */
export default function CoachCycleGeneralV4Publication(props: CoachCycleGeneralV4PublicationProps) {
  const { api, owner, scope, athleteName, draft, clean, version, busy, blocked, blockNew, isCurrent, runLocked, onPendingChange, onStorageFailure, onAccessEnded, checkAuthority, onRebind } = props
  const [review, setReview] = useState<Review | null>(null)
  const [confirmed, setConfirmed] = useState('')
  const [pending, setPending] = useState<CoachCycleGeneralV4PublicationPending | null>(null)
  const [historical, setHistorical] = useState<Historical | null>(null)
  const [storageError, setStorageError] = useState('')
  const [message, setMessage] = useState('')
  const active = useRef(true), requestEpoch = useRef(0), reviewRef = useRef<Review | null>(null)
  const scopeKey = JSON.stringify(scope)
  function invalidate() { requestEpoch.current++; reviewRef.current = null; setReview(null); setConfirmed('') }
  function storageFailure() { invalidate(); setHistorical(null); setStorageError('Publication recovery storage could not be verified. No new changes can be sent.'); onStorageFailure() }
  function syncPending() {
    try { const retained = readCoachCycleGeneralV4PublicationPending(owner, scope); setPending(retained); onPendingChange(Boolean(retained)) }
    catch { storageFailure() }
  }
  useEffect(() => {
    active.current = true; syncPending()
    const changed = () => { invalidate(); setHistorical(null); syncPending() }
    window.addEventListener('storage', changed)
    return () => { active.current = false; requestEpoch.current++; window.removeEventListener('storage', changed) }
  }, [owner, scopeKey])
  useEffect(() => { invalidate() }, [api, draft?.draft_id, draft?.revision, draft?.source_hash, clean, version])
  const current = (epoch: number, reviewVersion: number) => active.current && requestEpoch.current === epoch && isCurrent(reviewVersion)
  function currentOperation(identity: CoachCycleGeneralV4PublicationPending, epoch: number) {
    if (!active.current || requestEpoch.current !== epoch) return false
    try {
      const retained = readCoachCycleGeneralV4PublicationPending(owner, scope)
      if (sameIdentity(retained, identity)) return true
      // A storage event can arrive after the network response. Read the durable
      // identity too, and never let an earlier request adopt its replacement.
      invalidate(); setHistorical(null); setPending(retained); onPendingChange(Boolean(retained))
    } catch { storageFailure() }
    return false
  }
  function dismissHistorical(value: Historical) {
    if (!value.dismissible || busy || blocked || storageError || !currentOperation(value.identity, value.epoch)) return
    try {
      removeCoachCycleGeneralV4PublicationPending(value.identity)
      invalidate(); setHistorical(null); syncPending(); onRebind()
    } catch { storageFailure() }
  }
  function failure(error: unknown, publishing = false) {
    invalidate()
    const code = error instanceof CoachCycleGeneralV4PublicationError ? error.code : 'network'
    if (code === 'session_expired' || code === 'access_denied') { setHistorical(null); onAccessEnded(code); return }
    const coordinate = error instanceof CoachCycleGeneralV4PublicationError && error.coordinate ? ` Check cycle!${error.coordinate.address} (row ${error.coordinate.row + 1}, column ${error.coordinate.column + 1}).` : ''
    setMessage(code === 'conflict' || code === 'request_reused' ? 'The saved revision, assignment or authority changed. Load a fresh complete review and confirm it again.'
      : code === 'blocked' ? `The server could not interpret this saved cycle.${coordinate} Correct the worksheet, save it and review again.`
      : code === 'unavailable' ? 'Cycle publication is closed or unavailable on this server. No live publication is authorized. Resolve any retained request before another change.'
      : code === 'retryable' ? 'The server rolled back this attempt during a concurrent change. Load a fresh review before a new explicit publication attempt.'
      : publishing ? 'The publication outcome remains unknown. Resolve the retained request; the original publication is never resent.'
      : 'The complete server review could not be verified. No partial review was retained. Load the saved cycle review again.')
  }
  async function load() {
    if (!api || !draft || !clean || busy || blocked || blockNew || pending || storageError) return
    await runLocked(async () => {
      invalidate(); setMessage('Loading the server interpretation and every detail page…')
      const epoch = requestEpoch.current, reviewVersion = version, input = { ...scope, draft: draft.draft_id, expected_revision: draft.revision }
      try {
        const summary = await api.preview(input)
        if (!current(epoch, reviewVersion)) return
        if (!isCoachCycleGeneralV4Preview(summary, input, owner) || summary.source_hash !== draft.source_hash) throw new CoachCycleGeneralV4PublicationError('conflict')
        const items: CoachCyclePreviewV2Item[] = []
        for (let page = 0; page < summary.detail_page_count; page++) {
          const pageInput = { ...input, expected_review_hash: summary.review_hash, page_index: page }
          const detail = await api.detail(pageInput, summary)
          if (!current(epoch, reviewVersion)) return
          if (!isCoachCycleGeneralV4PreviewDetail(detail, pageInput, summary) || detail.items[0].item_index !== items.length) throw new CoachCycleGeneralV4PublicationError('conflict')
          items.push(...detail.items)
          setMessage(`Verified detail page ${page + 1} of ${summary.detail_page_count}. Confirmation waits for the entire cycle.`)
        }
        const programmed = items.filter(item => item.status === 'programmed')
        const totals = { exercises: programmed.length, skipped: items.length - programmed.length, groups: programmed.reduce((sum, item) => sum + item.set_groups.length, 0), sets: programmed.reduce((sum, item) => sum + item.set_groups.reduce((n, group) => n + group.sets_min, 0), 0) }
        if (items.length !== summary.detail_item_count || items.some((item, index) => item.item_index !== index)
          || Object.entries(totals).some(([key, value]) => summary.totals[key as keyof typeof totals] !== value)
          || new Set(items.map(item => `${item.week}:${item.weekday}:${item.block_id}`)).size !== items.length
          || summary.schedule.some(day => !items.some(item => item.week === day.week && item.weekday === day.weekday))) throw new CoachCycleGeneralV4PublicationError('conflict')
        if (!current(epoch, reviewVersion)) return
        const complete = { summary, items, version: reviewVersion }
        reviewRef.current = complete; setReview(complete); setConfirmed('')
        setMessage(`All ${summary.detail_page_count} detail pages verified under one review hash. Review every item, date and assignment effect below.`)
      } catch (error) { if (current(epoch, reviewVersion)) failure(error) }
    })
  }
  async function retainHistorical(receipt: CoachCycleGeneralV4PublishReceipt, identity: CoachCycleGeneralV4PublicationPending, epoch: number) {
    // An immutable commit receipt does not prove that an assignment is still
    // current. A fresh scope check only permits explicit historical dismissal.
    if (!currentOperation(identity, epoch)) return
    setHistorical({ receipt, identity, epoch, dismissible: false })
    const authorized = await checkAuthority()
    if (!currentOperation(identity, epoch)) return
    if (authorized) {
      setHistorical({ receipt, identity, epoch, dismissible: true })
      setMessage('The server recorded a historical local publication receipt. Its assignment is not proved current. This contract does not authorize live publication. Dismiss the receipt and recheck access before continuing.')
    }
  }
  async function publish() {
    const exact = reviewRef.current
    if (!api || !exact || exact !== review || !draft || !clean || busy || blocked || blockNew || pending || storageError || confirmed !== exact.summary.review_hash || !isCurrent(exact.version)) return
    await runLocked(async () => {
      if (!isCurrent(exact.version) || reviewRef.current !== exact) return
      const input = { ...scope, draft: draft.draft_id, expected_revision: draft.revision, request: crypto.randomUUID(), expected_review_hash: exact.summary.review_hash, expected_current_assignment: exact.summary.expected_current_assignment, expected_assignment_hash: exact.summary.assignment_hash, review_confirmed: true as const }
      const entry = coachCycleGeneralV4PublicationPending(owner, input)
      try { storeCoachCycleGeneralV4PublicationPending(entry) }
      catch { storageFailure(); return }
      setPending(entry); onPendingChange(true); setHistorical(null); invalidate()
      const epoch = requestEpoch.current
      let acknowledged = false
      try {
        const receipt = await api.publish(input)
        acknowledged = true
        if (!currentOperation(entry, epoch)) return
        if (!isCoachCycleGeneralV4PublishReceipt(receipt, input) || receipt.source_hash !== exact.summary.source_hash || receipt.compiled_hash !== exact.summary.compiled_hash || receipt.coverage_hash !== exact.summary.coverage_hash || receipt.projection_hash !== exact.summary.projection_hash
          || receipt.start_on !== exact.summary.start_on || receipt.end_on !== exact.summary.end_on || Object.entries(exact.summary.totals).some(([key, value]) => receipt.totals[key as keyof typeof receipt.totals] !== value)) throw new CoachCycleGeneralV4PublicationError('network')
        await retainHistorical(receipt, entry, epoch)
      } catch (error) {
        if (!currentOperation(entry, epoch)) return
        if (!acknowledged && error instanceof CoachCycleGeneralV4PublicationError && ['conflict','request_reused','retryable','blocked','invalid','access_denied','session_expired'].includes(error.code)) {
          try { removeCoachCycleGeneralV4PublicationPending(entry); syncPending() } catch { storageFailure() }
        }
        failure(error, true)
      }
    })
  }
  async function resolve() {
    if (!api || !pending || busy || blocked || storageError || isCoachCycleGeneralV4PublicationFenced(pending, owner, scope)) return
    const entry = pending
    await runLocked(async () => {
      invalidate(); setHistorical(null)
      const epoch = requestEpoch.current
      if (!currentOperation(entry, epoch)) return
      try {
        const input = coachCycleGeneralV4PublicationResolveInput(entry, owner, scope), result = await api.resolve(input)
        if (!currentOperation(entry, epoch)) return
        if (!isCoachCycleGeneralV4PublicationResult('publish_resolve', result, input)) throw new CoachCycleGeneralV4PublicationError('network')
        if (result.resolution === 'cancelled') {
          try { removeCoachCycleGeneralV4PublicationPending(entry); syncPending() } catch { storageFailure(); return }
          setMessage('The original publication request is permanently cancelled. A late original request cannot commit. Any new publication requires a fresh complete review and explicit confirmation.')
        } else await retainHistorical(result.receipt, entry, epoch)
      } catch (error) {
        if (!currentOperation(entry, epoch)) return
        if (error instanceof CoachCycleGeneralV4PublicationError && error.code === 'session_expired') { failure(error); return }
        if (error instanceof CoachCycleGeneralV4PublicationError && error.code === 'access_denied') { const authorized = await checkAuthority(); if (!currentOperation(entry, epoch) || !authorized) return }
        setMessage('The publication outcome remains unknown. Resolution is unavailable or busy. Keep the request identity and resolve again; no original publication is resent and dismissal stays blocked.')
      }
    }, true)
  }
  const unavailable = busy || blocked || Boolean(pending) || Boolean(storageError)
  const fenced = Boolean(pending && isCoachCycleGeneralV4PublicationFenced(pending, owner, scope))
  const complete = review && isCurrent(review.version) ? review : null
  return <section className="ccg-publication" aria-label="Full cycle server review and publication">
    <h2>Review complete cycle</h2>
    <p>Save the worksheet first. Server review checks every saved prescription, load, instruction and scheduled date before one full-cycle publication request.</p>
    <p className="ccg-publication-boundary">Local contract only. Live publication remains closed until the separate server grants and rollout gates are enabled.</p>
    <button disabled={!api || unavailable || blockNew || !draft || !clean} onClick={() => void load()}>Load complete server review</button>
    {!api && <p>Publication review is disabled for this workspace.</p>}
    {(!draft || !clean) && <p>Open a saved draft and save and verify all current edits before review.</p>}
    <p role={message ? 'status' : undefined}>{message}</p>{storageError && <p role="alert">{storageError}</p>}
    {pending && <aside className="ccg-pending" aria-label="Publication recovery"><strong>Unconfirmed full-cycle publication</strong><p>Request {pending.request}. Only owner, scope, operation and request identity are retained on this device. Resolution never sends worksheet text or the original publication again.</p>
      {fenced ? <><p>This request belongs to a retired authority generation. Its outcome is unknown and it may already have committed. Archiving its local identity does not cancel the request or prove its outcome.</p><button disabled={busy || blocked || Boolean(storageError)} onClick={() => { if (!currentOperation(pending, requestEpoch.current)) return; try { archiveCoachCycleGeneralV4PublicationPending(pending, owner, scope); invalidate(); setHistorical(null); syncPending(); onRebind() } catch { storageFailure() } }}>Archive unresolved publication and recheck access</button></>
        : <button disabled={!api || busy || blocked || Boolean(storageError)} onClick={() => void resolve()}>Resolve uncertain publication</button>}
      {historical && historical.epoch === requestEpoch.current && sameIdentity(pending, historical.identity) && <div><h3>Historical publication receipt</h3><p>Program {historical.receipt.program_id} · assignment {historical.receipt.assignment_id} · immutable revision {historical.receipt.immutable_revision_number}. This proves a past local commit; it does not prove a current assignment or live delivery.</p><button disabled={!historical.dismissible || busy || blocked || Boolean(storageError)} onClick={() => dismissHistorical(historical)}>Dismiss historical publication and recheck access</button></div>}
    </aside>}
    {complete && <section aria-label="Complete server cycle details"><h3>{complete.summary.name} · saved revision {complete.summary.draft_revision}</h3><p>{complete.summary.start_on} to {complete.summary.end_on} · {complete.summary.week_count} weeks · {complete.summary.unit}</p>
      <p>{complete.summary.totals.exercises} programmed items · {complete.summary.totals.skipped} explicit skips · {complete.summary.totals.groups} set groups · {complete.summary.totals.sets} sets</p>
      <section className="ccg-assignment" aria-label="Exact assignment effect"><h3>Assignment effect for {athleteName}</h3>{complete.summary.current_assignment ? <><p>Current active assignment: <code>{complete.summary.current_assignment.assignment_id}</code> · program <code>{complete.summary.current_assignment.program_id ?? 'none'}</code> · revision <code>{complete.summary.current_assignment.current_revision_id ?? 'none'}</code>.</p><dl>{Object.entries(complete.summary.current_assignment).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value === null ? 'none' : String(value)}</dd></div>)}</dl></> : <p>No current active assignment. The reviewed cycle would become the active assignment.</p>}
        <p>Publish the entire cycle as a new active assignment. Pause the previous active assignment, if present, and retire only its not-started workout instances. Preserve started and completed instances.</p>
        <p>Assignment hash: <code>{complete.summary.assignment_hash}</code></p></section>
      {complete.summary.schedule.map(day => <section key={`${day.week}:${day.weekday}`} className="ccg-publication-day" aria-label={`${day.day} week ${day.week} server review`}><h3>Week {day.week} · {day.day} · {day.scheduled_date}</h3>{day.marked_rest && <p>Explicit rest day: all exercise blocks skipped.</p>}
        {complete.items.filter(item => item.week === day.week && item.weekday === day.weekday).map(item => <article key={item.item_index}><h4>{item.name} {item.status === 'skipped' && '· SKIP'}</h4>
          <p>Name source: cycle!{item.source.name.address} · row {item.source.name.row + 1}, column {item.source.name.column + 1}</p>
          <p>Coach prescription: {item.prescription} · source cycle!{item.source.prescription.address} · row {item.source.prescription.row + 1}, column {item.source.prescription.column + 1}</p>
          <ol>{item.set_groups.map(group => <li key={group.ordinal}>{describeGroup(group, complete.summary.unit)}<p>Group {group.ordinal} source: cycle!{item.group_source[group.ordinal - 1].source.address} · {item.group_source[group.ordinal - 1].raw}</p></li>)}</ol>
          <p className="ccg-instruction">Coach instructions: {item.instruction || '(blank)'} · source cycle!{item.source.instruction.address} · row {item.source.instruction.row + 1}, column {item.source.instruction.column + 1}</p>
        </article>)}
      </section>)}
      <p>Review hash: <code>{complete.summary.review_hash}</code></p>
      <label className="ccg-publication-confirmation"><input type="checkbox" disabled={unavailable} checked={confirmed === complete.summary.review_hash} onChange={event => setConfirmed(event.target.checked ? complete.summary.review_hash : '')} />I reviewed every item and scheduled date for {athleteName}, and confirm this exact review hash, current assignment and full-cycle activation effect.</label>
      <button disabled={unavailable || blockNew || confirmed !== complete.summary.review_hash || !clean} onClick={() => void publish()}>Publish complete reviewed cycle</button>
    </section>}
  </section>
}
