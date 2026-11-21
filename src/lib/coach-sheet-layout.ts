import type { Cell, Sheet } from '@fortune-sheet/core'

export type Intake = { client: string; name: string; weeks: number; days: string[]; start: string; unit: 'lb' | 'kg' }
export type BlockIds = Record<string, string[]>
/** Weeks (2+) where an exercise block switches to a different exercise, keyed by block ID. */
export type Switches = Record<string, number[]>
export type CoachSheetDraft = { format: 'unrack-generated-cycle-v1'; intake: Intake; counts: Record<string, number>; sheets: Sheet[]; blockIds?: BlockIds; switches?: Switches }
/** Per day, per block position: the weeks (1-based) where the block's exercise name starts. */
export type NameStarts = Record<string, number[][]>
export function nameStarts(intake: Intake, blockIds: BlockIds, switches?: Switches): NameStarts {
  return Object.fromEntries(intake.days.map(day => [day, (blockIds[day] || []).map(id =>
    [1, ...[...new Set(switches?.[id] ?? [])].filter(week => Number.isInteger(week) && week > 1 && week <= intake.weeks).sort((a, b) => a - b)])]))
}
export const startsOf = (starts: NameStarts | undefined, day: string, block: number) => starts?.[day]?.[block] ?? [1]
export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const starterExercises = 5

export function cell(value: string, background?: string, wrap = true): Cell {
  return { v: value, m: value, bg: background, tb: wrap ? '2' : '1', ct: { fa: '@', t: 's' } }
}

export function sheetMatrix(sheet?: Sheet): (Cell | null)[][] {
  if (!sheet) return []
  if (sheet.data) return sheet.data
  const matrix: (Cell | null)[][] = Array.from({ length: sheet.row || 0 }, () => Array.from({ length: sheet.column || 0 }, () => null))
  sheet.celldata?.forEach(({ r, c, v }) => { if (matrix[r]) matrix[r][c] = v })
  return matrix
}

export function initialCounts(intake: Intake): Record<string, number> {
  return Object.fromEntries(intake.days.map(day => [day, starterExercises]))
}

export function editableCell(intake: Intake, counts: Record<string, number>, row: number, column: number, starts?: NameStarts): boolean {
  const day = intake.days[Math.floor(column / 5)]
  const position = (row - 1) % (intake.weeks + 1), block = Math.floor((row - 1) / (intake.weeks + 1))
  return row > 0 && column >= 0 && !!day && block < counts[day] && position > 0
    && (column % 5 === 2 || column % 5 === 3 || (column % 5 === 1 && startsOf(starts, day, block).includes(position)))
}
export function initialBlockIds(intake: Intake, counts: Record<string, number>): BlockIds {
  return Object.fromEntries(intake.days.map(day => [day, Array.from({ length: counts[day] }, () => crypto.randomUUID())]))
}
export function resolveBlockIds(intake: Intake, counts: Record<string, number>, saved?: BlockIds): BlockIds {
  return saved && intake.days.every(day => Array.isArray(saved[day]) && saved[day].length === counts[day]
    && saved[day].every(id => typeof id === 'string' && id.length > 0) && new Set(saved[day]).size === counts[day])
    ? saved : initialBlockIds(intake, counts)
}
const nameFill = '#f0f5f2', switchFill = '#fbf1d9'
/** The fill each run's first name cell should have: amber only where the exercise actually changes
 * from the run before it. Same name in every week (after "Change exercise by week") stays plain;
 * amber there read as a yellow flag (Joe, Nov 18). */
