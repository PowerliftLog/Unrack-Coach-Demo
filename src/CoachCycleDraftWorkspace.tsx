import CoachExcelNextCyclePreview from './CoachExcelNextCyclePreview'
import { readNextCycleRecovery, nextCycleRecoveryKey } from './coach-excel-next-cycle-recovery'
import { coachExcelBetaPublicationRecoveryKey, readCoachExcelBetaPublicationRecovery, COACH_EXCEL_BETA_RECOVERY_CHANGED } from './coach-excel-publication-recovery'
import type { createCoachExcelPublishApi } from './lib/coach-excel-publish-api'
import { useEffect, useRef, useState } from 'react'
import type { Sheet } from '@fortune-sheet/core'
import CoachSheetEditorProof, { nameStarts, validStructure, type CoachSheetDraft } from './review/CoachSheetEditorProof'
import CoachCycleServerPreview from './CoachCycleServerPreview'
import CoachExcelBetaSavedDraftPreview from './CoachExcelBetaSavedDraftPreview'
import CoachExcelSavedDraftPreview from './CoachExcelSavedDraftPreview'
import type { createCoachExcelPreviewApi } from './lib/coach-excel-preview-api'
import CoachCycleV2Review, { type CoachCycleV2ReviewProps } from './CoachCycleV2Review'
import CoachCycleV2Publish from './CoachCycleV2Publish'
import { readBrowserCoachCyclePendingV2Scope } from './lib/coach-cycle-pending-v2'
import type { createCoachCyclePreviewV2Api } from './lib/coach-cycle-preview-v2-api'
import { CoachCycleDraftError, isCoachCycleDraftSource, type createCoachCycleDraftApi, type CoachCycleDraftRecord, type CoachCycleDraftSaveInput, type CoachCycleDraftSummary } from './lib/coach-cycle-draft-api'
import { copyCoachCycleTemplate, extractCoachCycleTemplate } from './lib/coach-cycle-template'
import { CoachCycleLibrary, nextMondayIso, type ErasedAthleteDraftApi } from './CoachCycleLibrary'
import { CoachCycleTemplateError, type createCoachCycleTemplateApi, type CoachCycleTemplateCreateInput, type CoachCycleTemplateDeleteInput, type CoachCycleTemplateSummary } from './lib/coach-cycle-template-api'
import { CoachCyclePublishError, type createCoachCyclePublishApi, type CoachCyclePublishPreview, type CoachCyclePublishSource } from './lib/coach-cycle-publish-api'
import ExercisePastPerformance, { type AthleteHistoryState } from './ExercisePastPerformance'
import type { CoachExerciseHistoryV1 } from './lib/coach-api'
import { CoachExcelNextCycleError } from './lib/coach-excel-next-cycle-client'
import type { CoachCycleRunningState, CoachCycleRunningUpdateInput } from './lib/coach-excel-next-cycle-api'
import './coach-cycle-draft-workspace.css'

export type CoachExcelBetaReview = {
  nextCycleApi?: import('./lib/coach-excel-next-cycle-client').CoachExcelNextCycleApi
  gateEpoch: number
  previewApi: ReturnType<typeof import('./lib/coach-excel-beta-preview-api').createCoachExcelBetaPreviewApi>
  publishApi: ReturnType<typeof import('./lib/coach-excel-beta-publish-api').createCoachExcelBetaPublishApi>
}
export type CoachCycleDraftWorkspaceProps = {
  excelBetaReview?: CoachExcelBetaReview | null
  api: ReturnType<typeof createCoachCycleDraftApi>
  excelPublishApi?: ReturnType<typeof createCoachExcelPublishApi> | null
  excelPreviewApi?: ReturnType<typeof createCoachExcelPreviewApi> | null
  templateApi?: ReturnType<typeof createCoachCycleTemplateApi> | null
  publishPreviewApi?: Pick<ReturnType<typeof createCoachCyclePublishApi>, 'preview'> | null
  commitV2Api?: ReturnType<typeof import('./lib/coach-cycle-commit-v2-api').createCoachCycleCommitV2Api> | null
  openPending?: CoachCycleV2ReviewProps['openPending']
  previewV2Api?: ReturnType<typeof createCoachCyclePreviewV2Api> | null
  previewV2AdmissionVersion?: number | null
  ownerSubject?: string
  gym: string
  athlete: string
  athleteName: string
  currentProgram?: { id: string; name: string; startOn?: string | null; endOn?: string | null } | null
  /** Read each listed draft once to show its cycle name, weeks and start date in the cycle picker. */
  draftNames?: boolean
  /** Open the newest saved cycle (or new-cycle settings) as soon as the builder loads. */
  autoOpen?: boolean
  /** Open the saved sheet behind the client's active program (matched by cycle name and start date) instead. */
  openProgram?: { name: string; startOn?: string | null } | null
  /** Clients whose saved cycles appear in the Library (copy any cycle to this athlete). */
  libraryClients?: { id: string; name: string }[]
  erasedAthleteDraftApi?: ErasedAthleteDraftApi
  /** Athlete's recent sessions for the builder's past-performance reference (read-only). */
  athleteHistory?: (input: { target_gym: string; target_athlete: string }) => Promise<CoachExerciseHistoryV1>
  onBack(): void
}
type OpenDraft = { id: string; revision: number; initial?: CoachSheetDraft; saved?: string; sourceHash?: string; mount: number; completed?: { day: string; week: number }[] }
type Running = Extract<CoachCycleRunningState, { linked: true }>
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const dayName = (weekday: number) => WEEKDAY_NAMES[weekday - 1] ?? `Day ${weekday}`
const dayLabel = (item: { week: number; weekday: number }) => `Week ${item.week} ${dayName(item.weekday).slice(0, 3)}`
/** Done workouts of a running program as the editor's read-only rows. */
export const runningCompleted = (state: Running) => state.done.map(item => ({ day: dayName(item.weekday), week: item.week }))
const RUNNING_MESSAGES: Record<string, string> = {
  RUNNING_UPDATE_DONE_CHANGED: 'The athlete finished or started another workout since this sheet was opened. Its rows are now locked. Check the sheet and publish again.',
  RUNNING_UPDATE_WORKOUT_STARTED: 'The athlete started a workout while this was publishing. Nothing changed. Check the sheet and publish again.',
  RUNNING_UPDATE_EARLIER_OPEN_DAY_CHANGED: 'A change is on a workout dated before one the athlete already did. Only workouts after the last done one can change. Undo that change, or move it to a later week.',
  RUNNING_UPDATE_SCHEDULE_CHANGED: 'Start date, training days, unit and number of weeks can’t change on a running program. Put them back, or build a new cycle instead.',
  RUNNING_UPDATE_DRAFT_STALE: 'The saved sheet changed. Reload it and publish again.',
  RUNNING_UPDATE_NOT_RUNNING: 'This program is no longer the athlete’s active program. Nothing changed.',
  RUNNING_UPDATE_NO_WORKOUT_TO_DELIVER: 'There is no workout left to update. Nothing changed.',
  RUNNING_UPDATE_AUTHORITY_CHANGED: 'Your access to this client changed. Nothing changed.',
  RUNNING_UPDATE_ENGINE_REFUSED: 'The update could not be applied safely. Nothing changed. Reload the sheet and try again.',
  RUNNING_UPDATE_REQUEST_REUSED: 'This update request was already used for different edits. Publish again.',
}
// JSONB object key order is immaterial; array order remains significant.
const snapshot = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const editorSource = (record: CoachCycleDraftRecord): CoachSheetDraft => ({ ...record.source, sheets: record.source.sheets as Sheet[] })

