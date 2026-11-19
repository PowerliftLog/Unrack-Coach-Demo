import { useEffect, useRef, useState } from 'react'
import { CoachCycleCommitV2Error, type createCoachCycleCommitV2Api, type CoachCycleCommitV2Receipt } from './lib/coach-cycle-commit-v2-api'
import { openBrowserCoachCyclePendingV2, type CoachCyclePendingV2, type CoachCyclePendingV2Controller, type CoachCyclePendingV2Scope } from './lib/coach-cycle-pending-v2'
import type { CoachCyclePreviewV2Summary } from './lib/coach-cycle-preview-v2-api'

type Props = {
  api: ReturnType<typeof createCoachCycleCommitV2Api>; scope: CoachCyclePendingV2Scope
  review: CoachCyclePreviewV2Summary | null; disabled?: boolean
  openPending?: (getOwnerSubject: () => string | null) => Promise<CoachCyclePendingV2Controller>
  onPendingStored?(): void
  onReviewInvalidated(): void; onAccessEnded(): void
}
/** The controller owns durable intent; React state is only a display of it. */
export default function CoachCycleV2Publish({ api, scope, review, disabled, openPending = openBrowserCoachCyclePendingV2, onPendingStored, onReviewInvalidated, onAccessEnded }: Props) {
  const [controller, setController] = useState<CoachCyclePendingV2Controller | null>(null)
  const [pending, setPending] = useState<CoachCyclePendingV2 | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [statusChecked, setStatusChecked] = useState(false)
  const [receipt, setReceipt] = useState<CoachCycleCommitV2Receipt | null>(null)
  const [message, setMessage] = useState('Opening safe publication recovery…')
  const [error, setError] = useState('')
  const alive = useRef(false)
  const owner = useRef<string | null>(scope.owner)
  const inFlight = useRef(false)
  const openerSequence = useRef<Promise<void>>(Promise.resolve())
  const scopeKey = JSON.stringify(scope)
  useEffect(() => {
    alive.current = true; owner.current = scope.owner
    let effectActive = true
    let opened: CoachCyclePendingV2Controller | undefined
    const task = openerSequence.current.catch(() => {}).then(async () => {
      if (!effectActive) return
      const value = await openPending(() => owner.current)
      opened = value
      if (!effectActive) { await Promise.resolve(value.close()); return }
      try { const retained = value.pending(scope); setPending(retained); setController(value); setMessage(retained ? 'A previous publication request needs historical status recovery. Its exact input is retained.' : '') }
      catch (cause) { await Promise.resolve(value.close()); if (effectActive) setError(cause instanceof Error ? cause.message : 'Recovery could not be opened.') }
    }).catch(cause => { if (effectActive) setError(cause instanceof Error ? cause.message : 'Recovery could not be opened.') })
    openerSequence.current = task
    return () => {
      effectActive = false; alive.current = false; owner.current = null
      if (opened) { const release = Promise.resolve(opened.close()); openerSequence.current = openerSequence.current.then(() => release) }
    }
    // The parent remounts this component for every scope binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPending, scopeKey])
  // Reset during render, not in an effect: a passive effect can run after a fast click and untick it.
  const [confirmedFor, setConfirmedFor] = useState({ review, disabled })
  if (confirmedFor.review !== review || confirmedFor.disabled !== disabled) { setConfirmedFor({ review, disabled }); setConfirmed(false) }
  const authorized = review?.publication_authorized === true && review.authorization_contract === 'coach-cycle-pilot-authorized/1' && review.local_only === false
  function resolved(value: CoachCycleCommitV2Receipt) {
    setPending(null); setReceipt(value); setStatusChecked(false); setConfirmed(false)
    setMessage('Publication is confirmed by its immutable receipt. Historical confirmation remains valid if a later assignment supersedes it.')
  }
  async function checkStatus(value: CoachCyclePendingV2, c: CoachCyclePendingV2Controller) {
    const status = await api.status(c.statusInput(scope, value.input.request_id), value.input)
    if (!alive.current) return
    const result = c.resolveStatus(scope, value.input.request_id, status)
    if (result) resolved(result)
    else { setStatusChecked(true); setMessage('No receipt was visible at this status snapshot. The original request may still complete. Retry uses the same request ID and exact input.') }
  }
  async function run(action: 'publish' | 'status' | 'retry') {
    if (!controller || inFlight.current || !alive.current) return
    if (action === 'publish' && (disabled || !authorized || !confirmed || pending || receipt)) return
    if (action === 'retry' && (!pending || !statusChecked || pending.review.authorization_contract !== 'coach-cycle-pilot-authorized/1')) return
    inFlight.current = true; setBusy(true); setError('')
    let pinned: CoachCyclePendingV2 | null = pending
    try {
      if (action === 'status') { if (pinned) await checkStatus(pinned, controller); return }
      if (!pinned) { pinned = controller.prepare(scope, review!); setPending(pinned); onPendingStored?.() }
      const input = controller.inputForDispatch(scope, pinned.input.request_id)
      setPending(controller.pending(scope)); setStatusChecked(false)
      const result = await api.commit(input, action === 'publish' ? review! : undefined)
      if (!alive.current) return
      resolved(controller.resolveCommit(scope, input.request_id, result))
    } catch (cause) {
      if (!alive.current) return
      if (pinned) {
        try { setPending(controller.noteFailure(scope, pinned.input.request_id)) } catch { /* Keep the display pinned if storage/owner ended. */ }
      }
      setError(cause instanceof Error ? cause.message : 'The publication outcome could not be confirmed.')
      if (cause instanceof CoachCycleCommitV2Error && (cause.code === 'session_expired' || cause.code === 'access_denied')) { onAccessEnded(); return }
      if (action !== 'status' && pinned) {
        onReviewInvalidated()
        try { await checkStatus(pinned, controller) }
        catch { if (alive.current) setMessage('Outcome unknown. Keep this request and check historical status before retrying. No replacement request was created.') }
      }
    } finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  function discard() {
    if (!controller || !pending || inFlight.current) return
    if (!window.confirm('Discard this browser recovery record? This does not cancel publication: the original request may still complete. Check historical status first. A later request would be separate.')) return
    try { controller.discard(scope, pending.input.request_id); setPending(null); setStatusChecked(false); setConfirmed(false); onReviewInvalidated(); setMessage('Browser recovery discarded explicitly. No server publication was cancelled. Load and review the saved cycle again before preparing another request.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Recovery could not be discarded.') }
  }
  return <section aria-label="Cycle publication and recovery">
    {review && <label><input type="checkbox" checked={confirmed} disabled={busy || disabled || !authorized || !!pending || !!receipt} onChange={event => setConfirmed(event.target.checked)} /> I reviewed the full cycle, including every week, exercise, load, instruction and explicit skip.</label>}
    <button disabled={!controller || busy || disabled || !authorized || !confirmed || !!pending || !!receipt} onClick={() => void run('publish')}>Publish reviewed cycle</button>
    {!authorized && <p>Publication is closed until the saved review has database authorization for this pilot.</p>}
    {pending && <div><p>Retained request: {pending.input.request_id}. Recover this request before starting another publication.</p>
      <button disabled={busy} onClick={() => void run('status')}>Check publication status</button>
      <button disabled={busy || !statusChecked || pending.review.authorization_contract !== 'coach-cycle-pilot-authorized/1'} onClick={() => void run('retry')}>Retry same publication request</button>
      <button disabled={busy || !statusChecked} onClick={discard}>Discard browser recovery record</button>
    </div>}
    {receipt && <p>Published program {receipt.program_id} · assignment {receipt.assignment_id} · immutable revision {receipt.immutable_revision_number} · request {receipt.request_id}.</p>}
    <p role="status" aria-live="polite">{message}</p>{error && <p role="alert">{error}</p>}
  </section>
}
