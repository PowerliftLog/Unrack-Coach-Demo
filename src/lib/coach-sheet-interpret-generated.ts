import {
  COACH_SHEET_PARSER_VERSION,
  parseCoachPrescription,
  type CoachPrescriptionParse,
  type CoachSheetIssue,
  type CoachSheetSource,
  type CoachSheetText,
  type CoachWeightUnit,
} from './coach-sheet-interpret'

/** `name` starts a different exercise in this block from this week on (a mid-cycle switch). */
export type CoachGeneratedWeekInput = { week: number; prescription: CoachSheetText; instructions: CoachSheetText; name?: CoachSheetText }
export type CoachGeneratedExerciseInput = { id: string; name: CoachSheetText; weeks: CoachGeneratedWeekInput[] }
export type CoachGeneratedDayInput = { id: string; name: string; exercises: CoachGeneratedExerciseInput[] }
export type CoachGeneratedSheetInput = {
  cycleId: string
  weeks: number
  defaultUnit: CoachWeightUnit
  days: CoachGeneratedDayInput[]
  /** Trusted generated structural manifest: exact identity markers, headers and week gutters. */
  structure?: CoachSheetText[]
  /** Complete snapshot of populated cells; when supplied, every cell must match the manifest. */
  populatedCells?: CoachSheetText[]
}
export type CoachSheetCoverage = {
  source: CoachSheetSource
  text: string
  role: 'structure' | 'exercise' | 'prescription' | 'instructions'
  dayId?: string
  exerciseId?: string
  week?: number
}
export type CoachInterpretedWeek = {
  id: string
  week: number
  instructions: string
  instructionSource: CoachSheetSource
  prescription: CoachPrescriptionParse
  reviewKey: string
  /** Present on the week a switched exercise starts; later weeks carry it until the next switch. */
  renamed?: { name: string; source: CoachSheetSource }
}
export type CoachInterpretedExercise = { id: string; name: string; nameSource: CoachSheetSource; weeks: CoachInterpretedWeek[] }
export type CoachInterpretedDay = { id: string; name: string; exercises: CoachInterpretedExercise[] }
export type CoachGeneratedSheetInterpretation = {
  parserVersion: typeof COACH_SHEET_PARSER_VERSION
  cycleId: string
  days: CoachInterpretedDay[]
  issues: CoachSheetIssue[]
  coverage: CoachSheetCoverage[]
  reviewKey: string
  status: 'ready_for_review' | 'blocked'
  totals: { groups: number; sets: number }
}

const coordinate = (source: CoachSheetSource) => JSON.stringify([source.sheetId, source.address])
const identity = (source: CoachSheetSource) => JSON.stringify([source.sheetId, source.cellId])
const stableId = (parts: (string | number)[]) => JSON.stringify(parts)
export const COACH_SHEET_DESTINATION_VERSION = 'coach-sheet-athlete/1' as const

/** Multiply a decimal exactly and require it to fit the destination's decimal scale. */
function exactScaledValue(value: number, multiplier: number, places: number): number | null {
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  const scale = fraction.length - Number(exponent)
  let numerator = BigInt(whole + fraction) * BigInt(multiplier) * 10n ** BigInt(places)
  let denominator = 1n
  if (scale >= 0) denominator = 10n ** BigInt(scale)
  else numerator *= 10n ** BigInt(-scale)
  if (numerator % denominator !== 0n) return null
  const integer = numerator / denominator
  return integer <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(integer) / 10 ** places : null
}

