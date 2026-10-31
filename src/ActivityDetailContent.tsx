import type {
  CoachActivityPerformedExerciseV1,
  CoachActivityPerformedSetV1,
  CoachActivityPlannedExerciseV1,
  CoachActivityPlannedSetV1,
  CoachWorkoutActivityDetailV1,
} from './lib/coach-api'
import './activity-detail.css'

const time = (value: string | null) => value === null ? 'Not recorded' : new Date(value).toLocaleString()
const actual = (value: number | null, unit: string | null = null) => value === null
  ? <span className="activity-missing" aria-label="Not recorded">—</span>
  : <>{value}{unit ? ` ${unit}` : ''}</>

export const activityWorkoutTitle = (detail: CoachWorkoutActivityDetailV1) => detail.planned.day.subtitle ?? detail.planned.day.label

function plannedSetSummary(set: CoachActivityPlannedSetV1, defaultUnit: 'lb' | 'kg', full = false) {
  const sets = set.sets_mode === 'range' ? `${set.sets_min}–${set.sets_max}` : String(set.sets_min)
  const setLabel = set.sets_mode === 'exact' && set.sets_min === 1 ? 'set' : 'sets'
  const dose = set.dose_mode === 'reps' ? set.reps_mode === 'athlete_choice' ? 'athlete choice reps' : `${set.dose_min}${set.dose_max === null ? '' : `–${set.dose_max}`} reps`
    : set.dose_mode === 'amrap' ? 'AMRAP' : `${set.dose_min} ${set.dose_mode === 'distance' ? set.distance_unit : set.dose_mode === 'time' ? 'seconds' : 'steps'}`
  const load = set.load_mode === 'exact' ? `${set.exact_weight} ${set.unit_override ?? defaultUnit}`
    : set.load_mode === 'percent' ? `${set.percent}%${set.of_max_id ? ' of pinned max' : ''}${full && set.percent_basis_max_type ? ` · ${set.percent_basis_max_type.replaceAll('_', ' ')}` : ''}${full && set.resolved_max_effective_from !== null ? ` · max effective ${set.resolved_max_effective_from}` : ''}${set.resolved_weight === null ? '' : ` · resolved ${set.resolved_weight} ${set.unit_override ?? defaultUnit}`}${set.manual_override === null ? '' : ` · manual override ${set.manual_override} ${set.unit_override ?? defaultUnit}`}`
      : set.load_mode === 'rpe' ? `RPE ${set.rpe_min}${set.rpe_max === null ? '' : `–${set.rpe_max}`}`
        : set.load_mode === 'qualitative' ? `Effort ${set.qualitative}` : set.load_mode
  return `${sets} ${setLabel} · ${dose} · ${load}${full ? ` · ${set.laterality.replaceAll('_', ' ')} · ${set.load_basis.replaceAll('_', ' ')}${set.rest_seconds === null ? '' : ` · ${set.rest_seconds}s rest`}` : ''}`
}

type Field = 'load' | 'reps' | 'time' | 'steps' | 'distance' | 'rpe'
const labels: Record<Field, string> = { load: 'Recorded load', reps: 'Reps', time: 'Time', steps: 'Steps', distance: 'Distance', rpe: 'RPE' }
function fieldsFor(group: CoachActivityPlannedSetV1 | null, logs: CoachActivityPerformedSetV1[]): Field[] {
  const has = (field: keyof CoachActivityPerformedSetV1) => logs.some(set => set[field] !== null)
  return (['load', 'reps', 'time', 'steps', 'distance', 'rpe'] as Field[]).filter(field => {
    if (field === 'load') return (group !== null && !['none', 'bodyweight'].includes(group.load_mode)) || has('actual_weight')
    if (field === 'reps') return group?.dose_mode === 'reps' || group?.dose_mode === 'amrap' || has('actual_reps')
    if (field === 'time') return group?.dose_mode === 'time' || has('actual_seconds')
    if (field === 'steps') return group?.dose_mode === 'steps' || has('actual_steps')
    if (field === 'distance') return group?.dose_mode === 'distance' || has('actual_distance')
    return group?.load_mode === 'rpe' || has('actual_rpe')
  })
}
function fieldValue(set: CoachActivityPerformedSetV1, field: Field) {
  if (field === 'load') return actual(set.actual_weight, set.actual_weight_unit)
  if (field === 'reps') return actual(set.actual_reps)
  if (field === 'time') return actual(set.actual_seconds, 's')
  if (field === 'steps') return actual(set.actual_steps)
  if (field === 'distance') return actual(set.actual_distance, set.actual_distance_unit)
  return actual(set.actual_rpe)
}

