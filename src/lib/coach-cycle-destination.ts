import type { RichProgramDaySaveV2, RichProgramExerciseSaveV2, RichProgramSetSave } from './coach-api'
import { amrapMinimumNote, COACH_SHEET_PARSER_VERSION, type CoachSheetIssue, type CoachSheetSource, type CoachWeightUnit } from './coach-sheet-interpret'
import { interpretCoachSheet, type CoachGeneratedSheetInput, type CoachGeneratedSheetInterpretation, type CoachSheetCoverage } from './coach-sheet-interpret-generated'
import { COACH_CYCLE_PUBLISH_LIMITS } from './coach-cycle-limits'
import { compileExactStartSchedule } from './coach-cycle-exact-start'

export const COACH_CYCLE_DESTINATION_VERSION = 'coach-cycle-rich-destination/1' as const
export const COACH_CYCLE_DESTINATION_VERSION_V2 = 'coach-cycle-rich-destination/2' as const
export { COACH_CYCLE_PUBLISH_LIMITS } from './coach-cycle-limits'
const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type CoachCycleDestinationIntake = { name: string; weeks: number; start: string; unit: CoachWeightUnit; days: string[] }
export type CoachCycleDestinationIssue = Omit<CoachSheetIssue, 'code'> & {
  code: CoachSheetIssue['code'] | 'invalid_schedule' | 'intake_mismatch' | 'interpretation_mismatch'
}
export type CoachCycleDestinationSchedule = {
  /** Frozen /1 calendar contract. Exact starts use the separate /2 contract. */
  mode: 'monday_start'
  startOn: string
  endOn: string
  selectedWeekdays: number[]
  weeks: { ordinal: number; days: { name: string; weekday: number; plannedDate: string }[] }[]
}
export type CoachCycleDestinationScheduleV2 = Omit<CoachCycleDestinationSchedule, 'mode' | 'weeks'> & {
  mode: 'exact_start'
  /** Calendar order, independent of the Monday-first source lane order. */
  weeks: { ordinal: number; days: { name: string; weekday: number; offset: number; plannedDate: string }[] }[]
}
type ScheduleResultFor<Schedule> = { status: 'compiled'; schedule: Schedule; issues: [] }
  | { status: 'blocked'; schedule: null; issues: CoachCycleDestinationIssue[] }
type ScheduleResult = ScheduleResultFor<CoachCycleDestinationSchedule>
export type CoachCycleDestinationScheduleResultV2 = ScheduleResultFor<CoachCycleDestinationScheduleV2>
type ReplaceExercise = Extract<RichProgramExerciseSaveV2, { mode: 'replace' }>
type ReplaceSet = Extract<RichProgramSetSave, { mode: 'replace' }>
/** Exercise note on the first week of a mid-cycle exercise switch; shared with the server compile. */
export const exerciseSwitchNote = (previous: string): string => `New exercise this week (was ${previous})`
export type CoachCycleDestinationExerciseSource = {
  sourceKey: string
  sourceExerciseId: string
  sourceWeekId: string
  nameSource: CoachSheetSource
  prescriptionSource: CoachSheetSource
  instructionSource: CoachSheetSource
  rawPrescription: string
  rawInstructions: string
  /** Null means this week explicitly says SKIP and has no Rich exercise row. */
  ordinal: number | null
  setGroups: { sourceKey: string; position: number; source: CoachSheetSource; start: number; end: number; raw: string }[]
}
export type CoachCycleDestinationDay = {
  sourceKey: string
  sourceDayId: string
  weekday: number
  plannedDate: string
  /** A future atomic materializer must supply its own server day UUID. */
  payload: Omit<RichProgramDaySaveV2, 'identity_token'>
  exerciseSources: CoachCycleDestinationExerciseSource[]
}
export type CoachCycleDestination = {
  version: typeof COACH_CYCLE_DESTINATION_VERSION
  localOnly: true
  sourceCycleId: string
  sourceReviewKey: string
  /** Exact dependency token, not an approval, signature, UUID or publication credential. */
  reviewKey: string
  name: string
  defaultUnit: CoachWeightUnit
  materializationRequirements: {
    /** The retired calendar constructor defaults to lb; a publisher must set and verify this. */
    defaultUnit: CoachWeightUnit
    verifyDefaultUnitBeforeDaySave: true
    /** Current athlete clients hide weight only for none, so bodyweight needs a parity gate. */
    bodyweightNoWeightFieldParity: 'required' | 'not_applicable'
  }
  schedule: Omit<CoachCycleDestinationSchedule, 'weeks'>
  weeks: { sourceKey: string; ordinal: number; days: CoachCycleDestinationDay[] }[]
  totals: { exercises: number; omittedExercises: number; groups: number; sets: number }
}
/**
 * Days are chronological within each exact seven-date week. Their weekday,
 * sourceDayId and payload ordinal still identify the original source lane.
 */