function destinationPrescription(parsed: CoachPrescriptionParse): CoachPrescriptionParse {
  const issues = [...parsed.issues]
  const groups = parsed.groups.map(group => {
    const issue = (message: string) => issues.push({ code: 'destination_limit', severity: 'blocking', message, source: group.source, start: group.start, end: group.end, position: group.position })
    let dose = group.dose
    if (dose.kind === 'amrap') {
      // No numeric dose to check; an N+ minimum was bounded by the parser.
    } else if (dose.kind === 'reps') {
      if (dose.max > 1000) issue('The athlete destination supports at most 1000 reps per set.')
    } else if (dose.kind === 'time') {
      const seconds = exactScaledValue(dose.value, dose.unit === 'min' ? 60 : 1, 0)
      if (seconds === null || seconds < 1 || seconds > 9_999_999) issue('An exact duration must convert to 1–9999999 whole seconds without rounding.')
      else dose = { kind: 'time', value: seconds, unit: 'sec' }
    } else {
      const distance = exactScaledValue(dose.value, dose.unit === 'yd' ? 3 : 1, 3)
      if (distance === null || distance < 0.001 || distance > 9_999_999.999) issue('An exact distance must fit 0.001–9999999.999 with at most three decimal places; yards convert exactly to feet.')
      else dose = { kind: 'distance', value: distance, unit: dose.unit === 'yd' ? 'ft' : dose.unit }
    }
    if (group.load.kind === 'exact') {
      if (exactScaledValue(group.load.weight, 1, 3) === null || group.load.weight > 9_999_999.999) issue('The athlete destination supports exact weights up to 9999999.999 with at most three decimal places.')
      if (group.load.weight === 0) issue('Zero exact weight needs an explicit load decision. Choose bodyweight or no load, or a separately supported zero-added-weight meaning.')
    }
    if (group.load.kind === 'percentage' && exactScaledValue(group.load.percent, 1, 3) === null) issue('A percentage must fit at most three decimal places before destination resolution.')
    return { ...group, dose }
  })
  return { ...parsed, groups, issues, status: issues.length ? 'blocked' : parsed.status, reviewKey: JSON.stringify([COACH_SHEET_DESTINATION_VERSION, parsed.reviewKey]) }
}

/**
 * Interpret a generated sheet through its stable manifest, never exercise names or coordinates.
 * The caller must provide trusted structural roles and a complete populated snapshot for coverage.
 * Omitting the optional snapshot is useful for pure model previews and is not full sheet admission.
 * A review key binds exact source, week, instructions, unit and identities; it is not a signature.
 */
