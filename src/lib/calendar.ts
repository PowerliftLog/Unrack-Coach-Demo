import type { CoachProgramCalendar, CoachProgramDay, CoachProgramWeek } from './coach-api'

export const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type CalendarSlot = { ordinal: number; label: string; plannedDate: string; day: CoachProgramDay | null }
export type ProgramSlot = Omit<CalendarSlot, 'plannedDate'> & { plannedDate: string | null }

export function programSlots(calendar: CoachProgramCalendar | null | undefined, week: CoachProgramWeek): ProgramSlot[] {
  return calendar ? calendarSlots(calendar, week) : [...week.days].sort((a, b) => a.ordinal - b.ordinal)
    .map(day => ({ ordinal: day.ordinal, label: day.label ?? `Day ${day.ordinal}`, plannedDate: null, day }))
}

export function slotStatus(day: CoachProgramDay | null): string {
  return day === null ? 'Unscheduled' : day.marked_rest ? 'Rest' : day.exercises.length ? 'Workout' : 'Workout · empty'
}

export function weekDateRange(startOn: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startOn)) return null
  const date = new Date(`${startOn}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startOn || date.getUTCDay() !== 1) return null
  date.setUTCDate(date.getUTCDate() + 6)
  return `${startOn} – ${date.toISOString().slice(0, 10)}`
}

/** Missing slots are display projections. They carry no persisted identity or rest/completion state. */
export function calendarSlots(calendar: CoachProgramCalendar, week: CoachProgramWeek): CalendarSlot[] {
  return weekdayNames.map((label, index) => {
    const date = new Date(`${calendar.start_on}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + (week.ordinal - 1) * 7 + index)
    return { ordinal: index + 1, label, plannedDate: date.toISOString().slice(0, 10),
      day: week.days.find(day => day.ordinal === index + 1) ?? null }
  })
}