export type CoachCycleDestinationV2 = Omit<CoachCycleDestination, 'version' | 'schedule'> & {
  version: typeof COACH_CYCLE_DESTINATION_VERSION_V2
  schedule: Omit<CoachCycleDestinationScheduleV2, 'weeks'>
}
type DestinationResultFor<Destination> = { status: 'compiled'; cycle: Destination; issues: [] }
  | { status: 'blocked'; cycle: null; issues: CoachCycleDestinationIssue[] }
export type CoachCycleDestinationResult = DestinationResultFor<CoachCycleDestination>
export type CoachCycleDestinationResultV2 = DestinationResultFor<CoachCycleDestinationV2>

const key = (...parts: (string | number)[]) => JSON.stringify(parts)
const issue = (code: CoachCycleDestinationIssue['code'], message: string, source?: CoachSheetSource): CoachCycleDestinationIssue => ({ code, severity: 'blocking', message, ...(source ? { source: { ...source } } : {}) })
// Match the Rich text alphabet, including rejection of isolated UTF-16 surrogates.
function acceptedText(value: string, maximum: number, required = false): boolean {
  return typeof value === 'string' && (!required || value.trim().length > 0) && [...value].length <= maximum
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value)
}
function validDate(value: string): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}
const dateAfter = (start: Date, days: number) => new Date(start.getTime() + days * 86_400_000).toISOString().slice(0, 10)

/** UTC calendar arithmetic only: deterministic across local timezone and daylight-saving changes. */
export function compileCoachCycleSchedule(intake: Pick<CoachCycleDestinationIntake, 'weeks' | 'start' | 'days'>): ScheduleResult {
  const issues: CoachCycleDestinationIssue[] = []
  const start = validDate(intake.start)
  if (!start || start.getUTCDay() !== 1) issues.push(issue('invalid_schedule', 'The current Rich calendar requires an explicit Monday start date; choose a Monday.'))
  if (!Number.isSafeInteger(intake.weeks) || intake.weeks < 1 || intake.weeks > 12) issues.push(issue('destination_limit', 'The current Rich calendar supports 1–12 weeks.'))
  const selectedWeekdays = intake.days.map(name => weekdayNames.indexOf(name as typeof weekdayNames[number]) + 1)
  if (!selectedWeekdays.length || selectedWeekdays.length > 7 || selectedWeekdays.some((day, index) => day < 1 || (index > 0 && day <= selectedWeekdays[index - 1]))) issues.push(issue('invalid_schedule', 'Choose unique training weekday names in Monday-to-Sunday order.'))
  if (selectedWeekdays.length * intake.weeks > COACH_CYCLE_PUBLISH_LIMITS.authoredDays) issues.push(issue('destination_limit', `A cycle can publish at most ${COACH_CYCLE_PUBLISH_LIMITS.authoredDays} workout days. Reduce the weeks or selected weekdays.`))
  if (issues.length || !start) return { status: 'blocked', schedule: null, issues }
  const endOn = dateAfter(start, intake.weeks * 7 - 1)
  if (!validDate(endOn)) return { status: 'blocked', schedule: null, issues: [issue('invalid_schedule', 'The complete cycle must fit the four-digit calendar date range.')] }
  return { status: 'compiled', issues: [], schedule: { mode: 'monday_start', startOn: intake.start, endOn, selectedWeekdays,
    weeks: Array.from({ length: intake.weeks }, (_, index) => ({ ordinal: index + 1, days: selectedWeekdays.map((weekday, dayIndex) => ({ name: intake.days[dayIndex], weekday, plannedDate: dateAfter(start, index * 7 + weekday - 1) })) })) } }
}