export function runFills(intake: Intake, counts: Record<string, number>, starts: NameStarts | undefined, matrix: (Cell | null)[][]): [row: number, column: number, fill: string, span: number][] {
  const fills: [number, number, string, number][] = []
  for (const [dayIndex, day] of intake.days.entries()) for (let block = 0; block < (counts[day] || 0); block++) {
    const column = dayIndex * 5 + 1, first = 1 + block * (intake.weeks + 1)
    const name = (start: number) => String(matrix[first + start]?.[column]?.v ?? '').trim()
    startsOf(starts, day, block).forEach((start, index, runs) => fills.push([first + start, column,
      index > 0 && name(start) !== name(runs[index - 1]) ? switchFill : nameFill, (runs[index + 1] ?? intake.weeks + 1) - start]))
  }
  return fills
}
export function generate(intake: Intake, counts: Record<string, number>, previous?: Sheet, rowMap?: Record<string, number[]>, starts?: NameStarts): Sheet[] {
  const columns = intake.days.length * 5 - 1
  const blockHeight = intake.weeks + 1
  const rows = 1 + Math.max(...intake.days.map(day => counts[day] || starterExercises)) * blockHeight
  const data: (Cell | null)[][] = Array.from({ length: rows }, () => Array.from({ length: columns }, () => null))
  const old = sheetMatrix(previous)
  const widths: Record<string, number> = {}
  const heights: Record<string, number> = {}
  const merges: Record<string, { r: number; c: number; rs: number; cs: number }> = {}
  for (let day = 0; day < intake.days.length; day++) {
    const base = day * 5
    for (let column = 0; column < 4; column++) data[0][base + column] = cell(column === 1 ? intake.days[day].toUpperCase() : '', '#b8d0c8', false)
    widths[String(base)] = 92
    widths[String(base + 1)] = 250
    widths[String(base + 2)] = 350
    widths[String(base + 3)] = 430
    if (day < intake.days.length - 1) {
      widths[String(base + 4)] = 22
      for (let row = 0; row < rows; row++) data[row][base + 4] = cell('', '#829d93')
    }
    for (let exercise = 0; exercise < counts[intake.days[day]]; exercise++) {
      const labels = 1 + exercise * blockHeight
      ;['WEEK', 'EXERCISE', 'PRESCRIPTION', 'COACH INSTRUCTIONS'].forEach((label, column) => { data[labels][base + column] = cell(label, '#d6e5df', false) })
      heights[String(labels)] = 32
      // The name column merges over each run of weeks that share an exercise (one run unless switched).
      const runs = startsOf(starts, intake.days[day], exercise)
      const runOf = (week: number) => runs.filter(start => start <= week + 1).at(-1)!
      for (const [index, start] of runs.entries()) {
        const span = (runs[index + 1] ?? intake.weeks + 1) - start
        if (span > 1) merges[`${labels + start}_${base + 1}`] = { r: labels + start, c: base + 1, rs: span, cs: 1 }
      }
      for (let week = 0; week < intake.weeks; week++) {
        const row = labels + week + 1
        // A newly added block maps to -1: it has no old rows (never copy the header row's styles into it).
        const oldIndex = rowMap ? rowMap[intake.days[day]]?.[exercise] ?? -1 : exercise
        const oldRow = !rowMap ? row : oldIndex < 0 ? -1 : 2 + oldIndex * blockHeight + week
        data[row][base] = cell(`W${week + 1}`, '#edf3f0')
        const runStart = labels + runOf(week), merge = merges[`${runStart}_${base + 1}`]
        data[row][base + 1] = { ...cell('', nameFill), ...(merge ? { mc: row === runStart ? merge : { r: runStart, c: base + 1 } } : {}) }
        data[row][base + 2] = cell('')
        data[row][base + 3] = cell('')
        if (row === runStart && old[oldRow]?.[base + 1]?.v) data[row][base + 1] = { ...old[oldRow][base + 1]!, bg: data[row][base + 1]!.bg, mc: data[row][base + 1]!.mc }
        for (const column of [base + 2, base + 3]) {
          if (old[oldRow]?.[column]) data[row][column] = { ...old[oldRow][column]!, mc: undefined }
        }
        heights[String(row)] = 44
      }
    }
  }
  for (const [row, column, fill, span] of runFills(intake, counts, starts, data)) for (let at = row; at < row + span; at++) data[at][column] = { ...data[at][column]!, bg: fill }
  return [{ id: 'cycle', name: intake.name || 'Training cycle', celldata: data.flatMap((line, r) => line.flatMap((value, c) => value ? [{ r, c, v: value }] : [])), row: rows, column: columns, zoomRatio: previous?.zoomRatio || 0.9, defaultRowHeight: 44, config: { columnlen: widths, rowlen: heights, merge: merges } }]
}

function canonicalValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalValue(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}

// Bulk engine operations may bypass cell hooks: reject their whole snapshot rather
// than repair content after a raw row operation has shifted its source coordinates.
export function validStructure(intake: Intake, counts: Record<string, number>, sheets: Sheet[], starts?: NameStarts): boolean {
  if (!intake || !Array.isArray(intake.days) || intake.days.length < 1 || intake.days.length > 7
    || new Set(intake.days).size !== intake.days.length || intake.days.some(day => !weekdays.includes(day))
    || !Number.isInteger(intake.weeks) || intake.weeks < 1 || intake.weeks > 16
    || !counts || intake.days.some(day => !Number.isInteger(counts[day]) || counts[day] < 1 || counts[day] > 20)) return false
  const expected = generate(intake, counts, undefined, undefined, starts)[0]
  const actual = sheets[0]
  if (sheets.length !== 1 || !actual || actual.id !== expected.id || actual.name !== expected.name
    || actual.row !== expected.row || actual.column !== expected.column) return false
  const matrix = sheetMatrix(actual), template = sheetMatrix(expected)
  const merges = (sheet: Sheet) => canonicalValue(sheet.config?.merge || {})
  if (merges(actual) !== merges(expected)) return false
  for (let row = 0; row < Math.max(matrix.length, template.length); row++) {
    for (let column = 0; column < Math.max(matrix[row]?.length || 0, template[row]?.length || 0); column++) {
      const value = matrix[row]?.[column], reference = template[row]?.[column]
      if (!editableCell(intake, counts, row, column, starts) && (String(value?.v ?? '') !== String(reference?.v ?? '') || value?.f)) return false
      if (canonicalValue(value?.mc) !== canonicalValue(reference?.mc)) return false
    }
  }
  return true
}
