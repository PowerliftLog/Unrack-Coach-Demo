import { localToday, shortDate } from './lib/local-date'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ManualTabList } from './ManualTabList'
import { MaxReportInbox } from './MaxReportInbox'
import { ModalDialog } from './ModalDialog'
import { splitProgrammingMaxes } from './lib/athlete-home-data'
import { CoachApiError, type AthleteProfileInputV1, type AthleteProfileV1, type AthleteTrackingV1, type BacklogRevisionApi, type CoachAthleteMetricsV1, type ConnectedCoachApiV3, type ConnectedCoachApiV4, type PercentageProgrammingApi, type ProgrammingMaxesV1, type ProgrammingMaxRecordV1, type TrainingReportV1 } from './lib/coach-api'
import { convertProfileWeight, testedMaxForSubmission, ProfileMaxValidationError, type WeightUnit } from './lib/profile-max-entry'
import './athlete-profile-panel.css'

export function errorText(error: unknown) {
  if (error instanceof ProfileMaxValidationError) return error.message
  if (!(error instanceof CoachApiError)) return 'The workspace could not be loaded. Check your connection and try again.'
  const message = error.code === 'request_rejected'
    ? 'The coach request could not be processed. Check the form and try again.'
    : error.message
  return error.requestId ? `${message} (Support reference: ${error.requestId.slice(0, 8)})` : message
}

function profileNumber(form: FormData, key: string): number | null {
  const raw = String(form.get(key) ?? '').trim()
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}
export function profileFromForm(form: FormData): AthleteProfileInputV1 {
  const bodyweight = profileNumber(form, 'bodyweight')
  const unit = form.get('bodyweight_unit') === 'kg' ? 'kg' : 'lb'
  const preferred = form.get('preferred_weight_unit') === 'kg' ? 'kg' : 'lb'
  const testedUnit = form.get('tested_1rm_unit') === 'kg' ? 'kg' : 'lb'
  const testedMax = (lift: 'squat' | 'bench' | 'deadlift') => testedMaxForSubmission(String(form.get(`tested_1rm_${lift}`) ?? ''), form.get(`tested_1rm_${lift}_edited`) === 'true', lift[0].toUpperCase() + lift.slice(1), testedUnit)
  return {
    name: String(form.get('name') ?? [...form.entries()].find(([key]) => key.startsWith('intake-name-'))?.[1] ?? '').trim(),
    sex_category: form.get('sex_category') === 'male' || form.get('sex_category') === 'female' ? form.get('sex_category') as 'male' | 'female' : null,
    bodyweight_value: bodyweight, bodyweight_unit: bodyweight === null ? null : unit,
    preferred_weight_unit: preferred,
    tested_1rm_squat: testedMax('squat'),
    tested_1rm_bench: testedMax('bench'),
    tested_1rm_deadlift: testedMax('deadlift'),
    tested_1rm_unit: testedUnit,
  }
}
function TestedMaxEntry({ lift, original, canonicalUnit }: { lift: 'squat' | 'bench' | 'deadlift'; original: number | null; canonicalUnit: WeightUnit }) {
  const name = lift[0].toUpperCase() + lift.slice(1)
  const [unit, setUnit] = useState<WeightUnit>(canonicalUnit)
  const [draft, setDraft] = useState({ text: original === null ? '' : String(original), canonical: original, edited: false })
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let message = ''
    try { testedMaxForSubmission(draft.canonical === null ? '' : String(draft.canonical), draft.edited, name, canonicalUnit) }
    catch (cause) { message = cause instanceof Error ? cause.message : 'Review this 1RM.' }
    input.current?.setCustomValidity(message)
  }, [draft, name, canonicalUnit])
  return <div className="athlete-tested-max-row"><label>{name}<input ref={input} type="number" step="any" inputMode="decimal" value={draft.text} onChange={event => { const text = event.target.value; setDraft({ text, canonical: text.trim() ? convertProfileWeight(Number(text), unit, canonicalUnit) : null, edited: true }) }} /></label><label className="athlete-tested-max-unit"><span className="sr-only">{name} 1RM unit</span><select value={unit} onChange={event => { const next = event.target.value as WeightUnit; setUnit(next); setDraft(current => ({ ...current, text: current.canonical === null ? '' : String(convertProfileWeight(current.canonical, canonicalUnit, next)) })) }}><option value="lb">lb</option><option value="kg">kg</option></select></label><input type="hidden" name={`tested_1rm_${lift}`} value={draft.canonical ?? ''} /><input type="hidden" name={`tested_1rm_${lift}_edited`} value={String(draft.edited)} /></div>
}
export function AthleteProfileFields({ profile, autoFocusName = false }: { profile?: AthleteProfileV1; autoFocusName?: boolean }) {
  const fieldId = useId().replace(/[^a-zA-Z0-9]/g, '')
  return <div className="athlete-profile-fields"><label>Name<input autoFocus={autoFocusName} required maxLength={120} name={autoFocusName ? `intake-name-${fieldId}` : 'name'} autoComplete="off" autoCorrect="off" spellCheck={false} defaultValue={profile?.name ?? ''} /></label><label>Sex<select name="sex_category" defaultValue={profile?.sex_category ?? ''}><option value="">Not provided</option><option value="male">Male</option><option value="female">Female</option></select></label><label>Bodyweight<input name="bodyweight" type="number" min="0.001" max="1500" step="0.001" inputMode="decimal" defaultValue={profile?.bodyweight_value ?? ''} /></label><label>Bodyweight unit<select name="bodyweight_unit" defaultValue={profile?.bodyweight_unit ?? 'lb'}><option value="lb">lb</option><option value="kg">kg</option></select></label><label><span>Athlete logging unit</span><select aria-label="Athlete logging unit" aria-describedby={`logging-unit-${fieldId}`} name="preferred_weight_unit" defaultValue={profile?.preferred_weight_unit ?? 'lb'}><option value="lb">lb</option><option value="kg">kg</option></select><small id={`logging-unit-${fieldId}`}>Default unit for recording lifted weights.</small></label><fieldset className="athlete-tested-maxes"><legend>Current tested 1RMs</legend><input type="hidden" name="tested_1rm_unit" value={profile?.tested_1rm_unit ?? 'lb'} />{(['squat', 'bench', 'deadlift'] as const).map(lift => <TestedMaxEntry key={lift} lift={lift} original={profile?.[`tested_1rm_${lift}`] ?? null} canonicalUnit={profile?.tested_1rm_unit ?? 'lb'} />)}<small className="athlete-profile-wide">Saved and synced in {profile?.tested_1rm_unit ?? 'lb'}. Each lift’s unit changes its display; edited values convert to this shared unit when saved (up to 3 decimals).</small><small className="athlete-profile-wide">Max entry is optional. These tested 1RMs sync with the athlete profile and require coach approval for programming. Percentage loads prefer a training max, then an approved tested 1RM; estimated 1RMs are never used. Unresolved percentages can be saved in templates and drafts, but cannot be published.</small></fieldset></div>
}
export type AthleteProfileTab = 'overview' | 'metrics' | 'report' | 'maxes' | 'tracking'
type InlineTab = 'maxes' | 'tracking' | 'body'
const lifts = ['squat', 'bench', 'deadlift'] as const
type Lift = (typeof lifts)[number]

