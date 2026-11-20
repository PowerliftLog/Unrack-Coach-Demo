import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { AthleteBuilderLink } from './CoachShell'
import { powerliftSeries } from './ClientOverview'
import { CoachNotes } from './CoachNotes'
import { PowerliftTrend, type PowerliftSeries } from './PowerliftTrend'
import type { AthleteScheduleWorkout } from './AthleteSchedulePanel'
import { calendarWeeks, createWeekExerciseReader, currentCycleWorkouts, recentWorkoutRows, strengthTiles, type AthleteHomeAssignmentApi, type AthleteHomeCycle } from './lib/athlete-home-data'
import type { CoachAthleteActivityPageV1, CoachOverviewApi, CoachRecentActivityCursorV1, CoachRecentActivityItemV1, PercentageProgrammingApi } from './lib/coach-api'
import type { CoachCycleQueuedState } from './lib/coach-excel-next-cycle-api'
import type { CoachExcelNextCycleApi } from './lib/coach-excel-next-cycle-client'
import { shortDate } from './lib/local-date'
import './athlete-home.css'

type Api = AthleteHomeAssignmentApi & Partial<CoachOverviewApi & Pick<PercentageProgrammingApi, 'getCoachAthleteCalendarV1' | 'getCoachAthleteMetricsV1' | 'getAthleteTrackingV1'>>
type AthleteScope = { api: Api; gym: string; athlete: string }

const activityDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
const weight = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const fullWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' })
const dayStatus: Record<AthleteScheduleWorkout['state'], string> = {
  completed: 'Done', skipped: 'Skipped', in_progress: 'Not done yet', not_started: 'Not done yet',
}

async function readCalendar({ api, gym, athlete }: AthleteScope) {
  return (await api.getCoachAthleteCalendarV1?.({ target_gym: gym, target_athlete: athlete }))?.workouts
}

async function readRecent({ api, gym, athlete }: AthleteScope) {
  const recent = await api.getCoachAthleteRecentWorkoutsV1?.({ gym, athlete })
  return recent ? recentWorkoutRows(recent) : undefined
}

async function readStrength({ api, gym, athlete }: AthleteScope) {
  if (!api.getCoachAthleteMetricsV1 || !api.getAthleteTrackingV1) return undefined
  const scope = { target_gym: gym, target_athlete: athlete }
  const [metrics, tracking] = await Promise.all([api.getCoachAthleteMetricsV1(scope), api.getAthleteTrackingV1(scope)])
  return powerliftSeries(metrics, tracking)
}

type Read<T> = { status: 'loading' | 'error' | 'unavailable' } | { status: 'ready'; data: T }

function useAthleteRead<T>({ api, gym, athlete }: AthleteScope, read: (scope: AthleteScope) => Promise<T | undefined>, enabled = true) {
  const [result, setResult] = useState<Read<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    setResult({ status: 'loading' })
    void read({ api, gym, athlete }).then(data => {
      if (active) setResult(data === undefined ? { status: 'unavailable' } : { status: 'ready', data })
    }).catch(() => { if (active) setResult({ status: 'error' }) })
    return () => { active = false }
  }, [api, gym, athlete, read, attempt, enabled])
  return [result, () => setAttempt(value => value + 1)] as const
}

function SectionStatus({ status, label, retry }: { status: Read<unknown>['status']; label: string; retry(): void }) {
  if (status === 'loading') return <p className="ah-empty" role="status">Loading {label}…</p>
  if (status === 'unavailable') return <p className="ah-empty">{label[0].toUpperCase() + label.slice(1)} unavailable.</p>
  if (status === 'error') return <div className="ah-state" role="alert">
    <span>Could not load {label}.</span><button type="button" className="ah-button" onClick={retry}>Retry</button>
  </div>
  return null
}

type Week = ReturnType<NonNullable<ReturnType<typeof calendarWeeks>>['weekAt']>

