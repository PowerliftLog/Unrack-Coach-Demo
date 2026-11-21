import { COACH_CYCLE_PUBLISH_LIMITS } from './coach-cycle-limits'
import {
  generate, initialBlockIds, initialCounts, nameStarts, resolveBlockIds, sheetMatrix, startsOf, weekdays,
  type BlockIds, type CoachSheetDraft,
} from './coach-sheet-layout'

export const COACH_SHEET_SHAPE_LIMITS = {
  // The server compile and publish checks cap a cycle at 12 weeks (coach-cycle-publish-api, coach-cycle-destination).
  weeks: 12,
  authoredDays: COACH_CYCLE_PUBLISH_LIMITS.authoredDays,
} as const

export function addWeekBlocked({ intake }: Pick<CoachSheetDraft, 'intake'>): string | null {
  if (intake.weeks >= COACH_SHEET_SHAPE_LIMITS.weeks) return `A cycle can have at most ${COACH_SHEET_SHAPE_LIMITS.weeks} weeks.`
  if (intake.days.length * (intake.weeks + 1) > COACH_SHEET_SHAPE_LIMITS.authoredDays) {
    return `A cycle can have at most ${COACH_SHEET_SHAPE_LIMITS.authoredDays} workouts. Remove a day or start a new cycle for more weeks.`
  }
  return null
}

export function addDayBlocked({ intake }: Pick<CoachSheetDraft, 'intake'>): string | null {
  if (intake.days.length >= weekdays.length) return 'Every day of the week is already a training day.'
  if ((intake.days.length + 1) * intake.weeks > COACH_SHEET_SHAPE_LIMITS.authoredDays) {
    return `A cycle can have at most ${COACH_SHEET_SHAPE_LIMITS.authoredDays} workouts. Remove a week or start a new cycle for another day.`
  }
  return null
}

const weeksOf = (weeks: number) => Array.from({ length: weeks }, (_, index) => index + 1)
const blockRow = (weeks: number, block: number) => 1 + block * (weeks + 1)

export type WeekOperation = 'add' | { remove: number }

/** For each new week, return its 1-based source week. */
export function sourceWeeks(oldWeeks: number, operation?: WeekOperation): number[] {
  const weeks = weeksOf(oldWeeks)
  if (!operation) return weeks
  if (operation === 'add') return [...weeks, oldWeeks]
  return weeks.filter(week => week !== operation.remove)
}

type SheetShape = Omit<CoachSheetDraft, 'sheets' | 'format' | 'blockIds'> & { blockIds: BlockIds }

/** Lay out the new grid, then carry cells over by weekday, block, and source week. */
function reshape(draft: CoachSheetDraft, shape: SheetShape, weekSources = sourceWeeks(draft.intake.weeks)): CoachSheetDraft {
  const { intake, counts, blockIds, switches } = shape
  const oldWeeks = draft.intake.weeks
  const old = draft.sheets[0]
  const oldMatrix = sheetMatrix(old)
  const oldStarts = nameStarts(draft.intake, blockIds, draft.switches)
  const starts = nameStarts(intake, blockIds, switches)
  const [sheet] = generate(intake, counts, undefined, undefined, starts)
  const oldDayIndexes = intake.days.map(day => draft.intake.days.indexOf(day))
  const oldColumns = Array.from({ length: sheet.column ?? 0 }, (_, column) => {
    const oldDayIndex = oldDayIndexes[Math.floor(column / 5)]
    const oldColumn = oldDayIndex * 5 + column % 5
    return oldDayIndex < 0 || oldColumn >= (old.column ?? 0) ? -1 : oldColumn
  })

  const matrix = sheetMatrix(sheet)
  for (const [r, line] of matrix.entries()) {
    const block = r === 0 ? 0 : Math.floor((r - 1) / (intake.weeks + 1))
    const week = r === 0 ? 0 : r - blockRow(intake.weeks, block)
    const sourceWeek = week === 0 ? 0 : weekSources[week - 1]
    const sourceBlockRow = blockRow(oldWeeks, block)
    const appendedWeek = week > oldWeeks

    for (const [c, template] of line.entries()) {
      const column = oldColumns[c]
      const offset = c % 5
      if (column === -1 || (appendedWeek && (!template || offset === 0 || offset === 4))) continue

      let row = r === 0 ? 0 : sourceBlockRow + sourceWeek
      if (offset === 1 && week > 0 && template) {
        const day = intake.days[Math.floor(c / 5)]
        if (startsOf(starts, day, block).includes(week)) {
          // If the old run's first week was removed, carry its name to the new first week.
          const start = startsOf(oldStarts, day, block).filter(start => start <= sourceWeek).at(-1)!
          row = sourceBlockRow + start
        } else if (appendedWeek) {
          template.bg = oldMatrix[row]?.[column]?.bg ?? template.bg
          continue
        }
      }

      const source = oldMatrix[row]?.[column]
      if (!source) {
        // Keep absent cells sparse unless the new layout needs a merge, a gutter or an appended cell.
        if (!template?.mc && row < oldMatrix.length && !appendedWeek) line[c] = null
        continue
      }
      const value = appendedWeek ? structuredClone(source) : { ...source }
      if (template?.mc) value.mc = template.mc
      else if (value.mc || appendedWeek) delete value.mc
      if (offset === 0 && template && week !== sourceWeek) {
        value.v = template.v
        value.m = template.m
      }
      line[c] = value
    }
  }
  sheet.celldata = matrix.flatMap((line, r) => line.flatMap((value, c) => value ? [{ r, c, v: value }] : []))

  const widths = sheet.config?.columnlen
  for (const [column, sourceColumn] of oldColumns.entries()) {
    const width = old.config?.columnlen?.[sourceColumn]
    if (widths && width !== undefined) widths[column] = width
  }

  sheet.id = old.id
  sheet.name = old.name
  sheet.zoomRatio = old.zoomRatio
  return structuredClone({
    format: draft.format, intake, counts, blockIds, sheets: [sheet],
    ...(switches === undefined ? {} : { switches }),
  })
}