type ProfileApi = Pick<ConnectedCoachApiV3, 'getAthleteProfileV1' | 'saveAthleteProfileV1'> & Partial<
  Pick<PercentageProgrammingApi, 'getProgrammingMaxesV1' | 'saveProgrammingMaxV1' | 'dismissProgrammingMaxCandidateV1'
    | 'getAthleteTrackingV1' | 'setCoachTrackingV1' | 'setGymCompetitionExerciseV1'
    | 'getCoachAthleteMetricsV1' | 'getCoachTrainingReportV1' | 'completeCoachAssignmentCycleV1'>
  & Pick<ConnectedCoachApiV4, 'getCoachNavigationAssignmentsV4'>
  & Pick<BacklogRevisionApi, 'getCoachMaxReportInboxV1' | 'reviewCoachMaxReportV1'>
>

type ProfileProps = {
  api: ProfileApi
  gymId: string
  athleteId: string
  canEditPresets?: boolean
  initialReportId?: string
  onReportReviewed?(): void
  onClose(): void
  onSaved(): void | Promise<void>
  onCycleClosed?(): void | Promise<void>
}

type DialogProps = ProfileProps & { athleteName: string; initialTab?: AthleteProfileTab }
type Assignments = Awaited<ReturnType<ConnectedCoachApiV4['getCoachNavigationAssignmentsV4']>>

export function AthleteProfileDialog({ athleteName, initialTab = 'overview', ...props }: DialogProps) {
  return <AthleteProfile {...props} initialTab={initialTab} athleteName={athleteName} />
}

export function AthleteProfilePanel(props: ProfileProps) {
  return <AthleteProfile {...props} initialTab="maxes" inline />
}

function ReadError({ error, retry }: { error: string; retry(): void }) {
  return <div role="alert" className="ap-error">
    <p>{error}</p>
    <button type="button" className="button outline" onClick={retry}>Retry</button>
  </div>
}

function MaxRecords({ records, liftName }: { records: ProgrammingMaxRecordV1[]; liftName(id: string): string }) {
  return <ul className="athlete-max-list">{records.map(record => <li key={record.id}>
    <strong>{liftName(record.exercise_id)}</strong>
    <span>{record.max_type === 'training_max' ? 'Training max' : 'Tested 1RM'} · {record.value} {record.unit}</span>
    <time dateTime={record.effective_from}>Since {shortDate(record.effective_from)}</time>
  </li>)}</ul>
}

function MetricsSummary({ metrics }: { metrics: CoachAthleteMetricsV1 }) {
  if (!metrics.recent_sessions.length) return <p>No logged workouts yet.</p>
  const completed = metrics.recent_sessions.filter(session => session.state === 'completed')
  const sets = metrics.recent_sessions.flatMap(session => session.exercises.flatMap(exercise => exercise.sets))
    .filter(set => set.completed)
  const rpes = sets.flatMap(set => set.rpe === null ? [] : [set.rpe])
  const volume = sets.reduce((sum, set) => set.weight === null || !set.unit || set.reps === null
    ? sum : sum + convertProfileWeight(set.weight, set.unit, 'lb') * set.reps, 0)
  return <>
    <p>Last {metrics.recent_sessions.length} logged {metrics.recent_sessions.length === 1 ? 'session' : 'sessions'}</p>
    <dl className="ap-facts" aria-label="Recent training metrics">
      <div><dt>Sessions completed</dt><dd>{completed.length}</dd></div>
      <div><dt>Logged sets</dt><dd>{sets.length}</dd></div>
      <div><dt>Average RPE</dt><dd>{rpes.length ? (rpes.reduce((sum, rpe) => sum + rpe, 0) / rpes.length).toFixed(1) : '—'}</dd></div>
      <div><dt>Total volume</dt><dd>{Math.round(volume).toLocaleString()} lb</dd></div>
    </dl>
    {metrics.tracked_lifts.some(lift => lift.top_weight !== null) && <details className="ap-disclosure">
      <summary>Top logged weights</summary>
      <ul className="athlete-max-list">{metrics.tracked_lifts.filter(lift => lift.top_weight !== null).map(lift =>
        <li key={lift.exercise_id}><strong>{lift.name}</strong><span>{lift.top_weight} {lift.top_unit}</span></li>)}</ul>
    </details>}
  </>
}

