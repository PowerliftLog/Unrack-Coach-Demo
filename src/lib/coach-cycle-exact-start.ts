/** Calendar-date schedule for the versioned exact-start Coach cycle contract. */
export type ExactStartDay = {
  /** ISO weekday, Monday = 1. Stable identity of the source sheet lane. */
  weekday: number
  /** Chronological day within this seven-date cycle week. */
  offset: number
  scheduledDate: string
}

export type ExactStartWeek = { ordinal: number; days: ExactStartDay[] }
export type ExactStartSchedule = { startOn: string; endOn: string; weeks: ExactStartWeek[] }

function parseDate(value: string): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return null
  const date = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}

function addDays(date: Date, offset: number): string {
  const next = new Date(date.getTime() + offset * 86_400_000)
  if (!Number.isFinite(next.getTime())) throw new RangeError('cycle date outside supported range')
  const iso = next.toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith('0000')) {
    throw new RangeError('cycle date outside supported range')
  }
  return iso
}

/**
 * Week 1 is the selected date and the six calendar dates that follow it.
 * Each selected weekday appears once in that window; later weeks add seven
 * dates. Dates are date-only values, never local-midnight instants.
 */
export function compileExactStartSchedule(startOn: string, weekCount: number, selectedWeekdays: readonly number[]): ExactStartSchedule {
  const start = parseDate(startOn)
  if (!start || !Number.isSafeInteger(weekCount) || weekCount < 1 || weekCount > 12
    || !selectedWeekdays.length || selectedWeekdays.length > 7
    || selectedWeekdays.some((day, index) => !Number.isInteger(day) || day < 1 || day > 7
      || index > 0 && day <= selectedWeekdays[index - 1])) {
    throw new RangeError('invalid exact-start cycle schedule')
  }
  const startWeekday = (start.getUTCDay() + 6) % 7 + 1
  const lanes = selectedWeekdays.map(weekday => ({ weekday, offset: (weekday - startWeekday + 7) % 7 }))
    .sort((a, b) => a.offset - b.offset)
  const endOn = addDays(start, weekCount * 7 - 1)
  return {
    startOn,
    endOn,
    weeks: Array.from({ length: weekCount }, (_, index) => ({
      ordinal: index + 1,
      days: lanes.map(({ weekday, offset }) => ({
        weekday,
        offset,
        scheduledDate: addDays(start, index * 7 + offset),
      })),
    })),
  }
}
