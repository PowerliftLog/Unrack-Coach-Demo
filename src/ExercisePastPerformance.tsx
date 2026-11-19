import type { CoachExerciseHistoryV1 } from './lib/coach-api'
import { pastPerformance, sessionTops, topTrend } from './lib/exercise-past-performance'

export type AthleteHistoryState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; history: CoachExerciseHistoryV1 }

/** What the athlete actually did for the selected exercise, from their last 40 completed sessions.
 * Sets logged with only an RPE show the prescription they were given, marked "as written". */
export default function ExercisePastPerformance({ name, state, layout = 'list' }: { name: string; state: AthleteHistoryState; layout?: 'list' | 'table' }) {
  if (layout === 'table') return <PastWeightsTable name={name} state={state} />
  const heading = <h3>Past performance</h3>
  if (!name.trim()) return <>{heading}<p>Name the exercise to see what the athlete did before.</p></>
  if (state.status === 'loading') return <>{heading}<p role="status">Loading recent sessions…</p></>
  if (state.status === 'error') return <>{heading}<p>Recent sessions could not be loaded.</p></>
  const result = pastPerformance(state.history, name)
  return <>
    {heading}
    {result.sessions.length ? <Sessions label={`Recent ${name} sessions`} sessions={result.sessions} />
      : <p>No completed sets named “{name}” in the last 40 sessions.</p>}
    {result.similar.map(item => <div key={item.name} className="cse-similar">
      <p>Similar name: <strong>{item.name}</strong></p>
      <Sessions label={`Recent ${item.name} sessions`} sessions={item.sessions} />
    </div>)}
  </>
}

function Sessions({ label, sessions }: { label: string; sessions: { date: string; lines: string[] }[] }) {
  return <ol aria-label={label}>{sessions.map(session => <li key={session.date + session.lines.join()}>
    <strong><time dateTime={session.date}>{new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></strong>
    {session.lines.map((line, index) => <span key={index}>{line}</span>)}
  </li>)}</ol>
}

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** Compact form for the builder's exercise card: one row per session with its top set, and the
 * top-set change across the rows shown. Falls back to the closest-named lift, said plainly. */
function PastWeightsTable({ name, state }: { name: string; state: AthleteHistoryState }) {
  if (!name.trim()) return <p className="cse-card-muted">Name the exercise to see past weights.</p>
  if (state.status === 'loading') return <p className="cse-card-muted" role="status">Loading recent sessions…</p>
  if (state.status === 'error') return <p className="cse-card-muted">Recent sessions could not be loaded.</p>
  const result = pastPerformance(state.history, name, 5)
  const fallback = result.sessions.length ? null : result.similar[0] ?? null
  const shown = fallback ? fallback.name : name, sessions = fallback ? fallback.sessions : result.sessions
  if (!sessions.length) return <p className="cse-card-muted">No completed sets named “{name}” or anything like it in the last 40 sessions.</p>
  const tops = sessionTops(state.history, shown), dated = new Map(tops.map(top => [top.date, top]))
  const trend = topTrend(sessions.flatMap(session => dated.get(session.date) ?? []))
  return <>
    {fallback && <p className="cse-card-similar">No history as “{name}”. Showing <strong>{fallback.name}</strong>.</p>}
    {trend && <p className={`cse-card-trend${trend.change > 0 ? ' up' : trend.change < 0 ? ' down' : ''}`}>{trend.change > 0 ? '▲ +' : trend.change < 0 ? '▼ ' : '● '}{trend.change} {trend.unit ?? ''} top set since {shortDate(trend.since)}</p>}
    <table className="cse-card-table" aria-label={`Recent ${shown} sessions`}><thead><tr><th scope="col">Date</th><th scope="col">Sets done</th><th scope="col">Top</th></tr></thead>
      <tbody>{sessions.map(session => { const top = dated.get(session.date); return <tr key={session.date + session.lines.join()}>
        <td><time dateTime={session.date}>{shortDate(session.date)}</time></td><td>{session.lines.join(', ')}</td><td>{top ? `${String(top.weight)}` : '—'}</td></tr> })}</tbody></table>
  </>
}
