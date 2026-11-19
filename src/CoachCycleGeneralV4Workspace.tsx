import { useEffect, useRef, useState } from 'react'
import type { Sheet } from '@fortune-sheet/core'
import CoachSheetEditorProof, { type CoachSheetDraft } from './review/CoachSheetEditorProof'
import { extractCoachCycleTemplate } from './lib/coach-cycle-template'
import { isCoachCycleTemplateSnapshot, type CoachCycleTemplateSnapshot } from './lib/coach-cycle-template-api'
import { CoachCycleGeneralV4Error, isCoachCycleGeneralV4Uuid, type createCoachCycleGeneralV4Api, type CoachCycleGeneralV4BindResult, type CoachCycleGeneralV4ClientScope, type CoachCycleGeneralV4Cursor, type CoachCycleGeneralV4DraftRecord, type CoachCycleGeneralV4DraftSummary, type CoachCycleGeneralV4Receipt, type CoachCycleGeneralV4TemplateRecord, type CoachCycleGeneralV4TemplateSummary } from './lib/coach-cycle-general-v4-api'
import './coach-cycle-general-v4-workspace.css'
import CoachCycleGeneralV4Publication from './CoachCycleGeneralV4Publication'
import CoachCycleGeneralV5Publication from './CoachCycleGeneralV5Publication'
import type { createCoachCycleGeneralV4PublicationApi } from './lib/coach-cycle-general-v4-publication-api'
import type { createCoachCycleGeneralV5PublicationApi } from './lib/coach-cycle-general-v5-publication-api'
import { readCoachCycleGeneralV4PublicationPending } from './coach-cycle-general-v4-publication-recovery'
import { readCoachCycleGeneralV5PublicationPending } from './coach-cycle-general-v5-publication-recovery'
import { archiveCoachCycleGeneralV4Pending, coachCycleGeneralV4ResolveInput, isCoachCycleGeneralV4PendingFenced, readCoachCycleGeneralV4Pending, removeCoachCycleGeneralV4Pending, storeCoachCycleGeneralV4Pending, type CoachCycleGeneralV4Pending as Pending } from './coach-cycle-general-v4-pending'

export type CoachCycleGeneralV4WorkspaceProps = {
  api: ReturnType<typeof createCoachCycleGeneralV4Api>
  publicationApi?: ReturnType<typeof createCoachCycleGeneralV4PublicationApi> | null
  publicationV5Api?: ReturnType<typeof createCoachCycleGeneralV5PublicationApi> | null
  ownerSubject: string
  gym: string
  athlete: string
  athleteName: string
  onBack(): void
}
const snapshot = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
// Roster display text is not worksheet identity or reusable content. An explicit
// save always supplies the latest selected roster label; SQL decides acceptance.
const sameWorksheet = (left: CoachSheetDraft, right: CoachCycleGeneralV4DraftRecord['source']) => snapshot({ ...left, intake: { ...left.intake, client: '' } }) === snapshot({ ...right, intake: { ...right.intake, client: '' } })

/** PostgreSQL jsonb::text for this validated, fixed-ASCII-key semantic envelope.
 * JSONB sorts object keys by UTF-8 byte length then bytes. Values contain only
 * strings, arrays and the bounded integer week count. Reject text PostgreSQL
 * cannot represent before computing a confirmation hash.
 */