function WeekDays({ scope, readWeek, week }: {
  scope: AthleteScope
  readWeek: ReturnType<typeof createWeekExerciseReader>
  week: Week
}) {
  const [chosen, setChosen] = useState<string>()
  const workouts = useMemo(() => week.days.flatMap(day => day.workouts), [week])
  const read = useCallback(async () => readWeek?.(workouts), [readWeek, workouts])
  const [details, retry] = useAthleteRead(scope, read, workouts.length > 0)
  const selected = chosen ?? week.days.find(day => day.today && day.workouts.length > 0)?.date
  const openDay = week.days.find(day => day.date === selected)
  return <>
    <ol className="ah-week">
      {week.days.map(day => <li key={day.date}>
        <button type="button" className={day.workouts.length ? 'ah-day' : 'ah-day ah-day-rest'}
          aria-current={day.today ? 'date' : undefined} aria-pressed={day.date === selected}
          onClick={() => setChosen(day.date)}>
          <time className="ah-meta" dateTime={day.date}>{weekday.format(Date.parse(day.date))} {Number(day.date.slice(-2))}</time>
          {day.workouts.map(workout => {
            const lift = details.status === 'ready' ? details.data.get(workout.workout_instance_id)?.[0]?.name : undefined
            return <span className="ah-day-lift" key={workout.workout_instance_id} title={lift}>{lift ?? 'Workout'}</span>
          })}
          {day.today ? <span>Today</span> : day.workouts.length === 0 && <span>Rest</span>}
        </button>
      </li>)}
    </ol>
    {openDay && <div className="ah-day-detail">
      {openDay.workouts.length === 0 && <h3>{fullWeekday.format(Date.parse(openDay.date))} · Rest</h3>}
      {openDay.workouts.map(workout => {
        const exercises = details.status === 'ready' ? details.data.get(workout.workout_instance_id) : undefined
        return <div key={workout.workout_instance_id}>
          <h3>{fullWeekday.format(Date.parse(openDay.date))} · {dayStatus[workout.state].toLowerCase()}</h3>
          {exercises?.length ? <table><tbody>{exercises.map(exercise => <tr key={exercise.ordinal}>
            <td>{exercise.name}</td><td>{exercise.prescription}</td>
            <td><AthleteBuilderLink athlete={scope.athlete}>Edit in sheet</AthleteBuilderLink></td>
          </tr>)}</tbody></table> : details.status === 'ready'
            ? <p className="ah-empty">{exercises ? 'No exercises scheduled.' : 'Exercises unavailable.'}</p>
            : <SectionStatus status={details.status} label="exercises" retry={retry} />}
        </div>
      })}
    </div>}
  </>
}

function Schedule({ scope, cycle, today, result, retry }: {
  scope: AthleteScope
  cycle: AthleteHomeCycle | null
  today: string
  result: Read<AthleteScheduleWorkout[]>
  retry(): void
}) {
  const [selection, setSelection] = useState<{ cycleId: string; index: number } | null>(null)
  const assignmentId = cycle?.assignment_id
  const startOn = cycle?.start_on ?? null
  const endOn = cycle?.end_on ?? null
  const { api, gym, athlete } = scope
  const readWeek = useMemo(() => createWeekExerciseReader(api, assignmentId), [api, gym, athlete, assignmentId])
  const weeks = useMemo(() => result.status === 'ready' && assignmentId
    ? calendarWeeks(result.data, { assignment_id: assignmentId, start_on: startOn, end_on: endOn }, today)
    : null, [result, assignmentId, startOn, endOn, today])
  const index = weeks ? (selection && selection.cycleId === assignmentId
    ? Math.min(selection.index, weeks.length - 1) : weeks.initialIndex) : 0
  const week = useMemo(() => weeks?.weekAt(index), [weeks, index])
  return <section className="ah-card ah-week-card" aria-label="Athlete schedule">
    <header className="ah-card-head">
      <div className="ah-week-title">
        <h2>{!week || index === weeks?.currentIndex ? 'This week' : 'Schedule'}</h2>
        {week && weeks && <p className="ah-meta" aria-live="polite">
          {shortDate(week.start)} – {week.start.slice(0, 7) === week.end.slice(0, 7) ? Number(week.end.slice(-2)) : shortDate(week.end)}
          {' · '}Week {index + 1} of {weeks.length}
        </p>}
      </div>
      {weeks && assignmentId && <div className="ah-week-nav">
        <button type="button" className="ah-button" aria-label="Previous week" disabled={index === 0}
          onClick={() => setSelection({ cycleId: assignmentId, index: index - 1 })}>‹</button>
        <button type="button" className="ah-button" aria-label="Next week" disabled={index === weeks.length - 1}
          onClick={() => setSelection({ cycleId: assignmentId, index: index + 1 })}>›</button>
      </div>}
    </header>
    {result.status !== 'ready' ? <SectionStatus status={result.status} label="schedule" retry={retry} /> : week && assignmentId
      ? <WeekDays key={`${assignmentId}:${week.start}`} scope={scope} readWeek={readWeek} week={week} />
      : <p className="ah-empty">No workouts scheduled.</p>}
  </section>
}

