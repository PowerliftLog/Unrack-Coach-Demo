import type { CoachCycleDraftSummary } from './lib/coach-cycle-draft-api'
import type { CoachCycleRunningState } from './lib/coach-excel-next-cycle-api'
import { cycleSendState, queuedDraftId, type Queued } from './lib/cycle-send-state'
import { shortDate } from './lib/local-date'
import type { Intake } from './review/CoachSheetEditorProof'
import './coach-builder.css'

export type CycleDraft = Pick<CoachCycleDraftSummary, 'draft_id' | 'updated_at'> & Partial<Pick<CoachCycleDraftSummary, 'revision'>> & {
  intake?: Pick<Intake, 'name' | 'start' | 'weeks'> & Partial<Pick<Intake, 'days'>>
}
export type CycleSelection = { kind: 'previous' | 'current' | 'next'; draftId: string } | { kind: 'new' }

function cycleEnd(intake?: { start: string; weeks: number }): string | undefined {
  if (!intake || !/^\d{4}-\d{2}-\d{2}$/.test(intake.start) || !Number.isInteger(intake.weeks) || intake.weeks < 1) return
  const end = new Date(`${intake.start}T00:00:00Z`)
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== intake.start) return
  end.setUTCDate(end.getUTCDate() + intake.weeks * 7 - 1)
  if (!Number.isFinite(end.getTime())) return
  const value = end.toISOString()
  return value.length === 24 ? value.slice(0, 10) : undefined
}

export function classifyCycles(drafts: CycleDraft[], running: CoachCycleRunningState | null, today: string, openDraft?: CycleDraft, queuedId?: string | null) {
  const linked = running?.linked ? running : null
  const current = linked ? drafts.find(draft => draft.draft_id === linked.draft_id) ?? {
    draft_id: linked.draft_id, updated_at: linked.checked_at,
  } : undefined
  const editable = openDraft && !drafts.some(draft => draft.draft_id === openDraft.draft_id) ? openDraft : undefined
  const candidates = (editable ? [...drafts, editable] : drafts)
    .filter(draft => draft.draft_id !== current?.draft_id)
    .map(draft => {
      const end = cycleEnd(draft.intake) ?? ''
      return { draft, end, start: end ? draft.intake?.start ?? '' : '' }
    })
  // An editable sheet can have unsaved date changes or have just been created with past dates.
  const isPrevious = ({ draft, end }: typeof candidates[number]) => end !== '' && end < today && draft !== editable && draft.draft_id !== queuedId
  const newestUpdate = (a: CycleDraft, b: CycleDraft) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0)
  const previous = candidates.filter(isPrevious)
    .sort((a, b) => b.end.localeCompare(a.end) || newestUpdate(a.draft, b.draft))
    .map(({ draft }) => draft)
  const next = candidates.filter(candidate => !isPrevious(candidate))
    .sort((a, b) => b.start.localeCompare(a.start) || newestUpdate(a.draft, b.draft))
    .map(({ draft }) => draft)
  return { previous, current, next }
}

const dateLabel = (value?: string | null) => value ? shortDate(value) : ''

type Running = Extract<CoachCycleRunningState, { linked: true }>

export function runningCycleProgress(running: Running, draft?: CycleDraft, assignmentEnd?: string | null, priorDraft?: CycleDraft) {
  const matchesPublished = (candidate?: CycleDraft) => candidate?.draft_id === running.draft_id
    && candidate.revision === running.published_draft_revision
  const draftMatches = matchesPublished(draft)
  // A previously verified intake can still identify the remaining weeks after a private save.
  const intake = draftMatches ? draft?.intake : matchesPublished(priorDraft) ? priorDraft?.intake : undefined
  const start = running.start_on
  const end = assignmentEnd ?? cycleEnd({ start, weeks: intake?.weeks ?? 0 })
  const weeks = end ? Math.ceil((Date.parse(end) - Date.parse(start) + 86_400_000) / 604_800_000) : 0
  const days = intake?.days?.length ?? 0
  if (!weeks || !days) return { end, weeks, weeksDone: null, remainingWeeks: null, workoutsLeft: null }

  const doneByWeek = new Map<number, number>()
  for (const row of running.done) {
    // Completed and skipped workouts count as done. In-progress workouts still count as left.
    if (row.state === 'completed' || row.state === 'skipped') {
      doneByWeek.set(row.week, (doneByWeek.get(row.week) ?? 0) + 1)
    }
  }
  const remainingWeeks: number[] = []
  let workoutsLeft = 0
  for (let week = 1; week <= weeks; week++) {
    const left = Math.max(0, days - (doneByWeek.get(week) ?? 0))
    if (left) remainingWeeks.push(week)
    if (draftMatches) workoutsLeft += left
  }
  return { end, weeks, remainingWeeks, weeksDone: draftMatches ? weeks - remainingWeeks.length : null,
    workoutsLeft: draftMatches ? workoutsLeft : null }
}

const loggedDateFormatters = new Map<string | undefined, Intl.DateTimeFormat>()

