import { useEffect, useId, useRef, useState } from 'react'
import './athlete-schedule-panel.css'

export type AthleteScheduleWorkout = {
  workout_instance_id: string
  assignment_id: string
  logical_day_id: string
  receipt_id: string | null
  title: string
  program_name: string
  week_ordinal: number
  day_ordinal: number
  original_date: string | null
  scheduled_date: string | null
  version: number
  state: 'not_started' | 'in_progress' | 'completed' | 'skipped'
  updated_at: string | null
  note: string | null
}

export type AthleteSchedulePanelProps = {
  gym: string
  athlete: string
  assignment?: string
  full?: boolean
  getSchedule: (input: { target_gym: string; target_athlete: string }) => Promise<{
    contract_version: 1
    workouts: AthleteScheduleWorkout[]
  }>
}

const dateValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}
const shiftDate = (value: string, days: number) => {
  const date = dateValue(value)!
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
const weekStart = (value: string) => {
  const day = dateValue(value)!.getUTCDay()
  return shiftDate(value, -((day + 6) % 7))
}
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const shortDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', timeZone: 'UTC',
}).format(dateValue(value)!)
const stateLabel: Record<AthleteScheduleWorkout['state'], string> = {
  not_started: 'Scheduled', in_progress: 'In progress', completed: 'Completed', skipped: 'Skipped',
}