export function interpretCoachSheet(input: CoachGeneratedSheetInput): CoachGeneratedSheetInterpretation {
  const issues: CoachSheetIssue[] = []
  const coverage: CoachSheetCoverage[] = []
  const ids = new Set<string>()
  const coordinates = new Map<string, CoachSheetCoverage>()
  const cellIds = new Map<string, CoachSheetCoverage>()
  const addIssue = (code: CoachSheetIssue['code'], message: string, source?: CoachSheetSource) => issues.push({ code, severity: 'blocking', message, ...(source ? { source: { ...source } } : {}) })
  const checkIdentity = (id: string, label: string) => {
    if (!id.trim() || ids.has(id)) addIssue('duplicate_identity', `${label} needs a nonempty unique stable ID.`)
    ids.add(id)
  }
  const addCoverage = (cell: CoachSheetText, role: CoachSheetCoverage['role'], context: Pick<CoachSheetCoverage, 'dayId' | 'exerciseId' | 'week'> = {}) => {
    const entry: CoachSheetCoverage = { source: { ...cell.source }, text: cell.text, role, ...context }
    coverage.push(entry)
    if (!cell.source.sheetId.trim() || !/^[A-Z]+[1-9]\d*$/.test(cell.source.address) || !cell.source.cellId?.trim()) addIssue('invalid_source', 'Generated cells need a sheet ID, an uppercase A1 address and a stable cell ID.', cell.source)
    const key = coordinate(cell.source)
    if (coordinates.has(key)) addIssue('source_collision', 'One source cell cannot serve multiple generated-sheet roles.', cell.source)
    else coordinates.set(key, entry)
    const id = identity(cell.source)
    if (cellIds.has(id)) addIssue('source_collision', 'Stable source cell IDs must be unique within a sheet.', cell.source)
    else cellIds.set(id, entry)
  }

  if (!input.cycleId.trim() || !Number.isInteger(input.weeks) || input.weeks < 1 || input.weeks > 16 || !input.days.length || (input.defaultUnit !== 'lb' && input.defaultUnit !== 'kg')) addIssue('invalid_cycle', 'Choose a cycle ID, 1–16 weeks, at least one training day and a default weight unit.')
  checkIdentity(input.cycleId, 'Cycle')
  input.structure?.forEach(cell => addCoverage(cell, 'structure'))
  const days = input.days.map(day => {
    checkIdentity(day.id, 'Training day')
    if (!day.name.trim()) addIssue('invalid_cycle', 'Each training day needs a name.')
    if (day.exercises.length > 12) addIssue('destination_limit', 'The athlete destination supports at most 12 exercise occurrences in one training day.')
    return {
      id: day.id,
      name: day.name,
      exercises: day.exercises.map(exercise => {
        checkIdentity(exercise.id, 'Exercise occurrence')
        const context = { dayId: day.id, exerciseId: exercise.id }
        addCoverage(exercise.name, 'exercise', context)
        if (!exercise.name.text.trim()) addIssue('missing_exercise_name', 'Enter a name for this exercise occurrence or remove its block.', exercise.name.source)
        else if (exercise.name.text.length > 120 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(exercise.name.text)) addIssue('destination_limit', 'Exercise names must fit 120 characters and cannot contain control characters.', exercise.name.source)
        const weeksSeen = new Set<number>()
        const weeks = exercise.weeks.map(slot => {
          addCoverage(slot.prescription, 'prescription', { ...context, week: slot.week })
          addCoverage(slot.instructions, 'instructions', { ...context, week: slot.week })
          if (slot.name) {
            addCoverage(slot.name, 'exercise', { ...context, week: slot.week })
            if (!slot.name.text.trim()) addIssue('missing_exercise_name', `Enter the exercise that starts in week ${slot.week}, or remove the switch.`, slot.name.source)
            else if (slot.name.text.length > 120 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(slot.name.text)) addIssue('destination_limit', 'Exercise names must fit 120 characters and cannot contain control characters.', slot.name.source)
          }
          if (!Number.isInteger(slot.week) || slot.week < 1 || slot.week > input.weeks) addIssue('unexpected_week', 'This prescription slot is outside the configured cycle weeks.', slot.prescription.source)
          if (weeksSeen.has(slot.week)) addIssue('duplicate_week', 'Each exercise needs exactly one prescription slot per cycle week.', slot.prescription.source)
          weeksSeen.add(slot.week)
          // Raw instructions remain byte-for-byte scoped to this week, including whitespace.
          if (slot.instructions.text.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(slot.instructions.text)) addIssue('invalid_instructions', 'Coach instructions must fit 500 characters and cannot contain control characters.', slot.instructions.source)
          const prescription = destinationPrescription(parseCoachPrescription(slot.prescription.text, { defaultUnit: input.defaultUnit, source: slot.prescription.source }))
          issues.push(...prescription.issues)
          if (prescription.groups.length > 20 || prescription.groups.reduce((sum, group) => sum + group.count, 0) > 20) addIssue('destination_limit', 'The athlete destination supports at most 20 ordered groups and 20 physical sets per exercise and week.', slot.prescription.source)
          const reviewKey = JSON.stringify([COACH_SHEET_PARSER_VERSION, input.cycleId, day.id, day.name, exercise.id, exercise.name, slot.week, prescription.reviewKey, slot.instructions, ...(slot.name ? [slot.name] : [])])
          return { id: stableId([exercise.id, slot.week]), week: slot.week, instructions: slot.instructions.text, instructionSource: { ...slot.instructions.source }, prescription, reviewKey, ...(slot.name ? { renamed: { name: slot.name.text, source: { ...slot.name.source } } } : {}) }
        })
        if (Number.isInteger(input.weeks) && input.weeks >= 1 && input.weeks <= 16) {
          for (let week = 1; week <= input.weeks; week++) {
            if (!weeksSeen.has(week)) addIssue('missing_week', `Week ${week} is missing. Every exercise needs a prescription or explicit SKIP in every week.`, exercise.name.source)
          }
        }
        weeks.sort((left, right) => left.week - right.week)
        return { id: exercise.id, name: exercise.name.text, nameSource: { ...exercise.name.source }, weeks }
      }),
    }
  })

  if (input.populatedCells) {
    const seen = new Set<string>()
    const snapshotIds = new Set<string>()
    input.populatedCells.forEach(cell => {
      const key = coordinate(cell.source)
      if (seen.has(key)) addIssue('source_collision', 'The sheet snapshot contains a duplicate source coordinate.', cell.source)
      seen.add(key)
      const cellId = identity(cell.source)
      if (snapshotIds.has(cellId)) addIssue('source_collision', 'The sheet snapshot contains a duplicate stable cell ID.', cell.source)
      snapshotIds.add(cellId)
      const expected = coordinates.get(key)
      if (!expected) {
        if (cell.text.length) addIssue('unaccounted_cell', 'This populated cell has no generated-sheet role. Move it into a known authoring cell or remove it.', cell.source)
      } else if (expected.text !== cell.text || expected.source.cellId !== cell.source.cellId) addIssue('source_value_mismatch', 'The live source cell differs from the manifest. Refresh interpretation using the current source.', cell.source)
    })
    coverage.forEach(entry => {
      if (entry.text.length && !seen.has(coordinate(entry.source))) addIssue('missing_source_cell', 'A populated manifest cell is absent from the sheet snapshot.', entry.source)
    })
  }

  let groupCount = 0
  let setCount = 0
  for (const day of days) for (const exercise of day.exercises) for (const week of exercise.weeks) for (const group of week.prescription.groups) {
    groupCount++
    setCount += group.count
    if (!Number.isSafeInteger(setCount)) addIssue('invalid_number', 'The physical set total exceeds the supported safe whole-number range.', group.source)
  }
  const reviewKey = JSON.stringify([COACH_SHEET_PARSER_VERSION, COACH_SHEET_DESTINATION_VERSION, input.cycleId, input.weeks, input.defaultUnit, input.structure ?? [], days.map(day => [day.id, day.name, day.exercises.map(exercise => [exercise.id, exercise.name, exercise.weeks.map(week => week.reviewKey)])]), input.populatedCells ?? null])
  return { parserVersion: COACH_SHEET_PARSER_VERSION, cycleId: input.cycleId, days, issues, coverage, reviewKey, status: issues.length ? 'blocked' : 'ready_for_review', totals: { groups: groupCount, sets: setCount } }
}