const ACTIVE_SHEET_SEARCH_LIMIT = 30
// Per-week exercise names (build plan item 4); the server compile accepts `switches` since Nov 17.
const EXERCISE_BY_WEEK = true
/** The saved sheet behind a published program: same cycle name and start date; a name-only match is the fallback. */
export function matchActiveSheet(drafts: { id: string; intake: { name: string; start: string } }[], program: { name: string; startOn?: string | null }): { id: string; exact: boolean } | null {
  const name = program.name.trim().toLowerCase()
  const named = drafts.filter(draft => draft.intake.name.trim().toLowerCase() === name)
  const exact = program.startOn ? named.find(draft => draft.intake.start === program.startOn) : undefined
  if (exact) return { id: exact.id, exact: true }
  return named[0] ? { id: named[0].id, exact: false } : null
}

/** A scope change destroys all mounted editor state, including unresolved requests. */
export default function CoachCycleDraftWorkspace(props: CoachCycleDraftWorkspaceProps) {
  return <DraftWorkspace key={`${props.ownerSubject}:${props.gym}:${props.athlete}`} {...props} />
}
function DraftWorkspace({ excelBetaReview, api, excelPublishApi, excelPreviewApi, templateApi, publishPreviewApi, commitV2Api, openPending, previewV2Api, previewV2AdmissionVersion, ownerSubject, gym, athlete, athleteName, currentProgram, athleteHistory, draftNames = false, autoOpen = false, openProgram = null, libraryClients, erasedAthleteDraftApi, onBack }: CoachCycleDraftWorkspaceProps) {
  const [historyState, setHistoryState] = useState<AthleteHistoryState>({ status: 'loading' })
  useEffect(() => {
    if (!athleteHistory) return
    let active = true
    athleteHistory({ target_gym: gym, target_athlete: athlete })
      .then(history => { if (active) setHistoryState({ status: 'ready', history }) })
      .catch(() => { if (active) setHistoryState({ status: 'error' }) })
    return () => { active = false }
  }, [athleteHistory, gym, athlete])
  const [drafts, setDrafts] = useState<CoachCycleDraftSummary[]>([])
  // Cycle names for the picker, read once per draft revision (read-only; a failed read keeps the dated label).
  const [names, setNames] = useState<Record<string, DraftLabel>>({})
  const [drawer, setDrawer] = useState(false)
  const [opened, setOpened] = useState<OpenDraft | null>(null)
  const openRef = useRef<OpenDraft | null>(null)
  const edits = useRef<CoachSheetDraft | null>(null)
  const pending = useRef<CoachCycleDraftSaveInput | null>(null)
  const busyRef = useRef(false)
  const alive = useRef(true)
  const autoOpened = useRef(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [listFailed, setListFailed] = useState(false)
  const [message, setMessage] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [fatal, setFatal] = useState(false)
  const [betaRecoveryOnly, setBetaRecoveryOnly] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [running, setRunning] = useState<Running | null>(null)
  const runningRequest = useRef<CoachCycleRunningUpdateInput | null>(null)
  const [runningBusy, setRunningBusy] = useState(false)
  const runningApi = excelBetaReview?.nextCycleApi?.runningState && excelBetaReview.nextCycleApi.runningUpdate ? excelBetaReview.nextCycleApi : null
  /** Exact link from the running program to the draft it was published from (null: not running, or unavailable). */
  async function readRunning(draft: string | null): Promise<Running | null> {
    if (!runningApi?.runningState || !excelBetaReview) return null
    try {
      const state = await runningApi.runningState({ gym, athlete, draft, expected_gate_epoch: excelBetaReview.gateEpoch })
      return state.linked ? state : null
    } catch { return null }
  }
  const [templates, setTemplates] = useState<CoachCycleTemplateSummary[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateFailed, setTemplateFailed] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [targetUnit, setTargetUnit] = useState<'' | 'lb' | 'kg'>('')
  const [targetName, setTargetName] = useState('')
  type TemplateMutation = { operation: 'create'; input: CoachCycleTemplateCreateInput } | { operation: 'delete'; input: CoachCycleTemplateDeleteInput }
  const templatePending = useRef<TemplateMutation | null>(null)
  const [hasTemplatePending, setHasTemplatePending] = useState(false)
  const [sourceClean, setSourceClean] = useState(false)
  const [publishPreview, setPublishPreview] = useState<CoachCyclePublishPreview | null>(null)
  const [previewError, setPreviewError] = useState<{ message: string; source?: CoachCyclePublishSource; location?: string } | null>(null)
  const [previewNotice, setPreviewNotice] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewGeneration = useRef(0)
  const [reviewEpoch, setReviewEpoch] = useState(0)
  const [, setPublicationTick] = useState(0)
  let publicationRecovery: ReturnType<typeof readBrowserCoachCyclePendingV2Scope> = null
  let publicationRecoveryError = ''
  if (commitV2Api && ownerSubject) {
    try { publicationRecovery = readBrowserCoachCyclePendingV2Scope(ownerSubject) }
    catch (error) { publicationRecoveryError = error instanceof Error ? error.message : 'Publication recovery is unavailable.' }
  }
  let betaPublicationPending = false, betaRecoveryError = ''
  if (excelBetaReview) {
    try { betaPublicationPending = Boolean(readCoachExcelBetaPublicationRecovery(ownerSubject, { gym, athlete })) || Boolean(excelBetaReview.nextCycleApi && (() => { const saved = readNextCycleRecovery(ownerSubject, { gym, athlete }); return saved && !saved.resolved })()) }
    catch (error) { betaRecoveryError = error instanceof Error ? error.message : 'Publication recovery is unavailable.' }
  }
  useEffect(() => {
    if (!excelBetaReview) return
    const update = (event: Event) => {
      try {
        const key = coachExcelBetaPublicationRecoveryKey(ownerSubject, { gym, athlete })
        if (event instanceof StorageEvent ? event.key === key || event.key === null || Boolean(excelBetaReview.nextCycleApi && event.key === nextCycleRecoveryKey(ownerSubject, { gym, athlete })) : (event as CustomEvent<string>).detail === key) setPublicationTick(value => value + 1)
      } catch { setPublicationTick(value => value + 1) }
    }
    window.addEventListener('storage', update)
    window.addEventListener(COACH_EXCEL_BETA_RECOVERY_CHANGED, update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener(COACH_EXCEL_BETA_RECOVERY_CHANGED, update) }
  }, [excelBetaReview, ownerSubject, gym, athlete])
  const scope = { gym, athlete }
  function clearPublishPreview() { setReviewEpoch(value => value + 1); previewGeneration.current++; setPublishPreview(null); setPreviewError(null); setPreviewNotice('') }
  function open(value: OpenDraft | null) {
    clearPublishPreview()
    openRef.current = value; setOpened(value); edits.current = value?.initial ?? null
    setSourceClean(Boolean(value?.saved && edits.current && snapshot(edits.current) === value.saved))
  }
  function errorMessage(error: unknown) {
    if (error instanceof CoachCycleDraftError || error instanceof CoachCycleTemplateError || error instanceof CoachCyclePublishError) {
      if (error.code === 'session_expired' || error.code === 'access_denied') {
        open(null); edits.current = null; pending.current = null; setDrafts([]); setTemplates([]); templatePending.current = null; setHasTemplatePending(false); setFatal(true)
        // Draft gate denial does not establish loss of managed historical custody.
        // The epoch-free status endpoint independently checks that custody.
        setBetaRecoveryOnly(Boolean(excelBetaReview && error instanceof CoachCycleDraftError && error.code === 'access_denied'))
      }
      if (error instanceof CoachCycleDraftError && ['revision_conflict', 'deleted', 'not_found', 'request_reused'].includes(error.code)) {
        setBlocked(true)
        return `${error.message} Your edits remain in this editor. Reload the saved version only when you are ready to discard them.`
      }
      return error.message
    }
    return 'The request could not be confirmed.'
  }
  async function refresh() {
    setLoading(true); setListFailed(false)
    const openedBeforeRead = openRef.current
    try {
      const list = await api.list({ ...scope, page_limit: 100 })
      if (alive.current) {
        setDrafts(list)
        const current = openRef.current
        // Quick start: the first time the builder opens, go straight to the newest saved cycle,
        // or to new-cycle settings when this client has none.
        if (openProgram && !autoOpened.current && !current) {
          autoOpened.current = true
          void openActiveSheet(list, openProgram)
        } else if (autoOpen && !autoOpened.current && !current) {
          autoOpened.current = true
          const newest = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
          queueMicrotask(() => { if (!alive.current || openRef.current) return; if (newest) void load(newest.draft_id); else create() })
        }
        const latest = list.find(item => item.draft_id === current?.id)
        if (current?.revision && current.id === openedBeforeRead?.id && current.revision === openedBeforeRead.revision
          && current.sourceHash === openedBeforeRead.sourceHash
          && (latest ? latest.revision !== current.revision || latest.source_hash !== current.sourceHash : list.length < 100)) {
          clearPublishPreview(); setBlocked(true)
          setPreviewNotice('The saved draft changed or was deleted. Your edits remain here. Reload the saved draft before requesting another preview.')
        }
      }
    }
    catch (error) { if (alive.current) { setListFailed(true); setMessage(errorMessage(error)) } }
    finally { if (alive.current) setLoading(false) }
  }
  useEffect(() => { alive.current = true; void refresh(); return () => { alive.current = false } }, [api, gym, athlete]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftNames) return
    const missing = drafts.filter(draft => names[draft.draft_id]?.revision !== draft.revision).slice(0, 30)
    if (!missing.length) return
    let active = true
    void Promise.all(missing.map(draft => api.read({ gym, athlete, draft: draft.draft_id })
      .then(record => [draft.draft_id, labelFor(record.source.intake, record.revision)] as const).catch(() => null)))
      .then(rows => { if (active) setNames(value => ({ ...value, ...Object.fromEntries(rows.filter(row => row !== null)) })) })
    return () => { active = false }
  }, [draftNames, drafts, api, gym, athlete]) // eslint-disable-line react-hooks/exhaustive-deps
  function leaveEdits() {
    if (templatePending.current && !window.confirm('A template change is unconfirmed and may already be stored. Leave this draft before retrying the exact template request?')) return false
    return !openRef.current || (!pending.current && (!edits.current || snapshot(edits.current) === openRef.current.saved))
      || window.confirm('Discard the edits in this editor and leave this draft? An unconfirmed save may already be stored on the server.')
  }
  async function openActiveSheet(list: CoachCycleDraftSummary[], program: { name: string; startOn?: string | null }) {
    const linked = await readRunning(null)
    if (!alive.current || openRef.current) return
    if (linked) { await load(linked.draft_id, linked); return }
    const newest = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, ACTIVE_SHEET_SEARCH_LIMIT)
    const found: { id: string; intake: { name: string; start: string } }[] = []
    for (const draft of newest) {
      try {
        const record = await api.read({ ...scope, draft: draft.draft_id })
        found.push({ id: draft.draft_id, intake: record.source.intake })
        if (matchActiveSheet(found, program)?.exact) break
      } catch { /* an unreadable draft is skipped */ }
      if (!alive.current || openRef.current) return
    }
    const match = matchActiveSheet(found, program)
    if (match) { await load(match.id); return }
    setMessage(`No saved sheet matches the active program “${program.name}”. It may have been built outside the sheet builder. Use View programs on the client page to see it.`)
  }
  async function load(id: string, known?: Running | null) {
    if (busyRef.current || !leaveEdits()) return
    busyRef.current = true; setBusy(true); setMessage('')
    try {
      const [record, live] = await Promise.all([api.read({ ...scope, draft: id }), known !== undefined ? Promise.resolve(known) : readRunning(id)])
      if (!alive.current) return
      if (record.source.intake.client !== athlete) throw new CoachCycleDraftError('invalid')
      const initial = editorSource(record)
      if (!validStructure(initial.intake, initial.counts, initial.sheets, initial.blockIds ? nameStarts(initial.intake, initial.blockIds, initial.switches) : undefined)) {
        setMessage('This saved draft needs repair: its worksheet structure is invalid. It was not opened; any current edits remain here.')
        return
      }
      pending.current = null; setHasPending(false); setBlocked(false)
      const runningNow = live && live.draft_id === id ? live : null
      setRunning(runningNow); runningRequest.current = null
      const completed = runningNow ? runningCompleted(runningNow) : record.completed_workouts
      open({ id, revision: record.revision, initial, saved: snapshot(initial), sourceHash: record.source_hash, mount: (openRef.current?.mount ?? 0) + 1, ...(completed?.length ? { completed } : {}) })
      setMessage(runningNow ? '' : `Opened private draft revision ${record.revision}.`)
    } catch (error) { if (alive.current) setMessage(errorMessage(error)) }
    finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  function create() {
    if (busyRef.current || !leaveEdits()) return
    pending.current = null; setHasPending(false); setBlocked(false); setRunning(null); runningRequest.current = null; setMessage('New private draft. Create the worksheet, then save it to Coach storage.')
    open({ id: crypto.randomUUID(), revision: 0, mount: (openRef.current?.mount ?? 0) + 1 })
  }
  async function save(draft: CoachSheetDraft) {
    if (busyRef.current || blocked) throw new Error('Resolve the current request before saving.')
    const current = openRef.current
    // FortuneSheet may attach undefined optional fields. Normalize to the exact
    // JSON source sent over the wire before validating its JSON-only contract.
    const source: unknown = JSON.parse(snapshot(draft))
    if (!current || !isCoachCycleDraftSource(source) || source.intake.client !== athlete) {
      setMessage('This draft must contain the selected client and a valid generated worksheet before saving.')
      throw new Error('Invalid draft source')
    }
    if (pending.current && snapshot(pending.current.source) !== snapshot(source)) {
      setMessage('The previous save is unconfirmed. Retry that exact save first; your newer edits remain here.')
      throw new Error('Unconfirmed previous save')
    }
    const request = pending.current ?? { ...scope, draft: current.id, expected_revision: current.revision, request_id: crypto.randomUUID(), source }
    clearPublishPreview()
    pending.current = request; setHasPending(true)
    busyRef.current = true; setBusy(true); setMessage('Saving private draft…')
    try {
      const receipt = await api.save(request)
      // A replay receipt may describe a revision that has since changed or been
      // deleted. Never treat a receipt alone as proof of the current source.
      const record = await api.read({ ...scope, draft: current.id })
      if (!alive.current) throw new Error('Workspace closed')
      if (record.revision !== receipt.revision || snapshot(record.source) !== snapshot(request.source)) throw new CoachCycleDraftError('revision_conflict')
      pending.current = null; setHasPending(false)
      const saved = snapshot(request.source)
      const next = { ...current, revision: record.revision, saved, sourceHash: record.source_hash }
      openRef.current = next; setOpened(next)
      setSourceClean(Boolean(edits.current && snapshot(edits.current) === saved))
      setDrafts(list => [record, ...list.filter(item => item.draft_id !== record.draft_id)])
      if (edits.current && snapshot(edits.current) !== saved) {
        setMessage(`Revision ${record.revision} is stored. Newer edits remain unsaved; save them next.`)
        throw new Error('Newer edits remain unsaved')
      }
      setMessage(`Private draft saved and verified at revision ${record.revision}. Nothing was published.`)
    } catch (error) {
      if (alive.current && pending.current) setMessage(`${errorMessage(error)}${blockedError(error) ? '' : ' Save is unconfirmed; retry the same save before submitting a new source. Your edits remain here.'}`)
      throw error
    } finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  async function retryPending() {
    const request = pending.current
    if (!request) return
    try { await save({ ...request.source, sheets: request.source.sheets as Sheet[] }) } catch { /* Recovery is explained above; keep editor mounted. */ }
  }
  async function remove() {
    const current = openRef.current
    if (!current || current.revision < 1 || busyRef.current || pending.current || blocked) return
    if (excelBetaReview) {
      try {
        const key = coachExcelBetaPublicationRecoveryKey(ownerSubject, scope)
        if (typeof navigator.locks?.request !== 'function') throw new Error('This browser cannot safely coordinate publication recovery across tabs.')
        await navigator.locks.request(key, { mode: 'exclusive', ifAvailable: true }, async lock => {
          if (!lock) throw new Error('Another tab is checking or publishing this client cycle. Wait for it to finish before deleting a draft.')
          if (!alive.current || busyRef.current) return
          if (readCoachExcelBetaPublicationRecovery(ownerSubject, scope) || excelBetaReview.nextCycleApi && (() => { const saved = readNextCycleRecovery(ownerSubject, scope); return saved && !saved.resolved })()) {
            setMessage('Resolve the retained publication request before deleting a private draft. The original request may already have published.'); return
          }
          if (excelBetaReview.nextCycleApi) {
            const saved = readNextCycleRecovery(ownerSubject, scope)
            if (saved?.resolved && saved.input.draft === current.id) {
              const state = await excelBetaReview.nextCycleApi.status({ ...scope, request_id: saved.input.request_id })
              if (state.status === 'pending') { setMessage('Cancel the queued program first before deleting its source draft.'); return }
            }
          }
          await deleteUnpublishedDraft(current)
        })
      } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : 'Publication recovery cannot be checked. Draft deletion is unavailable.') }
      return
    }
    await deleteUnpublishedDraft(current)
  }
  async function deleteUnpublishedDraft(current: OpenDraft) {
    if (commitV2Api && ownerSubject) {
      try {
        if (readBrowserCoachCyclePendingV2Scope(ownerSubject)) {
          setMessage('Resolve the retained publication request before deleting a private draft. The original request may already have published.'); return
        }
      } catch { setMessage('Publication recovery cannot be checked in this browser. Draft deletion is unavailable until recovery is restored.'); return }
    }
    if (!window.confirm(excelBetaReview?.nextCycleApi ? 'Delete this private cycle draft? This also discards the edits in this editor. Deleting the draft cancels any queued program built from it. The athlete stays on their current program.' : 'Delete this private cycle draft? This also discards the edits in this editor. Existing athlete programs are unaffected.')) return
    busyRef.current = true; setBusy(true)
    try {
      await api.delete({ ...scope, draft: current.id, expected_revision: current.revision, request_id: crypto.randomUUID() })
      if (!alive.current) return
      open(null); setDrafts(list => list.filter(item => item.draft_id !== current.id)); setMessage('Private draft deleted. Nothing was published.')
    } catch (error) {
      if (alive.current) { setBlocked(true); setMessage(`${errorMessage(error)} Delete was not confirmed. Reload the draft list and saved version before trying another delete.`) }
    } finally { busyRef.current = false; if (alive.current) setBusy(false); if (excelBetaReview?.nextCycleApi) setTimeout(() => window.dispatchEvent(new CustomEvent(COACH_EXCEL_BETA_RECOVERY_CHANGED, { detail: coachExcelBetaPublicationRecoveryKey(ownerSubject, scope) })), 0) }
  }
  async function refreshTemplates() {
    if (!templateApi) return
    setTemplateLoading(true); setTemplateFailed(false)
    try { const list = await templateApi.list({ gym, page_limit: 100 }); if (alive.current) setTemplates(list) }
    catch (error) { if (alive.current) { setTemplateFailed(true); setMessage(errorMessage(error)) } }
    finally { if (alive.current) setTemplateLoading(false) }
  }
  useEffect(() => { if (templateApi) void refreshTemplates() }, [templateApi, gym]) // eslint-disable-line react-hooks/exhaustive-deps
  async function runTemplateMutation(mutation: TemplateMutation) {
    if (!templateApi || busyRef.current) return
    templatePending.current = mutation; setHasTemplatePending(true)
    busyRef.current = true; setBusy(true)
    try {
      if (mutation.operation === 'create') {
        const receipt = await templateApi.create(mutation.input)
        const record = await templateApi.read({ gym, template: mutation.input.template })
        if (!alive.current) return
        if (record.snapshot_hash !== receipt.snapshot_hash || record.revision !== receipt.revision) throw new CoachCycleTemplateError('source_conflict')
        setTemplates(list => [{ ...record, name: record.snapshot.name }, ...list.filter(item => item.template_id !== record.template_id)])
        setSelectedTemplate(record.template_id)
        setMessage('Reusable template saved and verified. It contains exercise names, raw prescriptions and instructions. Nothing was published.')
      } else {
        await templateApi.delete(mutation.input)
        if (!alive.current) return
        setTemplates(list => list.filter(item => item.template_id !== mutation.input.template))
        if (selectedTemplate === mutation.input.template) setSelectedTemplate('')
        setMessage('Reusable template deleted. Existing drafts and athlete programs are unchanged.')
      }
      templatePending.current = null; setHasTemplatePending(false)
    } catch (error) {
      if (!alive.current) return
      const terminal = error instanceof CoachCycleTemplateError && ['source_conflict', 'revision_conflict', 'request_reused', 'exists', 'not_found', 'invalid', 'access_denied', 'session_expired'].includes(error.code)
      if (terminal) { templatePending.current = null; setHasTemplatePending(false) }
      setMessage(`${errorMessage(error)}${terminal ? ' Current draft edits are preserved.' : ' Template change is unconfirmed. Retry the same template request before another template change.'}`)
    } finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  function saveTemplate() {
    const current = openRef.current
    if (!templateApi || busyRef.current || templatePending.current || pending.current || blocked || !current?.revision || !current.sourceHash) return
    if (!edits.current || snapshot(edits.current) !== current.saved) { setMessage('Save and verify the current draft edits before creating a reusable template.'); return }
    try { extractCoachCycleTemplate(JSON.parse(snapshot(edits.current))) }
    catch { setMessage('This draft cannot become a template yet. Use literal text cells and a valid generated worksheet; formulas or conflicting source representations need correction.'); return }
    if (!window.confirm('Save this cycle as your reusable template? Exercise names and all weekly prescriptions and instructions will be retained. Check them for client-specific information first.')) return
    void runTemplateMutation({ operation: 'create', input: { gym, athlete, draft: current.id, template: crypto.randomUUID(), request_id: crypto.randomUUID(), expected_revision: current.revision, expected_source_hash: current.sourceHash } })
  }
  async function applyTemplate() {
    if (!templateApi || busyRef.current || templatePending.current || pending.current || blocked || !selectedTemplate || !targetDate || !targetUnit || !leaveEdits()) return
    const sourceBeforeRead = snapshot(edits.current)
    busyRef.current = true; setBusy(true)
    try {
      const record = await templateApi.read({ gym, template: selectedTemplate })
      if (!alive.current) return
      const copy = copyCoachCycleTemplate(record.snapshot, { athleteId: athlete, clientName: athleteName, start: targetDate, unit: targetUnit, ...(targetName.trim() ? { name: targetName.trim() } : {}) })
      if (sourceBeforeRead !== snapshot(edits.current) && !window.confirm('The current draft changed while the template loaded. Discard those newer edits and open the template copy?')) return
      const initial = { ...copy.source, sheets: copy.source.sheets as Sheet[] }
      open({ id: copy.draftId, revision: 0, initial, mount: (openRef.current?.mount ?? 0) + 1 })
      setBlocked(false)
      setMessage(`Template copied into a new unsaved draft for ${athleteName}. Review its dates, ${targetUnit} default unit and all prescriptions before saving or publication.${copy.unitChanged ? ' The default unit changed; unitless weights keep their written numbers and use the new unit.' : ''} Prior interpretation and percentage resolutions were cleared.`)
    } catch (error) { if (alive.current) setMessage(error instanceof CoachCycleTemplateError ? errorMessage(error) : 'The template could not be copied. Check its contents, start date and default unit. Current draft edits are preserved.') }
    finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  function deleteTemplate() {
    if (!selectedTemplate || busyRef.current || templatePending.current || !window.confirm('Delete this reusable template? Copies already made from it remain unchanged.')) return
    void runTemplateMutation({ operation: 'delete', input: { gym, template: selectedTemplate, request_id: crypto.randomUUID(), expected_revision: 1 } })
  }
  function draftChanged(draft: CoachSheetDraft) {
    const changed = snapshot(edits.current) !== snapshot(draft)
    edits.current = draft
    const clean = Boolean(openRef.current?.saved && snapshot(draft) === openRef.current.saved)
    setSourceClean(clean)
    if (changed) {
      clearPublishPreview()
      setPreviewNotice(clean ? 'Request a fresh server preview for the saved revision.' : 'The worksheet changed. Save and verify these edits before requesting a fresh server preview.')
    }
  }
  async function previewSavedCycle() {
    const current = openRef.current
    if (!publishPreviewApi || busyRef.current || pending.current || templatePending.current || blocked || !current?.revision || !current.sourceHash) return
    if (!edits.current || snapshot(edits.current) !== current.saved) {
      clearPublishPreview(); setPreviewNotice('Save and verify the current worksheet edits before requesting a server preview.'); return
    }
    clearPublishPreview()
    const generation = previewGeneration.current
    busyRef.current = true; setBusy(true); setPreviewLoading(true)
    const request = { ...scope, draft: current.id, expected_revision: current.revision }
    const stillCurrent = () => alive.current && generation === previewGeneration.current && openRef.current?.id === current.id
      && openRef.current.revision === current.revision && openRef.current.sourceHash === current.sourceHash
      && openRef.current.saved === current.saved && snapshot(edits.current) === current.saved
    try {
      const result = await publishPreviewApi.preview(request)
      if (!stillCurrent()) return
      if (result.gym_id !== gym || result.athlete_id !== athlete || result.draft_id !== current.id || result.draft_revision !== current.revision
        || result.source_hash !== current.sourceHash || result.local_only !== true || result.publication_authorized !== false) throw new CoachCyclePublishError('conflict', 'cycle_publish_source_integrity')
      setPublishPreview(result)
      setPreviewNotice('The server checked this saved revision. This is a preview only; publishing remains unavailable.')
    } catch (error) {
      if (!stillCurrent()) return
      if (error instanceof CoachCyclePublishError && (error.code === 'session_expired' || error.code === 'access_denied')) {
        errorMessage(error); return
      }
      if (error instanceof CoachCyclePublishError && (error.code === 'conflict' || error.code === 'not_found')) {
        setBlocked(true)
        setPreviewError({ message: "The saved draft or the athlete’s current program changed. Your edits remain here. Reload the saved draft before requesting another server preview." })
      } else {
        const message = error instanceof CoachCyclePublishError
          ? error.reason === 'cycle_publish_capacity_exceeded' ? 'This cycle exceeds the supported preview capacity. Reduce the training days, exercise blocks, set groups or sets, then save and preview again.'
            : error.code === 'blocked' ? error.message
              : error.code === 'unavailable' ? 'Server cycle preview is unavailable. This capability remains closed.'
                : 'The server preview could not be completed. Try previewing the saved revision again.'
          : 'The server preview could not be completed. Try previewing the saved revision again.'
        setPreviewError({ message, ...(error instanceof CoachCyclePublishError && error.source ? { source: error.source } : {}),
          ...(error instanceof CoachCyclePublishError && error.reason === 'cycle_publish_schedule_invalid' ? { location: 'Cycle intake · Start date' } : {}) })
      }
    } finally { busyRef.current = false; if (alive.current) { setBusy(false); setPreviewLoading(false) } }
  }
  async function publishRunning() {
    const current = openRef.current, api2 = runningApi
    if (!current || !running || !api2?.runningUpdate || !excelBetaReview || runningBusy) return
    setRunningBusy(true); setPublished(''); setMessage('Checking what the athlete has done…')
    try {
      const fresh = await readRunning(current.id)
      if (!alive.current) return
      if (!fresh) { setRunning(null); setMessage(`This sheet is no longer ${athleteName}’s running program. Nothing was published.`); return }
      const doneKey = (rows: { week: number; weekday: number }[]) => rows.map(row => `${row.week}:${row.weekday}`).sort().join(',')
      if (doneKey(fresh.done) !== doneKey(running.done)) {
        setRunning(fresh); runningRequest.current = null
        open({ ...current, mount: current.mount + 1, initial: edits.current ?? current.initial, completed: runningCompleted(fresh) })
        setMessage(RUNNING_MESSAGES.RUNNING_UPDATE_DONE_CHANGED)
        return
      }
      setRunning(fresh)
      if (fresh.opened.length && !runningRequest.current
        && !window.confirm(`${athleteName} opened ${fresh.opened.map(dayLabel).join(', ')} in the last 3 hours and may be working out now. A workout locks as soon as they log a set. Publish the update anyway?`)) {
        setMessage('Not published. Your saved edits remain here.'); return
      }
      const input: CoachCycleRunningUpdateInput = runningRequest.current && runningRequest.current.draft === current.id && runningRequest.current.expected_revision === current.revision
        ? runningRequest.current
        : { request_id: crypto.randomUUID(), gym, athlete, draft: current.id, expected_revision: current.revision, expected_assignment: fresh.assignment_id,
            expected_done: fresh.done.map(row => [row.week, row.weekday] as [number, number]), expected_gate_epoch: excelBetaReview.gateEpoch }
      runningRequest.current = input
      setMessage('Publishing the update…')
      const result = await api2.runningUpdate(input)
      if (!alive.current) return
      runningRequest.current = null
      if (result.status === 'no_changes') { setMessage(`Nothing to update: the workouts still to come already match this sheet.`); return }
      const count = result.changed_days.length
      setMessage('')
      setPublished(`Updated ${count} ${count === 1 ? 'workout' : 'workouts'} in “${fresh.program_name}” for ${athleteName} (${result.changed_days.map(([week, weekday]) => dayLabel({ week, weekday })).join(', ')}). Done workouts did not change.`)
      const after = await readRunning(current.id)
      if (alive.current && after) setRunning(after)
    } catch (error) {
      if (!alive.current) return
      if (error instanceof CoachExcelNextCycleError) {
        if (error.code === 'session_expired' || error.code === 'access_denied') { runningRequest.current = null; setFatal(true); return }
        if (error.code === 'ambiguous' || error.code === 'network' || error.code === 'retryable') { setMessage('The update could not be confirmed. Publish again to retry the same update; it will not be applied twice.'); return }
        runningRequest.current = null
        if (error.code === 'conflict' && error.reason && RUNNING_MESSAGES[error.reason]) {
          if (error.reason === 'RUNNING_UPDATE_DONE_CHANGED' || error.reason === 'RUNNING_UPDATE_WORKOUT_STARTED') {
            const fresh = await readRunning(current.id)
            if (alive.current && fresh) { setRunning(fresh); open({ ...current, mount: current.mount + 1, initial: edits.current ?? current.initial, completed: runningCompleted(fresh) }) }
          }
          setMessage(RUNNING_MESSAGES[error.reason]); return
        }
        if (error.code === 'blocked') { setMessage(error.message); return }
      }
      runningRequest.current = null
      setMessage('The update could not be published. Nothing changed. Try again.')
    } finally { if (alive.current) setRunningBusy(false) }
  }
  const [publishRequest, setPublishRequest] = useState(0)
  const [publishBusy, setPublishBusy] = useState(false)
  const [library, setLibrary] = useState(false)
  function copyFromLibrary(record: CoachCycleDraftRecord, clientName: string) {
    if (busyRef.current || pending.current || blocked || !leaveEdits()) return
    try {
      const start = nextMondayIso()
      const copy = copyCoachCycleTemplate(extractCoachCycleTemplate(record.source), { athleteId: athlete, clientName: athleteName, start, unit: record.source.intake.unit })
      open({ id: copy.draftId, revision: 0, initial: { ...copy.source, sheets: copy.source.sheets as Sheet[] }, mount: (openRef.current?.mount ?? 0) + 1 })
      setBlocked(false); setLibrary(false); setPublished(''); setRunning(null); runningRequest.current = null
      setMessage(`Copied “${record.source.intake.name}” from ${clientName} into a new draft for ${athleteName}, starting ${new Date(`${start}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}. Check the weights for ${athleteName}, then save or publish.`)
    } catch { setMessage('That cycle could not be copied. Open it on its own client and check its sheet.') }
  }
  const [published, setPublished] = useState('')
  const publishSection = useRef<HTMLElement>(null)
  let legacyRecovery = false
  if (excelBetaReview?.nextCycleApi) {
    try { legacyRecovery = Boolean(readCoachExcelBetaPublicationRecovery(ownerSubject, { gym, athlete })) } catch { legacyRecovery = true }
  }
  const nextCycle = Boolean(excelBetaReview?.nextCycleApi && !legacyRecovery)
  const betaReview = excelBetaReview?.nextCycleApi && !legacyRecovery ? <CoachExcelNextCyclePreview api={excelBetaReview.nextCycleApi} gateEpoch={excelBetaReview.gateEpoch} reviewEpoch={reviewEpoch} autoPreview={publishRequest} autoPublish
    onBusyChange={setPublishBusy} onNeedsAttention={() => setDrawer(true)} onPublished={note => { setPublished(note); setMessage('') }}
    athleteName={athleteName} currentProgram={currentProgram}
    input={{ gym, athlete, draft: opened?.id ?? '', expected_revision: opened?.revision ?? 0 }} sourceHash={opened?.sourceHash ?? ''} ownerSubject={ownerSubject}
    recoveryOnly={betaRecoveryOnly} disabled={fatal || busy || !opened?.revision || !sourceClean || hasPending || blocked || hasTemplatePending}
    onConflict={() => { clearPublishPreview(); setBlocked(true); setMessage('The saved draft or current program changed. Your edits remain here. Reload the saved draft before previewing again.') }}
    onAccessEnded={allowRecovery => { open(null); edits.current = null; pending.current = null; setDrafts([]); setTemplates([]); setBetaRecoveryOnly(Boolean(allowRecovery)); setFatal(true) }} />
    : excelBetaReview && <CoachExcelBetaSavedDraftPreview api={excelBetaReview.previewApi} publishApi={excelBetaReview.publishApi} gateEpoch={excelBetaReview.gateEpoch} reviewEpoch={reviewEpoch}
    input={{ gym, athlete, draft: opened?.id ?? '', expected_revision: opened?.revision ?? 0 }} sourceHash={opened?.sourceHash ?? ''} ownerSubject={ownerSubject}
    recoveryOnly={betaRecoveryOnly || legacyRecovery} disabled={fatal || busy || !opened?.revision || !sourceClean || hasPending || blocked || hasTemplatePending}
    onConflict={() => { clearPublishPreview(); setBlocked(true); setMessage('The saved draft or current program changed. Your edits remain here. Reload the saved draft before previewing again.') }}
    onAccessEnded={allowRecovery => { open(null); edits.current = null; pending.current = null; setDrafts([]); setTemplates([]); setBetaRecoveryOnly(Boolean(allowRecovery)); setFatal(true) }} />
  if (fatal) return <section className="ccd-workspace"><p role="alert">Draft access ended. Sign in again or return to your client list.</p><button onClick={onBack}>Back to clients</button>{betaRecoveryOnly && betaReview}</section>
  return <section className="ccd-workspace" aria-label="Private cycle drafts">
    <header className="ccd-header">
      <div className="ccd-title"><p className="ccd-crumb">{athleteName} / Training cycle</p><h1>Training cycle · {athleteName}</h1>
        <div className="ccd-picker"><label><span className="ccd-sr">Open cycle</span><select aria-label="Open cycle" value={opened && drafts.some(draft => draft.draft_id === opened.id) ? opened.id : ''} disabled={busy || loading} onChange={event => { if (event.target.value) void load(event.target.value) }}>
          <option value="">{loading ? 'Loading cycles…' : opened && !opened.revision ? 'New cycle (not saved yet)' : drafts.length ? 'Choose a saved cycle' : 'No saved cycles yet'}</option>
          {drafts.map(draft => <option key={draft.draft_id} value={draft.draft_id}>{draftOptionLabel(draft, opened?.id === draft.draft_id && edits.current ? labelFor(edits.current.intake, draft.revision) : names[draft.draft_id])}</option>)}
        </select></label><button disabled={busy} onClick={create}>New cycle draft</button><button className="ccd-quiet" disabled={busy || loading} onClick={() => void refresh()}>Refresh drafts</button></div>
        {listFailed && <p className="ccd-note">Draft list could not be loaded. Refresh drafts to retry.</p>}
        {drafts.length === 100 && <p className="ccd-note">Showing up to 100 drafts. Older drafts may not be listed.</p>}
      </div>
      <div className="ccd-header-actions">{libraryClients ? <button aria-expanded={library} onClick={() => setLibrary(true)}>Library</button> : null}{excelBetaReview ? <button className="ccd-quiet" aria-expanded={drawer} onClick={() => setDrawer(true)}>Publish status</button> : null}<button disabled={busy} onClick={() => { if (leaveEdits()) onBack() }}>Back to client</button></div>
    </header>
    <StatusStrip currentProgram={currentProgram} opened={opened ? (edits.current?.intake ?? opened.initial?.intake ?? null) : null} history={athleteHistory ? historyState : null} running={Boolean(running && opened && running.draft_id === opened.id)} />
    {running && opened && running.draft_id === opened.id && <RunningNote state={running} />}
    <p role="status" className="ccd-message">{message}</p>
    {published && <div className="ccd-published" role="status"><span aria-hidden="true">✓</span><p>{published}</p><button className="ccd-quiet" onClick={() => setDrawer(true)}>Details</button><button className="ccd-quiet" aria-label="Dismiss" onClick={() => setPublished('')}>×</button></div>}
    {opened && (hasPending || blocked) && <div className="ccd-actions">
      {hasPending && !blocked && <button disabled={busy} onClick={() => void retryPending()}>Retry unconfirmed save</button>}
      {blocked && <button disabled={busy} onClick={() => void load(opened.id)}>Reload saved draft (discard edits)</button>}
    </div>}
    {opened && <CoachSheetEditorProof key={`${opened.id}:${opened.mount}`} initialDraft={opened.initial} initialClientId={athlete} cycleId={opened.id} clientOptions={[{ id: athlete, name: athleteName }]} localPersistence={false} serverClean={sourceClean} onDraftChange={draftChanged} onSaveDraft={save}
      exerciseReference={athleteHistory ? name => <ExercisePastPerformance name={name} state={historyState} layout="table" /> : undefined}
      onPublishReady={running && running.draft_id === opened.id ? () => void publishRunning() : nextCycle ? () => { setPublished(''); setPublishRequest(value => value + 1) } : undefined} publishBusy={publishBusy || runningBusy} layout="workspace" completedWorkouts={opened.completed} exerciseByWeek={EXERCISE_BY_WEEK} />}
    {/* One render site for the publish panel, outside the editor's key, so opening or saving a draft never remounts an in-flight publish.
        The drawer only hides it; a pending publication opens it by itself. */}
    {excelBetaReview && <><div className={drawer || betaPublicationPending || Boolean(betaRecoveryError) ? 'ccd-scrim open' : 'ccd-scrim'} onClick={() => { if (!betaPublicationPending) setDrawer(false) }} />
      <aside ref={publishSection} className={drawer || betaPublicationPending || Boolean(betaRecoveryError) ? 'ccd-publish ccd-drawer open' : 'ccd-publish ccd-drawer'} aria-label="Publish details" inert={!(drawer || betaPublicationPending || Boolean(betaRecoveryError))}>
        <div className="ccd-drawer-head"><h2>Publish details</h2><button onClick={() => setDrawer(false)}>Back to sheet</button></div>{betaReview}</aside></>}
    {library && libraryClients && <><div className="ccd-scrim open" onClick={() => setLibrary(false)} />
      <aside className="ccd-drawer open ccd-library-drawer" aria-label="Library"><CoachCycleLibrary api={api} erasedApi={erasedAthleteDraftApi} gym={gym} clients={libraryClients} targetName={athleteName} onUse={copyFromLibrary} onClose={() => setLibrary(false)} /></aside></>}
    {opened && <div className="ccd-danger-zone"><button className="ccd-quiet ccd-danger" disabled={busy || opened.revision < 1 || hasPending || blocked || Boolean(publicationRecovery) || Boolean(publicationRecoveryError) || betaPublicationPending || Boolean(betaRecoveryError)} onClick={() => void remove()}>Delete private draft</button><span>{opened.revision ? `Saved revision ${opened.revision}` : 'Not saved yet'}</span></div>}
    {templateApi && <details className="ccd-library ccd-templates"><summary>Reusable cycle templates</summary><section aria-label="Reusable cycle templates">
      <h2>Reusable cycle templates</h2><p>Your private templates are available across clients in this gym. Check reusable instructions for client-specific information.</p>
      <div className="ccd-actions"><button disabled={busy || templateLoading} onClick={() => void refreshTemplates()}>Refresh templates</button><button disabled={busy || !opened?.revision || hasPending || blocked || hasTemplatePending} onClick={saveTemplate}>Save saved cycle as template</button>{hasTemplatePending && <button disabled={busy} onClick={() => { if (templatePending.current) void runTemplateMutation(templatePending.current) }}>Retry unconfirmed template change</button>}</div>
      {templateLoading ? <p>Loading templates…</p> : templateFailed ? <p>Template list could not be loaded. Refresh templates to retry.</p> : !templates.length ? <p>No reusable templates saved.</p> : <>
        <label>Reusable template<select value={selectedTemplate} disabled={busy || hasTemplatePending} onChange={event => setSelectedTemplate(event.target.value)}><option value="">Choose a template</option>{templates.map(template => <option key={template.template_id} value={template.template_id}>{template.name}</option>)}</select></label>
        <div className="ccd-template-fields"><label>New cycle name<input value={targetName} disabled={busy} placeholder="Use template name" onChange={event => setTargetName(event.target.value)} /></label><label>Template copy start date<input type="date" required value={targetDate} disabled={busy} onChange={event => setTargetDate(event.target.value)} /></label><label>Template copy default unit<select value={targetUnit} disabled={busy} onChange={event => setTargetUnit(event.target.value as '' | 'lb' | 'kg')}><option value="">Choose unit</option><option value="lb">lb</option><option value="kg">kg</option></select></label></div>
        <p>Copies go to {athleteName}. Choose the date and unit explicitly. Unitless weight numbers stay unchanged and use the selected unit; percentage bases and interpretations need a fresh review.</p>
        <div className="ccd-actions"><button disabled={busy || !selectedTemplate || !targetDate || !targetUnit || hasTemplatePending || hasPending || blocked} onClick={() => void applyTemplate()}>Apply template to {athleteName}</button><button disabled={busy || !selectedTemplate || hasTemplatePending} onClick={deleteTemplate}>Delete reusable template</button></div>
      </>}
      {templates.length === 100 && <p>Showing up to 100 templates. Older templates may not be listed.</p>}
    </section></details>}
    {!excelBetaReview && excelPreviewApi && <CoachExcelSavedDraftPreview api={excelPreviewApi} publishApi={excelPublishApi} reviewEpoch={reviewEpoch}
      input={{ gym, athlete, draft: opened?.id ?? '', expected_revision: opened?.revision ?? 0 }} sourceHash={opened?.sourceHash ?? ''} ownerSubject={ownerSubject}
      disabled={busy || !opened?.revision || !sourceClean || hasPending || blocked || hasTemplatePending}
      onConflict={() => { clearPublishPreview(); setBlocked(true); setMessage('The saved draft or current program changed. Your edits remain here. Reload the saved draft before previewing again.') }}
      onAccessEnded={() => { open(null); edits.current = null; pending.current = null; setDrafts([]); setTemplates([]); setFatal(true) }} />}
    {publishPreviewApi && <section className="ccd-library ccd-publish-preview" aria-label="Server cycle preview">
      <h2>Server cycle preview</h2><p>Preview only · publishing unavailable. The server checks the saved worksheet without changing athlete programs.</p>
      <button disabled={busy || !opened?.revision || !sourceClean || hasPending || blocked || hasTemplatePending} onClick={() => void previewSavedCycle()}>Preview saved cycle on server</button>
      {!opened?.revision && <p>Open or save a private draft before requesting a preview.</p>}
      {Boolean(opened?.revision) && !sourceClean && <p>Save and verify the current worksheet edits before requesting a server preview.</p>}
      {previewLoading && <p>Checking the saved draft revision…</p>}
      {previewNotice && <p>{previewNotice}</p>}
      {previewError && <div role="alert"><strong>{previewError.source ? <>{previewError.source.sheet}!{previewError.source.address}{previewError.source.day ? ` · ${previewError.source.day} · week ${previewError.source.week}` : ''}</> : previewError.location ?? 'Saved cycle'}: </strong>{previewError.message}</div>}
      {publishPreview && <CoachCycleServerPreview preview={publishPreview} />}
    </section>}
    {publicationRecoveryError && <p role="alert">{publicationRecoveryError} Publication and draft deletion remain unavailable in this browser.</p>}
    {publicationRecovery && commitV2Api && (!opened?.revision || opened.id !== publicationRecovery.draft) && <section className="ccd-library" aria-label="Retained cycle publication recovery"><h2>Recover an earlier publication request</h2><p>This request remains tied to its original client and draft, even if that draft is no longer in the list. Check its historical status before taking another publication action.</p><CoachCycleV2Publish key={`${publicationRecovery.owner}:${publicationRecovery.draft}`} api={commitV2Api} openPending={openPending} scope={publicationRecovery} review={null} onReviewInvalidated={() => clearPublishPreview()} onAccessEnded={() => { open(null); setFatal(true) }} /></section>}
    {!publicationRecoveryError && previewV2Api && ownerSubject && opened?.revision && (!publicationRecovery || publicationRecovery.draft === opened.id) && Number.isSafeInteger(previewV2AdmissionVersion) && Number(previewV2AdmissionVersion) > 0 && <CoachCycleV2Review key={reviewEpoch} api={previewV2Api} commitApi={commitV2Api} openPending={openPending} onPendingStored={() => setPublicationTick(value => value + 1)}
      input={{ gym, athlete, draft: opened?.id ?? '', expected_revision: opened?.revision ?? 0, expected_admission_version: previewV2AdmissionVersion! }}
      ownerSubject={ownerSubject} sourceHash={opened?.sourceHash ?? ''} disabled={busy || !opened?.revision || !sourceClean || hasPending || blocked || hasTemplatePending}
      onConflict={() => { clearPublishPreview(); setBlocked(true); setMessage('The saved source, pilot scope or assignment changed. Reload the saved draft before reviewing again.') }}
      onAccessEnded={() => { open(null); edits.current = null; pending.current = null; setDrafts([]); setTemplates([]); setFatal(true) }} />}
  </section>
}
type DraftLabel = { name: string; weeks: number; days: string[]; start: string; revision: number }
const labelFor = (intake: CoachSheetDraft['intake'], revision: number): DraftLabel => ({ name: intake.name, weeks: intake.weeks, days: intake.days, start: intake.start, revision })
const shortDay = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
function draftOptionLabel(draft: CoachCycleDraftSummary, label?: DraftLabel) {
  const saved = new Date(draft.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return label ? `${label.name || 'Untitled cycle'} · ${label.weeks} ${label.weeks === 1 ? 'week' : 'weeks'} · starts ${shortDay(label.start)} · saved ${saved}`
    : `Draft saved ${saved} · revision ${draft.revision}`
}

/** What the athlete is on now, what is open here, and their last logged workout. */
function StatusStrip({ currentProgram, opened, history, running = false }: { currentProgram?: CoachCycleDraftWorkspaceProps['currentProgram']; opened: CoachSheetDraft['intake'] | null; history: AthleteHistoryState | null; running?: boolean }) {
  const latest = history?.status === 'ready' ? [...history.history.sessions].sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0] : null
  const dates = currentProgram?.startOn && currentProgram.endOn ? `${shortDay(currentProgram.startOn)} – ${shortDay(currentProgram.endOn)}` : null
  return <div className="ccd-status" role="group" aria-label="Program status">
    <div><small>ACTIVE NOW</small><strong>{currentProgram?.name ?? 'No active program'}</strong><span>{dates ?? (currentProgram ? 'Dates not available' : 'Nothing is being delivered right now')}</span></div>
    <div><small>THIS DRAFT</small><strong>{opened?.name || 'No cycle open'}</strong><span>{opened ? `${opened.weeks} ${opened.weeks === 1 ? 'week' : 'weeks'} · ${opened.days.map(day => day.slice(0, 3)).join(', ')} · ${running ? `running since ${shortDay(opened.start)}` : `starts ${shortDay(opened.start)} once published`}` : 'Choose a saved cycle or start a new one'}</span></div>
    <div><small>LAST WORKOUT</small><strong>{latest ? shortDay(latest.completed_at.slice(0, 10)) : history?.status === 'loading' ? 'Loading…' : history ? 'None logged yet' : 'Not available'}</strong><span>{latest ? latest.exercises.map(item => item.name).slice(0, 3).join(' · ') : history?.status === 'error' ? 'Could not load recent sessions' : ''}</span></div>
  </div>
}

/** Running program: what is locked, what the athlete opened recently, and offline finishes. */
function RunningNote({ state }: { state: Running }) {
  const offline = state.done.filter(item => item.earlier_version)
  return <div className="ccd-running" role="note" aria-label="Running program">
    <p><strong>Running program.</strong> {state.done.length ? `${state.done.length} ${state.done.length === 1 ? 'workout is' : 'workouts are'} done and locked (grey). ` : 'No workouts done yet. '}Publish updates the workouts still to come; done ones never change.</p>
    {state.opened.length > 0 && <p className="ccd-running-warn">Opened in the last 3 hours, may be in progress: {state.opened.map(dayLabel).join(', ')}.</p>}
    {offline.map(item => <p key={`${item.week}:${item.weekday}`} className="ccd-running-offline">{dayLabel(item)}: done offline from the earlier version.</p>)}
  </div>
}

function blockedError(error: unknown) {
  return error instanceof CoachCycleDraftError && ['revision_conflict', 'deleted', 'not_found', 'request_reused', 'access_denied', 'session_expired'].includes(error.code)
}
