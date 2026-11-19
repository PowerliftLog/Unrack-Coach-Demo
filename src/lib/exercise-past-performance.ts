import type { CoachExerciseHistorySetV1, CoachExerciseHistoryV1 } from './coach-api'

export type PastSession = { date: string; lines: string[] }
export type PastPerformance = { sessions: PastSession[]
  /** Only when nothing matches exactly: other logged names whose words contain (or are contained in) this one's, e.g. "Incline Bench" for "Incline Bench Press". Always shown labelled with their own name. */
  similar: { name: string; sessions: PastSession[] }[] }

/** Exact exercise identity for lookup: case, spacing and punctuation only. No fuzzy or substring
 * matching, so "Pause Squat" never matches "Squat". Text after @ (effort cues) is not part of the name. */
export function exerciseKey(name: string): string {
  return name.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const number = (value: number) => String(Number(value.toFixed(2)))
/** Actuals when logged; otherwise the prescription, marked, because athletes often log only RPE
 * and leave reps and weight blank to mean "done as prescribed". */
export function describeSet(set: CoachExerciseHistorySetV1): string {
  const planned = set.reps === null && set.weight === null
  const reps = set.reps !== null ? number(set.reps)
    : set.planned_min === null ? '—' : set.planned_max !== null && set.planned_max !== set.planned_min ? `${number(set.planned_min)}–${number(set.planned_max)}` : number(set.planned_min)
  const suffix = set.planned_dose_mode === 'seconds' && set.reps === null ? 's' : ''
  const load = set.weight !== null ? ` @ ${number(set.weight)} ${set.unit ?? ''}`.trimEnd()
    : planned && set.planned_weight !== null ? ` @ ${number(set.planned_weight)} ${set.planned_unit ?? ''}`.trimEnd()
      : planned && set.planned_effort ? ` @ ${set.planned_effort}` : ''
  const rpe = set.rpe === null ? '' : ` · RPE ${number(set.rpe)}`
  return `${reps}${suffix}${load}${planned && (set.planned_min !== null || set.planned_weight !== null) ? ' (as written)' : ''}${rpe}`
}

function sessionsFor(history: CoachExerciseHistoryV1, matches: (name: string) => boolean, limit: number): PastSession[] {
  return [...history.sessions]
    .sort((left, right) => right.completed_at.localeCompare(left.completed_at))
    .flatMap(session => {
      const sets = session.exercises.filter(exercise => matches(exercise.name)).flatMap(exercise => exercise.sets)
      if (!sets.length) return []
      const lines: string[] = []
      let run = 1
      sets.forEach((set, index) => {
        const next = sets[index + 1]
        if (next && describeSet(next) === describeSet(set) && !set.note) { run++; return }
        lines.push(run > 1 ? `${run}×${describeSet(set)}` : describeSet(set))
        if (set.note) lines.push(`“${set.note}”`)
        run = 1
      })
      return [{ date: session.completed_at.slice(0, 10), lines }]
    })
    .slice(0, limit)
}

/** The athlete's completed sets for one exercise, newest session first, identical consecutive sets grouped (3×5 @ 225 lb). */
export function pastPerformance(history: CoachExerciseHistoryV1 | null, name: string, limit = 6): PastPerformance {
  const key = exerciseKey(name)
  if (!history || !key) return { sessions: [], similar: [] }
  const sessions = sessionsFor(history, other => exerciseKey(other) === key, limit)
  let similar: PastPerformance['similar'] = []
  if (!sessions.length) {
    const words = new Set(key.split(' '))
    const contains = (outer: Set<string>, inner: Set<string>) => [...inner].every(word => outer.has(word))
    const names = new Map<string, string>()
    for (const session of history.sessions) for (const exercise of session.exercises) {
      const otherKey = exerciseKey(exercise.name), other = new Set(otherKey.split(' '))
      if (otherKey && otherKey !== key && (contains(words, other) || contains(other, words)) && !names.has(otherKey)) names.set(otherKey, exercise.name)
    }
    similar = [...names.entries()].slice(0, 3)
      .map(([otherKey, display]) => ({ name: display, sessions: sessionsFor(history, other => exerciseKey(other) === otherKey, 3) }))
      .filter(item => item.sessions.length)
  }
  return { sessions, similar }
}

export type SessionTop = { date: string; weight: number; unit: string | null }
/** Heaviest set per session for this exact exercise name, newest first. A set logged with only an
 * RPE counts at its prescribed weight (same rule as describeSet). Sessions without a weight are left out. */
export function sessionTops(history: CoachExerciseHistoryV1 | null, name: string): SessionTop[] {
  const key = exerciseKey(name)
  if (!history || !key) return []
  return [...history.sessions]
    .sort((left, right) => right.completed_at.localeCompare(left.completed_at))
    .flatMap(session => {
      const loads = session.exercises.filter(exercise => exerciseKey(exercise.name) === key).flatMap(exercise => exercise.sets)
        .flatMap(set => set.weight !== null ? [{ weight: set.weight, unit: set.unit }]
          : set.reps === null && set.planned_weight !== null ? [{ weight: set.planned_weight, unit: set.planned_unit }] : [])
      if (!loads.length) return []
      const top = loads.reduce((best, load) => load.weight > best.weight ? load : best)
      return [{ date: session.completed_at.slice(0, 10), weight: top.weight, unit: top.unit }]
    })
}

/** Change in top set between the oldest and newest of the given sessions, when they share a unit. */
export function topTrend(tops: SessionTop[]): { change: number; unit: string | null; since: string } | null {
  if (tops.length < 2) return null
  const newest = tops[0], oldest = tops[tops.length - 1]
  if (newest.unit !== oldest.unit) return null
  return { change: Number((newest.weight - oldest.weight).toFixed(2)), unit: newest.unit, since: oldest.date }
}