type ActivityProps = { onActivity(item: CoachRecentActivityItemV1): void }
function WorkoutRows({ items, onActivity }: ActivityProps & { items: CoachRecentActivityItemV1[] }) {
  return <ul className="ah-list">
    {items.map(item => <li key={item.activity_id}>
      <button type="button" className="ah-workout-row" onClick={() => onActivity(item)}>
        <time className="ah-meta" dateTime={item.performed_at}>{activityDate.format(Date.parse(item.performed_at))}</time>
        <strong title={item.day_label}>{item.day_label}</strong>
        <span className="ah-outcome" data-state={item.outcome}>{dayStatus[item.outcome]}</span>
        <span aria-hidden="true">›</span>
      </button>
    </li>)}
  </ul>
}

function ActivityHistory({ api, gym, athlete, recent, onActivity }: AthleteScope & ActivityProps & { recent: CoachRecentActivityItemV1[] }) {
  const [page, setPage] = useState<CoachAthleteActivityPageV1 | null>(null)
  const [cursor, setCursor] = useState<CoachRecentActivityCursorV1 | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<Read<unknown>['status']>('loading')
  useEffect(() => {
    if (!api.getCoachAthleteActivityPageV1) { setStatus('unavailable'); return }
    let active = true
    setStatus('loading')
    void api.getCoachAthleteActivityPageV1({ gym, athlete, cursor, page_size: 20 }).then(next => {
      if (!active) return
      setPage(previous => ({
        ...next,
        items: cursor && previous ? [...previous.items, ...next.items.filter(item =>
          !previous.items.some(old => old.activity_id === item.activity_id))] : next.items,
      }))
      setStatus('ready')
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [api, gym, athlete, cursor, attempt])
  const recentIds = new Set(recent.map(item => item.activity_id))
  const rows = page?.items.filter(item => !recentIds.has(item.activity_id)) ?? []
  return <div aria-label="Workout history">
    {rows.length > 0 && <WorkoutRows items={rows} onActivity={onActivity} />}
    <SectionStatus status={status} label="workout history" retry={() => setAttempt(value => value + 1)} />
    {status === 'ready' && rows.length === 0 && !page?.has_more && <p className="ah-empty">No more recorded workouts.</p>}
    {status === 'ready' && page?.has_more && page.next_cursor && <button type="button" className="ah-button ah-load-more"
      onClick={() => { setStatus('loading'); setCursor(page.next_cursor) }}>Load more</button>}
  </div>
}

function Recent({ scope, onActivity }: ActivityProps & { scope: AthleteScope }) {
  const [result, retry] = useAthleteRead(scope, readRecent)
  const [expanded, setExpanded] = useState(false)
  const [opened, setOpened] = useState(false)
  const historyId = useId()
  const recent = result.status === 'ready' ? result.data : []
  return <section className="ah-card" aria-label="Recent workouts">
    <header className="ah-card-head"><h2>Recent</h2></header>
    {result.status !== 'ready' ? <SectionStatus status={result.status} label="recent workouts" retry={retry} />
      : recent.length ? <WorkoutRows items={recent} onActivity={onActivity} /> : <p className="ah-empty">No recent workouts.</p>}
    {scope.api.getCoachAthleteActivityPageV1 && <div className="ah-disclosure">
      <button type="button" aria-expanded={expanded} aria-controls={historyId}
        onClick={() => { setOpened(true); setExpanded(value => !value) }}>More activity</button>
      <div id={historyId} hidden={!expanded}>
        {opened && <ActivityHistory {...scope} recent={recent} onActivity={onActivity} />}
      </div>
    </div>}
  </section>
}

function Strength({ scope, overviewVisible }: { scope: AthleteScope; overviewVisible: boolean }) {
  // Load once the overview is first shown; opening and closing Profile doesn't refetch (competition lifts don't change there).
  const [seen, setSeen] = useState(overviewVisible)
  useEffect(() => { if (overviewVisible) setSeen(true) }, [overviewVisible])
  const [result, retry] = useAthleteRead(scope, readStrength, seen)
  const [expanded, setExpanded] = useState(false)
  const chartId = useId()
  const series: PowerliftSeries[] = result.status === 'ready' ? result.data : []
  const tiles = strengthTiles(series)
  const hasSets = tiles.some(tile => tile.current !== null)
  return <section className="ah-card" aria-label="Strength trend">
    <header className="ah-card-head">
      <div><h2>Strength trend</h2>{hasSets && <p className="ah-meta">Estimated 1RM</p>}</div>
      {hasSets && <button type="button" className="ah-button" aria-expanded={expanded} aria-controls={chartId}
        onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide chart' : 'Show chart'}</button>}
    </header>
    {result.status !== 'ready' ? <SectionStatus status={result.status} label="strength data" retry={retry} />
      : hasSets ? <div className="ah-strength-grid">
        {tiles.map(({ lift, name, current, change, sparkline }) => {
          const end = sparkline.at(-1)
          return <div key={lift} className="ah-strength-tile">
            <h3>{name}</h3>
            {current === null || !end ? <p className="ah-empty">No logged sets.</p> : <>
              <p className="ah-strength-value"><strong>{weight.format(current)}</strong> lb</p>
              <div className="ah-strength-foot">
                {change === null ? <span className="ah-meta">1 session</span> :
                  <span className="ah-change" data-direction={Math.sign(change)} title="Change over the displayed sessions">
                    {change > 0 ? '+' : ''}{weight.format(change)} lb
                  </span>}
                <svg className="ah-sparkline" viewBox="0 0 80 28" aria-hidden="true">
                  <polyline points={sparkline.map(({ x, y }) => `${x},${y}`).join(' ')} />
                  <circle cx={end.x} cy={end.y} r="2.6" />
                </svg>
              </div>
            </>}
          </div>
        })}
      </div> : <p className="ah-empty">No strength data yet.</p>}
    <div id={chartId} className="ah-full-chart" hidden={!expanded || !hasSets}>
      {expanded && hasSets && <PowerliftTrend series={series} />}
    </div>
  </section>
}

export function AthleteHome({ api, gym, athlete, cycle, programName, today, queuedState, gateEpoch, renderHeader, onActivity, onDirtyChange, hidden = false }: AthleteScope & ActivityProps & {
  cycle: AthleteHomeCycle | null
  programName?: string | null
  today: string
  queuedState?: CoachExcelNextCycleApi['queuedState']
  gateEpoch?: number
  renderHeader?(programLine?: ReactNode, nextProgramLine?: ReactNode): ReactNode
  onDirtyChange(dirty: boolean): void
  hidden?: boolean
}) {
  const scope = { api, gym, athlete }
  const [calendar, retryCalendar] = useAthleteRead(scope, readCalendar)
  const [queue, setQueue] = useState<{ gym: string; athlete: string; cycle: Extract<CoachCycleQueuedState, { queued: true }> } | null>(null)
  const queuedCycle = queue?.gym === gym && queue.athlete === athlete ? queue.cycle : null
  useEffect(() => {
    if (hidden) return
    setQueue(null)
    if (!queuedState || gateEpoch == null) return
    let active = true
    // Wait until the effect survives React's development cleanup before starting the read.
    void Promise.resolve().then(async () => {
      if (!active) return
      const result = await queuedState({ gym, athlete, expected_gate_epoch: gateEpoch })
      if (active && result.queued) setQueue({ gym, athlete, cycle: result })
    }).catch(() => {
      // The queued cycle is optional context on the athlete page.
    })
    return () => { active = false }
  }, [gym, athlete, queuedState, gateEpoch, hidden])
  const assignmentId = cycle?.assignment_id
  const workouts = useMemo(() => calendar.status === 'ready' && assignmentId
    ? currentCycleWorkouts(calendar.data, assignmentId) : null, [calendar, assignmentId])
  const name = workouts?.[0]?.program_name ?? programName ?? 'Current program'
  const remaining = workouts?.filter(workout => workout.state === 'not_started' || workout.state === 'in_progress').length
  return <>
    {renderHeader?.(assignmentId ? <>
      Now: <strong>{name}</strong>
      {remaining !== undefined && ` · ${remaining} workout${remaining === 1 ? '' : 's'} left`}
      {' · '}<AthleteBuilderLink athlete={athlete}>Open in Build Workouts →</AthleteBuilderLink>
    </> : undefined, queuedCycle ? <>
      Next: <strong>{queuedCycle.program_name}</strong>
      {queuedCycle.start_on !== null && ` · starts ${shortDate(queuedCycle.start_on)}`}
      {' · on the phone'}
    </> : undefined)}
    <div className="ah-root" hidden={hidden}>
      <div className="ah-layout">
        <div className="ah-main">
          <Schedule scope={scope} cycle={cycle} today={today} result={calendar} retry={retryCalendar} />
          <Recent scope={scope} onActivity={onActivity} />
          <Strength scope={scope} overviewVisible={!hidden} />
        </div>
        <aside className="ah-notes">
          <CoachNotes {...scope} onDirtyChange={onDirtyChange} />
        </aside>
      </div>
    </div>
  </>
}
