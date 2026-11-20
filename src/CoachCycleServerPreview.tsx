import type { CoachCyclePublishPreview, CoachCycleSqlGroup } from './lib/coach-cycle-publish-api'
import { amrapMinimumFromNote } from './lib/coach-sheet-interpret'

function columnName(index: number): string {
  let value = index + 1, name = ''
  while (value > 0) { value--; name = String.fromCharCode(65 + value % 26) + name; value = Math.floor(value / 26) }
  return name
}

export function describeGroup(group: CoachCycleSqlGroup, defaultUnit: 'lb' | 'kg'): string {
  const minimum = amrapMinimumFromNote(group.note)
  const dose = group.dose_mode === 'reps' ? `${group.dose_min}${group.dose_max === null ? '' : `–${group.dose_max}`} reps`
    : group.dose_mode === 'time' ? `${group.dose_min} sec`
    : group.dose_mode === 'amrap' ? minimum === null ? 'max reps' : `${minimum}+ reps`
    : `${group.dose_min} ${group.distance_unit}`
  const load = group.load_mode === 'exact' ? `${group.exact_weight} ${group.unit_override ?? defaultUnit}`
    : group.load_mode === 'qualitative' ? `${group.qualitative} intensity`
    : group.load_mode === 'bodyweight' ? 'bodyweight'
    : group.load_mode === 'none' ? 'no weight'
    : group.load_mode === 'athlete_choice' ? 'athlete chooses weight'
    : 'RPE load'
  const rpe = group.rpe_min === null ? '' : ` · RPE ${group.rpe_min}${group.rpe_max === null ? '' : `–${group.rpe_max}`}`
  return `${group.sets_min} ${group.sets_min === 1 ? 'set' : 'sets'} × ${dose} · ${load}${rpe}${group.laterality === 'each_side' ? ' · each side' : ''}`
}

/** The server's saved-source interpretation, shown before any publish control exists. */
export default function CoachCycleServerPreview({ preview }: { preview: CoachCyclePublishPreview }) {
  const cycle = preview.compiled
  return <div aria-label="Saved cycle preview summary">
    <h3>{cycle.name} · saved revision {preview.draft_revision}</h3>
    <p>{cycle.start_on} to {cycle.end_on} · default unit {cycle.unit}</p>
    <dl className="ccd-preview-totals"><div><dt>Weeks</dt><dd>{cycle.week_count}</dd></div><div><dt>Exercise prescriptions</dt><dd>{cycle.totals.exercises}</dd></div><div><dt>Explicit skips</dt><dd>{cycle.totals.skipped}</dd></div><div><dt>Set groups</dt><dd>{cycle.totals.groups}</dd></div><div><dt>Physical sets</dt><dd>{cycle.totals.sets}</dd></div><div><dt>Cells accounted for</dt><dd>{cycle.coverage.length}</dd></div></dl>
    {cycle.weeks.map(week => <details key={week.ordinal}><summary>Week {week.ordinal}</summary>
      {week.days.map(day => {
        const omitted = cycle.provenance.filter(item => item.week === week.ordinal && item.day === day.payload.label && item.skipped)
        return <section className="ccd-preview-day" key={day.weekday} aria-label={`${day.payload.label} week ${week.ordinal}`}>
          <h4>{day.payload.label} · {day.scheduled_date}</h4>
          {day.payload.marked_rest && <p>Explicit rest: all exercise blocks skipped.</p>}
          <ol>{day.payload.ungrouped_exercises.map((exercise, index) => {
            const source = cycle.provenance.filter(item => item.week === week.ordinal && item.day === day.payload.label && !item.skipped)[index]
            return <li key={source?.block_id ?? index}>
              <strong>{exercise.name}</strong>{source && <span className="ccd-preview-source"> · sheet {columnName(source.column + 2)}{source.prescription_row + 1}</span>}
              <p>Coach prescription: {exercise.protocol}</p>
              <ol>{exercise.set_groups.map(group => <li key={group.ordinal}>{describeGroup(group, cycle.unit)}</li>)}</ol>
              {exercise.instruction && <p>Coach instructions: {exercise.instruction}</p>}
            </li>
          })}</ol>
          {omitted.length > 0 && <p>{omitted.length} explicitly skipped {omitted.length === 1 ? 'exercise' : 'exercises'} in this workout.</p>}
        </section>
      })}
    </details>)}
  </div>
}
