import './powerlift-trend.css'

export type PowerliftPoint = { date: string; estimated1rm: number }
export type PowerliftSeries = { lift: 'squat' | 'bench' | 'deadlift'; name: string; points: PowerliftPoint[] }
export function PowerliftTrend({ series, unit = 'lb' }: { series: PowerliftSeries[]; unit?: 'lb' | 'kg' }) {
  const ordered = (['squat','bench','deadlift'] as const).map(lift => {
    const item = series.find(entry => entry.lift === lift) ?? { lift, name: lift === 'squat' ? 'Back Squat' : lift === 'bench' ? 'Bench Press' : 'Deadlift', points: [] }
    return { ...item, points: item.points.filter(point => Number.isFinite(point.estimated1rm) && point.estimated1rm >= 0 && Number.isFinite(Date.parse(point.date))).sort((a,b) => Date.parse(a.date) - Date.parse(b.date)) }
  })
  const values = ordered.flatMap(item => item.points).filter(point => Number.isFinite(point.estimated1rm) && point.estimated1rm >= 0 && Number.isFinite(Date.parse(point.date)))
  const first = Math.min(...values.map(point => Date.parse(point.date)))
  const last = Math.max(...values.map(point => Date.parse(point.date)))
  const ceiling = Math.max(unit === 'lb' ? 100 : 50, Math.ceil(Math.max(0,...values.map(point => point.estimated1rm)) / (unit === 'lb' ? 100 : 50)) * (unit === 'lb' ? 100 : 50))
  const x = (date: string) => first === last ? 226 : 46 + (Date.parse(date) - first) / (last - first) * 360
  const y = (weight: number) => 154 - weight / ceiling * 130
  const shortDate = (time: number) => new Date(time).toLocaleDateString('en-US', { month:'short',day:'numeric',timeZone:'UTC' })
  return <div className="powerlift-trend"><div className="powerlift-legend" aria-label="Powerlift chart legend">{ordered.map(item => <div key={item.lift} data-lift={item.lift}><span className="powerlift-swatch" aria-hidden="true"/><span>{item.name}</span><strong>{item.points.length ? `${Number(item.points.at(-1)!.estimated1rm.toFixed(1))} ${unit}` : 'No logged sets'}</strong></div>)}</div>{values.length ? <svg viewBox="0 0 440 186" role="img" aria-label={`Estimated 1RM in ${unit}. ${ordered.map(item => `${item.name}: ${item.points.length ? item.points.map(point=>`${shortDate(Date.parse(point.date))} ${Number(point.estimated1rm.toFixed(1))}`).join(', ') : 'no logged sets'}`).join('. ')}`}><text x="4" y="12" className="powerlift-axis">{unit}</text>{[0,1,2,3,4].map(step=>{const weight=ceiling*step/4;return <g key={step}><line x1="46" x2="406" y1={y(weight)} y2={y(weight)} className="powerlift-grid"/><text x="36" y={y(weight)+3} textAnchor="end" className="powerlift-axis">{weight}</text></g>})}{ordered.map(item=><g key={item.lift} data-lift={item.lift}>{item.points.length>1&&<polyline points={item.points.map(point=>`${x(point.date)},${y(point.estimated1rm)}`).join(' ')} className="powerlift-line"/>}{item.points.map((point,index)=><circle key={`${point.date}-${index}`} cx={x(point.date)} cy={y(point.estimated1rm)} r="3" className="powerlift-point"><title>{item.name} · {shortDate(Date.parse(point.date))} · {Number(point.estimated1rm.toFixed(1))} {unit}</title></circle>)}</g>)}<text x="46" y="178" className="powerlift-axis">{shortDate(first)}</text><text x="406" y="178" textAnchor="end" className="powerlift-axis">{shortDate(last)}</text></svg> : <p className="powerlift-empty">No eligible completed sets recorded for the main lifts yet.</p>}<p className="powerlift-caption">Best estimated 1RM per session · Epley · Completed sets of 1–10 reps. Analysis only; coach-approved programming maxes stay separate.</p></div>
}