function SetTable({ title, group, logs }: { title: string; group: CoachActivityPlannedSetV1 | null; logs: CoachActivityPerformedSetV1[] }) {
  if (logs.length === 0) return <p className="activity-empty-sets">No set facts recorded.</p>
  const fields = fieldsFor(group, logs)
  return <div className="activity-set-table-wrap"><table className="activity-set-table"><caption className="activity-visually-hidden">{title} set results</caption><thead><tr><th scope="col">Set</th>{fields.map(field => <th key={field} scope="col">{labels[field]}</th>)}<th scope="col">State</th></tr></thead><tbody>{logs.map(set => <FragmentRow key={set.id} set={set} fields={fields} />)}</tbody></table></div>
}
function FragmentRow({ set, fields }: { set: CoachActivityPerformedSetV1; fields: Field[] }) {
  return <><tr><th scope="row" data-label="Set">{set.set_number}</th>{fields.map(field => <td key={field} data-label={labels[field]}>{fieldValue(set, field)}</td>)}<td data-label="State"><span className={`activity-set-state ${set.completed ? 'complete' : 'incomplete'}`}>{set.completed ? 'Completed' : 'Incomplete'}</span></td></tr>{set.athlete_note && <tr className="activity-set-note"><td colSpan={fields.length + 2}><strong>Set note:</strong> {set.athlete_note}</td></tr>}</>
}

function LoggedOutsidePlan({ log, title }: { log: CoachActivityPerformedExerciseV1; title: string }) {
  const groups = [...new Set(log.sets.map(set => set.revision_set_group_id))]
  return <article className="activity-lift activity-unmatched"><div className="activity-lift-head"><h4>{title}</h4><p>Recorded rows do not match a set group in this saved prescription.</p>{log.athlete_note && <p><strong>Athlete exercise note:</strong> {log.athlete_note}</p>}</div>{groups.map(group => <SetTable key={group} title={title} group={null} logs={log.sets.filter(set => set.revision_set_group_id === group).sort((a, b) => a.set_number - b.set_number)} />)}<details className="activity-technical"><summary>Record identity</summary><p>Exercise row {log.revision_exercise_row_id}</p></details></article>
}

function Lift({ exercise, log, group, defaultUnit }: { exercise: CoachActivityPlannedExerciseV1; log?: CoachActivityPerformedExerciseV1; group?: CoachWorkoutActivityDetailV1['planned']['movement_groups'][number]; defaultUnit: 'lb' | 'kg' }) {
  const plannedIds = new Set(exercise.set_groups.map(set => set.revision_set_group_id))
  const unmatched = log?.sets.filter(set => !plannedIds.has(set.revision_set_group_id)) ?? []
  return <article className="activity-lift"><div className="activity-lift-head"><div><h4>{exercise.exercise_name}</h4>{group && <p className="activity-group-label">{group.title ?? group.group_type} · {group.group_type}{group.rounds_min === null ? '' : ` · ${group.rounds_min}${group.rounds_max === null ? '' : `–${group.rounds_max}`} rounds`}</p>}</div><span className="activity-lift-count">{log?.sets.length ?? 0} recorded {log?.sets.length === 1 ? 'set row' : 'set rows'}</span></div>
    {exercise.exercise_instruction && <p className="activity-inline-note"><strong>Coach instruction:</strong> {exercise.exercise_instruction}</p>}
    {log?.athlete_note && <p className="activity-inline-note"><strong>Athlete exercise note:</strong> {log.athlete_note}</p>}
    {exercise.set_groups.map(setGroup => { const logs = log?.sets.filter(set => set.revision_set_group_id === setGroup.revision_set_group_id).sort((a, b) => a.set_number - b.set_number) ?? []; return <div className="activity-set-group" key={setGroup.revision_set_group_id}><p className="activity-prescription"><strong>Planned:</strong> {plannedSetSummary(setGroup, defaultUnit)}</p>{setGroup.note && <p className="activity-inline-note"><strong>Coach set note:</strong> {setGroup.note}</p>}<SetTable title={exercise.exercise_name} group={setGroup} logs={logs}/><details className="activity-technical"><summary>Full prescription</summary><p>{plannedSetSummary(setGroup, defaultUnit, true)}</p></details></div> })}
    {unmatched.length > 0 && <div className="activity-set-group"><p className="activity-prescription"><strong>Recorded outside planned set groups</strong></p><SetTable title={`${exercise.exercise_name} additional`} group={null} logs={unmatched.sort((a, b) => a.set_number - b.set_number)}/></div>}
    {(exercise.protocol || exercise.movement_note || log) && <details className="activity-technical"><summary>Exercise and update details</summary>{exercise.protocol && <p><strong>Protocol:</strong> {exercise.protocol}</p>}{exercise.movement_note && <p><strong>Coach note:</strong> {exercise.movement_note}</p>}{log && <p><strong>Exercise sync:</strong> {time(log.updated_at)}</p>}{log?.sets.map(set => <p key={set.id}>Set {set.set_number}: device update {time(set.device_updated_at)} · synced update {time(set.updated_at)}</p>)}</details>}
  </article>
}