// Start = earliest completed workout, else earliest in-progress workout, else planned start; finish = latest completed or skipped workout once every week is done; logged timestamps intentionally use the coach's browser time zone (Joe, 2026-11-20).
export function runningCycleDates(running: Running, progress: ReturnType<typeof runningCycleProgress>, today: string, timeZone?: string) {
  const finished = progress.weeks > 0 && progress.remainingWeeks?.length === 0
  let firstCompleted = Infinity
  let firstInProgress = Infinity
  let lastDone = -Infinity
  for (const row of running.done) {
    if (!row.performed_at) continue
    const performed = Date.parse(row.performed_at)
    if (!Number.isFinite(performed)) continue
    if (row.state === 'completed') firstCompleted = Math.min(firstCompleted, performed)
    if (row.state === 'in_progress') firstInProgress = Math.min(firstInProgress, performed)
    else if (finished) lastDone = Math.max(lastDone, performed)
  }

  let loggedDateLabel = loggedDateFormatters.get(timeZone)
  if (!loggedDateLabel) {
    loggedDateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone })
    loggedDateFormatters.set(timeZone, loggedDateLabel)
  }
  const firstWorkout = Number.isFinite(firstCompleted) ? firstCompleted : firstInProgress
  const loggedStart = Number.isFinite(firstWorkout)
  const start = loggedStart ? loggedDateLabel.format(firstWorkout) : dateLabel(running.start_on)
  const end = Number.isFinite(lastDone) ? loggedDateLabel.format(lastDone) : dateLabel(progress.end)
  return {
    start: start && `${loggedStart || running.start_on <= today ? 'Started' : 'Starts'} ${start}`,
    end: end && `${finished ? 'finished' : 'ends'} ${end}`,
  }
}

function rangeLabel(start?: string, end?: string) {
  if (!start || !end) return dateLabel(start)
  return `${dateLabel(start)} – ${start.slice(0, 7) === end.slice(0, 7) ? Number(end.slice(8)) : dateLabel(end)}`
}

type CycleCard = { label?: string; title: string; detail?: string; selection: CycleSelection }
const weekLabel = (weeks: number) => `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`

function runningCycleDetail(running: Running, progress: ReturnType<typeof runningCycleProgress>, today: string) {
  const { start, end } = runningCycleDates(running, progress, today)
  const done = progress.weeksDone !== null ? `${progress.weeksDone} of ${weekLabel(progress.weeks)} done`
    : progress.workoutsLeft === null ? '' : `${progress.workoutsLeft} workout${progress.workoutsLeft === 1 ? '' : 's'} left`
  return [start, end, done].filter(Boolean).join(' · ')
}

export function CoachCycleStrip({ cycles, running, progress, today, queued, loading = false, selected, attempted, disabled, onSelect }: {
  cycles: ReturnType<typeof classifyCycles>
  running: Running | null
  progress?: ReturnType<typeof runningCycleProgress> | null
  today: string
  queued?: Queued | null
  loading?: boolean
  selected?: CycleSelection
  attempted?: CycleSelection
  disabled: boolean
  onSelect(selection: CycleSelection): void
}) {
  if (loading) return <nav className="ccb-cycle-strip" aria-label="Cycles"><p className="ccb-cycle ccb-cycle-loading" role="status">Loading cycles…</p></nav>

  const { previous, current, next } = cycles
  const queuedId = queuedDraftId(queued)
  const orderedNext = queuedId
    ? [...next.filter(draft => draft.draft_id === queuedId), ...next.filter(draft => draft.draft_id !== queuedId)]
    : next
  const cards: CycleCard[] = [
    ...previous.slice().reverse().map(draft => ({
      label: 'Done', title: draft.intake?.name || 'Untitled cycle', detail: rangeLabel(draft.intake?.start, cycleEnd(draft.intake)),
      selection: { kind: 'previous' as const, draftId: draft.draft_id },
    })),
    ...(current && running && progress ? [{
      label: 'Now', title: running.program_name,
      detail: runningCycleDetail(running, progress, today),
      selection: { kind: 'current' as const, draftId: current.draft_id },
    }] : []),
    ...orderedNext.map(draft => {
      const sent = queuedId === draft.draft_id ? queued : null
      const sendState = cycleSendState({ kind: sent ? 'queued' : 'draft', revision: draft.revision, published: sent?.published_draft_revision })
      const intake = cycleEnd(draft.intake) ? draft.intake : undefined
      const starts = dateLabel(sent ? sent.start_on : intake?.start)
      return {
        label: sendState === 'sent-unsent' ? 'Queued · changes not sent' : sendState === 'sent' ? 'Queued · on the phone' : 'Draft · not sent',
        title: sent?.program_name || draft.intake?.name || 'Untitled cycle',
        detail: [starts && `Starts ${starts}`, intake && weekLabel(intake.weeks)].filter(Boolean).join(' · '),
        selection: { kind: 'next' as const, draftId: draft.draft_id },
      }
    }),
    { title: '+ New cycle', selection: { kind: 'new' } },
  ]
  const matches = (selection: CycleSelection, target?: CycleSelection) => target && selection.kind === target.kind
    && (selection.kind === 'new' || ('draftId' in target && selection.draftId === target.draftId))

  return <nav className="ccb-cycle-strip" aria-label="Cycles">
    {cards.map(({ label, title, detail, selection }) => <button key={selection.kind === 'new' ? 'new' : selection.draftId}
      type="button" className={selection.kind === 'new' ? 'ccb-cycle ccb-cycle-new' : 'ccb-cycle'}
      aria-current={matches(selection, selected) ? 'true' : undefined}
      disabled={disabled} onClick={() => { if (attempted || !matches(selection, selected)) onSelect(selection) }}>
      {label && <small>{label}</small>}<strong>{title}</strong>{detail && <span>{detail}</span>}
    </button>)}
  </nav>
}
