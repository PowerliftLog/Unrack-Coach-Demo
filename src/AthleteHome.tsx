import { useEffect, useId, useState } from 'react'
import { powerliftSeries } from './ClientOverview'
import { CoachNotes } from './CoachNotes'
import { PowerliftTrend, type PowerliftSeries } from './PowerliftTrend'
import type { AthleteScheduleWorkout } from './AthleteSchedulePanel'
import { calendarWeeks, recentWorkoutRows, strengthTiles, type AthleteHomeCycle } from './lib/athlete-home-data'
import type { CoachAthleteActivityPageV1, CoachOverviewApi, CoachRecentActivityCursorV1, CoachRecentActivityItemV1, PercentageProgrammingApi } from './lib/coach-api'
import './athlete-home.css'

type Api = Partial<CoachOverviewApi & Pick<PercentageProgrammingApi, 'getCoachAthleteCalendarV1' | 'getCoachAthleteMetricsV1' | 'getAthleteTrackingV1'>>
type AthleteScope = { api: Api; gym: string; athlete: string }

const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
const weight = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const workoutStatus: Record<AthleteScheduleWorkout['state'], { label: string; mark: string }> = {
  completed: { label: 'Done', mark: '✓' },
  skipped: { label: 'Skipped', mark: '–' },
  in_progress: { label: 'In progress', mark: '◐' },
  not_started: { label: 'To do', mark: '○' },
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

function Schedule({ scope, cycle, today }: { scope: AthleteScope; cycle: AthleteHomeCycle | null; today: string }) {
  const [result, retry] = useAthleteRead(scope, readCalendar)
  const [selection, setSelection] = useState<{ cycleId: string; index: number } | null>(null)
  const weeks = result.status === 'ready' ? calendarWeeks(result.data, cycle, today) : null
  const index = weeks ? (selection && selection.cycleId === cycle?.assignment_id
    ? Math.min(selection.index, weeks.length - 1) : weeks.initialIndex) : 0
  const week = weeks?.weekAt(index)
  return <section className="ah-card ah-week-card" aria-label="Athlete schedule">
    <header className="ah-card-head">
      <div className="ah-week-title">
        <h2>{!week || index === weeks?.currentIndex ? 'This week' : 'Schedule'}</h2>
        {week && weeks && <p className="ah-meta" aria-live="polite">
          {shortDate.format(Date.parse(week.start))} – {week.start.slice(0, 7) === week.end.slice(0, 7) ? Number(week.end.slice(-2)) : shortDate.format(Date.parse(week.end))}
          {' · '}Week {index + 1} of {weeks.length}
        </p>}
      </div>
      {weeks && cycle && <div className="ah-week-nav">
        <button type="button" className="ah-button" aria-label="Previous week" disabled={index === 0}
          onClick={() => setSelection({ cycleId: cycle.assignment_id, index: index - 1 })}>‹</button>
        <button type="button" className="ah-button" aria-label="Next week" disabled={index === weeks.length - 1}
          onClick={() => setSelection({ cycleId: cycle.assignment_id, index: index + 1 })}>›</button>
      </div>}
    </header>
    {result.status !== 'ready' ? <SectionStatus status={result.status} label="schedule" retry={retry} /> : week ? <ol className="ah-week">
      {week.days.map(day => <li key={day.date} className={day.workouts.length ? 'ah-day' : 'ah-day ah-day-rest'}
        aria-current={day.today ? 'date' : undefined}>
        <time className="ah-meta" dateTime={day.date}>{weekday.format(Date.parse(day.date))} {Number(day.date.slice(-2))}</time>
        {day.workouts.length ? day.workouts.map(workout => <div key={workout.workout_instance_id} className="ah-day-workout">
          <strong title={workout.title}>{workout.shortTitle}</strong>
          <span className="ah-outcome" data-state={workout.state} title={workoutStatus[workout.state].label}>
            <span aria-hidden="true">{workoutStatus[workout.state].mark}</span>
            <span className="ah-sr">{workoutStatus[workout.state].label}</span>
          </span>
        </div>) : <span className="ah-rest">Rest</span>}
      </li>)}
    </ol> : <p className="ah-empty">No workouts scheduled.</p>}
  </section>
}

type ActivityProps = { onActivity(item: CoachRecentActivityItemV1): void }
function WorkoutRows({ items, onActivity }: ActivityProps & { items: CoachRecentActivityItemV1[] }) {
  return <ul className="ah-list">
    {items.map(item => <li key={item.activity_id}>
      <button type="button" className="ah-workout-row" onClick={() => onActivity(item)}>
        <time className="ah-meta" dateTime={item.performed_at}>{shortDate.format(Date.parse(item.performed_at))}</time>
        <strong title={item.day_label}>{item.day_label}</strong>
        <span className="ah-outcome" data-state={item.outcome}>{workoutStatus[item.outcome].label}</span>
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

export function AthleteHome({ api, gym, athlete, cycle, today, onActivity, onDirtyChange, hidden = false }: AthleteScope & ActivityProps & {
  cycle: AthleteHomeCycle | null
  today: string
  onDirtyChange(dirty: boolean): void
  hidden?: boolean
}) {
  const scope = { api, gym, athlete }
  return <div className="ah-root" hidden={hidden}>
    <div className="ah-layout">
      <div className="ah-main">
        <Schedule scope={scope} cycle={cycle} today={today} />
        <Recent scope={scope} onActivity={onActivity} />
        <Strength scope={scope} overviewVisible={!hidden} />
      </div>
      <aside className="ah-notes">
        <CoachNotes {...scope} onDirtyChange={onDirtyChange} />
      </aside>
    </div>
  </div>
}