export function ActivityDetailContent({ detail }: { detail: CoachWorkoutActivityDetailV1 }) {
  const exercises = [...detail.planned.movement_groups.flatMap(group => group.exercises), ...detail.planned.ungrouped_exercises].sort((a, b) => a.ordinal - b.ordinal)
  const performed = new Map(detail.performed_exercises.map(exercise => [exercise.revision_exercise_row_id, exercise]))
  const movementGroups = new Map(detail.planned.movement_groups.flatMap(group => group.exercises.map(exercise => [exercise.revision_exercise_row_id, group] as const)))
  const plannedIds = new Set(exercises.map(exercise => exercise.revision_exercise_row_id))
  const unmatched = detail.performed_exercises.filter(exercise => !plannedIds.has(exercise.revision_exercise_row_id))
  return <div className="activity-logbook"><div className="activity-logbook-intro"><span className={`activity-outcome-badge ${detail.outcome}`}>{detail.outcome === 'completed' ? 'Completed session' : 'Skipped session'}</span><p>{detail.program_name} · <time dateTime={detail.performed_at}>{time(detail.performed_at)}</time></p>{detail.session.state !== detail.outcome && <p className="activity-state-warning">Current session state: {detail.session.state.replaceAll('_', ' ')}</p>}</div>
    {detail.session.athlete_note && <div className="activity-session-note"><strong>Athlete session note</strong><p>{detail.session.athlete_note}</p></div>}
    {detail.outcome === 'skipped' && <div className="activity-session-note"><strong>Skip reason:</strong> {detail.session.skip_reason ?? 'Not recorded'}</div>}
    {detail.planned.day.workout_instruction && <p className="activity-day-instruction"><strong>Coach instruction:</strong> {detail.planned.day.workout_instruction}</p>}
    <section className="activity-lift-list" aria-label="Planned and performed lifts"><h3>{detail.outcome === 'skipped' ? 'Planned workout' : 'Planned and performed'}</h3>{exercises.length === 0 ? <p>No exercises were prescribed.</p> : exercises.map(exercise => <Lift key={exercise.revision_exercise_row_id} exercise={exercise} log={performed.get(exercise.revision_exercise_row_id)} group={movementGroups.get(exercise.revision_exercise_row_id)} defaultUnit={detail.planned.revision.default_unit}/>)}</section>
    {unmatched.length > 0 && <section className="activity-lift-list" aria-label="Additional recorded exercises"><h3>Additional recorded exercises</h3>{unmatched.map(log => <LoggedOutsidePlan key={log.id} log={log} title="Recorded exercise outside plan"/>)}</section>}
    <details className="activity-sync"><summary>Session and sync details</summary><div className="activity-sync-grid"><div><strong>Performed</strong><time dateTime={detail.performed_at}>{time(detail.performed_at)}</time></div><div><strong>Received by sync</strong><time dateTime={detail.recorded_at}>{time(detail.recorded_at)}</time></div><div><strong>Current session state</strong><span>{detail.session.state.replaceAll('_', ' ')}</span></div><div><strong>Started</strong><span>{time(detail.session.started_at)}</span></div><div><strong>{detail.outcome === 'completed' ? 'Completed at' : 'Skipped at'}</strong><span>{time(detail.outcome === 'completed' ? detail.session.completed_at : detail.session.skipped_at)}</span></div><div><strong>Downloaded</strong><span>{time(detail.delivery.acknowledged_at)}</span></div><div><strong>Opened</strong><span>{time(detail.delivery.opened_at)}</span></div><div><strong>Receipt consumed</strong><span>{time(detail.delivery.consumed_at)}</span></div><div><strong>Last session update</strong><span>{time(detail.session.updated_at)}</span></div></div><p>Received by sync records when this workout reached the coach. It does not establish whether the athlete has pending updates.</p></details>
  </div>
}