/** Exact date-only seven-day windows; intake/source lanes remain Monday-first. */
export function compileCoachCycleScheduleV2(intake: Pick<CoachCycleDestinationIntake, 'weeks' | 'start' | 'days'>): CoachCycleDestinationScheduleResultV2 {
  const issues: CoachCycleDestinationIssue[] = []
  if (!validDate(intake.start)) issues.push(issue('invalid_schedule', 'Choose a valid exact cycle start date.'))
  if (!Number.isSafeInteger(intake.weeks) || intake.weeks < 1 || intake.weeks > 12) issues.push(issue('destination_limit', 'The current Rich calendar supports 1–12 weeks.'))
  const selectedWeekdays = intake.days.map(name => weekdayNames.indexOf(name as typeof weekdayNames[number]) + 1)
  if (!selectedWeekdays.length || selectedWeekdays.length > 7 || selectedWeekdays.some((day, index) => day < 1 || (index > 0 && day <= selectedWeekdays[index - 1]))) issues.push(issue('invalid_schedule', 'Choose unique training weekday names in Monday-to-Sunday order.'))
  if (selectedWeekdays.length * intake.weeks > COACH_CYCLE_PUBLISH_LIMITS.authoredDays) issues.push(issue('destination_limit', `A cycle can publish at most ${COACH_CYCLE_PUBLISH_LIMITS.authoredDays} workout days. Reduce the weeks or selected weekdays.`))
  if (issues.length) return { status: 'blocked', schedule: null, issues }
  try {
    const calendar = compileExactStartSchedule(intake.start, intake.weeks, selectedWeekdays)
    return { status: 'compiled', issues: [], schedule: { mode: 'exact_start', startOn: calendar.startOn, endOn: calendar.endOn, selectedWeekdays,
      weeks: calendar.weeks.map(week => ({ ordinal: week.ordinal, days: week.days.map(day => ({ name: weekdayNames[day.weekday - 1], weekday: day.weekday, offset: day.offset, plannedDate: day.scheduledDate })) })) } }
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return { status: 'blocked', schedule: null, issues: [issue('invalid_schedule', 'The complete cycle must fit the four-digit calendar date range.')] }
  }
}

// Compare typed meaning, not JSON object insertion order or the parser's dependency-token spelling.
// The caller's exact source review key remains separately bound into the destination review key.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).filter(([name, child]) => name !== 'reviewKey' && child !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, child]) => `${JSON.stringify(name)}:${canonical(child)}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
const roleKey = (entry: Pick<CoachSheetCoverage, 'role' | 'dayId' | 'exerciseId' | 'week'>) => JSON.stringify([entry.role, entry.dayId ?? null, entry.exerciseId ?? null, entry.week ?? null])

/**
 * Local-only compiler. It makes no API/SQL calls, resolves no maxes and grants no publication.
 * Reinterpret the exact covered source before compiling; any source, intake or typed mismatch
 * blocks the entire result. Source identities stay separate from server identity_token UUIDs.
 */
export function compileCoachCycleDestination(interpretation: CoachGeneratedSheetInterpretation, intake: CoachCycleDestinationIntake): CoachCycleDestinationResult {
  return compileDestination(interpretation, intake, COACH_CYCLE_DESTINATION_VERSION, compileCoachCycleSchedule(intake))
}

/** Local-only /2 contract. No existing publisher or calendar constructor is invoked. */
export function compileCoachCycleDestinationV2(interpretation: CoachGeneratedSheetInterpretation, intake: CoachCycleDestinationIntake): CoachCycleDestinationResultV2 {
  return compileDestination(interpretation, intake, COACH_CYCLE_DESTINATION_VERSION_V2, compileCoachCycleScheduleV2(intake))
}