export function coachCycleReusableJsonbText(value: CoachCycleTemplateSnapshot): string {
  if (!isCoachCycleTemplateSnapshot(value)) throw new Error('Invalid reusable content')
  const encode = (item: unknown): string => {
    if (typeof item === 'string') {
      if (/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(item)) throw new Error('Unsupported reusable text')
      return JSON.stringify(item)
    }
    if (typeof item === 'number' && Number.isSafeInteger(item)) return String(item)
    if (Array.isArray(item)) return `[${item.map(encode).join(', ')}]`
    if (item && typeof item === 'object') return `{${Object.entries(item).sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).map(([key, child]) => `${JSON.stringify(key)}: ${encode(child)}`).join(', ')}}`
    throw new Error('Unsupported reusable content')
  }
  return encode(value)
}
export async function hashCoachCycleReusableContent(value: CoachCycleTemplateSnapshot): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(coachCycleReusableJsonbText(value)))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Owner, gym or target changes destroy the complete binding/editor/review tree. */
export default function CoachCycleGeneralV4Workspace(props: CoachCycleGeneralV4WorkspaceProps) {
  return <BindingWorkspace key={`${props.ownerSubject}:${props.gym}:${props.athlete}`} {...props} />
}
function BindingWorkspace(props: CoachCycleGeneralV4WorkspaceProps) {
  const [bound, setBound] = useState<{ api: CoachCycleGeneralV4WorkspaceProps['api']; binding: CoachCycleGeneralV4BindResult } | null>(null)
  const binding = bound?.api === props.api ? bound.binding : null
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setBound(null); setError('')
    if (![props.ownerSubject, props.gym, props.athlete].every(isCoachCycleGeneralV4Uuid)) { setError('Select a signed-in owner and an authorized client.'); return }
    void props.api.bind({ gym: props.gym, athlete: props.athlete }).then(result => {
      if (!cancelled) setBound({ api: props.api, binding: result })
    }, () => { if (!cancelled) setError('Client access could not be confirmed. Return to the roster or recheck access.') })
    return () => { cancelled = true }
  }, [props.api, props.ownerSubject, props.gym, props.athlete, retry])
  const rebind = () => { setBound(null); setRetry(value => value + 1) }
  if (!binding) return <section className="ccg-workspace"><button onClick={props.onBack}>Back to clients</button><p role={error ? 'alert' : 'status'}>{error || 'Confirming current client access…'}</p>{error && <button onClick={rebind}>Recheck access</button>}</section>
  return <BoundWorkspace key={`${binding.library_generation}:${binding.client_generation}`} {...props} binding={binding} onRebind={rebind} />
}
function BoundWorkspace({ api, publicationApi, publicationV5Api, ownerSubject, gym, athlete, athleteName, onBack, binding, onRebind }: CoachCycleGeneralV4WorkspaceProps & { binding: CoachCycleGeneralV4BindResult; onRebind(): void }) {
  const scope: CoachCycleGeneralV4ClientScope = { gym, athlete, library_generation: binding.library_generation, client_generation: binding.client_generation }
  const library = { gym, library_generation: binding.library_generation }
  const life = useRef(0)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(true)
  const [fatal, setFatal] = useState(false)
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<CoachCycleGeneralV4DraftSummary[]>([])
  const [templates, setTemplates] = useState<CoachCycleGeneralV4TemplateSummary[]>([])
  const [draftCursor, setDraftCursor] = useState<CoachCycleGeneralV4Cursor | null>(null)
  const [templateCursor, setTemplateCursor] = useState<CoachCycleGeneralV4Cursor | null>(null)
  const [recoveryError, setRecoveryError] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [historical, setHistorical] = useState(false)
  const [publicationBlocked, setPublicationBlocked] = useState(false)
  const [otherPublicationPending, setOtherPublicationPending] = useState('')
  const publicationEpoch = useRef(0)
  const [publicationVersion, setPublicationVersion] = useState(0)
  function invalidatePublication() { publicationEpoch.current++; setPublicationVersion(publicationEpoch.current) }
  const [opened, setOpened] = useState<{ record: CoachCycleGeneralV4DraftRecord | null; mount: number } | null>(null)
  const openedRef = useRef(opened)
  const edits = useRef<CoachSheetDraft | null>(null)
  const [clean, setClean] = useState(false)
  const [review, setReview] = useState<CoachCycleTemplateSnapshot | null>(null)
  const reviewEpoch = useRef(0)
  const [reviewHash, setReviewHash] = useState('')
  const [confirmedHash, setConfirmedHash] = useState('')
  const [selected, setSelected] = useState<CoachCycleGeneralV4TemplateRecord | null>(null)
  const [start, setStart] = useState('')
  const [unit, setUnit] = useState<'' | 'lb' | 'kg'>('')
  const [applicationConfirmed, setApplicationConfirmed] = useState(false)
  const current = (epoch: number) => life.current === epoch
  const sameBinding = (value: CoachCycleGeneralV4BindResult) => value.gym_id === gym && value.athlete_id === athlete && value.library_generation === scope.library_generation && value.client_generation === scope.client_generation
  function otherVersionPublicationPending() {
    if (publicationV5Api && readCoachCycleGeneralV4PublicationPending(ownerSubject, scope)) return 'A v4 publication request is still unresolved. Resolve it through the v4 recovery path before using exact-start publication.'
    if (!publicationV5Api && readCoachCycleGeneralV5PublicationPending(ownerSubject, scope)) return 'A v5 publication request is still unresolved. Resolve it through the v5 recovery path before making another change.'
    return ''
  }
  const editorDraft = (record: CoachCycleGeneralV4DraftRecord): CoachSheetDraft => ({ ...record.source, intake: { ...record.source.intake, client: athleteName }, sheets: record.source.sheets as Sheet[] })
  function clearReview() { invalidatePublication(); reviewEpoch.current++; setReview(null); setReviewHash(''); setConfirmedHash('') }
  function open(record: CoachCycleGeneralV4DraftRecord | null) {
    clearReview()
    const next = { record, mount: (openedRef.current?.mount ?? 0) + 1 }
    openedRef.current = next; setOpened(next)
    edits.current = record ? editorDraft(record) : null
    setClean(Boolean(record))
  }
  function replaceAllowed() {
    const record = openedRef.current?.record
    return !edits.current || Boolean(record && sameWorksheet(edits.current, record.source)) || window.confirm('Discard unsaved worksheet edits? Save draft first to keep them.')
  }
  function fail(error: unknown) {
    if (error instanceof CoachCycleGeneralV4Error && ['session_expired', 'access_denied'].includes(error.code)) {
      life.current++; setFatal(true); openedRef.current = null; edits.current = null; setOpened(null); setDrafts([]); setTemplates([]); setSelected(null); clearReview()
      setMessage('Access ended. Return to the roster and confirm the current client before continuing.')
    } else setMessage(error instanceof CoachCycleGeneralV4Error && ['conflict', 'invalid', 'request_reused'].includes(error.code)
      ? 'The saved revision, reusable content or roster label could not be accepted. Your edits remain here. Recheck access and reload the current saved draft before continuing.'
      : 'The request could not be confirmed. Check operation status before making another change.')
  }
  async function pages(epoch: number) {
    const [draftPage, templatePage] = await Promise.all([
      api.list({ ...scope, kind: 'draft', page_limit: 100, cursor: null }),
      api.list({ ...library, athlete: null, client_generation: null, kind: 'template', page_limit: 100, cursor: null }),
    ])
    if (!current(epoch)) return
    setDrafts(draftPage.items as CoachCycleGeneralV4DraftSummary[]); setDraftCursor(draftPage.next_cursor)
    setTemplates(templatePage.items as CoachCycleGeneralV4TemplateSummary[]); setTemplateCursor(templatePage.next_cursor)
  }
  async function refreshVerifiedPages(epoch: number) {
    await pages(epoch).catch(error => {
      if (!current(epoch)) return
      if (error instanceof CoachCycleGeneralV4Error && ['access_denied', 'session_expired'].includes(error.code)) fail(error)
      else setMessage('Operation verified. The library list could not be refreshed; recheck access to reload it.')
    })
  }
  useEffect(() => {
    const epoch = ++life.current
    busyRef.current = true
    try {
      setPending(readCoachCycleGeneralV4Pending(ownerSubject, scope))
      setOtherPublicationPending(otherVersionPublicationPending())
    }
    catch { setRecoveryError('Operation recovery storage is unavailable or invalid. No changes can be sent from this tab.') }
    const changed = () => {
      try { setOtherPublicationPending(otherVersionPublicationPending()) }
      catch { setRecoveryError('Publication recovery storage is unavailable. No changes can be sent.') }
    }
    window.addEventListener('storage', changed)
    void pages(epoch).catch(error => { if (current(epoch)) fail(error) }).finally(() => { if (current(epoch)) { busyRef.current = false; setBusy(false) } })
    return () => { life.current++; reviewEpoch.current++; window.removeEventListener('storage', changed) }
  }, [])
  async function readAction(action: (epoch: number) => Promise<void>) {
    if (busyRef.current || fatal) return
    busyRef.current = true; setBusy(true)
    const epoch = life.current
    try { await action(epoch) } catch (error) { if (current(epoch)) fail(error) }
    finally { if (current(epoch)) { busyRef.current = false; setBusy(false) } }
  }
  async function readDraft(id: string, receipt?: CoachCycleGeneralV4Receipt) {
    const record = await api.draftRead({ ...scope, draft: id })
    if (record.target_binding.gym_id !== gym || record.target_binding.athlete_id !== athlete || record.target_binding.library_generation !== scope.library_generation || record.target_binding.client_generation !== scope.client_generation
      || receipt && (!('source_hash' in receipt) || record.revision !== receipt.revision || record.source_hash !== receipt.source_hash)) throw new CoachCycleGeneralV4Error('conflict')
    return record
  }
  async function verifyReceipt(receipt: CoachCycleGeneralV4Receipt, operation: Pending['operation'], epoch: number) {
    if (operation === 'save' || operation === 'apply') {
      if (!('draft_id' in receipt) || !('source_hash' in receipt)) throw new CoachCycleGeneralV4Error('invalid')
      const record = await readDraft(receipt.draft_id, receipt)
      if (current(epoch)) {
        if (operation === 'save' && edits.current && !sameWorksheet(edits.current, record.source)) {
          const next = { record, mount: openedRef.current?.mount ?? 0 }
          openedRef.current = next; setOpened(next); setClean(false); clearReview()
          setMessage('Saved revision verified. Newer edits remain unsaved in this editor and need fresh review.')
        } else { open(record); setMessage(operation === 'apply' ? 'Template applied to an independent saved target draft and read back. Review every prescription, literal load and instruction again before a full-cycle server review.' : 'Draft saved and verified against the current server revision. Fresh review is required.') }
      }
    } else if (operation === 'capture') {
      if (!('template_id' in receipt) || !('snapshot_hash' in receipt)) throw new CoachCycleGeneralV4Error('invalid')
      const record = await api.templateRead({ ...library, template: receipt.template_id })
      if (record.revision !== receipt.revision || record.snapshot_hash !== receipt.snapshot_hash) throw new CoachCycleGeneralV4Error('conflict')
      if (current(epoch)) { clearReview(); setMessage('Reviewed template saved and read back from the server.') }
    } else if (current(epoch)) { if (operation === 'delete') { setOpened(null); openedRef.current = null; edits.current = null; clearReview() } else setSelected(null); setMessage('Deletion acknowledged by Coach storage.') }
  }
  async function mutate(operation: Pending['operation'], send: () => Promise<CoachCycleGeneralV4Receipt>, request: string) {
    if (busyRef.current || pending || publicationBlocked || fatal || recoveryError) throw new Error('Resolve the current operation first')
    try {
      if (readCoachCycleGeneralV4Pending(ownerSubject, scope) || readCoachCycleGeneralV4PublicationPending(ownerSubject, scope)
        || readCoachCycleGeneralV5PublicationPending(ownerSubject, scope)) throw new Error('Resolve the current operation first')
    } catch (error) { setRecoveryError('A retained operation or unreadable recovery record blocks new changes. Resolve it or recheck access.'); throw error }
    if (operation === 'apply' && !replaceAllowed()) throw new Error('Application cancelled')
    const epoch = life.current, entry: Pending = { owner: ownerSubject, scope, request, operation }, sourceRecord = openedRef.current?.record
    try { storeCoachCycleGeneralV4Pending(entry) }
    catch { setRecoveryError('Operation recovery storage could not be verified. No request was sent.'); throw new Error('Operation recovery unavailable') }
    busyRef.current = true; setBusy(true)
    invalidatePublication()
    if (operation !== 'capture') clearReview()
    if (operation === 'apply') { setStart(''); setUnit(''); setApplicationConfirmed(false) }
    setPending(entry); setHistorical(false)
    let acknowledged = false
    try {
      const receipt = await send()
      acknowledged = true
      if (!current(epoch)) return
      await verifyReceipt(receipt, operation, epoch)
      if (!current(epoch)) return
      removeCoachCycleGeneralV4Pending(entry); setPending(null)
      await refreshVerifiedPages(epoch)
    } catch (error) {
      if (current(epoch)) {
        // Explicit rejection is not an uncertain write. Lost/malformed responses
        // and readback failures retain only the source-free operation identity.
        if (!acknowledged && error instanceof CoachCycleGeneralV4Error && ['conflict', 'invalid', 'request_reused', 'access_denied', 'session_expired', 'retryable'].includes(error.code)) { removeCoachCycleGeneralV4Pending(entry); setPending(null) }
        if (!acknowledged && operation === 'capture' && error instanceof CoachCycleGeneralV4Error && error.code === 'access_denied') {
          // SQL uses the same 403 for a policy refusal and authority loss. Only
          // the send itself can be a rolled-back refusal; a successful capture
          // followed by failed template readback remains an uncertain write.
          let stillAuthorized = false
          try {
            const fresh = await api.bind({ gym, athlete })
            if (current(epoch) && sameBinding(fresh) && sourceRecord) {
              const freshDraft = await readDraft(sourceRecord.draft_id)
              stillAuthorized = freshDraft.draft_id === sourceRecord.draft_id && freshDraft.revision === sourceRecord.revision && freshDraft.source_hash === sourceRecord.source_hash
            }
          } catch { /* No independent current-authority proof: clear private UI. */ }
          if (current(epoch)) {
            if (stillAuthorized) setMessage('Template capture was refused under the current policy. Applied copies cannot become templates in this release; start an original draft. Your worksheet and reusable review remain here.')
            else fail(error)
          }
        } else if (!acknowledged && error instanceof CoachCycleGeneralV4Error && error.code === 'retryable') setMessage('The server rolled back this operation because it was busy. Your edits remain here. Make a new explicit save or template attempt when ready.')
        else {
          fail(error)
          if (operation === 'capture' && error instanceof CoachCycleGeneralV4Error && error.code === 'invalid') setMessage('Template capture was refused. Check reusable text and the current saved revision. Your worksheet and reusable review remain here.')
        }
      }
      throw error
    } finally { if (current(epoch)) { busyRef.current = false; setBusy(false) } }
  }
  async function save(source: CoachSheetDraft) {
    const record = openedRef.current?.record
    const normalized = { ...source, intake: { ...source.intake, client: athleteName } }
    const request = crypto.randomUUID()
    await mutate('save', () => api.draftSave({ ...scope, request, draft: record?.draft_id ?? null, expected_revision: record?.revision ?? 0, source: JSON.parse(JSON.stringify(normalized)) }), request)
  }
  function updateReview(value: CoachCycleTemplateSnapshot) { invalidatePublication(); reviewEpoch.current++; setReview(value); setReviewHash(''); setConfirmedHash('') }
  async function capture() {
    const record = openedRef.current?.record
    if (!record || !review || !clean || !reviewHash || confirmedHash !== reviewHash) return
    const epoch = reviewEpoch.current, lifecycle = life.current, reviewed = structuredClone(review), expected = reviewHash, confirmation = confirmedHash
    const hash = await hashCoachCycleReusableContent(reviewed)
    if (!current(lifecycle) || reviewEpoch.current !== epoch || hash !== expected || hash !== confirmation) return
    const request = crypto.randomUUID()
    await mutate('capture', () => api.templateCapture({ ...scope, request, draft: record.draft_id, expected_revision: record.revision, expected_source_hash: record.source_hash, reviewed_snapshot: reviewed, reviewed_hash: hash, confirmed: true }), request)
  }
  function beginReview() {
    if (!opened?.record || !clean || !edits.current) return
    try { updateReview(extractCoachCycleTemplate(opened.record.source)) }
    catch { setMessage('This worksheet has unsupported material cells. Correct them before reusable-content review.') }
  }
  useEffect(() => {
    const epoch = ++reviewEpoch.current
    setReviewHash(''); setConfirmedHash('')
    if (review) void hashCoachCycleReusableContent(review).then(hash => { if (reviewEpoch.current === epoch) setReviewHash(hash) }, () => { if (reviewEpoch.current === epoch) setMessage('Reusable text cannot be hashed. Remove unsupported text before saving a template.') })
  }, [review])
  async function permitHistoricalDismissal(epoch: number) {
    let fresh: CoachCycleGeneralV4BindResult
    try { fresh = await api.bind({ gym, athlete }) }
    catch (error) { if (current(epoch)) fail(error); return }
    if (!current(epoch)) return
    if (!sameBinding(fresh)) { onRebind(); return }
    setHistorical(true)
    setMessage('The request committed, but the current object could not be verified. This is a historical receipt only; no object is restored. You may dismiss it and recheck access before continuing.')
  }
  async function resolvePending(entry: Pending, epoch: number) {
    setHistorical(false)
    const input = coachCycleGeneralV4ResolveInput(entry, ownerSubject, scope)
    let result
    try { result = await api.resolve(input) }
    catch (error) {
      if (!current(epoch)) return
      if (error instanceof CoachCycleGeneralV4Error && error.code === 'access_denied') {
        // A denied resolver is no terminal decision. Rebind to distinguish
        // unavailable RPC authority from revoked target authority.
        let fresh: CoachCycleGeneralV4BindResult
        try { fresh = await api.bind({ gym, athlete }) }
        catch (bindingError) { if (current(epoch)) fail(bindingError); return }
        if (!current(epoch)) return
        if (!sameBinding(fresh)) { onRebind(); return }
      } else if (error instanceof CoachCycleGeneralV4Error && error.code === 'session_expired') { fail(error); return }
      setMessage('The request outcome remains unknown. Resolution was unavailable or busy. Keep this request ID and try resolving it again; original content is never resent, and dismissal remains blocked until a terminal decision is proved.')
      return
    }
    if (!current(epoch)) return
    if (result.request_id !== entry.request || result.operation !== input.operation) throw new CoachCycleGeneralV4Error('network')
    if (result.resolution === 'cancelled') {
      removeCoachCycleGeneralV4Pending(entry); setPending(null)
      setMessage('The original request ID is permanently cancelled. No late original can commit. Your worksheet edits remain here; any new attempt needs an explicit save or template action.')
      await refreshVerifiedPages(epoch)
      return
    }
    if (['delete', 'template-delete'].includes(entry.operation)) { await permitHistoricalDismissal(epoch); return }
    try {
      await verifyReceipt(result.result, entry.operation, epoch)
      if (current(epoch)) { removeCoachCycleGeneralV4Pending(entry); setPending(null); await refreshVerifiedPages(epoch) }
    } catch (error) {
      if (!current(epoch)) return
      if (error instanceof CoachCycleGeneralV4Error && error.code === 'session_expired') { fail(error); return }
      // A committed resolver receipt is terminal, but deletion/archive or later
      // edits can make its object unavailable. Prove current binding before an
      // explicit historical dismissal; never claim current-object success.
      await permitHistoricalDismissal(epoch)
    }
  }
  async function publicationAction(action: () => Promise<void>, recovery = false) {
    if (busyRef.current || fatal || pending || recoveryError) return
    try {
      if (readCoachCycleGeneralV4Pending(ownerSubject, scope)) { setRecoveryError('Resolve the retained draft or template operation before publication.'); return }
      if (!recovery) {
        const other = otherVersionPublicationPending()
        if (other) { setOtherPublicationPending(other); return }
      }
    } catch { setRecoveryError('Operation recovery storage is unavailable. No changes can be sent.'); return }
    busyRef.current = true; setBusy(true)
    const epoch = life.current
    try { await action() } finally { if (current(epoch)) { busyRef.current = false; setBusy(false) } }
  }
  async function checkPublicationAuthority() {
    const epoch = life.current
    try { const fresh = await api.bind({ gym, athlete }); if (!current(epoch)) return false; if (!sameBinding(fresh)) { onRebind(); return false }; return true }
    catch (error) { if (current(epoch)) fail(error); return false }
  }
  const disabled = busy || fatal || Boolean(pending) || publicationBlocked || Boolean(otherPublicationPending) || Boolean(recoveryError)
  const displayLabel = athleteName
  const pendingFenced = Boolean(pending && isCoachCycleGeneralV4PendingFenced(pending, ownerSubject, scope))
  if (fatal) return <section className="ccg-workspace"><p role="alert">{message}</p><button onClick={onBack}>Back to clients</button></section>
  return <section className="ccg-workspace">
    <header className="ccg-heading"><div><button onClick={() => { if (replaceAllowed()) onBack() }}>← Back to clients</button><p>PRIVATE CYCLE WORKSPACE</p><h1>{athleteName}</h1><p>Save a worksheet or reuse a reviewed template. Every applied cycle needs fresh prescription review. Live publication remains closed pending separate rollout gates.</p></div><button disabled={busy} onClick={() => { if (replaceAllowed()) onRebind() }}>Recheck access</button></header>
    <p className="ccg-message" role="status">{message || (busy ? 'Loading current drafts and templates…' : 'Current client access confirmed.')}</p>
    {recoveryError && <p role="alert">{recoveryError}</p>}
    {otherPublicationPending && <p role="alert">{otherPublicationPending} Recovery of the selected version remains available.</p>}
    {pending && <aside className="ccg-pending"><strong>Unconfirmed {pending.operation} for this client</strong><p>Request {pending.request}. Recovery sends only this request identity and scope. Resolution proves a historical commit or permanently cancels a missing request; it never resends worksheet text.</p>{pendingFenced ? <><p>The original operation is fenced by a retired authority generation. Its outcome remains unknown and it may already have completed. Archive its local recovery record to continue after another access check; archival does not retry, cancel or prove the outcome.</p><button disabled={busy} onClick={() => { try { archiveCoachCycleGeneralV4Pending(pending, ownerSubject, scope); setPending(null); onRebind() } catch { setRecoveryError('The unresolved request could not be archived. No new changes can be sent.') } }}>Archive unresolved request and recheck access</button></> : <button disabled={busy} onClick={() => void readAction(epoch => resolvePending(pending, epoch))}>Resolve uncertain request</button>}{historical && !pendingFenced && <button disabled={busy} onClick={() => { try { removeCoachCycleGeneralV4Pending(pending); setPending(null); onRebind() } catch { setRecoveryError('Operation recovery cleanup failed. No new changes can be sent.') } }}>Dismiss historical receipt and recheck access</button>}</aside>}
    <div className="ccg-library">
      <section aria-label="Saved target drafts"><h2>Saved drafts</h2><button disabled={disabled} onClick={() => { if (replaceAllowed()) open(null) }}>New cycle draft</button>{!busy && !drafts.length && <p>No saved drafts for this client yet.</p>}<ul>{drafts.map((draft, index) => <li key={draft.draft_id}><button disabled={disabled} onClick={() => void readAction(async epoch => { if (!replaceAllowed()) return; const result = await readDraft(draft.draft_id); if (current(epoch)) open(result) })}>Open saved draft {index + 1} · revision {draft.revision}</button></li>)}</ul>{draftCursor && <button disabled={disabled} onClick={() => void readAction(async epoch => { const page = await api.list({ ...scope, kind: 'draft', page_limit: 100, cursor: draftCursor }); if (current(epoch)) { setDrafts(items => [...items, ...page.items as CoachCycleGeneralV4DraftSummary[]]); setDraftCursor(page.next_cursor) } })}>Load more drafts</button>}</section>
      <section aria-label="Server template library"><h2>Reusable templates</h2>{!busy && !templates.length && <p>No reusable templates yet. Save an original draft, then review its reusable text.</p>}<ul>{templates.map(template => <li key={template.template_id}><button disabled={disabled} onClick={() => void readAction(async epoch => { const result = await api.templateRead({ ...library, template: template.template_id }); if (current(epoch)) { invalidatePublication(); setSelected(result); setStart(''); setUnit(''); setApplicationConfirmed(false) } })}>{template.name}</button></li>)}</ul>{templateCursor && <button disabled={disabled} onClick={() => void readAction(async epoch => { const page = await api.list({ ...library, athlete: null, client_generation: null, kind: 'template', page_limit: 100, cursor: templateCursor }); if (current(epoch)) { setTemplates(items => [...items, ...page.items as CoachCycleGeneralV4TemplateSummary[]]); setTemplateCursor(page.next_cursor) } })}>Load more templates</button>}</section>
    </div>
    {selected && <section className="ccg-application" aria-label="Apply server template"><h2>Apply {selected.snapshot.name} to {athleteName}</h2><p>{selected.snapshot.weeks} weeks · {selected.snapshot.days.map(day => day.name).join(', ')}. Literal loads are unchanged when units change.</p><label>Fresh start date<input type="date" value={start} disabled={disabled} onChange={event => { invalidatePublication(); setStart(event.target.value); setApplicationConfirmed(false) }} /></label><label>Target unit<select value={unit} disabled={disabled} onChange={event => { invalidatePublication(); setUnit(event.target.value as typeof unit); setApplicationConfirmed(false) }}><option value="">Choose unit</option><option value="lb">lb</option><option value="kg">kg</option></select></label><label><input type="checkbox" disabled={disabled || !start || !unit} checked={applicationConfirmed} onChange={event => setApplicationConfirmed(event.target.checked)} />I confirm this client's date and unit and will review all prescriptions again.</label><button disabled={disabled || !start || !unit || !applicationConfirmed} onClick={() => { const request = crypto.randomUUID(); void mutate('apply', () => api.templateApply({ ...scope, request, template: selected.template_id, expected_revision: selected.revision, expected_hash: selected.snapshot_hash, start, unit: unit as 'lb' | 'kg', confirmed: true }), request).catch(() => {}) }}>Apply as saved target draft</button><button disabled={disabled} onClick={() => { if (window.confirm('Delete this reusable template? Existing target drafts remain independent.')) { const request = crypto.randomUUID(); void mutate('template-delete', () => api.templateDelete({ ...library, request, template: selected.template_id, expected_revision: selected.revision }), request).catch(() => {}) } }}>Delete server template</button></section>}
    {opened && <><p>Create or edit the worksheet below, then choose Save draft above the sheet.</p><div className="ccg-draft-actions"><button disabled={disabled || !opened.record || !clean} onClick={beginReview}>Review reusable text</button><button disabled={disabled || !opened.record} onClick={() => { const record = opened.record; if (record && window.confirm('Delete this private saved draft?')) { const request = crypto.randomUUID(); void mutate('delete', () => api.draftDelete({ ...scope, request, draft: record.draft_id, expected_revision: record.revision }), request).catch(() => {}) } }}>Delete saved draft</button></div><fieldset className="ccg-editor" disabled={disabled} inert={disabled}><legend>Selected client worksheet</legend><CoachSheetEditorProof key={opened.mount} cycleId={opened.record?.draft_id} initialDraft={opened.record ? editorDraft(opened.record) : undefined} initialClientId={displayLabel} clientOptions={[{ id: displayLabel, name: displayLabel }]} localPersistence={false} serverClean={clean} onSaveDraft={save} onDraftChange={source => { invalidatePublication(); edits.current = source; const same = Boolean(openedRef.current?.record && sameWorksheet(source, openedRef.current.record.source)); setClean(same); if (!same) clearReview() }} /></fieldset></>}
    {publicationV5Api ? <CoachCycleGeneralV5Publication api={publicationV5Api} owner={ownerSubject} scope={scope} athleteName={athleteName} draft={opened?.record ?? null} clean={clean} version={publicationVersion} busy={busy} blocked={fatal || Boolean(pending) || Boolean(recoveryError)} blockNew={Boolean(otherPublicationPending)} isCurrent={version => publicationEpoch.current === version} runLocked={publicationAction} onPendingChange={setPublicationBlocked} onStorageFailure={() => setRecoveryError('Publication recovery storage is unavailable. No changes can be sent.')} onAccessEnded={code => fail(new CoachCycleGeneralV4Error(code))} checkAuthority={checkPublicationAuthority} onRebind={onRebind} />
      : <CoachCycleGeneralV4Publication api={publicationApi} owner={ownerSubject} scope={scope} athleteName={athleteName} draft={opened?.record ?? null} clean={clean} version={publicationVersion} busy={busy} blocked={fatal || Boolean(pending) || Boolean(recoveryError)} blockNew={Boolean(otherPublicationPending)} isCurrent={version => publicationEpoch.current === version} runLocked={publicationAction} onPendingChange={setPublicationBlocked} onStorageFailure={() => setRecoveryError('Publication recovery storage is unavailable. No changes can be sent.')} onAccessEnded={code => fail(new CoachCycleGeneralV4Error(code))} checkAuthority={checkPublicationAuthority} onRebind={onRebind} />}
    {review && <section className="ccg-review" aria-label="Reusable text review" inert={disabled}><h2>Review and edit every reusable text field</h2><p>Remove identifying names and instructions before saving. The final content hash binds this confirmation. Client, date and worksheet IDs are excluded.</p><label>Reusable cycle name<input value={review.name} onChange={event => updateReview({ ...review, name: event.target.value })} /></label>{review.days.map((day, d) => <fieldset key={day.name}><legend>{day.name}</legend>{day.exercises.map((exercise, e) => <div className="ccg-review-exercise" key={e}><label>{day.name} exercise {e + 1}<input value={exercise.name} onChange={event => { const next = structuredClone(review); next.days[d].exercises[e].name = event.target.value; updateReview(next) }} /></label>{exercise.weeks.map((week, w) => <div className="ccg-review-week" key={w}><label>Exercise {e + 1}, week {w + 1} prescription<textarea value={week.prescription} onChange={event => { const next = structuredClone(review); next.days[d].exercises[e].weeks[w].prescription = event.target.value; updateReview(next) }} /></label><label>Exercise {e + 1}, week {w + 1} instructions<textarea value={week.instructions} onChange={event => { const next = structuredClone(review); next.days[d].exercises[e].weeks[w].instructions = event.target.value; updateReview(next) }} /></label></div>)}</div>)}</fieldset>)}<p>Content hash: <code>{reviewHash || 'Computing valid content hash…'}</code></p><label><input type="checkbox" disabled={!reviewHash || disabled} checked={Boolean(reviewHash && confirmedHash === reviewHash)} onChange={event => setConfirmedHash(event.target.checked ? reviewHash : '')} />I reviewed every reusable text field and confirm this exact content hash.</label><button disabled={disabled || !reviewHash || confirmedHash !== reviewHash || !clean} onClick={() => void capture().catch(() => {})}>Save reviewed server template</button></section>}
  </section>
}
