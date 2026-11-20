import type { CoachCycleDraftSummary } from './lib/coach-cycle-draft-api'
import type { CoachCycleRunningState } from './lib/coach-excel-next-cycle-api'
import type { Intake } from './review/CoachSheetEditorProof'
import './coach-builder.css'

export type CycleDraft = Pick<CoachCycleDraftSummary, 'draft_id' | 'updated_at'> & {
  intake?: Pick<Intake, 'name' | 'start' | 'weeks'>
}
export type CycleSelection = { kind: 'previous' | 'current' | 'next'; draftId: string } | { kind: 'new' }

function cycleEnd(intake: CycleDraft['intake']): string | undefined {
  if (!intake || !/^\d{4}-\d{2}-\d{2}$/.test(intake.start) || !Number.isInteger(intake.weeks) || intake.weeks < 1) return
  const end = new Date(`${intake.start}T00:00:00Z`)
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== intake.start) return
  end.setUTCDate(end.getUTCDate() + intake.weeks * 7 - 1)
  if (!Number.isFinite(end.getTime())) return
  const value = end.toISOString()
  return value.length === 24 ? value.slice(0, 10) : undefined
}

export function classifyCycles(drafts: CycleDraft[], running: CoachCycleRunningState | null, today: string, openDraft?: CycleDraft) {
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
  const isPrevious = ({ draft, end }: typeof candidates[number]) => end !== '' && end < today && draft !== editable
  const newestUpdate = (a: CycleDraft, b: CycleDraft) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0)
  const previous = candidates.filter(isPrevious)
    .sort((a, b) => b.end.localeCompare(a.end) || newestUpdate(a.draft, b.draft))
    .map(({ draft }) => draft)
  const next = candidates.filter(candidate => !isPrevious(candidate))
    .sort((a, b) => b.start.localeCompare(a.start) || newestUpdate(a.draft, b.draft))
    .map(({ draft }) => draft)
  return { previous, current, next }
}

function dateLabel(value?: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''
}
function rangeLabel(draft: CycleDraft) {
  const end = cycleEnd(draft.intake)
  return end ? `${dateLabel(draft.intake?.start)} – ${dateLabel(end)}` : ''
}
type CycleCard = { label?: string; title: string; detail?: string; selection?: CycleSelection }

export function CoachCycleStrip({ cycles, running, selected, attempted, disabled, onSelect }: {
  cycles: ReturnType<typeof classifyCycles>
  running: Extract<CoachCycleRunningState, { linked: true }> | null
  selected?: CycleSelection
  attempted?: CycleSelection
  disabled: boolean
  onSelect(selection: CycleSelection): void
}) {
  const { previous, current, next } = cycles
  const pastCards: CycleCard[] = previous.map(draft => ({
    label: 'Previous', title: draft.intake?.name || 'Untitled cycle', detail: rangeLabel(draft),
    selection: { kind: 'previous', draftId: draft.draft_id },
  }))
  const nextCards: CycleCard[] = next.length ? next.map(draft => {
    const intake = cycleEnd(draft.intake) ? draft.intake : undefined
    return {
      label: 'Next', title: intake?.name || 'Untitled cycle',
      detail: intake ? `Starts ${dateLabel(intake.start)}` : undefined,
      selection: { kind: 'next', draftId: draft.draft_id },
    }
  }) : [{ label: 'Next', title: 'No draft yet' }]
  const cards: CycleCard[] = [
    ...pastCards.slice().reverse(),
    ...(current ? [{
      label: 'Current', title: running?.program_name || current.intake?.name || 'Running cycle',
      detail: current.intake ? rangeLabel(current) : dateLabel(running?.start_on),
      selection: { kind: 'current' as const, draftId: current.draft_id },
    }] : []),
    ...nextCards,
    { title: '+ New cycle', selection: { kind: 'new' } },
  ]
  const matches = (selection?: CycleSelection, target?: CycleSelection) => Boolean(selection && target && selection.kind === target.kind
    && (selection.kind === 'new' || ('draftId' in target && selection.draftId === target.draftId)))
  // A failed read can be retried from its card, or stepped past without closing the open worksheet.
  const cursor = attempted ?? selected
  const selectedIndex = cards.findIndex(card => matches(card.selection, cursor))
  const index = selectedIndex < 0 ? cards.length - 1 : selectedIndex
  const back = cards.slice(0, index).reverse().find(card => card.selection)?.selection
  const forward = cards.slice(index + 1).find(card => card.selection)?.selection
  const hasCycles = Boolean(previous.length || current || next.length)
  const visiblePast = pastCards.find(card => matches(card.selection, cursor)) ?? pastCards[0]
  const visibleNext = nextCards.find(card => matches(card.selection, cursor)) ?? nextCards[0]

  return <nav className="ccb-cycle-strip" aria-label="Cycles">
    {hasCycles && <button type="button" className="ccb-step" aria-label="Previous cycle" disabled={disabled || !back} onClick={() => { if (back) onSelect(back) }}>‹</button>}
    {cards.filter(card => card.label === 'Previous' ? card === visiblePast : card.label === 'Next' ? card === visibleNext : true).map(card => <button key={card.label ?? card.title}
      type="button" className={card.selection?.kind === 'new' ? 'ccb-cycle ccb-cycle-new' : 'ccb-cycle'} aria-current={matches(card.selection, selected) ? 'true' : undefined}
      disabled={disabled || !card.selection} onClick={() => { if (card.selection && (attempted || !matches(card.selection, selected))) onSelect(card.selection) }}>
      {card.label && <small>{card.label}</small>}<strong>{card.title}</strong>{card.detail && <span>{card.detail}</span>}
    </button>)}
    {hasCycles && <button type="button" className="ccb-step" aria-label="Next cycle" disabled={disabled || !forward} onClick={() => { if (forward) onSelect(forward) }}>›</button>}
  </nav>
}