export function addWeek(draft: CoachSheetDraft): CoachSheetDraft {
  const blocked = addWeekBlocked(draft)
  if (blocked) throw new Error(blocked)
  const { intake, counts, switches } = draft
  return reshape(draft, {
    intake: { ...intake, weeks: intake.weeks + 1 }, counts, switches,
    blockIds: resolveBlockIds(intake, counts, draft.blockIds),
  }, sourceWeeks(intake.weeks, 'add'))
}

export function removeWeek(draft: CoachSheetDraft, week: number): CoachSheetDraft {
  const { intake, counts } = draft
  if (intake.weeks === 1) throw new Error('A cycle needs at least one week.')
  if (!Number.isInteger(week) || week < 1 || week > intake.weeks) throw new Error('Choose a week in this cycle.')
  const blockIds = resolveBlockIds(intake, counts, draft.blockIds)
  const starts = nameStarts(intake, blockIds, draft.switches)
  const switchEntries: [string, number[]][] = []
  for (const day of intake.days) for (const [block, id] of blockIds[day].entries()) {
    const runs = starts[day][block]
    const next = runs.slice(1)
      .filter(start => start !== week || (week < intake.weeks && !runs.includes(week + 1)))
      .map(start => start > week ? start - 1 : start)
      .filter(start => start > 1 && start < intake.weeks)
    if (next.length) switchEntries.push([id, next])
  }
  return reshape(draft, {
    intake: { ...intake, weeks: intake.weeks - 1 }, counts, blockIds,
    switches: switchEntries.length ? Object.fromEntries(switchEntries) : undefined,
  }, sourceWeeks(intake.weeks, { remove: week }))
}

export function addDay(draft: CoachSheetDraft, weekday: string): CoachSheetDraft {
  const blocked = addDayBlocked(draft)
  if (blocked) throw new Error(blocked)
  const { intake, counts, switches } = draft
  if (!weekdays.includes(weekday) || intake.days.includes(weekday)) throw new Error('Choose an unused weekday.')
  const days = weekdays.filter(day => day === weekday || intake.days.includes(day))
  const newDay = { ...intake, days: [weekday] }
  const newCounts = initialCounts(newDay)
  return reshape(draft, {
    intake: { ...intake, days },
    counts: { ...counts, ...newCounts },
    blockIds: { ...resolveBlockIds(intake, counts, draft.blockIds), ...initialBlockIds(newDay, newCounts) },
    switches,
  })
}

export function removeDay(draft: CoachSheetDraft, weekday: string): CoachSheetDraft {
  const { intake } = draft
  if (intake.days.length === 1) throw new Error('A cycle needs at least one training day.')
  if (!intake.days.includes(weekday)) throw new Error('Choose a training day in this cycle.')
  const counts = { ...draft.counts }
  const blockIds = { ...resolveBlockIds(intake, counts, draft.blockIds) }
  const switches = { ...draft.switches }
  for (const id of blockIds[weekday]) delete switches[id]
  delete counts[weekday]
  delete blockIds[weekday]
  return reshape(draft, {
    intake: { ...intake, days: intake.days.filter(day => day !== weekday) }, counts, blockIds,
    switches: Object.keys(switches).length ? switches : undefined,
  })
}

function dayWeeksHaveContent(draft: CoachSheetDraft, matrix: ReturnType<typeof sheetMatrix>, dayIndex: number, weeks: number[]): boolean {
  const day = draft.intake.days[dayIndex]
  const base = dayIndex * 5
  for (let block = 0; block < draft.counts[day]; block++) {
    const start = blockRow(draft.intake.weeks, block)
    for (const week of weeks) {
      if ([1, 2, 3].some(offset => String(matrix[start + week]?.[base + offset]?.v ?? '').trim() !== '')) return true
    }
  }
  return false
}

export function weekHasContent(draft: CoachSheetDraft, week: number): boolean {
  if (!Number.isInteger(week) || week < 1 || week > draft.intake.weeks) return false
  const matrix = sheetMatrix(draft.sheets[0])
  return draft.intake.days.some((_, index) => dayWeeksHaveContent(draft, matrix, index, [week]))
}

export function dayHasContent(draft: CoachSheetDraft, weekday: string): boolean {
  const index = draft.intake.days.indexOf(weekday)
  return index >= 0 && dayWeeksHaveContent(draft, sheetMatrix(draft.sheets[0]), index, weeksOf(draft.intake.weeks))
}