function compileDestination<Version extends typeof COACH_CYCLE_DESTINATION_VERSION | typeof COACH_CYCLE_DESTINATION_VERSION_V2, Schedule extends CoachCycleDestinationSchedule | CoachCycleDestinationScheduleV2>(
  interpretation: CoachGeneratedSheetInterpretation, intake: CoachCycleDestinationIntake, version: Version, schedule: ScheduleResultFor<Schedule>,
): DestinationResultFor<Omit<CoachCycleDestination, 'version' | 'schedule'> & { version: Version; schedule: Omit<Schedule, 'weeks'> }> {
  const issues: CoachCycleDestinationIssue[] = interpretation.issues.map(item => ({ ...item, ...(item.source ? { source: { ...item.source } } : {}) }))
  issues.push(...schedule.issues)
  if (interpretation.status !== 'ready_for_review' && !interpretation.issues.length) issues.push(issue('interpretation_mismatch', 'Interpretation must be ready for review with no blocking issues.'))
  if (interpretation.parserVersion !== COACH_SHEET_PARSER_VERSION || !interpretation.reviewKey?.trim()) issues.push(issue('interpretation_mismatch', 'Refresh interpretation with the current parser and exact source review key.'))
  if (!acceptedText(intake.name, 120, true)) issues.push(issue('destination_limit', 'The cycle name must fit 120 characters and the Rich text alphabet.'))
  if (intake.unit !== 'lb' && intake.unit !== 'kg') issues.push(issue('invalid_cycle', 'Choose lb or kg as the cycle unit.'))
  if (interpretation.days.length !== intake.days.length || interpretation.days.some((day, index) => day.name !== intake.days[index])) issues.push(issue('intake_mismatch', 'The interpreted day lanes must exactly match the selected intake weekdays and order.'))
  const coverage = new Map<string, CoachSheetCoverage>()
  for (const entry of interpretation.coverage) {
    if (entry.role === 'structure') continue
    const identity = roleKey(entry)
    if (coverage.has(identity)) issues.push(issue('source_collision', 'Each exercise, prescription and instruction role needs exactly one covered source cell.', entry.source))
    coverage.set(identity, entry)
  }
  const used = new Set<string>()
  const lookup = (role: 'exercise' | 'prescription' | 'instructions', dayId: string, exerciseId: string, week?: number) => {
    const identity = roleKey({ role, dayId, exerciseId, week })
    used.add(identity)
    const entry = coverage.get(identity)
    if (!entry) issues.push(issue('missing_source_cell', 'The interpretation is missing a covered source role.'))
    return entry
  }
  const sourceDays: CoachGeneratedSheetInput['days'] = interpretation.days.map(day => ({ id: day.id, name: day.name, exercises: day.exercises.map(exercise => {
    const name = lookup('exercise', day.id, exercise.id)
    if (!name || name.text !== exercise.name || canonical(name.source) !== canonical(exercise.nameSource)) issues.push(issue('interpretation_mismatch', 'The exercise name differs from its covered source cell.', exercise.nameSource))
    return { id: exercise.id, name: { source: { ...exercise.nameSource }, text: exercise.name }, weeks: exercise.weeks.map(week => {
      const prescription = lookup('prescription', day.id, exercise.id, week.week)
      const instructions = lookup('instructions', day.id, exercise.id, week.week)
      if (!prescription || prescription.text !== week.prescription.raw) issues.push(issue('interpretation_mismatch', 'The prescription differs from its covered source cell.', prescription?.source))
      if (!instructions || instructions.text !== week.instructions || canonical(instructions.source) !== canonical(week.instructionSource)) issues.push(issue('interpretation_mismatch', 'The instructions differ from their covered source cell.', week.instructionSource))
      if (!acceptedText(week.prescription.raw, 1000, true)) issues.push(issue('destination_limit', 'A raw prescription must fit the Rich protocol field of 1000 characters.', prescription?.source))
      let renamed: { source: CoachSheetSource; text: string } | undefined
      if (week.renamed) {
        const entry = lookup('exercise', day.id, exercise.id, week.week)
        if (!entry || entry.text !== week.renamed.name || canonical(entry.source) !== canonical(week.renamed.source)) issues.push(issue('interpretation_mismatch', 'The switched exercise name differs from its covered source cell.', week.renamed.source))
        renamed = { source: { ...week.renamed.source }, text: week.renamed.name }
      }
      return { week: week.week, prescription: { source: { ...(prescription?.source ?? exercise.nameSource) }, text: week.prescription.raw }, instructions: { source: { ...week.instructionSource }, text: week.instructions }, ...(renamed ? { name: renamed } : {}) }
    }) }
  }) }))
  for (const [identity, entry] of coverage) if (!used.has(identity)) issues.push(issue('unaccounted_cell', 'A covered authoring cell has no exercise/week role in the destination.', entry.source))
  for (const day of interpretation.days) if (!day.exercises.length) issues.push(issue('invalid_cycle', 'Each selected weekday needs at least one exercise block or an explicit skipped block.'))
  if (issues.length || schedule.status === 'blocked') return { status: 'blocked', cycle: null, issues }
  const rebuilt = interpretCoachSheet({ cycleId: interpretation.cycleId, weeks: intake.weeks, defaultUnit: intake.unit, days: sourceDays,
    structure: interpretation.coverage.filter(entry => entry.role === 'structure').map(({ source, text }) => ({ source: { ...source }, text })),
    populatedCells: interpretation.coverage.map(({ source, text }) => ({ source: { ...source }, text })) })
  issues.push(...rebuilt.issues)
  if (canonical(rebuilt.days) !== canonical(interpretation.days) || canonical(rebuilt.totals) !== canonical(interpretation.totals)) issues.push(issue('interpretation_mismatch', 'The typed interpretation no longer matches its exact source, unit, weeks or totals. Refresh review.'))
  // Generated interpretation already normalizes time to whole seconds and yards exactly to feet.
  // Explicitly check the destination vocabulary as well, so future parser additions fail closed.
  for (const day of rebuilt.days) for (const exercise of day.exercises) for (const week of exercise.weeks) {
    if (!acceptedText(week.renamed?.name ?? exercise.name, 120, true) || !acceptedText(week.instructions, 1000)) issues.push(issue('destination_limit', 'Exercise text exceeds the Rich destination text limits or alphabet.', exercise.nameSource))
    for (const group of week.prescription.groups) {
      if (group.dose.kind === 'time' && group.dose.unit !== 'sec' || group.dose.kind === 'distance' && !['m', 'km', 'ft', 'mi'].includes(group.dose.unit)) issues.push(issue('destination_limit', 'This dose unit has no exact supported Rich representation.', group.source))
      if (!['optional', 'exact', 'qualitative', 'none', 'bodyweight'].includes(group.load.kind)) issues.push(issue('percentage_resolution_required', 'Percentages remain blocked until a current approved max resolver and resolved-load review exist.', group.source))
    }
  }
  if (issues.length) return { status: 'blocked', cycle: null, issues }

  const totals = { exercises: 0, omittedExercises: 0, groups: 0, sets: 0 }
  let needsBodyweightParity = false
  // Schedule position can rotate at a midweek start; weekday is the source lane identity.
  const sourceDaysByWeekday = new Map(rebuilt.days.map(day => [weekdayNames.indexOf(day.name as typeof weekdayNames[number]) + 1, day]))
  const weeks = schedule.schedule.weeks.map(scheduledWeek => ({ sourceKey: key(interpretation.cycleId, 'week', scheduledWeek.ordinal), ordinal: scheduledWeek.ordinal,
    days: scheduledWeek.days.map((scheduledDay): CoachCycleDestinationDay => {
      const day = sourceDaysByWeekday.get(scheduledDay.weekday)!
      const exerciseSources: CoachCycleDestinationExerciseSource[] = []
      const exercises: ReplaceExercise[] = []
      for (const exercise of day.exercises) {
        const week = exercise.weeks.find(item => item.week === scheduledWeek.ordinal)!
        // A mid-cycle switch names this week's exercise; it carries forward to the next switch.
        const switched = exercise.weeks.filter(item => item.renamed && item.week <= week.week).at(-1)?.renamed
        const weekName = switched?.name ?? exercise.name, weekNameSource = switched?.source ?? exercise.nameSource
        // The first week of a different exercise tells the athlete what it replaced (Joe, Nov 17).
        const previousName = week.renamed ? exercise.weeks.filter(item => item.renamed && item.week < week.week).at(-1)?.renamed?.name ?? exercise.name : null
        const switchNote = previousName !== null && previousName !== weekName ? exerciseSwitchNote(previousName) : null
        const prescriptionSource = coverage.get(roleKey({ role: 'prescription', dayId: day.id, exerciseId: exercise.id, week: week.week }))!.source
        const sourceKey = key(interpretation.cycleId, day.id, exercise.id, week.week)
        const skipped = week.prescription.status === 'skipped'
        exerciseSources.push({ sourceKey, sourceExerciseId: exercise.id, sourceWeekId: week.id, nameSource: { ...weekNameSource }, prescriptionSource: { ...prescriptionSource }, instructionSource: { ...week.instructionSource }, rawPrescription: week.prescription.raw, rawInstructions: week.instructions,
          ordinal: skipped ? null : exercises.length + 1, setGroups: week.prescription.groups.map(group => ({ sourceKey: key(interpretation.cycleId, day.id, exercise.id, week.week, 'group', group.position), position: group.position, source: { ...prescriptionSource }, start: group.start, end: group.end, raw: group.raw })) })
        if (skipped) { totals.omittedExercises++; continue }
        const setGroups: ReplaceSet[] = week.prescription.groups.map(group => {
          totals.groups++; totals.sets += group.count
          const dose = group.dose
          const load = group.load
          if (load.kind === 'bodyweight') needsBodyweightParity = true
          const result: ReplaceSet = { mode: 'replace', identity_token: null, ordinal: group.position, sets_mode: 'exact', sets_min: group.count, sets_max: null,
            dose_mode: dose.kind, reps_mode: dose.kind === 'reps' ? dose.min === dose.max ? 'exact' : 'range' : null,
            dose_min: dose.kind === 'reps' ? dose.min : dose.kind === 'amrap' ? null : dose.value, dose_max: dose.kind === 'reps' && dose.min !== dose.max ? dose.max : null,
            distance_unit: dose.kind === 'distance' ? dose.unit as ReplaceSet['distance_unit'] : null, laterality: group.laterality === 'each_side' ? 'each_side' : 'bilateral',
            load_mode: load.kind === 'optional' ? group.rpe ? 'rpe' : 'athlete_choice' : load.kind === 'percentage' ? 'percent' : load.kind,
            load_basis: 'total', exact_weight: load.kind === 'exact' ? load.weight : load.kind === 'bodyweight' ? 0 : null,
            percent: null, percent_basis_exercise_id: null, percent_basis_max_type: null, manual_override: null,
            rpe_min: group.rpe?.min ?? null, rpe_max: group.rpe && group.rpe.min !== group.rpe.max ? group.rpe.max : null,
            qualitative: load.kind === 'qualitative' ? load.value : null, unit_override: load.kind === 'exact' && load.unitSource === 'explicit' ? load.unit : null,
            rest_seconds: null, note: dose.kind === 'amrap' && dose.min !== null ? amrapMinimumNote(dose.min) : null }
          return result
        })
        totals.exercises++
        exercises.push({ mode: 'replace', identity_token: null, ordinal: exercises.length + 1, group_ordinal: null, status: 'programmed', name: weekName,
          instruction: week.instructions.trim() ? week.instructions : null, note: switchNote, protocol: week.prescription.raw, exercise_id: null, track_in_metrics: false, set_groups: setGroups })
      }
      return { sourceKey: key(interpretation.cycleId, 'day', day.id, scheduledWeek.ordinal), sourceDayId: day.id, weekday: scheduledDay.weekday, plannedDate: scheduledDay.plannedDate,
        payload: { ordinal: scheduledDay.weekday, label: day.name, subtitle: null, marked_rest: exercises.length === 0, workout_instruction: null, movement_groups: [], ungrouped_exercises: exercises }, exerciseSources }
    }) }))
  const { weeks: _scheduleWeeks, ...calendar } = schedule.schedule
  if (totals.exercises > COACH_CYCLE_PUBLISH_LIMITS.exercises || totals.groups > COACH_CYCLE_PUBLISH_LIMITS.groups || totals.sets > COACH_CYCLE_PUBLISH_LIMITS.sets) {
    const limits = COACH_CYCLE_PUBLISH_LIMITS
    return { status: 'blocked', cycle: null, issues: [issue('destination_limit', `This cycle exceeds the publication limit of ${limits.exercises} exercises, ${limits.groups} set groups or ${limits.sets} physical sets. Reduce the cycle before publishing.`)] }
  }
  const reviewKey = JSON.stringify([version, interpretation.reviewKey, intake])
  return { status: 'compiled', issues: [], cycle: { version, localOnly: true, sourceCycleId: interpretation.cycleId, sourceReviewKey: interpretation.reviewKey, reviewKey,
    name: intake.name, defaultUnit: intake.unit, materializationRequirements: { defaultUnit: intake.unit, verifyDefaultUnitBeforeDaySave: true, bodyweightNoWeightFieldParity: needsBodyweightParity ? 'required' : 'not_applicable' }, schedule: calendar, weeks, totals } }
}