function AthleteProfile({
  api, gymId, athleteId, athleteName, canEditPresets = false, initialTab, initialReportId,
  onReportReviewed, onClose, onSaved, onCycleClosed, inline = false,
}: ProfileProps & { initialTab: AthleteProfileTab; athleteName?: string; inline?: boolean }) {
  const [tab, setTab] = useState<AthleteProfileTab | InlineTab>(initialTab)
  const [loadBodyHistory, setLoadBodyHistory] = useState(!inline)
  const [profile, setProfile] = useState<AthleteProfileV1 | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileRetry, setProfileRetry] = useState(0)
  const [maxes, setMaxes] = useState<ProgrammingMaxesV1 | null>(null)
  const [tracking, setTracking] = useState<AthleteTrackingV1 | null>(null)
  const [maxesError, setMaxesError] = useState<string | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [maxDate, setMaxDate] = useState(() => localToday())
  const [maxValue, setMaxValue] = useState('')
  const [maxExercise, setMaxExercise] = useState('')
  const [maxType, setMaxType] = useState<'tested_1rm' | 'training_max'>('training_max')
  const [profileLift, setProfileLift] = useState<Lift>('squat')
  const [pendingReportCount, setPendingReportCount] = useState<number | null>(null)
  const [trackExercise, setTrackExercise] = useState('')
  const [presetDraft, setPresetDraft] = useState({ squat: '', bench: '', deadlift: '' })
  const [metrics, setMetrics] = useState<CoachAthleteMetricsV1 | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [metricsRetry, setMetricsRetry] = useState(0)
  const [assignments, setAssignments] = useState<Assignments | null>(null)
  const [assignmentsBusy, setAssignmentsBusy] = useState(false)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [assignmentRetry, setAssignmentRetry] = useState(0)
  const [reportAssignment, setReportAssignment] = useState('')
  const [report, setReport] = useState<TrainingReportV1 | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportRetry, setReportRetry] = useState(0)
  const [cycleClosing, setCycleClosing] = useState(false)
  const [cycleError, setCycleError] = useState<string | null>(null)
  const [setMaxOpen, setSetMaxOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const panelId = useId()
  const scope = { target_gym: gymId, target_athlete: athleteId }
  const hasInbox = Boolean(api.getCoachMaxReportInboxV1)
  const pendingCandidates = maxes?.candidates.filter(candidate => candidate.state === 'pending') ?? []
  // The unified inbox includes workout singles. On older API versions the
  // same reviews are exposed directly as programming max candidates.
  const count = hasInbox ? pendingReportCount : pendingCandidates.length

  useEffect(() => { if (inline) heading.current?.focus() }, [inline])
  useEffect(() => {
    let active = true
    setError(null)
    void api.getAthleteProfileV1({ target_gym: gymId, target_athlete: athleteId }).then(value => {
      if (active) setProfile(value)
    }).catch(cause => { if (active) setError(errorText(cause)) })
    return () => { active = false }
  }, [api, gymId, athleteId, profileRetry])

  const reloadMaxes = async () => {
    if (!api.getProgrammingMaxesV1) return
    setMaxesError(null)
    try { setMaxes(await api.getProgrammingMaxesV1(scope)) }
    catch (cause) { setMaxesError(errorText(cause)) }
  }

  const reloadTracking = async () => {
    if (!api.getAthleteTrackingV1) return
    setTrackingError(null)
    try {
      const value = await api.getAthleteTrackingV1(scope)
      setTracking(value)
      setPresetDraft({
        squat: value.system_required.find(item => item.lift === 'squat')?.exercise_id ?? '',
        bench: value.system_required.find(item => item.lift === 'bench')?.exercise_id ?? '',
        deadlift: value.system_required.find(item => item.lift === 'deadlift')?.exercise_id ?? '',
      })
    } catch (cause) { setTrackingError(errorText(cause)) }
  }

  useEffect(() => { void reloadMaxes(); void reloadTracking() }, [api, gymId, athleteId])
  useEffect(() => {
    if (!api.getCoachAthleteMetricsV1 || !loadBodyHistory) return
    let active = true
    setMetricsError(null)
    void api.getCoachAthleteMetricsV1({ target_gym: gymId, target_athlete: athleteId }).then(value => {
      if (active) setMetrics(value)
    }).catch(cause => { if (active) setMetricsError(errorText(cause)) })
    return () => { active = false }
  }, [api, gymId, athleteId, metricsRetry, loadBodyHistory])
  useEffect(() => {
    if (!api.getCoachNavigationAssignmentsV4 || !loadBodyHistory) return
    let active = true
    setAssignmentError(null)
    void api.getCoachNavigationAssignmentsV4({ gym: gymId, athlete: athleteId, cursor: null, page_size: 50, expected_read_token: null }).then(value => {
      if (!active) return
      setAssignments(value)
      setReportAssignment(previous => value.items.some(item => item.assignment_id === previous && item.assignment_status === 'completed')
        ? previous : value.items.find(item => item.assignment_status === 'completed')?.assignment_id ?? '')
    }).catch(cause => { if (active) setAssignmentError(errorText(cause)) })
    return () => { active = false }
  }, [api, gymId, athleteId, assignmentRetry, loadBodyHistory])
  useEffect(() => {
    if (!api.getCoachTrainingReportV1 || !reportAssignment) { setReport(null); return }
    if (!loadBodyHistory) return
    let active = true
    setReport(null)
    setReportError(null)
    void api.getCoachTrainingReportV1({ target_gym: gymId, target_athlete: athleteId, assignment_id: reportAssignment }).then(value => {
      if (active) setReport(value)
    }).catch(cause => { if (active) setReportError(errorText(cause)) })
    return () => { active = false }
  }, [api, gymId, athleteId, reportAssignment, reportRetry, loadBodyHistory])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile || busy) return
    setBusy(true)
    setError(null)
    try {
      const saved = await api.saveAthleteProfileV1({
        ...scope, request_id: crypto.randomUUID(), expected_version: profile.profile_version,
        profile: profileFromForm(new FormData(event.currentTarget)),
      })
      if (inline) {
        setProfile(saved)
        setEditingProfile(false)
        await reloadMaxes()
        onReportReviewed?.()
      }
      await onSaved()
    } catch (cause) {
      if (cause instanceof CoachApiError && cause.code === 'serialization_retry') {
        try {
          setProfile(await api.getAthleteProfileV1(scope))
          setError('This profile changed on another device. The latest values are shown; review and save again.')
        } catch (reloadCause) { setError(errorText(reloadCause)) }
      } else setError(errorText(cause))
    } finally { setBusy(false) }
  }

  const saveMax = async (exerciseId: string, value: number, unit: WeightUnit, source: 'coach_entry' | 'profile_approval' | 'workout_approval', candidateId: string | null = null) => {
    if (!api.saveProgrammingMaxV1 || busy || !maxDate) return
    setBusy(true)
    setMaxesError(null)
    try {
      await api.saveProgrammingMaxV1({
        ...scope, request_id: crypto.randomUUID(), exercise_id: exerciseId,
        max_type: source === 'coach_entry' ? maxType : 'tested_1rm',
        value, unit, effective_from: maxDate, source, candidate_id: candidateId,
        expected_profile_version: source === 'profile_approval' ? maxes?.profile.profile_version ?? null
          : source === 'workout_approval' ? maxes?.candidates.find(candidate => candidate.id === candidateId)?.profile_version ?? null : null,
      })
      await reloadMaxes()
      setMaxValue('')
      setSetMaxOpen(false)
      if (inline) await onSaved()
    } catch (cause) { setMaxesError(errorText(cause)) }
    finally { setBusy(false) }
  }

  const dismissCandidate = async (candidateId: string) => {
    if (!api.dismissProgrammingMaxCandidateV1 || busy) return
    setBusy(true)
    setMaxesError(null)
    try {
      await api.dismissProgrammingMaxCandidateV1({ ...scope, candidate_id: candidateId })
      await reloadMaxes()
      if (inline) await onSaved()
    } catch (cause) { setMaxesError(errorText(cause)) }
    finally { setBusy(false) }
  }

  const setRequired = async (exerciseId: string, required: boolean) => {
    if (!api.setCoachTrackingV1 || !tracking || busy) return
    setBusy(true)
    setTrackingError(null)
    try {
      await api.setCoachTrackingV1({
        ...scope, request_id: crypto.randomUUID(), exercise_id: exerciseId,
        required, expected_version: tracking.tracking_version,
      })
      await reloadTracking()
      if (inline) await onSaved()
    } catch (cause) { setTrackingError(errorText(cause)) }
    finally { setBusy(false) }
  }

  const savePreset = async (lift: Lift) => {
    if (!canEditPresets || !api.setGymCompetitionExerciseV1 || !presetDraft[lift] || busy) return
    setBusy(true)
    setTrackingError(null)
    try {
      await api.setGymCompetitionExerciseV1({ target_gym: gymId, target_lift: lift, target_exercise: presetDraft[lift] })
      await reloadTracking()
      await reloadMaxes()
      if (inline) await onSaved()
    } catch (cause) { setTrackingError(errorText(cause)) }
    finally { setBusy(false) }
  }

  const loadMoreAssignments = async () => {
    if (!api.getCoachNavigationAssignmentsV4 || !assignments?.next_cursor || assignmentsBusy) return
    setAssignmentError(null)
    setAssignmentsBusy(true)
    try {
      const next = await api.getCoachNavigationAssignmentsV4({
        gym: gymId, athlete: athleteId, cursor: assignments.next_cursor,
        page_size: 50, expected_read_token: assignments.navigation_read_token,
      })
      setAssignments(current => current ? {
        ...next, items: [...current.items, ...next.items.filter(item => !current.items.some(previous => previous.assignment_id === item.assignment_id))],
      } : next)
      if (!reportAssignment) setReportAssignment(next.items.find(item => item.assignment_status === 'completed')?.assignment_id ?? '')
    } catch (cause) { setAssignmentError(errorText(cause)) }
    finally { setAssignmentsBusy(false) }
  }

  const closeCycleFor = async (assignmentId: string) => {
    if (!api.completeCoachAssignmentCycleV1 || cycleClosing) return
    if (!window.confirm('Close this cycle and make its final training report available? Every assigned workout must be completed or skipped.')) return
    setCycleClosing(true)
    setCycleError(null)
    try {
      await api.completeCoachAssignmentCycleV1({ ...scope, assignment_id: assignmentId })
      setAssignments(current => current ? {
        ...current, items: current.items.map(item => item.assignment_id === assignmentId ? { ...item, assignment_status: 'completed' } : item),
      } : current)
      setReportAssignment(assignmentId)
      setReportRetry(value => value + 1)
      await onCycleClosed?.()
    } catch (cause) { setCycleError(errorText(cause)) }
    finally { setCycleClosing(false) }
  }

  const liftName = (exerciseId: string) => maxes?.basis_options.find(option => option.exercise_id === exerciseId)?.name
    ?? tracking?.effective.find(item => item.exercise_id === exerciseId)?.name ?? 'Exercise'
  const selectedProfilePreset = tracking?.system_required.find(item => item.lift === profileLift)
  const profileLifts = [['Squat', profile?.tested_1rm_squat], ['Bench', profile?.tested_1rm_bench], ['Deadlift', profile?.tested_1rm_deadlift]] as const
  const activeAssignment = assignments?.items.find(item => item.assignment_status === 'active')
  const exerciseOptions = maxes?.basis_options.filter(option => !option.archived_at) ?? []
  const maxUnit = profile?.preferred_weight_unit ?? 'lb'

  const profileForm = profile && <form onSubmit={submit}>
    <AthleteProfileFields key={profile.profile_version} profile={profile} />
    <div className="dialog-actions">
      <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
    </div>
  </form>
  const maxDateField = <label className="athlete-max-date">Effective date
    <input type="date" value={maxDate} onChange={event => setMaxDate(event.target.value)} />
  </label>
  const inbox = <MaxReportInbox key={`${gymId}:${athleteId}`} api={api} gym={gymId} athlete={athleteId}
    review effectiveDate={maxDate} selectedReportId={initialReportId} onPendingCount={setPendingReportCount}
    onReviewed={async () => { onReportReviewed?.(); await reloadMaxes(); if (inline) await onSaved() }} />
  const candidateReviews = !hasInbox && pendingCandidates.length > 0 && <div className="athlete-profile-subsection">
    <h4>Athlete-confirmed singles awaiting coach review</h4>
    {pendingCandidates.map(candidate => <article key={candidate.id} className="athlete-max-card">
      <strong>{liftName(candidate.exercise_id)} · {candidate.value} {candidate.unit}</strong>
      <p>Reported {new Date(candidate.created_at).toLocaleString()}{candidate.actual_rpe === null ? '' : ` · RPE ${candidate.actual_rpe}`}. Athlete confirmed this result; it has not changed the programming max.</p>
      <button type="button" className="button outline" disabled={busy || !maxDate}
        onClick={() => void saveMax(candidate.exercise_id, candidate.value, candidate.unit, 'workout_approval', candidate.id)}>Approve as tested 1RM</button>{' '}
      {api.dismissProgrammingMaxCandidateV1 && <button type="button" className="button quiet" disabled={busy}
        onClick={() => void dismissCandidate(candidate.id)}>Dismiss report</button>}
    </article>)}
  </div>
  const reportedProfileApproval = maxes && <div className="athlete-max-entry athlete-reported-entry">
    <h4>Use a reported profile 1RM</h4>
    <label className="reported-lift-field"><span>Reported lift</span>
      <select value={profileLift} onChange={event => setProfileLift(event.target.value as Lift)}>
        <option value="squat">Squat</option><option value="bench">Bench</option><option value="deadlift">Deadlift</option>
      </select>
    </label>
    <p className="athlete-reported-instruction">
      <strong>{maxes.profile[`tested_1rm_${profileLift}`] === null ? 'Not reported' : `${maxes.profile[`tested_1rm_${profileLift}`]} ${maxes.profile.tested_1rm_unit}`}</strong>
      <span>Approve reported {profileLift} 1RM for {selectedProfilePreset?.name ?? 'the configured competition lift'}. Confirm the test date above before approval.
        {pendingReportCount !== null && pendingReportCount > 0 && <> Review the pending reports above before approving a profile value.</>}
      </span>
    </p>
    <button type="button" className="button outline" disabled={busy || (hasInbox && (pendingReportCount === null || pendingReportCount > 0))
      || !selectedProfilePreset || !maxDate || maxes.profile[`tested_1rm_${profileLift}`] === null} onClick={() => {
      const value = maxes.profile[`tested_1rm_${profileLift}`]
      if (value !== null && selectedProfilePreset) void saveMax(selectedProfilePreset.exercise_id, value, maxes.profile.tested_1rm_unit, 'profile_approval')
    }}>Approve reported 1RM</button>
  </div>
  const maxForm = <form className="athlete-max-entry" onSubmit={event => {
    event.preventDefault()
    if (maxExercise && event.currentTarget.checkValidity()) void saveMax(maxExercise, Number(maxValue), maxUnit, 'coach_entry')
  }}>
    <h4>Set a coach-approved max</h4>
    <label>Exercise<select required value={maxExercise} onChange={event => setMaxExercise(event.target.value)}>
      <option value="">Choose exercise</option>
      {exerciseOptions.map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}
    </select></label>
    <label>Max type<select value={maxType} onChange={event => setMaxType(event.target.value as typeof maxType)}>
      <option value="tested_1rm">Tested 1RM</option><option value="training_max">Training max</option>
    </select></label>
    <label>Weight ({maxUnit})<input required type="number" min="0.001" max="3000" step="0.001"
      value={maxValue} onChange={event => setMaxValue(event.target.value)} /></label>
    <button type="submit" className="button primary" disabled={busy || !maxDate || (inline && !profile && !error)}>Save approved max</button>
  </form>
  const presets = tracking && <div className="athlete-profile-subsection">
    {!inline && <h4>Competition lift presets</h4>}
    <p>{inline ? 'These presets apply throughout this gym.' : 'These three presets apply throughout this gym. Competition lifts are always tracked.'}</p>
    {lifts.map(lift => {
      const current = tracking.system_required.find(item => item.lift === lift)
      return <div className="athlete-preset-row" key={lift}>
        <label>{lift[0].toUpperCase() + lift.slice(1)}
          <select value={presetDraft[lift]} disabled={!canEditPresets || !api.setGymCompetitionExerciseV1 || busy}
            onChange={event => setPresetDraft(previous => ({ ...previous, [lift]: event.target.value }))}>
            <option value="">No preset</option>
            {exerciseOptions.map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}
          </select>
        </label>
        <span>Current: {current?.name ?? 'Not configured'}</span>
        {canEditPresets && <button type="button" className="button outline"
          disabled={busy || !presetDraft[lift] || presetDraft[lift] === current?.exercise_id}
          onClick={() => void savePreset(lift)}>Save preset</button>}
      </div>
    })}
  </div>
  const trackingRead = !api.getAthleteTrackingV1 ? <p>Tracking settings are unavailable in this workspace version.</p>
    : !tracking && !trackingError ? <p role="status">Loading tracked lifts…</p> : null
  const trackingSettings = <section className="athlete-profile-section">
    {!inline && <>
      <h3>Tracked lifts</h3>
      <p>Competition lifts are always tracked. Coach-required lifts are locked in the athlete app; athletes can add other lifts themselves.</p>
    </>}
    {trackingError && <ReadError error={trackingError} retry={() => void reloadTracking()} />}
    {inline && maxesError && <ReadError error={maxesError} retry={() => void reloadMaxes()} />}
    {trackingRead}
    {tracking && <>
      {!inline && presets}
      <div className="athlete-profile-subsection">
        <h4>Competition lifts · always tracked</h4>
        {tracking.system_required.length ? <ul>{tracking.system_required.map(item =>
          <li key={item.exercise_id}>{item.name}{!inline && ' · System required'}</li>)}</ul> : <p>No competition lifts configured.</p>}
      </div>
      <div className="athlete-profile-subsection">
        <h4>Coach-required lifts</h4>
        {tracking.coach_required.length ? <ul>{tracking.coach_required.map(item => <li key={item.exercise_id}>
          {item.name}{' '}<button type="button" className="text-button" disabled={busy}
            onClick={() => void setRequired(item.exercise_id, false)}>Remove coach requirement</button>
        </li>)}</ul> : <p>No additional lifts required by the coach.</p>}
      </div>
      <div className="athlete-profile-subsection">
        <h4>Athlete-added lifts</h4>
        {tracking.athlete_added.length ? <ul>{tracking.athlete_added.map(item =>
          <li key={item.exercise_id}>{item.name}{!inline && ' · Athlete can remove'}</li>)}</ul> : <p>No athlete-added lifts.</p>}
      </div>
      <div className="athlete-track-add">
        <label>Require another lift<select value={trackExercise} onChange={event => setTrackExercise(event.target.value)}>
          <option value="">Choose exercise</option>
          {exerciseOptions.filter(option => !tracking.coach_required.some(item => item.exercise_id === option.exercise_id)
            && !tracking.system_required.some(item => item.exercise_id === option.exercise_id))
            .map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}
        </select></label>
        <button type="button" className="button primary" disabled={busy || !trackExercise} onClick={() => {
          void setRequired(trackExercise, true)
          setTrackExercise('')
        }}>Require lift</button>
      </div>
    </>}
  </section>
  const reportSummary = report?.ready ? report.summary : null
  const reportPicker = <section className="athlete-profile-section">
    <h3>Completed-cycle training report</h3>
    {!inline && <p>Final reports use all logged program work across lift families and become available only after the assigned program is complete.</p>}
    {assignmentError && <ReadError error={assignmentError} retry={() => setAssignmentRetry(value => value + 1)} />}
    {!api.getCoachTrainingReportV1 || !api.getCoachNavigationAssignmentsV4 ? <p>Training reports are unavailable in this workspace version.</p>
      : !assignments ? !assignmentError && <p role="status">Loading program history…</p> : <>
        <label className="athlete-report-picker">Completed program
          <select value={reportAssignment} onChange={event => setReportAssignment(event.target.value)}>
            <option value="">Choose a completed program</option>
            {assignments.items.filter(item => item.assignment_status === 'completed').map(item =>
              <option key={item.assignment_id} value={item.assignment_id}>{item.program_name}</option>)}
          </select>
        </label>
        {assignments.has_more && <button type="button" className="button outline" disabled={assignmentsBusy}
          onClick={() => void loadMoreAssignments()}>{assignmentsBusy ? 'Loading…' : 'Load more programs'}</button>}
        {!reportAssignment ? <p role="status">No completed program is available for a final report yet.</p>
          : reportError ? <ReadError error={reportError} retry={() => setReportRetry(value => value + 1)} />
          : !report ? <p role="status">Loading training report…</p>
          : !reportSummary ? <p role="status">This cycle is not fully complete; its final report is not ready.</p>
          : <>
            <div className="athlete-report-stats">
              <div><small>Completed sessions</small><strong>{reportSummary.completed_sessions} / {reportSummary.sessions}</strong></div>
              <div><small>Logged sets</small><strong>{reportSummary.logged_sets}</strong></div>
              <div><small>Total volume</small><strong>{Math.round(reportSummary.total_volume).toLocaleString()} {reportSummary.volume_unit}</strong></div>
              <div><small>Average RPE</small><strong>{reportSummary.average_rpe === null ? '—' : reportSummary.average_rpe.toFixed(1)}</strong></div>
            </div>
            <div className="athlete-profile-subsection">
              <h4>Top logged sets</h4>
              {reportSummary.top_sets.length ? <ul className="athlete-max-list">{reportSummary.top_sets.map((set, index) =>
                <li key={`${set.exercise_id ?? set.exercise_name}:${set.performed_at}:${index}`}>
                  <strong>{set.exercise_name}</strong><span>{set.weight} {set.unit} × {set.reps}{set.rpe === null ? '' : ` · RPE ${set.rpe}`}</span>
                  <time dateTime={set.performed_at}>{new Date(set.performed_at).toLocaleDateString()}</time>
                </li>)}</ul> : <p>No completed weighted sets in this cycle.</p>}
            </div>
          </>}
      </>}
  </section>
  const closeCycle = activeAssignment && api.completeCoachAssignmentCycleV1 && <>
    <button type="button" className="button outline" disabled={cycleClosing}
      onClick={() => void closeCycleFor(activeAssignment.assignment_id)}>{cycleClosing ? 'Closing cycle…' : 'Close finished cycle'}</button>
    {cycleError && <p role="alert">{cycleError}</p>}
  </>
  const maxRead = !api.getProgrammingMaxesV1 ? <p>Programming max management is unavailable in this workspace version.</p>
    : !maxes && !maxesError ? <p role="status">Loading programming maxes…</p> : null
  const maxError = maxesError && <ReadError error={maxesError} retry={() => void reloadMaxes()} />

  if (inline) {
    const { current, history } = splitProgrammingMaxes(maxes?.maxes ?? [])
    const tabs: [InlineTab, string][] = [['maxes', 'Maxes'], ['tracking', 'Lifts tracked'], ['body', 'Body & history']]
    return <section className="ap-panel" aria-labelledby={`${panelId}-heading`}>
      <header className="ap-heading">
        <h2 id={`${panelId}-heading`} ref={heading} tabIndex={-1}>Profile</h2>
        <button type="button" className="button outline" onClick={onClose}>← Back to overview</button>
      </header>
      <div className="ap-layout">
        <ManualTabList className="ap-nav" panelId={panelId} aria-label="Profile sections">
          {tabs.map(([key, label]) => <button key={key} type="button" role="tab"
            aria-label={key === 'maxes' ? 'Programming maxes' : undefined}
            aria-describedby={key === 'maxes' && count ? `${panelId}-max-count` : undefined}
            aria-selected={tab === key} onClick={() => {
              setTab(key)
              if (key === 'body') setLoadBodyHistory(true)
            }}>
            {label}{key === 'maxes' && Boolean(count) && <span className="ap-count">
              <span aria-hidden="true">{count}</span><span className="ap-sr" id={`${panelId}-max-count`}>{count} reports waiting</span>
            </span>}
          </button>)}
        </ManualTabList>
        <div className="ap-body" id={panelId} role="tabpanel">
          <div className="ap-stack" hidden={tab !== 'maxes'}>
            {(hasInbox || maxes) && maxDateField}
            {inbox}
            {candidateReviews}
            {maxError}
            {maxRead}
            {maxes && <section className="ap-stack">
              <header className="ap-heading">
                <h3>Coach-approved maxes</h3>
                {api.saveProgrammingMaxV1 && <button type="button" className="button outline"
                  aria-expanded={setMaxOpen} aria-controls={`${panelId}-set-max`} onClick={() => setSetMaxOpen(value => !value)}>
                  {setMaxOpen ? 'Cancel' : 'Set a max'}
                </button>}
              </header>
              {api.saveProgrammingMaxV1 && <div id={`${panelId}-set-max`} hidden={!setMaxOpen}>{maxForm}</div>}
              {current.length ? <MaxRecords records={current} liftName={liftName} /> : <p>No coach-approved maxes yet.</p>}
              {history.length > 0 && <details className="ap-disclosure">
                <summary>Approved max history</summary><MaxRecords records={history} liftName={liftName} />
              </details>}
              {!hasInbox && selectedProfilePreset && lifts.some(lift => maxes.profile[`tested_1rm_${lift}`] !== null)
                && <details className="ap-disclosure"><summary>Use a reported profile 1RM</summary>{reportedProfileApproval}</details>}
            </section>}
            {canEditPresets && api.setGymCompetitionExerciseV1 && <details className="ap-disclosure">
              <summary>Competition lift presets</summary>
              {trackingRead}
              {trackingError && <ReadError error={trackingError} retry={() => void reloadTracking()} />}
              {presets}
            </details>}
          </div>
          {tab === 'tracking' && trackingSettings}
          {tab === 'body' && <div className="ap-stack">
            <section className="ap-stack">
              <header className="ap-heading">
                <h3>Body & units</h3>
                {profile && <button type="button" className="button outline" disabled={busy}
                  aria-expanded={editingProfile} aria-controls={`${panelId}-body-form`}
                  onClick={() => setEditingProfile(value => !value)}>{editingProfile ? 'Cancel' : 'Edit profile'}</button>}
              </header>
              {profile ? <>
                {!editingProfile && <dl className="ap-facts">
                  <div><dt>Sex</dt><dd>{profile.sex_category === 'male' ? 'Male' : profile.sex_category === 'female' ? 'Female' : 'Not provided'}</dd></div>
                  <div><dt>Bodyweight</dt><dd>{profile.bodyweight_value === null ? 'Not provided' : `${profile.bodyweight_value} ${profile.bodyweight_unit ?? ''}`}</dd></div>
                  <div><dt>Logging unit</dt><dd>{profile.preferred_weight_unit}</dd></div>
                </dl>}
                <div id={`${panelId}-body-form`} hidden={!editingProfile}>{editingProfile && profileForm}</div>
              </> : !error && <p role="status">Loading profile…</p>}
              {error && (profile ? <p role="alert" className="auth-error">{error}</p>
                : <ReadError error={error} retry={() => setProfileRetry(value => value + 1)} />)}
            </section>
            <section className="athlete-profile-section">
              <h3>Training metrics</h3>
              {!api.getCoachAthleteMetricsV1 ? <p>Training metrics unavailable.</p>
                : metricsError ? <ReadError error={metricsError} retry={() => setMetricsRetry(value => value + 1)} />
                : metrics ? <MetricsSummary metrics={metrics} /> : <p role="status">Loading athlete metrics…</p>}
            </section>
            {reportPicker}
            {closeCycle && <div className="dialog-actions">{closeCycle}</div>}
          </div>}
        </div>
      </div>
    </section>
  }

  return <ModalDialog className="modal-backdrop athlete-workspace-backdrop" labelledBy="athlete-profile-title" onEscape={onClose}>
    <div className="dialog athlete-profile-dialog athlete-workspace">
      <button className="close" aria-label="Close athlete profile" type="button" onClick={onClose}>×</button>
      <p className="eyebrow">ATHLETE WORKSPACE</p>
      <h2 id="athlete-profile-title">{athleteName}</h2>
      <ManualTabList panelId="athlete-profile-panel" className="athlete-profile-tabs" aria-label="Athlete profile sections">
        {([['overview', 'Overview'], ['metrics', 'Metrics'], ['report', 'Training report'], ['maxes', 'Programming maxes'], ['tracking', 'Tracking settings']] as const)
          .map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}
      </ManualTabList>
      <div id="athlete-profile-panel" role="tabpanel" aria-label={tab === 'maxes' ? 'Programming maxes' : tab === 'report' ? 'Training report' : tab === 'tracking' ? 'Tracking settings' : tab === 'metrics' ? 'Metrics' : 'Overview'}>
        {tab === 'overview' && <><p>Shared athlete profile. Coach and athlete edits sync; newer changes must be reviewed before saving.</p>{maxes?.candidates.some(candidate => candidate.state === 'pending') && <div className="athlete-pr-alert" role="status"><strong>{maxes.candidates.filter(candidate => candidate.state === 'pending').length} athlete-confirmed 1RM {maxes.candidates.filter(candidate => candidate.state === 'pending').length === 1 ? 'report needs' : 'reports need'} coach review</strong><p>The athlete confirmed the logged single. Programming maxes stay at their approved values until you review it.</p><button type="button" className="button outline" onClick={() => setTab('maxes')}>Review reported 1RM</button></div>}{!profile && !error ? <p role="status">Loading profile…</p> : profile ? <><div className="athlete-profile-summary">{profileLifts.map(([name, value]) => <div key={name}><small>Reported {name} 1RM</small><strong>{value === null ? 'Not reported' : `${value} ${profile.tested_1rm_unit}`}</strong></div>)}</div>{profileForm}</> : null}{error && <p role="alert" className="auth-error">{error}</p>}</>}
        {tab === 'metrics' && <section className="athlete-profile-section"><h3>Metrics</h3><p>Tracked lift trends and the 30 most recent logged sessions. Estimated 1RMs are analysis only; percentage prescriptions use coach-approved maxes.</p>{!api.getCoachAthleteMetricsV1 ? <p>Metrics are unavailable in this workspace version.</p> : metricsError ? <div role="alert"><p>{metricsError}</p><button type="button" className="button outline" onClick={() => setMetricsRetry(value => value + 1)}>Retry</button></div> : !metrics ? <p role="status">Loading athlete metrics…</p> : <><div className="athlete-metric-grid">{metrics.tracked_lifts.length === 0 ? <p>No tracked lifts have logged sets yet.</p> : metrics.tracked_lifts.map(lift => <article key={lift.exercise_id}><small>{lift.name}</small><strong>{lift.estimated_1rm === null ? '—' : `${Math.round(lift.estimated_1rm)} ${lift.estimated_1rm_unit ?? ''}`}</strong><span>Estimated 1RM</span><p>Top logged weight: {lift.top_weight === null ? 'Not logged' : `${lift.top_weight} ${lift.top_unit ?? ''}`}</p>{lift.latest_at && <time dateTime={lift.latest_at}>Last logged {new Date(lift.latest_at).toLocaleDateString()}</time>}</article>)}</div><div className="athlete-profile-subsection"><h4>Logged workouts and exercises</h4>{metrics.recent_sessions.length === 0 ? <p>No logged workouts yet.</p> : <ul className="athlete-session-list">{metrics.recent_sessions.map(session => <li key={session.workout_session_id}><details><summary>{session.completed_at ? new Date(session.completed_at).toLocaleDateString() : 'Date unavailable'} · {session.state} · {session.exercises.length} exercises</summary>{session.exercises.length === 0 ? <p>No exercise sets logged.</p> : session.exercises.map(exercise => <div key={`${session.workout_session_id}:${exercise.exercise_id ?? exercise.name}`} className="athlete-session-exercise"><strong>{exercise.name}</strong><ul>{exercise.sets.map(set => <li key={set.set_log_id}>{set.completed ? 'Completed' : 'Not completed'} · {set.reps ?? '—'} reps · {set.weight === null ? 'No weight' : `${set.weight} ${set.unit ?? ''}`}{set.rpe === null ? '' : ` · RPE ${set.rpe}`}</li>)}</ul></div>)}</details></li>)}</ul>}</div></>}</section>}
        {tab === 'report' && reportPicker}
        {tab === 'maxes' && <section className="athlete-profile-section">
          <h3>Programming maxes</h3>
          <p>Max entry is optional. Percentage prescriptions automatically use a training max first, then an approved tested 1RM. Reported 1RMs and workout singles require coach review; estimated 1RMs are never used. You can save unresolved templates and drafts; publishing requires an approved max.</p>
          {maxError}
          {maxRead}
          {maxes && <>
            {maxDateField}
            {inbox}
            {candidateReviews}
            <div className="athlete-profile-subsection">
              <h4>Approved max history</h4>
              {maxes.maxes.length ? <MaxRecords records={maxes.maxes} liftName={liftName} /> : <p>No coach-approved maxes yet.</p>}
            </div>
            {reportedProfileApproval}
            {maxForm}
          </>}
        </section>}
        {tab === 'tracking' && trackingSettings}
      </div>
      <div className="dialog-actions">
        {tab === 'report' && closeCycle}
        <button type="button" className="button quiet" onClick={onClose}>Close</button>
      </div>
    </div>
  </ModalDialog>
}
