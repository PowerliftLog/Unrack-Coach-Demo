import type { AthleteTrackingV1, ProgrammingMaxesV1, ProgrammingMaxRecordV1 } from './coach-api'
import type { CoachSheetSetGroup, CoachWeightUnit } from './coach-sheet-interpret'

export type PercentMax = Pick<ProgrammingMaxRecordV1, 'exercise_id' | 'value' | 'unit' | 'max_type'> & { name: string }
export type PercentMaxResolver = {
  maxes: PercentMax[]
  resolve(name: string, basisId?: string): PercentMax | undefined
}

export const percentExerciseKey = (name: string) => name.trim().toLowerCase()
export const percentConversionLabel = (unit: CoachWeightUnit) => `Convert % to ${unit}`

const liftAliases = new Map([
  ['back squat', 'squat'], ['squat', 'squat'],
  ['bench press', 'bench'], ['bench', 'bench'],
  ['deadlift', 'deadlift'], ['conventional deadlift', 'deadlift'],
])

export function createPercentMaxResolver(
  { maxes, basis_options }: Pick<ProgrammingMaxesV1, 'maxes' | 'basis_options'>,
  tracking: AthleteTrackingV1,
  includeBasisNames = true,
): PercentMaxResolver {
  const tracked = [...tracking.effective, ...tracking.system_required]
  const names = new Map([...basis_options, ...tracked].map(item => [item.exercise_id, item.name]))
  const latest = new Map<string, ProgrammingMaxRecordV1>()
  for (const max of maxes) {
    const previous = latest.get(max.exercise_id)
    // The newest effective date wins. On that date prefer a tested 1RM, then the newest revision of that type.
    if (!previous || max.effective_from > previous.effective_from || max.effective_from === previous.effective_from && (
      max.max_type !== previous.max_type ? max.max_type === 'tested_1rm' : max.same_day_version > previous.same_day_version
    )) latest.set(max.exercise_id, max)
  }
  const namedIds = new Map<string, string>()
  for (const exercise of tracked) {
    const name = percentExerciseKey(exercise.name)
    if (latest.has(exercise.exercise_id) && !namedIds.has(name)) namedIds.set(name, exercise.exercise_id)
  }
  const lifts = new Map<string, string>(tracking.system_required.map(item => [item.lift, item.exercise_id]))
  for (const [alias, lift] of liftAliases) {
    const id = lifts.get(lift)
    if (id !== undefined && latest.has(id) && !namedIds.has(alias)) namedIds.set(alias, id)
  }
  if (includeBasisNames) {
    for (const exercise of basis_options) {
      const name = percentExerciseKey(exercise.name)
      if (latest.has(exercise.exercise_id) && !namedIds.has(name)) namedIds.set(name, exercise.exercise_id)
    }
  }
  const options = [...latest.values()].map(({ exercise_id, value, unit, max_type }) => ({
    exercise_id, value, unit, max_type, name: names.get(exercise_id) ?? exercise_id,
  })).sort((a, b) => a.name.localeCompare(b.name))
  const byId = new Map(options.map(max => [max.exercise_id, max]))
  return {
    maxes: options,
    resolve(name, basisId) {
      if (basisId !== undefined) return byId.get(basisId)
      const id = namedIds.get(percentExerciseKey(name))
      return id === undefined ? undefined : byId.get(id)
    },
  }
}

export function roundPercentLoad(max: Pick<PercentMax, 'value' | 'unit'>, percent: number, unit: CoachWeightUnit, increment = unit === 'lb' ? 5 : 2.5): number {
  const unitFactor = max.unit === unit ? 1 : unit === 'lb' ? 2.20462 : 1 / 2.20462
  const weight = max.value * percent / 100 * unitFactor
  return Number((Math.round(weight / increment) * increment).toPrecision(15))
}

export type PercentLoad = { percent: number; start: number; end: number; weight: number }

export function percentLoads(groups: CoachSheetSetGroup[], max: PercentMax, unit: CoachWeightUnit): PercentLoad[] {
  return groups.flatMap(group => {
    if (group.load.kind !== 'percentage') return []
    // The parser has already checked that this group contains exactly one load modifier.
    // Accept its @, parenthesized and bare percentage spellings.
    const match = /(?:@\s*|\(\s*)?\d+(?:\.\d+)?\s*%(?:\s*\))?/.exec(group.raw)
    if (!match) return []
    const start = group.start + match.index
    return [{ percent: group.load.percent, start, end: start + match[0].length, weight: roundPercentLoad(max, group.load.percent, unit) }]
  })
}

export function rewritePercentPrescription(raw: string, loads: readonly Pick<PercentLoad, 'start' | 'end' | 'weight'>[], unit: CoachWeightUnit): string {
  return loads.reduceRight((text, { start, end, weight }) => {
    const space = /\s/.test(raw[start - 1] ?? '') ? '' : ' '
    return `${text.slice(0, start)}${space}@ ${weight} ${unit}${text.slice(end)}`
  }, raw)
}