type EditorCell = { v?: unknown; f?: string }
type EditorSheet = {
  id?: string | number
  name?: string
  data?: (EditorCell | null)[][]
  celldata?: { r: number; c: number; v?: EditorCell | null }[]
}
/** Structural subset of the editor draft; no runtime dependency on the editor or React. */
export type CoachSheetEditorDraftInput = {
  intake: { name: string; weeks: number; days: string[]; unit: CoachWeightUnit }
  counts: Record<string, number>
  sheets: EditorSheet[]
  blockIds?: Record<string, string[]>
  /** Weeks (2+) where a block switches to a different exercise, keyed by block ID. */
  switches?: Record<string, number[]>
}

function a1(row: number, column: number): string {
  let index = column + 1
  let label = ''
  while (index > 0) { label = String.fromCharCode(65 + (index - 1) % 26) + label; index = Math.floor((index - 1) / 26) }
  return `${label}${row + 1}`
}

/**
 * Convenience adapter for the generated FortuneSheet layout. Only this adapter knows coordinates;
 * block IDs determine occurrence identity. The complete snapshot is checked against expected cells,
 * including gutters, repeated headers, merged-name placeholders, separators and extra sheets.
 * Pass the persisted cycle/draft ID as options.cycleId for any server-bound review. The sheet-ID
 * fallback is for local previews only; generated sheet IDs such as "cycle" are not program IDs.
 * Neither this result nor ready_for_review status authorizes publication.
 */