function ScheduleScope({ gym, athlete, assignment, full = false, getSchedule }: AthleteSchedulePanelProps) {
  const headingId = useId()
  const dateId = useId()
  const [expanded, setExpanded] = useState(full)
  const [selectedDate, setSelectedDate] = useState(today)
  const [workouts, setWorkouts] = useState<AthleteScheduleWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const api = useRef(getSchedule)
  const refreshRef = useRef<() => void>(() => {})
  useEffect(() => { api.current = getSchedule }, [getSchedule])

  useEffect(() => {
    let mounted = true
    let requestNumber = 0
    const refresh = async () => {
      const request = ++requestNumber
      setLoading(true)
      try {
        const result = await api.current({ target_gym: gym, target_athlete: athlete })
        if (!mounted || request !== requestNumber) return
        setWorkouts(result.workouts.filter(row => !assignment || row.assignment_id === assignment))
        setError(false)
        setUpdatedAt(new Date())
      } catch {
        if (!mounted || request !== requestNumber) return
        setWorkouts([])
        setUpdatedAt(null)
        setError(true)
      } finally {
        if (mounted && request === requestNumber) setLoading(false)
      }
    }
    refreshRef.current = () => { void refresh() }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    void refresh()
    const timer = window.setInterval(refreshVisible, 30_000)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      mounted = false
      requestNumber += 1
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
      refreshRef.current = () => {}
    }
  }, [gym, athlete, assignment])

  const start = weekStart(selectedDate)
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(start, index))
  const unscheduled = workouts.filter(row => !row.scheduled_date || !dateValue(row.scheduled_date))
  const renderWorkout = (row: AthleteScheduleWorkout) => {
    const moved = row.original_date !== null && row.scheduled_date !== null
      && row.original_date !== row.scheduled_date
    return <li key={row.workout_instance_id} className="athlete-schedule-workout" data-state={row.state}>
      <span className="athlete-schedule-state">{stateLabel[row.state]}</span>
      <h4>{row.title}</h4>
      <p className="athlete-schedule-program">{row.program_name} · Week {row.week_ordinal}</p>
      {moved && <p className="athlete-schedule-moved">Moved by athlete<br />
        <span>Originally <time dateTime={row.original_date!}>{shortDate(row.original_date!)}</time></span>
      </p>}
      {row.note && <p className="athlete-schedule-note">{row.note}</p>}
    </li>
  }

  return <section className={`athlete-schedule-panel${expanded ? '' : ' is-mini'}`} aria-labelledby={headingId}>
    <header className="athlete-schedule-heading">
      <div>
        <h2 id={headingId}>Athlete schedule</h2>
        <p>{shortDate(start)} – {shortDate(days[6])} · Athlete’s current dates</p>
      </div>
      <div className="athlete-schedule-header-actions"><button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide schedule' : 'View schedule'}</button>
      {expanded && <button type="button" onClick={() => refreshRef.current()} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>}</div>
    </header>
    {!expanded && !error && <div className="athlete-schedule-mini-grid" aria-label="Athlete schedule week summary">{days.map(date => {
      const rows = workouts.filter(row => row.scheduled_date === date)
      return <div key={date} data-today={date === today()}><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(dateValue(date)!)}</span><time dateTime={date}>{dateValue(date)!.getUTCDate()}</time><span className="athlete-schedule-mini-workout" title={rows.map(row => `${row.title} · ${stateLabel[row.state]}`).join(' / ')}>{loading && updatedAt === null ? '…' : rows.length ? rows.map(row => row.title).join(' / ') : '—'}</span></div>
    })}</div>}
    <div hidden={!expanded}>
    <div className="athlete-schedule-toolbar">
      <div className="athlete-schedule-navigation" role="group" aria-label="Schedule week navigation">
        <button type="button" aria-label="Previous schedule week" onClick={() => setSelectedDate(shiftDate(start, -7))}>←</button>
        <h3><time dateTime={start}>{shortDate(start)}</time> – <time dateTime={days[6]}>{shortDate(days[6])}</time>
          <span>{dateValue(start)!.getUTCFullYear()}{dateValue(start)!.getUTCFullYear() !== dateValue(days[6])!.getUTCFullYear()
            ? ` – ${dateValue(days[6])!.getUTCFullYear()}` : ''}</span>
        </h3>
        <button type="button" aria-label="Next schedule week" onClick={() => setSelectedDate(shiftDate(start, 7))}>→</button>
      </div>
      <label htmlFor={dateId}>Go to date <input id={dateId} type="date" value={selectedDate}
        onChange={event => { if (dateValue(event.target.value)) setSelectedDate(event.target.value) }} /></label>
      <button type="button" onClick={() => setSelectedDate(today())}>This week</button>
    </div>
    {error ? <p className="athlete-schedule-error" role="alert">The athlete schedule could not be loaded. Refresh to try again.</p>
      : loading && updatedAt === null ? <p className="athlete-schedule-message" role="status">Loading athlete schedule…</p>
        : <>
          <div className="athlete-schedule-grid">
            {days.map(date => {
              const rows = workouts.filter(row => row.scheduled_date === date)
                .sort((a, b) => a.week_ordinal - b.week_ordinal || a.day_ordinal - b.day_ordinal
                  || a.workout_instance_id.localeCompare(b.workout_instance_id))
              return <article key={date} className="athlete-schedule-day" data-today={date === today()}>
                <h3>{new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(dateValue(date)!)}
                  <time dateTime={date}>{shortDate(date)}</time>
                </h3>
                {rows.length ? <ul>{rows.map(renderWorkout)}</ul> : <p className="athlete-schedule-empty">No workout scheduled</p>}
              </article>
            })}
          </div>
          {unscheduled.length > 0 && <div className="athlete-schedule-undated">
            <h3>Workouts without a date</h3><ul>{unscheduled.map(renderWorkout)}</ul>
          </div>}
        </>}
    </div>
    {!expanded && error && <p className="athlete-schedule-error" role="alert">Schedule unavailable. Open schedule to retry.</p>}
    {updatedAt && <p className="athlete-schedule-updated">Updated <time dateTime={updatedAt.toISOString()}>
      {updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time> {expanded && '· Refreshes every 30 seconds while visible'}</p>}
  </section>
}

export function AthleteSchedulePanel(props: AthleteSchedulePanelProps) {
  // A fresh scope unmounts the previous request and clears its protected rows before rendering.
  return <ScheduleScope key={JSON.stringify([props.gym, props.athlete, props.assignment])} {...props} />
}

export default AthleteSchedulePanel
