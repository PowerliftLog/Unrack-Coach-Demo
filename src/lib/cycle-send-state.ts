import type { CoachCycleQueuedState } from './coach-excel-next-cycle-api'
import { shortDate } from './local-date'

export type Queued = Extract<CoachCycleQueuedState, { queued: true }>
export const queuedDraftId = (queue: Queued | null | undefined) => queue?.draft_id ?? null

type CycleSendState = 'live' | 'live-unsent' | 'sent' | 'sent-unsent' | 'draft'
export function cycleSendState({ kind, revision, published }: {
  kind: 'running' | 'queued' | 'draft'
  revision?: number
  published?: number | null
}): CycleSendState {
  const unsent = revision !== undefined && published != null && revision > published
  if (kind === 'running') return unsent ? 'live-unsent' : 'live'
  if (kind === 'queued') return unsent ? 'sent-unsent' : 'sent'
  return 'draft'
}

export type BuilderStatus = { kind: 'unsaved' | 'saved' | 'sent' | 'live'; title: string; detail?: string }
type BuilderProgress = { weeks: number; weeksDone: number | null; remainingWeeks: number[] | null }
const savedTimeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function formatWeekRanges(weeks: number[]) {
  const ranges: { first: number; last: number }[] = []
  for (const week of weeks) {
    const range = ranges.at(-1)
    if (range?.last === week - 1) range.last = week
    else ranges.push({ first: week, last: week })
  }
  return ranges.map(({ first, last }) => first === last ? `W${first}` : `W${first}–W${last}`).join(', ')
}

export function builderStatus({ sendState, dirty, savedAt, queuedStart, progress }: {
  sendState: CycleSendState
  dirty: boolean
  savedAt?: string
  queuedStart?: string | null
  progress?: BuilderProgress | null
}): BuilderStatus {
  const savedTime = savedAt ? savedTimeFormatter.format(new Date(savedAt)) : undefined
  if (dirty) return { kind: 'unsaved', title: 'Unsaved changes', detail: savedTime && `last saved ${savedTime}` }
  if (sendState === 'sent') {
    return { kind: 'sent', title: queuedStart ? `Sent · starts ${shortDate(queuedStart)}` : 'Sent', detail: 'on the phone' }
  }
  const weeksToChange = formatWeekRanges(progress?.remainingWeeks ?? [])
  if (sendState === 'live-unsent') {
    return { kind: 'saved', title: 'Saved · changes not sent',
      detail: weeksToChange ? `Send changes to update ${weeksToChange}` : 'Send changes to update remaining workouts' }
  }
  if (sendState === 'live') {
    return { kind: 'live',
      title: progress?.weeks && progress.weeksDone !== null ? `Live · ${progress.weeksDone} of ${progress.weeks} done` : 'Live',
      detail: weeksToChange ? `changes go to ${weeksToChange}` : progress?.remainingWeeks ? 'no workouts left to change' : undefined }
  }
  return { kind: 'saved', title: sendState === 'sent-unsent' ? 'Saved · changes not sent' : 'Saved · not sent', detail: savedTime }
}
