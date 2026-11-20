import { useEffect, useState } from 'react'
import type { CoachAssignmentDayV6, CoachAssignmentDetailV5, Phase5CorrectionApi, RichProgramExercise } from './lib/coach-api'
import { existingPlanPrescription, range } from './lib/existing-plan-prescription'

export { existingPlanPrescription } from './lib/existing-plan-prescription'

export type ExistingPlanViewerProps = {
  api: Partial<Pick<Phase5CorrectionApi, 'getCoachAssignmentDetailV5' | 'getCoachAssignmentDayV6'>>
  assignmentId: string
  athleteName?: string
}

function Note({ children }: { children: string | null }) {
  return children ? <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{children}</p> : null
}

function Workout({ response, unit }: { response: CoachAssignmentDayV6; unit: 'lb' | 'kg' }) {
  const day = response.day
  if (day.mode === 'legacy_oversize') return <p role="status">Detailed prescriptions are unavailable for this legacy workout ({day.exercise_count} exercises, {day.set_row_count} set rows).</p>
  const content = day.content
  const exercise = (item: RichProgramExercise) => <article key={item.identity_token ?? item.ordinal}>
    <h4>{item.name}</h4>
    <Note>{item.instruction}</Note><Note>{item.note}</Note><Note>{item.protocol}</Note>
    {item.status === 'not_programmed' && <p>Not programmed</p>}
    {item.set_groups.length ? <ol>{item.set_groups.map(set => <li key={set.identity_token ?? set.ordinal}>
      {existingPlanPrescription(set, unit, response.percent_basis_options.find(option => option.exercise_id === set.percent_basis_exercise_id)?.name)}
      <Note>{set.note}</Note>
    </li>)}</ol> : <p>No set prescriptions.</p>}
  </article>
  return <>
    {(content.locked || content.locked_any) && <p role="status">Locked workout · available to view</p>}
    {!content.day_editable && content.day_unsupported_reason && <p>Some workout content is unavailable in this version: {content.day_unsupported_reason}</p>}
    <h3>{content.workout_title ?? content.label}</h3><Note>{content.subtitle}</Note><Note>{content.workout_instruction}</Note>
    {content.marked_rest && <p>Rest day</p>}
    {content.movement_groups.map(group => <section key={group.identity_token ?? group.ordinal}>
      <h4>{group.group_type === 'superset' ? 'Superset' : group.group_type === 'circuit' ? 'Circuit' : 'Sequence'}{group.title ? `: ${group.title}` : ''}{group.rounds_min === null ? '' : ` · ${range(group.rounds_min, group.rounds_max)} rounds`}</h4>
      {group.exercises.map(exercise)}
    </section>)}
    {content.ungrouped_exercises.map(exercise)}
    {!content.movement_groups.some(group => group.exercises.length) && !content.ungrouped_exercises.length && !content.marked_rest && <p>No exercises in this day.</p>}
  </>
}

function Plan({ api, assignmentId, athleteName }: ExistingPlanViewerProps) {
  const [detail, setDetail] = useState<CoachAssignmentDetailV5 | null>(null)
  const [detailError, setDetailError] = useState(false)
  const [reload, setReload] = useState(0)
  const [weekId, setWeekId] = useState('')
  const [dayOrdinal, setDayOrdinal] = useState(0)
  const [dayState, setDayState] = useState<{ token: string; response?: CoachAssignmentDayV6; error?: boolean } | null>(null)
  const supported = typeof api.getCoachAssignmentDetailV5 === 'function' && typeof api.getCoachAssignmentDayV6 === 'function'
  useEffect(() => {
    let cancelled = false
    setDetail(null); setDetailError(false); setDayState(null)
    if (supported) void api.getCoachAssignmentDetailV5!({ assignment: assignmentId }).then(value => {
      if (cancelled) return
      setDetail(value)
      const week = value.weeks[0]
      setWeekId(week?.week_identity_token ?? '')
      setDayOrdinal(week?.days.find(day => day.day_identity_token)?.day_ordinal ?? week?.days[0]?.day_ordinal ?? 0)
    }).catch(() => { if (!cancelled) setDetailError(true) })
    return () => { cancelled = true }
  }, [api, assignmentId, reload, supported])
  const week = detail?.weeks.find(item => item.week_identity_token === weekId)
  const slot = week?.days.find(item => item.day_ordinal === dayOrdinal)
  const token = slot?.day_identity_token
  useEffect(() => {
    let cancelled = false
    setDayState(null)
    if (detail && token && supported) {
      void api.getCoachAssignmentDayV6!({ assignment: assignmentId, day_identity_token: token, expected_detail_read_token: detail.detail_read_token })
        .then(response => { if (!cancelled) setDayState({ token, response }) })
        .catch(() => { if (!cancelled) setDayState({ token, error: true }) })
    }
    return () => { cancelled = true }
  }, [api, assignmentId, detail, token, supported])
  const retry = () => setReload(value => value + 1)
  return <section aria-label="Existing plan" className="athlete-profile-section">
    <h2>{detail?.program_name ?? 'Existing plan'}{athleteName ? ` · ${athleteName}` : ''}</h2>
    <p>Read-only plan</p>
    {!supported ? <p role="status">Plan viewing is unavailable in this workspace version.</p>
      : detailError ? <div role="alert"><p>Unable to load this plan.</p><button type="button" className="button outline" onClick={retry}>Retry plan</button></div>
      : !detail ? <p role="status">Loading plan…</p> : <>
        <label>Week<select value={weekId} onChange={event => {
          const next = detail.weeks.find(item => item.week_identity_token === event.target.value)
          setWeekId(event.target.value); setDayOrdinal(next?.days.find(day => day.day_identity_token)?.day_ordinal ?? next?.days[0]?.day_ordinal ?? 0)
        }}>{detail.weeks.map(item => <option key={item.week_identity_token} value={item.week_identity_token}>Week {item.week_ordinal}</option>)}</select></label>
        <label>Day<select value={dayOrdinal} onChange={event => setDayOrdinal(Number(event.target.value))}>
          {week?.days.map(day => <option key={day.day_ordinal} value={day.day_ordinal}>{day.system_weekday} · {day.workout_title ?? day.label ?? day.status}{day.locked_any ? ' · Locked' : ''}</option>)}
        </select></label>
        {!slot ? <p role="status">No days available.</p> : <>
          <p>{slot.planned_date}</p>
          {!token ? <p role="status">{slot.status === 'rest' || slot.status === 'unscheduled' ? 'Rest day · no workout scheduled.' : 'Workout details unavailable.'}</p>
            : dayState?.token === token && dayState.error ? <div role="alert"><p>Unable to load this workout. Reload the plan to get its latest contents.</p><button type="button" className="button outline" onClick={retry}>Retry plan</button></div>
            : dayState?.token === token && dayState.response ? <Workout response={dayState.response} unit={detail.default_unit} /> : <p role="status">Loading workout…</p>}
        </>}
      </>}
  </section>
}

// Remount on assignment changes so an old athlete's plan is never rendered while the next read starts.
export function ExistingPlanViewer(props: ExistingPlanViewerProps) {
  return <Plan key={props.assignmentId} {...props} />
}