export function interpretCoachSheetDraft(draft: CoachSheetEditorDraftInput, options: { cycleId?: string } = {}): CoachGeneratedSheetInterpretation {
  const sheet = draft.sheets[0]
  const cycleId = options.cycleId ?? String(sheet?.id ?? '')
  const sheetId = String(sheet?.id ?? '')
  const extraIssues: CoachSheetIssue[] = []
  const cells = new Map<string, EditorCell>()
  const coordinateKey = (row: number, column: number) => `${row}:${column}`
  const addCell = (row: number, column: number, cell?: EditorCell | null) => {
    if (!Number.isSafeInteger(row) || !Number.isSafeInteger(column) || row < 0 || column < 0) {
      extraIssues.push({ code: 'invalid_source', severity: 'blocking', message: 'The sheet contains an invalid cell coordinate.' })
      return
    }
    const key = coordinateKey(row, column)
    if (cells.has(key)) extraIssues.push({ code: 'source_collision', severity: 'blocking', message: 'The sparse sheet contains duplicate cell coordinates.', source: { sheetId, address: a1(row, column) } })
    if (cell) cells.set(key, cell)
  }
  if (sheet?.data) sheet.data.forEach((row, r) => row?.forEach((cell, c) => addCell(r, c, cell)))
  else sheet?.celldata?.forEach(cell => addCell(cell.r, cell.c, cell.v))
  if (draft.sheets.length !== 1) extraIssues.push({ code: 'invalid_cycle', severity: 'blocking', message: 'A generated cycle must contain exactly one sheet.' })
  const sourceByCoordinate = new Map<string, CoachSheetSource>()
  const textAt = (row: number, column: number): string => {
    const cell = cells.get(coordinateKey(row, column))
    if (!cell) return ''
    if (cell.f) return cell.f
    return cell.v == null ? '' : typeof cell.v === 'string' || typeof cell.v === 'number' ? String(cell.v) : JSON.stringify(cell.v) ?? ''
  }
  const sourceAt = (row: number, column: number, id: string): CoachSheetSource => {
    const source = { sheetId, address: a1(row, column), cellId: id }
    sourceByCoordinate.set(coordinateKey(row, column), source)
    return source
  }
  const authoringCell = (row: number, column: number, id: string): CoachSheetText => ({ source: sourceAt(row, column, id), text: textAt(row, column) })
  const structure: CoachSheetText[] = []
  const structuralCell = (row: number, column: number, id: string, expected: string) => structure.push({ source: sourceAt(row, column, id), text: expected })
  const weeks = Number.isInteger(draft.intake.weeks) && draft.intake.weeks >= 1 && draft.intake.weeks <= 16 ? draft.intake.weeks : 0
  const counts = draft.intake.days.map(day => {
    const count = draft.counts[day]
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      extraIssues.push({ code: 'invalid_cycle', severity: 'blocking', message: 'Each generated day needs 1–20 exercise blocks.' })
      return 0
    }
    if (draft.blockIds?.[day]?.length !== count) extraIssues.push({ code: 'duplicate_identity', severity: 'blocking', message: 'Every generated exercise block needs its saved stable ID.' })
    return count
  })
  const rowCount = 1 + Math.max(0, ...counts) * (weeks + 1)
  const days = draft.intake.days.map((day, dayIndex): CoachGeneratedDayInput => {
    const base = dayIndex * 5
    const dayId = stableId(['day', day])
    for (let column = 0; column < 4; column++) structuralCell(0, base + column, stableId([dayId, 'title', column]), column === 1 ? day.toUpperCase() : '')
    if (dayIndex < draft.intake.days.length - 1) for (let row = 0; row < rowCount; row++) structuralCell(row, base + 4, stableId([dayId, 'separator', row]), '')
    return {
      id: dayId,
      name: day,
      exercises: Array.from({ length: counts[dayIndex] }, (_, exerciseIndex) => {
        const id = draft.blockIds?.[day]?.[exerciseIndex] ?? ''
        const header = 1 + exerciseIndex * (weeks + 1)
        const starts = new Set(draft.switches?.[id] ?? [])
        ;['WEEK', 'EXERCISE', 'PRESCRIPTION', 'COACH INSTRUCTIONS'].forEach((label, column) => structuralCell(header, base + column, stableId([id, 'header', column]), label))
        return {
          id,
          name: authoringCell(header + 1, base + 1, stableId([id, 'name'])),
          weeks: Array.from({ length: weeks }, (_, offset) => {
            const week = offset + 1
            const row = header + week
            structuralCell(row, base, stableId([id, 'week', week]), `W${week}`)
            const switched = offset > 0 && starts.has(week)
            if (offset > 0 && !switched) structuralCell(row, base + 1, stableId([id, 'merged-name', week]), '')
            return { week, prescription: authoringCell(row, base + 2, stableId([id, 'prescription', week])), instructions: authoringCell(row, base + 3, stableId([id, 'instructions', week])),
              ...(switched ? { name: authoringCell(row, base + 1, stableId([id, 'name', week])) } : {}) }
          }),
        }
      }),
    }
  })
  const populatedCells: CoachSheetText[] = []
  cells.forEach((cell, key) => {
    const [row, column] = key.split(':').map(Number)
    const source = sourceByCoordinate.get(key) ?? { sheetId, address: a1(row, column), cellId: stableId(['unmapped', row, column]) }
    const text = textAt(row, column)
    if (text.length) populatedCells.push({ source, text })
    if (cell.f || (cell.v != null && typeof cell.v !== 'string' && typeof cell.v !== 'number')) extraIssues.push({ code: 'unsupported_expression', severity: 'blocking', message: 'Generated authoring accepts literal text and numbers. Formulas and structured cell values require a separate import review.', source })
    if (typeof cell.v === 'number' && !Number.isFinite(cell.v)) extraIssues.push({ code: 'invalid_number', severity: 'blocking', message: 'A cell contains a non-finite number.', source })
  })
  // Extra sheets are never silently discarded, even if the primary sheet is otherwise valid.
  draft.sheets.slice(1).forEach((extra, index) => {
    const extraId = String(extra.id ?? `extra-sheet-${index + 1}`)
    const collect = (r: number, c: number, cell?: EditorCell | null) => {
      if (cell && (cell.f || cell.v != null && String(cell.v).length)) populatedCells.push({ source: { sheetId: extraId, address: a1(r, c), cellId: stableId(['extra', index, r, c]) }, text: cell.f || String(cell.v) })
    }
    if (extra.data) extra.data.forEach((row, r) => row?.forEach((cell, c) => collect(r, c, cell)))
    else extra.celldata?.forEach(cell => collect(cell.r, cell.c, cell.v))
  })
  const result = interpretCoachSheet({ cycleId, weeks: draft.intake.weeks, defaultUnit: draft.intake.unit, days, structure, populatedCells })
  result.issues.push(...extraIssues)
  if (extraIssues.length) result.status = 'blocked'
  result.reviewKey = JSON.stringify([result.reviewKey, draft.intake, draft.counts, draft.blockIds ?? null, extraIssues, ...(draft.switches && Object.keys(draft.switches).length ? [draft.switches] : [])])
  return result
}
