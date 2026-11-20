import type { AthleteScheduleWorkout } from '../AthleteSchedulePanel'
import type { PowerliftSeries } from '../PowerliftTrend'
import type { CoachAthleteRecentWorkoutsV1, CoachDashboardCurrentAssignment, ProgrammingMaxRecordV1 } from './coach-api'

const DAY = 86_400_000
const WEEK = 7 * DAY

export type AthleteHomeCycle = Pick<CoachDashboardCurrentAssignment, 'assignment_id' | 'start_on' | 'end_on'>
type WeekWorkout = Pick<AthleteScheduleWorkout, 'workout_instance_id' | 'state'> & { title: string; shortTitle: string }

export function calendarWeeks(calendar: AthleteScheduleWorkout[], cycle: AthleteHomeCycle | null, today: string) {
  if (!cycle) return null
  const workouts = calendar.filter(workout => workout.assignment_id === cycle.assignment_id)
  const datedWorkouts = workouts.filter(workout => workout.original_date || workout.scheduled_date)
  if (!datedWorkouts.length) return null

  // Prefer the assignment anchor, which can start midweek. Where older roster
  // records lack dates, use the original workout dates before considering moves.
  const originals = datedWorkouts.filter(workout => workout.original_date)
  const anchors = (originals.length ? originals : datedWorkouts).map(workout => {
    const date = new Date(workout.original_date ?? workout.scheduled_date!)
    const monday = date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY
    return monday - (workout.week_ordinal - 1) * WEEK
  })
  const start = cycle.start_on ? Date.parse(cycle.start_on) : Math.min(...anchors)
  const end = cycle.end_on ? Date.parse(cycle.end_on) : null
  const length = Math.max(
    end === null ? 0 : Math.floor((end - start) / WEEK) + 1,
    ...workouts.map(workout => workout.week_ordinal),
  )
  const currentIndex = Math.floor((Date.parse(today) - start) / WEEK)
  const byDate = new Map<string, WeekWorkout[]>()
  for (const workout of workouts) {
    if (!workout.scheduled_date) continue
    const { workout_instance_id, title, state } = workout
    const day = byDate.get(workout.scheduled_date) ?? []
    day.push({ workout_instance_id, state, title, shortTitle: title.replace(/ day$/i, '') })
    byDate.set(workout.scheduled_date, day)
  }

  return {
    length,
    currentIndex,
    initialIndex: Math.max(0, Math.min(length - 1, currentIndex)),
    weekAt(index: number) {
      const days = Array.from({ length: 7 }, (_, day) => {
        const date = new Date(start + index * WEEK + day * DAY).toISOString().slice(0, 10)
        return { date, today: date === today, workouts: byDate.get(date) ?? [] }
      })
      return { start: days[0].date, end: days[6].date, days }
    },
  }
}

export function recentWorkoutRows(recent: CoachAthleteRecentWorkoutsV1) {
  // The endpoint already orders these by performed time with a stable tie-break.
  return recent.items.slice(0, 5)
}

export function strengthTiles(series: PowerliftSeries[]) {
  return series.map(({ lift, name, points }) => {
    const ordered = points
      .filter(point => Number.isFinite(point.estimated1rm) && point.estimated1rm >= 0 && Number.isFinite(Date.parse(point.date)))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    const first = ordered[0]
    const last = ordered.at(-1)
    const change = last && ordered.length > 1 ? last.estimated1rm - first.estimated1rm : null
    const values = ordered.map(point => point.estimated1rm)
    const low = Math.min(...values)
    const range = Math.max(...values) - low
    const start = first ? Date.parse(first.date) : 0
    const elapsed = last ? Date.parse(last.date) - start : 0
    const sparkline = ordered.map(point => ({
      x: elapsed ? 3 + 74 * (Date.parse(point.date) - start) / elapsed : 40,
      y: range ? 24 - 20 * (point.estimated1rm - low) / range : 14,
    }))
    return { lift, name, current: last?.estimated1rm ?? null, change, sparkline }
  })
}

export function splitProgrammingMaxes(maxes: ProgrammingMaxRecordV1[]) {
  const ordered = [...maxes].sort((a, b) => b.effective_from.localeCompare(a.effective_from)
    || Date.parse(b.created_at) - Date.parse(a.created_at)
    || b.same_day_version - a.same_day_version)
  const byExercise = new Map<string, ProgrammingMaxRecordV1>()
  const history: ProgrammingMaxRecordV1[] = []
  for (const record of ordered) {
    if (byExercise.has(record.exercise_id)) history.push(record)
    else byExercise.set(record.exercise_id, record)
  }
  return { current: [...byExercise.values()], history }
}
