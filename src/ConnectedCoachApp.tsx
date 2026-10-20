import { ManualTabList } from './ManualTabList'
import { WorkoutRecoveryPrincipalContext, WorkoutRecoveryEpochContext } from './lib/workout-recovery-context'
import type { WorkoutRecoveryController } from './lib/workout-recovery'
import { athleteSetupMessage } from './lib/athlete-setup-message'
import { CoachClientRemoval } from './CoachClientRemoval'
import { PersonalTrackingInbox } from './PersonalTrackingInbox'
import type { October18CoachApi, CoachDashboardRosterPageV4, CoachDashboardRosterItemV4, CoachTemplateReadinessV1, PreviewBuilderWeekCopyV3Input, PreviewBuilderWeekCopyV3Result } from './lib/coach-api'
import { WorkspaceSettings } from './WorkspaceSettings'
import type { OwnerOnboardingApi } from './lib/coach-api'
import { MaxReportInbox } from './MaxReportInbox'
import { ProgramPublicationDetails, ProgramPublicationSummary, useProgramPublicationMetadata } from './ProgramPublicationDetails'
import type { BacklogRevisionApi } from './lib/coach-api'
import type { CoachOverviewApi } from './lib/coach-api'
import { ClientOverview } from './ClientOverview'
import ApprovedWorkoutEditor from './ApprovedWorkoutEditor'
import './approved-workspace.css'
import { convertProfileWeight, testedMaxForSubmission, ProfileMaxValidationError, type WeightUnit } from './lib/profile-max-entry'
import { supersetIssue, supersetIssueMessage } from './lib/superset'
import { Fragment, useId, useEffect, useLayoutEffect, useContext, useCallback, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { programSlots, slotStatus, weekdayNames, weekDateRange } from './lib/calendar'
import type { AthleteProfileInputV1, AthleteProfileV1, AthleteTrackingV1, CoachAthleteMetricsV1, TrainingReportV1, ProgrammingMaxesV1, PercentageProgrammingApi, ExerciseOptionV1, ProgramPercentPreviewV1, TemplatePercentPreviewV1, CoachWorkoutActivityDetailV1, CoachActivityPlannedSetV1, CoachAssignmentDayV6, RichPercentBasisOption, RichProgramDay, RichTemplateDay, RichProgramDaySave, RichTemplateDaySave, RichProgramGroup, RichTemplateGroup, RichProgramExercise, RichTemplateExercise, RichProgramSet, RichTemplateSet } from './lib/coach-api'
import { CoachApiError, type ApplyBuilderCopyV1Result, type ApplyBuilderCopyV2Result, type ApplyBuilderProgressionV1Result, type ApplyBuilderProgressionV2Input, type ApplyWorkoutTemplateV1Input, type ApplyWorkoutTemplateV4Input, type ConnectedCoachApiV3 as ConnectedCoachApi, type ConnectedCoachApiV4, type CoachAssignmentDayV4, type CoachAssignmentDayV5, type CoachAssignmentDetailV4, type CoachAssignmentDetailV5, type CoachAssignmentWeekSummaryV4, type CoachAssignmentWeekSummaryV5, type CoachBuilderOperationResult, type CoachDashboardAssignmentItemV2, type CoachDashboardAssignmentsPageV1, type CoachDashboardAssignmentsPageV2, type CoachDashboardRosterPageV1, type CoachDashboardRosterPageV2, type CoachNavigationAssignmentsCursor, type CoachNavigationAssignmentsReadToken, type CoachNavigationGymsCursor, type CoachNavigationGymsReadToken, type CoachNavigationRosterCursor, type CoachNavigationRosterReadToken, type CoachReadinessIssueV1, type CoachRepsV3, type CopyDestination, type Phase55AssignmentLifecycleApi, type Phase55DashboardReadsApi, type Phase55WorkoutTemplateLibraryApi, type Phase5CorrectionApi, type Phase6ProgramArchiveApi, type Phase9ActivityApi, type CoachRecentActivityPageV1, type PreviewBuilderCopyV1Input, type PreviewBuilderCopyV1Result, type PreviewBuilderCopyV2Input, type PreviewBuilderCopyV2Result, type PreviewBuilderProgressionV1Input, type PreviewBuilderProgressionV1Result, type PreviewBuilderProgressionV2Input, type PreviewBuilderProgressionV2Result, type ProgressionScope, type ProgressionTransform, type ProgressionV2AfterValue, type ProgressionV2Override, type ProgressionV2Rule, type ProgressionV2Scope, type ProgressionValue, type SetCoachProgramReadinessV1Result, type CoachProgramDayV3, type CoachProgramDayV5, type CoachSetGroupV3, type CoachSetGroupV5, type CoachWorkspaceV3 as CoachWorkspace, type SaveCoachProgramDayV2, type SaveCoachProgramDayV3, type SaveCoachIndividualSet, type SaveCoachIndividualSetV3, type SaveCoachProgramDayV2Result } from './lib/coach-api'
import { phase55CapabilityMode } from './lib/config'
import { ProgramTemplateWorkspace } from './ProgramTemplateWorkspace'
import type { Phase9ProgramTemplateApi } from './lib/coach-api'
import { ThemeToggle } from './App'
import type { Theme } from './lib/theme'
import QRCode from 'qrcode'
import { PwaPairingApiError, type AthleteConnectionStatus, type PwaPairingCoachApi } from './lib/pwa-pairing-api'
import { buildProgramExportSheets, downloadProgramXlsx, type ExportDay } from './lib/program-xlsx'
import './rich-day-compact.css'

type Props = { api: ConnectedCoachApi & Partial<ConnectedCoachApiV4> & Partial<Phase5CorrectionApi> & Partial<Phase55DashboardReadsApi> & Partial<Phase55AssignmentLifecycleApi> & Partial<Phase55WorkoutTemplateLibraryApi> & Partial<Phase6ProgramArchiveApi> & Partial<Phase9ActivityApi> & Partial<Phase9ProgramTemplateApi> & Partial<PwaPairingCoachApi> & Partial<OwnerOnboardingApi> & Partial<October18CoachApi>; coachDisplayName?: string; onCoachNameSaved?(value: string): void; onSignOut(): void; theme?: Theme; onToggleTheme?: () => void; enablePhase5Corrections?: boolean; enablePhase55DashboardReads?: boolean; enablePhase55AssignmentLifecycle?: boolean; enablePhase55TemplateLibrary?: boolean; enablePhase6ProgramArchive?: boolean; enablePwaPairing?: boolean }
const errorText = (error: unknown) => error instanceof ProfileMaxValidationError ? error.message : error instanceof CoachApiError ? `${error.code === 'request_rejected' ? 'The coach request could not be processed. Check the form and try again.' : error.message}${error.requestId ? ` (Support reference: ${error.requestId.slice(0, 8)})` : ''}` : 'The workspace could not be loaded. Check your connection and try again.'
const createErrorText = (error: unknown) => error instanceof CoachApiError ? error.message : 'The program could not be created. Check your connection and try again.'
const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
const initials = (name: string) => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
const trapDialogTab = (event: ReactKeyboardEvent<HTMLDivElement>) => { if (event.key !== 'Tab') return; const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')); if (!items.length) return; const index = items.indexOf(document.activeElement as HTMLElement); if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus() } else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0].focus() } }

const humanLabels = {
  programLifecycle: { draft: 'Draft', active: 'Active', archived: 'Archived' },
  assignmentStatus: { active: 'Assigned', paused: 'Paused', completed: 'Completed', revoked: 'Access removed' },
  delivery: { draft: 'Draft', awaiting_device: 'Awaiting athlete device', preparing: 'Preparing delivery', awaiting_download: 'Awaiting download', partially_downloaded: 'Partially downloaded', downloaded: 'Downloaded' },
  dayStatus: { unscheduled: 'Rest day', authored_empty: 'Needs programming', workout: 'Workout', rest: 'Rest day', locked: 'Locked' },
  readinessIssue: { empty_unmarked_day: 'Empty day needs a workout or rest', rest_day_has_content: 'Rest day cannot include workout content', day_label_missing: 'Day needs a name', exercise_without_prescription: 'Exercise needs a prescription', percent_load_unresolved: 'Percentage load needs a resolved max', superset_too_small: 'Superset needs at least 2 unique exercises', superset_duplicate_exercise: 'Superset contains a duplicate exercise' },
  legacyCopyBlock: { source_too_large: 'Day is too large to copy' },
} as const

const humanLabel = <T extends Record<string, string>>(labels: T, value: string | null | undefined) => value && value in labels ? labels[value as keyof T] : 'Unavailable'
const programLifecycleLabel = (value: string) => humanLabel(humanLabels.programLifecycle, value)
const assignmentStatusLabel = (value: string) => humanLabel(humanLabels.assignmentStatus, value)
const deliveryLabel = (value: string) => humanLabel(humanLabels.delivery, value)
const dayStatusLabel = (value: string) => humanLabel(humanLabels.dayStatus, value)
const readinessIssueLabel = (value: string) => humanLabel(humanLabels.readinessIssue, value)
const legacyCopyBlockLabel = (value: string | null) => humanLabel(humanLabels.legacyCopyBlock, value)
const weekdayForOrdinal = (ordinal: number) => weekdayNames[ordinal - 1] ?? `Day ${ordinal}`
const isSystemWeekday = (label: string | null | undefined, ordinal: number) => label === weekdayForOrdinal(ordinal)
const workoutTitle = (label: string | null | undefined, ordinal: number) => label && !isSystemWeekday(label, ordinal) ? label : null
const validLegacyLabel = (label: string) => label === normalizePhase3Text(label) && Boolean(label) && !hasUnpairedSurrogate(label) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(label) && [...label].length <= 120
const boundedTemplateSearch = (value: string) => Array.from(value).slice(0, 80).join('')

export const canApplyTemplatePercentPreview = (preview: TemplatePercentPreviewV1 | null | undefined) => Boolean(preview && preview.rows.every(row => ['current', 'missing', 'future_only'].includes(row.status)))

function TemplatePercentReview({ preview }: { preview: TemplatePercentPreviewV1 }) {
  return <section className="template-percent-review" aria-label="Percentage load preview"><p>{preview.rows.length === 0 ? 'No percentage sets need a programming max.' : `${preview.rows.length} percentage ${preview.rows.length === 1 ? 'set' : 'sets'} reviewed for this athlete.`} {preview.ready ? 'All required maxes are available.' : `${preview.unresolved_count} ${preview.unresolved_count === 1 ? 'set needs' : 'sets need'} a coach-approved max before publishing. Unresolved loads can be applied as a draft.`}</p><ul>{preview.rows.map(row => <li key={row.set_id}><strong>{row.exercise_name} · {row.percent}% {row.max_type === 'training_max' ? 'training max' : row.max_type === 'tested_1rm' ? 'tested 1RM' : 'unmapped basis'}</strong><span>{row.status === 'current' && row.resolved_weight !== null ? `${row.resolved_weight} ${row.unit}` : `Needs review: ${row.status.replaceAll('_', ' ')}`}</span></li>)}</ul><small>Based on max records and calendar state as of {preview.cutoff_date}. Changes require a new review.</small></section>
}

type V4WeekSlot = { weekday: string; day_ordinal: number; day_identity_token: string | null; label: string | null; workout_title: string | null; planned_date: string | null; status: string; locked_any: boolean; exercise_count: number; set_row_count: number }
type AssignmentDaySummary = CoachAssignmentWeekSummaryV4['days'][number] | CoachAssignmentWeekSummaryV5['days'][number]
const isV5AssignmentDaySummary = (day: AssignmentDaySummary): day is CoachAssignmentWeekSummaryV5['days'][number] => 'system_weekday' in day && 'workout_title' in day
const projectV4WeekSlots = (week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5): V4WeekSlot[] => weekdayNames.map((weekday, index) => {
  const day = week.days.find(item => item.day_ordinal === index + 1)
  const v5 = day && isV5AssignmentDaySummary(day) ? day : null
  return { weekday: v5?.system_weekday ?? weekday, day_ordinal: index + 1, day_identity_token: day?.day_identity_token ?? null, label: day?.label ?? null, workout_title: v5?.workout_title ?? null, planned_date: day?.planned_date ?? null, status: day?.status ?? 'unscheduled', locked_any: day?.locked_any ?? false, exercise_count: day?.exercise_count ?? 0, set_row_count: day?.set_row_count ?? 0 }
})
const v4DaySlotLabel = (slot: V4WeekSlot) => {
  const title = slot.workout_title ?? workoutTitle(slot.label, slot.day_ordinal)
  return `${slot.weekday} · ${dayStatusLabel(slot.status)}${title ? ` · ${title}` : ''}${slot.locked_any ? ' (locked)' : ''}`
}

const isV4 = (api: Props['api']): api is ConnectedCoachApiV4 => [
  api.getCoachNavigationGymsV4, api.getCoachNavigationRosterV4, api.getCoachNavigationAssignmentsV4,
  api.getCoachAssignmentDetailV4, api.getCoachAssignmentDayV4, api.setCoachProgramReadinessV1,
  api.previewBuilderCopyV1, api.applyBuilderCopyV1, api.previewBuilderProgressionV1,
  api.applyBuilderProgressionV1, api.undoBuilderOperationV1, api.publishReadyProgramV1,
].every(method => typeof method === 'function')

const phase5Api = (api: Props['api'], enabled: boolean): Phase5CorrectionApi | null => enabled && [
  api.authorCalendarDayV1, api.listExerciseNameHistoryV1,
  api.recordExerciseNameHistoryV1, api.saveCoachProgramDayV2AndRecordHistory,
].every(method => typeof method === 'function') ? api as ConnectedCoachApiV4 & Phase5CorrectionApi : null
const phase54Api = (api: Props['api'], enabled: boolean): Phase5CorrectionApi | null => enabled && [
  api.getCoachAssignmentDetailV5, api.getCoachAssignmentDayV5, api.saveCoachProgramDayV3,
  api.previewBuilderCopyV2, api.applyBuilderCopyV2,
].every(method => typeof method === 'function') ? api as ConnectedCoachApiV4 & Phase5CorrectionApi : null
const progressionV2Api = (api: Phase5CorrectionApi | null): Phase5CorrectionApi | null => api && [
  api.previewBuilderProgressionV2, api.applyBuilderProgressionV2,
].every(method => typeof method === 'function') ? api : null
const phase55DashboardApi = (api: Props['api'], enabled: boolean): Phase55DashboardReadsApi | null => enabled && [api.getCoachDashboardRosterPageV1, api.getCoachDashboardAssignmentsPageV1].every(method => typeof method === 'function') ? api as Phase55DashboardReadsApi : null
const phase55AssignmentLifecycleApi = (api: Props['api'], enabled: boolean): Phase55AssignmentLifecycleApi | null => enabled && [api.createCalendarProgramV2, api.activateAndPublishCoachAssignmentV1].every(method => typeof method === 'function') ? api as Phase55AssignmentLifecycleApi : null
const phase55WorkoutTemplateApi = (api: Props['api'], enabled: boolean): Phase55WorkoutTemplateLibraryApi | null => enabled && [api.getCoachWorkoutTemplateLibraryPageV1, api.createCoachWorkoutTemplateV1, api.getCoachWorkoutTemplateDetailV1, api.getCoachWorkoutTemplateDayV1, api.saveCoachWorkoutTemplateDayV1, api.setCoachWorkoutTemplateReadinessV1, api.archiveCoachWorkoutTemplateV1, api.restoreCoachWorkoutTemplateV1, api.applyCoachWorkoutTemplateV1].every(method => typeof method === 'function') ? api as Phase55WorkoutTemplateLibraryApi : null
const phase6ProgramArchiveApi = (api: Props['api'], enabled: boolean): Phase6ProgramArchiveApi | null => enabled && [api.getCoachDashboardAssignmentsPageV2, api.archiveCoachProgramV1, api.restoreCoachProgramV1].every(method => typeof method === 'function') ? api as Phase6ProgramArchiveApi : null
const phase55AuthorityKey = (gym: string, athlete: string) => JSON.stringify([gym, athlete])

export default function ConnectedCoachApp(props: Props) {
  const dashboardApi = phase55DashboardApi(props.api, Boolean(props.enablePhase55DashboardReads))
  const lifecycleApi = phase55AssignmentLifecycleApi(props.api, Boolean(props.enablePhase55AssignmentLifecycle))
  const workoutTemplateApi = phase55WorkoutTemplateApi(props.api, Boolean(props.enablePhase55TemplateLibrary))
  const programArchiveApi = phase6ProgramArchiveApi(props.api, Boolean(props.enablePhase6ProgramArchive))
  const activityApi: Phase9ActivityApi | null = typeof props.api.getCoachRecentActivityPageV1 === 'function' ? props.api as Phase9ActivityApi : null
  const programTemplateApi: Phase9ProgramTemplateApi | null = typeof props.api.getCoachProgramTemplateLibraryV1 === 'function' ? props.api as Phase9ProgramTemplateApi : null
  const pairingApi: PwaPairingCoachApi | null = props.enablePwaPairing && typeof props.api.issueAthleteInvite === 'function' ? props.api as PwaPairingCoachApi : null
  let workspace: ReactNode
  if (!isV4(props.api)) workspace = <ConnectedCoachAppV3 {...props} />
  else {
  const mode = phase55CapabilityMode(Boolean(props.enablePhase55DashboardReads), Boolean(props.enablePhase55AssignmentLifecycle))
    if (mode === 'legacy') workspace = <ConnectedCoachAppV4 api={props.api} correctionsApi={phase5Api(props.api, Boolean(props.enablePhase5Corrections))} phase54Api={phase54Api(props.api, Boolean(props.enablePhase5Corrections))} onSignOut={props.onSignOut} />
    else if (mode === 'complete' && dashboardApi && lifecycleApi) workspace = <Phase55Dashboard coachDisplayName={props.coachDisplayName} onCoachNameSaved={props.onCoachNameSaved} api={props.api} dashboardApi={dashboardApi} lifecycleApi={lifecycleApi} workoutTemplateApi={workoutTemplateApi} programArchiveApi={programArchiveApi} activityApi={activityApi} programTemplateApi={programTemplateApi} pairingApi={pairingApi} onSignOut={props.onSignOut} correctionsApi={phase5Api(props.api, Boolean(props.enablePhase5Corrections))} phase54Api={phase54Api(props.api, Boolean(props.enablePhase5Corrections))} />
    else workspace = <Phase55CapabilityUnavailable onSignOut={props.onSignOut} />
  }
  return <>{props.theme && props.onToggleTheme && <div className="connected-theme-control"><ThemeToggle theme={props.theme} onToggle={props.onToggleTheme} /></div>}{workspace}</>
}

function Phase55CapabilityUnavailable({ onSignOut, onRetry }: { onSignOut(): void; onRetry?: () => void }) {
  return <main className="connected-app approved-home phase55-unavailable"><section className="signin-panel" role="status"><p className="eyebrow">WORKSPACE UPDATE</p><h1>Calendar update unavailable</h1><p>Your coach workspace is updating. Please retry shortly; program changes are unavailable until the calendar update is complete.</p>{onRetry && <button className="button outline" onClick={onRetry}>Retry</button>}<button className="text-button" onClick={onSignOut}>Sign out</button></section></main>
}

function Phase55Dashboard({ coachDisplayName, onCoachNameSaved, api, dashboardApi, lifecycleApi, workoutTemplateApi, programArchiveApi, activityApi, programTemplateApi, pairingApi, correctionsApi, phase54Api, onSignOut }: { coachDisplayName?: string; onCoachNameSaved?(value: string): void; api: ConnectedCoachApiV4 & Partial<PercentageProgrammingApi & CoachOverviewApi & OwnerOnboardingApi & October18CoachApi>; dashboardApi: Phase55DashboardReadsApi; lifecycleApi: Phase55AssignmentLifecycleApi; workoutTemplateApi: Phase55WorkoutTemplateLibraryApi | null; programArchiveApi: Phase6ProgramArchiveApi | null; activityApi: Phase9ActivityApi | null; programTemplateApi: Phase9ProgramTemplateApi | null; pairingApi: PwaPairingCoachApi | null; correctionsApi: Phase5CorrectionApi | null; phase54Api: Phase5CorrectionApi | null; onSignOut(): void }) {
  type RosterPage = CoachDashboardRosterPageV1 | CoachDashboardRosterPageV2 | CoachDashboardRosterPageV4
  const [rosterV4Unavailable, setRosterV4Unavailable] = useState(false)
  const [gyms, setGyms] = useState<Awaited<ReturnType<ConnectedCoachApiV4['getCoachNavigationGymsV4']>>['items']>([])
  const [gymCursor, setGymCursor] = useState<CoachNavigationGymsCursor | null>(null)
  const [gymToken, setGymToken] = useState<CoachNavigationGymsReadToken | null>(null)
  const [gymsMore, setGymsMore] = useState(false)
  const [gym, setGym] = useState<string | null>(null)
  const [needs, setNeeds] = useState<RosterPage | null>(null)
  const [current, setCurrent] = useState<RosterPage | null>(null)
  const [search, setSearch] = useState({ needs: '', current: '' })
  const [rosterFilter, setRosterFilter] = useState<'all' | 'needs_programming' | 'draft' | 'programmed'>('all')
  const [pending, setPending] = useState({ needs_programming: false, current_clients: false })
  const [plansFor, setPlansFor] = useState<string | null>(null)
  const [plans, setPlans] = useState<CoachDashboardAssignmentsPageV1 | CoachDashboardAssignmentsPageV2 | null>(null)
  const planDates = useProgramPublicationMetadata(api as Partial<BacklogRevisionApi>, gym ?? '', plansFor ?? '', [...new Set(plans?.items.map(plan => plan.program_id).filter((id): id is string => Boolean(id)) ?? [])])
  const [plansView, setPlansView] = useState<'working' | 'archived'>('working')
  const [plansExpectedCurrentAssignment, setPlansExpectedCurrentAssignment] = useState<string | null>(null)
  const [plansAthleteName, setPlansAthleteName] = useState<string | null>(null)
  const [plansRequiresCurrentAssignment, setPlansRequiresCurrentAssignment] = useState(false)
  const [plansCurrentCalendarUnavailable, setPlansCurrentCalendarUnavailable] = useState(false)
  const [creatingNextFor, setCreatingNextFor] = useState<{ gym: string; athlete: string; athleteName: string; expectedCurrentAssignment: string | null } | null>(null)
  const [plansMutation, setPlansMutation] = useState<'create' | 'archive' | 'restore' | null>(null)
  const [archiveUnavailable, setArchiveUnavailable] = useState(false)
  const [archiveDialog, setArchiveDialog] = useState<{ action: 'archive' | 'restore'; plan: CoachDashboardAssignmentItemV2 } | null>(null)
  const [opening, setOpening] = useState<{ gym: string; assignment: string; athlete: string; athleteName: string; expectedCurrentAssignment: string | null } | null>(null)
  const [emptyFor, setEmptyFor] = useState<{ gym: string; athlete: string; athleteName: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false)
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false)
  const [templateWorkspaceDirty, setTemplateWorkspaceDirty] = useState(false)
  const [libraryKind, setLibraryKind] = useState<'program' | 'workout'>('program')
  const [applyProgramTemplate, setApplyProgramTemplate] = useState<{ templateId: string; builderVersion: number; name: string; athlete: string; programName: string; startOn: string; requestId: string } | null>(null)
  const [applyProgramTemplateBusy, setApplyProgramTemplateBusy] = useState(false)
  const [applyProgramTemplateError, setApplyProgramTemplateError] = useState<string | null>(null)
  const [applyProgramTemplatePreview, setApplyProgramTemplatePreview] = useState<TemplatePercentPreviewV1 | null>(null)
  const [templateUnavailable, setTemplateUnavailable] = useState(false)
  const [pairingFor, setPairingFor] = useState<{ athleteId: string; athleteName: string } | null>(null)
  const workspaceNavigation = useRef<((action: () => void) => void) | null>(null)
  const overviewDirty = useRef(false)
  const [workspaceSearch,setWorkspaceSearch] = useState('')
  const [overviewFor,setOverviewFor]=useState<CoachDashboardRosterPageV1['items'][number]|null>(null)
  const [overviewActivity,setOverviewActivity]=useState<string|null>(null)
  const [reportRevision, setReportRevision] = useState(0)
  const [profileFor, setProfileFor] = useState<{ athleteId: string; athleteName: string; initialTab?: AthleteProfileTab; reportId?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [removal, setRemoval] = useState<{ client: { athlete: string; name: string } | null } | null>(null)
  const [addingAthlete, setAddingAthlete] = useState(false)
  const [athleteMutation, setAthleteMutation] = useState<'add' | null>(null)
  const [retryGeneration, setRetryGeneration] = useState(0)
  const gymGeneration = useRef(0)
  const groupGeneration = useRef({ needs_programming: 0, current_clients: 0 })
  const groupQuery = useRef<{ needs_programming: string | null; current_clients: string | null }>({ needs_programming: null, current_clients: null })
  const groupTimers = useRef<{ needs_programming: number | null; current_clients: number | null }>({ needs_programming: null, current_clients: null })
  const plansGeneration = useRef(0)
  const promotedCurrentAuthority = useRef(new Map<string, string>())
  const activeWorkoutTemplateApi = templateUnavailable ? null : workoutTemplateApi
  const activeProgramArchiveApi = archiveUnavailable ? null : programArchiveApi
  const nextMonday = () => { const date = new Date(); date.setDate(date.getDate() + (8 - date.getDay()) % 7); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
  const unsupported = (cause: unknown) => cause instanceof CoachApiError && cause.code === 'request_rejected' && cause.status === 404
  const dashboardChanged = (cause: unknown) => cause instanceof CoachApiError && cause.code === 'dashboard_read_changed'
  const normalizedSearch = (value: string) => value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US') || null
  const setGroupPage = (group_kind: 'needs_programming' | 'current_clients', page: RosterPage | null) => { if (group_kind === 'needs_programming') setNeeds(page); else setCurrent(page) }
  const loadGroup = async (group_kind: 'needs_programming' | 'current_clients', query: string | null, more = false, prior: RosterPage | null = null, restart = true) => {
    if (!gym) return
    const generation = ++groupGeneration.current[group_kind]
    const requestGym = gym
    const requestQuery = query
    if (groupQuery.current[group_kind] !== requestQuery) return
    const usablePrior = more && prior?.dashboard_read_token.search_text === requestQuery ? prior : null
    if (more && !usablePrior) return
    setPending(current => ({ ...current, [group_kind]: true }))
    try {
      const phase7Prior = usablePrior?.contract_version === 2 ? usablePrior : null
      const oct18Prior = usablePrior?.contract_version === 4 ? usablePrior : null
      const phase55Prior = usablePrior?.contract_version === 1 ? usablePrior : null
      const legacyRead = async () => dashboardApi.getCoachDashboardRosterPageV2
        ? await dashboardApi.getCoachDashboardRosterPageV2({ gym: requestGym, group_kind, search_text: requestQuery, cursor: phase7Prior?.next_cursor ?? null, page_size: 20, expected_read_token: phase7Prior?.next_read_token ?? null })
        : await dashboardApi.getCoachDashboardRosterPageV1({ gym: requestGym, group_kind, search_text: requestQuery, cursor: phase55Prior?.next_cursor ?? null, page_size: 20, expected_read_token: phase55Prior?.next_read_token ?? null })
      let page: RosterPage
      if (api.getCoachDashboardRosterPageV4 && !rosterV4Unavailable) {
        try { page = await api.getCoachDashboardRosterPageV4({ gym: requestGym, group_kind, search_text: requestQuery, cursor: oct18Prior?.next_cursor ?? null, page_size: 20, expected_read_token: oct18Prior?.next_read_token ?? null }) }
        catch (cause) { if (!unsupported(cause)) throw cause; setRosterV4Unavailable(true); if (more && oct18Prior) { setGroupPage(group_kind, null); void loadGroup(group_kind, requestQuery, false); return }; page = await legacyRead() }
      } else page = await legacyRead()
      if (generation !== groupGeneration.current[group_kind] || gym !== requestGym || groupQuery.current[group_kind] !== requestQuery) return
      for (const item of page.items) {
        const key = phase55AuthorityKey(requestGym, item.athlete_id)
        const promoted = promotedCurrentAuthority.current.get(key)
        if (promoted && item.current_assignment_id === promoted) promotedCurrentAuthority.current.delete(key)
      }
      const merged = usablePrior && usablePrior.contract_version === page.contract_version ? { ...page, items: [...usablePrior.items, ...page.items] } as RosterPage : page
      setGroupPage(group_kind, merged)
    } catch (cause) {
      if (generation !== groupGeneration.current[group_kind]) return
      if (unsupported(cause)) setCapabilityUnavailable(true)
      else if (dashboardChanged(cause) && restart) { setGroupPage(group_kind, null); void loadGroup(group_kind, requestQuery, false, null, false) }
      else setError(errorText(cause))
    } finally { if (generation === groupGeneration.current[group_kind]) setPending(current => ({ ...current, [group_kind]: false })) }
  }
  const scheduleGroup = (group_kind: 'needs_programming' | 'current_clients', value: string) => {
    const query = normalizedSearch(value); groupQuery.current[group_kind] = query; groupGeneration.current[group_kind] += 1
    if (groupTimers.current[group_kind] !== null) window.clearTimeout(groupTimers.current[group_kind]!)
    setGroupPage(group_kind, null); setPending(current => ({ ...current, [group_kind]: true }))
    groupTimers.current[group_kind] = window.setTimeout(() => { groupTimers.current[group_kind] = null; void loadGroup(group_kind, query) }, 250)
  }
  const loadGyms = async (more = false, preserveGym: string | null = null) => {
    const generation = more ? gymGeneration.current : ++gymGeneration.current; const expected = more ? gymToken : null
    try {
      const page = await api.getCoachNavigationGymsV4({ cursor: more ? gymCursor : null, page_size: 20, expected_read_token: expected })
      if (generation !== gymGeneration.current) return
      if (expected && tokenKey(page.navigation_read_token) !== tokenKey(expected)) { setGyms([]); setGymCursor(null); setGymToken(null); setGymsMore(false); void loadGyms(false); return }
      setGyms(current => more ? [...current.filter(item => !page.items.some(next => next.gym_id === item.gym_id)), ...page.items] : [...page.items, ...current.filter(item => item.gym_id === preserveGym && !page.items.some(next => next.gym_id === item.gym_id))])
      setGymCursor(page.next_cursor); setGymToken(page.navigation_read_token); setGymsMore(page.has_more)
      if (!more) setGym(preserveGym ?? page.items[0]?.gym_id ?? null)
    } catch (cause) { if (generation === gymGeneration.current) setError(errorText(cause)) }
  }
  useEffect(() => { void loadGyms(false); return () => { gymGeneration.current += 1; groupGeneration.current.needs_programming += 1; groupGeneration.current.current_clients += 1; Object.values(groupTimers.current).forEach(timer => { if (timer !== null) window.clearTimeout(timer) }) } }, [api, retryGeneration])
  useEffect(() => { if (!gym) return; for (const group_kind of ['needs_programming', 'current_clients'] as const) { const query = normalizedSearch(group_kind === 'needs_programming' ? search.needs : search.current); groupQuery.current[group_kind] = query; groupGeneration.current[group_kind] += 1; setGroupPage(group_kind, null); setPending(current => ({ ...current, [group_kind]: true })); void loadGroup(group_kind, query) } }, [gym, retryGeneration])
  const openClientPlan = (item: CoachDashboardRosterPageV1['items'][number]) => {
    setError(null)
    setPlansView('working')
    const promoted = gym ? promotedCurrentAuthority.current.get(phase55AuthorityKey(gym, item.athlete_id)) ?? null : null
    if (gym && item.current_assignment_available && item.current_assignment && (!promoted || promoted === item.current_assignment.assignment_id)) setOpening({ gym, assignment: item.current_assignment.assignment_id, athlete: item.athlete_id, athleteName: item.roster_name, expectedCurrentAssignment: promoted ?? item.current_assignment_id ?? item.current_assignment.assignment_id })
    else if (gym && !promoted && 'resumable_plan_count' in item && (item as CoachDashboardRosterItemV4).resumable_plan_count === 1 && (item as CoachDashboardRosterItemV4).resumable_plan) {
      const plan = (item as CoachDashboardRosterItemV4).resumable_plan!
      setOpening({ gym, assignment: plan.assignment_id, athlete: item.athlete_id, athleteName: item.roster_name, expectedCurrentAssignment: item.current_assignment_id })
    }
    else if (gym && !item.has_active_assignment && !promoted && (!('resumable_plan_count' in item) || (item as CoachDashboardRosterItemV4).resumable_plan_count === 0)) { setPlansCurrentCalendarUnavailable(false); setEmptyFor({ gym, athlete: item.athlete_id, athleteName: item.roster_name }) }
    else { setPlansExpectedCurrentAssignment(promoted ?? item.current_assignment_id); setPlansRequiresCurrentAssignment(Boolean(promoted) || item.has_active_assignment); setPlansCurrentCalendarUnavailable(Boolean(promoted) || (item.has_active_assignment && !item.current_assignment_available)); setPlansAthleteName(item.roster_name); setPlansFor(item.athlete_id); setPlans(null) }
  }
  const selectClient = (item:CoachDashboardRosterPageV1['items'][number]) => {
    if(api.getCoachAthleteNotesV1 && api.getCoachAthleteActivityPageV1 && gym){setOverviewFor(item);setOverviewActivity(null)}else openClientPlan(item)
  }
  const loadPlans = async (more = false, restart = true) => {
    if (!gym || !plansFor) return
    const generation = ++plansGeneration.current
    const requestGym = gym; const requestAthlete = plansFor
    try {
      const phase6Prior = plans?.contract_version === 2 ? plans : null
      const legacyPrior = plans?.contract_version === 1 ? plans : null
      const page = activeProgramArchiveApi
        ? await activeProgramArchiveApi.getCoachDashboardAssignmentsPageV2({ gym: requestGym, athlete: requestAthlete, lifecycle_filter: 'all', archive_visibility: plansView, cursor: more ? phase6Prior?.next_cursor ?? null : null, page_size: 20, expected_read_token: more ? phase6Prior?.next_read_token ?? null : null })
        : await dashboardApi.getCoachDashboardAssignmentsPageV1({ gym: requestGym, athlete: requestAthlete, lifecycle_filter: 'all', cursor: more ? legacyPrior?.next_cursor ?? null : null, page_size: 20, expected_read_token: more ? legacyPrior?.next_read_token ?? null : null })
      if (generation !== plansGeneration.current || gym !== requestGym || plansFor !== requestAthlete) return
      const next = page.contract_version === 2
        ? more && phase6Prior ? { ...page, items: [...phase6Prior.items, ...page.items] } : page
        : more && legacyPrior ? { ...page, items: [...legacyPrior.items, ...page.items] } : page
      setPlans(next)
    } catch (cause) {
      if (generation !== plansGeneration.current) return
      if (activeProgramArchiveApi && unsupported(cause)) { setArchiveUnavailable(true); setPlansView('working'); setPlans(null) }
      else if (dashboardChanged(cause) && restart) { setPlans(null); void loadPlans(false, false) }
      else setError(errorText(cause))
    }
  }
  useEffect(() => { if (plansFor) void loadPlans(false) }, [plansFor, gym, plansView, activeProgramArchiveApi])
  const mutateProgramArchive = async () => {
    if (!archiveDialog || !activeProgramArchiveApi) return
    const { action, plan } = archiveDialog
    setPlansMutation(action); setError(null)
    try {
      if (action === 'archive') {
        if (plan.program_status !== 'draft' && plan.program_status !== 'active') throw new Error('Program state is not archivable.')
        await activeProgramArchiveApi.archiveCoachProgramV1({ program: plan.program_id, expected_program_status: plan.program_status, expected_archive_generation: plan.archive_generation })
      } else await activeProgramArchiveApi.restoreCoachProgramV1({ program: plan.program_id, expected_archive_generation: plan.archive_generation })
      setArchiveDialog(null); setPlans(null); await loadPlans(false); refreshDashboardGroups()
    } catch (cause) {
      setArchiveDialog(null); setPlans(null)
      if (unsupported(cause)) { setArchiveUnavailable(true); setPlansView('working') }
      else { setError(errorText(cause)); void loadPlans(false) }
    } finally { setPlansMutation(null) }
  }
  const refreshDashboardGroups = () => {
    for (const groupKind of ['needs_programming', 'current_clients'] as const) {
      groupGeneration.current[groupKind] += 1; setGroupPage(groupKind, null)
      void loadGroup(groupKind, groupQuery.current[groupKind], false)
    }
  }
  const applySelectedProgramTemplate = async () => {
    const draft = applyProgramTemplate
    const preview = applyProgramTemplatePreview
    if (!draft || !preview || !canApplyTemplatePercentPreview(preview) || preview.template_id !== draft.templateId || preview.template_builder_version !== draft.builderVersion || preview.athlete_id !== draft.athlete || !programTemplateApi || !gym || !draft.athlete || !draft.programName.trim()) return
    const date = new Date(`${draft.startOn}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== draft.startOn || date.getUTCDay() !== 1) { setApplyProgramTemplateError('Choose a Monday start date.'); return }
    setApplyProgramTemplateBusy(true); setApplyProgramTemplateError(null)
    try {
      const result = await programTemplateApi.applyCoachProgramTemplateV2({ request_id: draft.requestId, template: draft.templateId,
        expected_template_builder_version: draft.builderVersion, athlete: draft.athlete, program_name: draft.programName.trim(), start_on: draft.startOn, preview_fingerprint: preview.fingerprint })
      const athlete = rosterClients.find(entry => entry.item.athlete_id === draft.athlete)?.item
      setApplyProgramTemplate(null); setApplyProgramTemplatePreview(null); setTemplateLibraryOpen(false)
      setOpening({ gym, athlete: draft.athlete, athleteName: athlete?.roster_name ?? 'Selected client',
        assignment: result.assignment_id, expectedCurrentAssignment: athlete?.current_assignment_id ?? null })
      refreshDashboardGroups()
    } catch (cause) { setApplyProgramTemplatePreview(null); setApplyProgramTemplateError(`${errorText(cause)} Review percentage loads again before retrying.`) }
    finally { setApplyProgramTemplateBusy(false) }
  }
  const reviewSelectedProgramTemplate = async () => {
    const draft = applyProgramTemplate
    const previewApi = api as ConnectedCoachApiV4 & Pick<Phase55WorkoutTemplateLibraryApi, 'previewCoachTemplatePercentV1'>
    if (!draft?.athlete || !previewApi.previewCoachTemplatePercentV1) { setApplyProgramTemplateError('Percentage preflight is unavailable. This template cannot be applied yet.'); return }
    setApplyProgramTemplateBusy(true); setApplyProgramTemplateError(null); setApplyProgramTemplatePreview(null)
    try { setApplyProgramTemplatePreview(await previewApi.previewCoachTemplatePercentV1({ template: draft.templateId, athlete: draft.athlete, expected_template_builder_version: draft.builderVersion, program: null, expected_program_builder_version: null })) }
    catch (cause) { setApplyProgramTemplateError(errorText(cause)) }
    finally { setApplyProgramTemplateBusy(false) }
  }
  const removalDialog = removal && gym ? <CoachClientRemoval api={api} gym={gym} client={removal.client} onClose={() => setRemoval(null)} onChanged={() => { setOverviewFor(null); setOpening(null); setRemoval(null); setPlansFor(null); refreshDashboardGroups() }} /> : null
  const overviewClient=overviewFor ? [...(needs?.items??[]),...(current?.items??[])].find(item=>item.athlete_id===overviewFor.athlete_id)??overviewFor : null
  if (capabilityUnavailable) return <Phase55CapabilityUnavailable onSignOut={onSignOut} onRetry={() => { setCapabilityUnavailable(false); setError(null); setRetryGeneration(current => current + 1) }} />
  const navigateWorkspace = (action:()=>void) => { if (opening) { workspaceNavigation.current?.(action); return } if (overviewDirty.current && !window.confirm('Discard unsaved coach notes?')) return; overviewDirty.current=false; action() }
  const clientShell = (content:ReactNode) => { const activeId=opening?.athlete ?? overviewClient?.athlete_id; const clientItems=[...(needs?.items??[]),...(current?.items??[])].filter((item,index,items)=>items.findIndex(candidate=>candidate.athlete_id===item.athlete_id)===index); return <div className="approved-live"><aside className="approved-client-rail" aria-label="Clients"><div className="brand">UNRACK <small>COACH</small></div><button className="text-button" onClick={()=>navigateWorkspace(()=>{setOpening(null);setOverviewFor(null)})}>← All clients</button><input aria-label="Search clients" placeholder="Search clients" value={workspaceSearch} onChange={event=>setWorkspaceSearch(event.target.value)}/><nav>{clientItems.filter(item=>item.roster_name.toLowerCase().includes(workspaceSearch.toLowerCase())).map(item=><button key={item.athlete_id} aria-current={activeId===item.athlete_id?'page':undefined} onClick={()=>navigateWorkspace(()=>{setOpening(null);setOverviewFor(item);setOverviewActivity(null)})}>{item.roster_name}</button>)}</nav>{(needs?.has_more||current?.has_more)&&<button className="text-button" onClick={()=>navigateWorkspace(()=>{setOpening(null);setOverviewFor(null)})}>Browse all clients →</button>}<button className="text-button" onClick={()=>navigateWorkspace(onSignOut)}>Sign out</button></aside><section className="approved-client-main"><ManualTabList panelId="client-screen-panel" className="approved-main-tabs" aria-label="Client screens"><button role="tab" aria-selected={!opening} onClick={()=>navigateWorkspace(()=>{const item=clientItems.find(item=>item.athlete_id===activeId);setOpening(null);if(item)setOverviewFor(item)})}>Client overview</button><button role="tab" aria-selected={Boolean(opening)} onClick={()=>{if(!opening&&overviewClient)navigateWorkspace(()=>openClientPlan(overviewClient))}}>Workout builder</button></ManualTabList><div id="client-screen-panel" role="tabpanel" aria-label={opening ? 'Workout builder' : 'Client overview'}>{content}</div></section></div> }
  if (opening) return clientShell(<ConnectedCoachAppV4 registerNavigationGuard={callback => {workspaceNavigation.current=callback}} api={api} correctionsApi={correctionsApi} phase54Api={phase54Api} assignmentLifecycleApi={lifecycleApi} workoutTemplateApi={activeWorkoutTemplateApi} programTemplateApi={programTemplateApi} onWorkoutTemplateUnavailable={() => setTemplateUnavailable(true)} activationExpectedCurrentAssignment={opening.expectedCurrentAssignment} onSignOut={onSignOut} initialGym={opening.gym} initialAssignment={opening.assignment} initialAthlete={opening.athlete} initialAthleteName={opening.athleteName} backLabel={overviewFor?'Back to overview':'Back to clients'} clientFirst onAssignmentActivated={assignment => { const key = phase55AuthorityKey(opening.gym, opening.athlete); promotedCurrentAuthority.current.set(key, assignment); setPlansExpectedCurrentAssignment(assignment); setOpening(current => current?.gym === opening.gym && current.athlete === opening.athlete ? { ...current, expectedCurrentAssignment: assignment } : current); refreshDashboardGroups() }} onBackToDashboard={() => { setPlansExpectedCurrentAssignment(null); setPlansRequiresCurrentAssignment(false); setPlansCurrentCalendarUnavailable(false); setPlansAthleteName(null); setPlansFor(null); setPlans(null); setOpening(null) }} onViewPlans={() => { setOverviewFor(null); const expectedCurrentAssignment = promotedCurrentAuthority.current.get(phase55AuthorityKey(opening.gym, opening.athlete)) ?? opening.expectedCurrentAssignment; setPlansExpectedCurrentAssignment(expectedCurrentAssignment); setPlansRequiresCurrentAssignment(true); setPlansCurrentCalendarUnavailable(false); setPlansAthleteName(opening.athleteName); setPlansFor(opening.athlete); setPlans(null); setOpening(null) }} onCurrentAssignmentDrift={() => { setOverviewFor(null); promotedCurrentAuthority.current.delete(phase55AuthorityKey(opening.gym, opening.athlete)); plansGeneration.current += 1; setOpening(null); setEmptyFor(null); setPlansExpectedCurrentAssignment(null); setPlansRequiresCurrentAssignment(true); setPlansCurrentCalendarUnavailable(true); setPlansAthleteName(opening.athleteName); setPlansFor(opening.athlete); setPlans(null); setError(null); void loadPlans(false, true); refreshDashboardGroups() }} />)
  if (overviewClient && gym && !emptyFor) return clientShell(<>{removalDialog}<ClientOverview embedded programStatus={overviewClient.current_assignment?.program_name ? ('programming_state' in overviewClient && overviewClient.programming_state==='current'?'Programmed':'Draft') : 'resumable_plan_count' in overviewClient && (overviewClient as CoachDashboardRosterItemV4).resumable_plan_count > 0 ? 'Draft · In progress' : 'Needs program'} onConnectApp={pairingApi?()=>setPairingFor({athleteId:overviewClient.athlete_id,athleteName:overviewClient.roster_name}):undefined} onDirtyChange={value=>{overviewDirty.current=value}} key={`${gym}:${overviewClient.athlete_id}`} api={api} gym={gym} athlete={overviewClient.athlete_id} name={overviewClient.roster_name} programName={overviewClient.current_assignment?.program_name??('resumable_plan' in overviewClient ? (overviewClient as CoachDashboardRosterItemV4).resumable_plan?.program_name : null)??null} onBack={()=>{setOverviewFor(null);setOverviewActivity(null)}} onEditPlan={()=>openClientPlan(overviewClient)} onProfile={()=>setProfileFor({athleteId:overviewClient.athlete_id,athleteName:overviewClient.roster_name})} onActivity={item=>setOverviewActivity(item.activity_id)} onPlans={()=>{const item=overviewClient;setOverviewFor(null);setPlansExpectedCurrentAssignment(item.current_assignment_id);setPlansRequiresCurrentAssignment(item.has_active_assignment);setPlansAthleteName(item.roster_name);setPlansFor(item.athlete_id);setPlans(null)}}/>{(gyms.find(item=>item.gym_id===gym)?.role==='owner'||gyms.find(item=>item.gym_id===gym)?.role==='admin') && <button className="text-button" onClick={() => navigateWorkspace(() => setRemoval({ client: { athlete: overviewClient.athlete_id, name: overviewClient.roster_name } }))}>Remove client</button>}{profileFor&&<AthleteProfileDialog api={api} gymId={gym} athleteId={profileFor.athleteId} athleteName={profileFor.athleteName} initialReportId={profileFor.reportId} onReportReviewed={() => setReportRevision(value => value + 1)} canEditPresets={gyms.find(item=>item.gym_id===gym)?.role==='owner'||gyms.find(item=>item.gym_id===gym)?.role==='admin'} onClose={()=>setProfileFor(null)} onSaved={async()=>{setProfileFor(null);refreshDashboardGroups()}} onCycleClosed={refreshDashboardGroups}/>}{pairingFor&&pairingApi&&<AthletePairingDialog api={pairingApi} athleteId={pairingFor.athleteId} athleteName={pairingFor.athleteName} onClose={()=>setPairingFor(null)}/>}{overviewActivity&&activityApi&&<OverviewActivityDialog key={overviewActivity} api={activityApi} gym={gym} activityId={overviewActivity} onClose={()=>setOverviewActivity(null)}/>}</>)
  if (emptyFor) return <Phase55NoCurrentAssignment api={api} lifecycleApi={lifecycleApi} client={emptyFor} onBack={() => setEmptyFor(null)} onPlans={() => { setOverviewFor(null); setPlansExpectedCurrentAssignment(null); setPlansRequiresCurrentAssignment(false); setPlansCurrentCalendarUnavailable(false); setPlansAthleteName(emptyFor.athleteName); setPlansFor(emptyFor.athlete); setPlans(null); setEmptyFor(null) }} onCreated={assignment => { const client = emptyFor; setEmptyFor(null); setOpening({ ...client, assignment, expectedCurrentAssignment: null }) }} />
  const rosterClients = [
    ...(needs?.items ?? []).map(item => ({ item, group: 'needs_programming' as const })),
    ...(current?.items ?? []).map(item => ({ item, group: 'current_clients' as const })),
  ].filter((entry, index, entries) => entries.findIndex(candidate => candidate.item.athlete_id === entry.item.athlete_id) === index)
  const clientState = (entry: typeof rosterClients[number]) => {
    if ('resumable_plan_count' in entry.item && (entry.item as CoachDashboardRosterItemV4).resumable_plan_count > 0 && !entry.item.current_assignment_available) return { key: 'draft' as const, label: (entry.item as CoachDashboardRosterItemV4).resumable_plan_count === 1 ? 'Draft · In progress' : `${(entry.item as CoachDashboardRosterItemV4).resumable_plan_count} drafts` }
    if ('programming_state' in entry.item && 'program_readiness' in entry.item) {
      if (entry.item.programming_state === 'current') return { key: 'programmed' as const, label: 'Programmed' }
      if (entry.item.program_readiness === 'draft') return { key: 'draft' as const, label: 'Draft' }
    }
    return entry.group === 'current_clients' ? { key: 'programmed' as const, label: 'Programmed' } : entry.item.has_active_assignment ? { key: 'draft' as const, label: 'Draft' } : { key: 'needs_programming' as const, label: 'Needs program' }
  }
  const filteredRoster = rosterClients.filter(entry => rosterFilter === 'all' || clientState(entry).key === rosterFilter)
  const clients = rosterClients.map(entry => entry.item)
  const dashboardSearchPending = pending.needs_programming || pending.current_clients
  const selectedGym = gyms.find(item => item.gym_id === gym) ?? null
  const compatibleRosterSnapshots = Boolean(needs && current && ['principal_id','principal_lifecycle_key','principal_generation','gym_id','gym_lifecycle_key','gym_generation','materialization_generation','materialization_as_of_date','visibility_kind'].every(key => (needs.dashboard_read_token as unknown as Record<string, unknown>)[key] === (current.dashboard_read_token as unknown as Record<string, unknown>)[key]) && (needs.contract_version !== 2 || current.contract_version !== 2 || needs.dashboard_read_token.programming_snapshot === current.dashboard_read_token.programming_snapshot))
  const showWelcome = Boolean(compatibleRosterSnapshots && selectedGym && ['owner','admin'].includes(selectedGym.role) && needs && current && !dashboardSearchPending && !error && !needs.has_more && !current.has_more && needs.items.length === 0 && current.items.length === 0 && !search.needs.trim() && !search.current.trim() && rosterFilter === 'all')
  const dashboardTitle = templateLibraryOpen ? 'Program library' : plansFor ? 'Plans' : 'Client roster'
  const dashboardSubtitle = templateLibraryOpen ? null : plansFor ? `Review ${plansAthleteName ?? 'this client'}’s current, upcoming, and past plans.` : null
  const resetPlans = () => { setPlansExpectedCurrentAssignment(null); setPlansRequiresCurrentAssignment(false); setPlansCurrentCalendarUnavailable(false); setPlansAthleteName(null); setPlansFor(null); setPlans(null); setPlansView('working'); setArchiveDialog(null); setError(null) }
  const guardTemplateWorkspace = (action: () => void) => {
    if (templateLibraryOpen && libraryKind === 'program' && templateWorkspaceDirty && !window.confirm('Discard unsaved changes to this template day?')) return
    setTemplateWorkspaceDirty(false); action()
  }
  return <main className="connected-app approved-home phase55-dashboard">
    <aside className="connected-roster" aria-label="Roster">
      <div className="brand"><span>UNRACK</span><small>COACH</small></div>
      <nav className="phase8-sidebar-nav" aria-label="Workspace"><button className={!templateLibraryOpen && !plansFor ? 'selected' : ''} aria-current={!templateLibraryOpen && !plansFor ? 'page' : undefined} onClick={() => guardTemplateWorkspace(() => { setTemplateLibraryOpen(false); resetPlans() })}>Client roster</button>{(activeWorkoutTemplateApi || programTemplateApi) && <button className={templateLibraryOpen ? 'selected' : ''} aria-current={templateLibraryOpen ? 'page' : undefined} onClick={() => { resetPlans(); setTemplateLibraryOpen(true) }}>Program library</button>}</nav>
      {gyms.length === 0 && !gymsMore ? <p className="phase4-workspace-name">{gymToken ? 'No accessible workspaces' : 'Loading workspaces…'}</p> : gyms.length === 1 && !gymsMore ? <p className="phase4-workspace-name"><span>Workspace</span><strong>{gyms[0].gym_name}</strong></p> : <label className="phase4-scope-picker">Gym<select aria-label="Select gym" value={gym ?? ''} onChange={event => { const nextGym = event.target.value; guardTemplateWorkspace(() => { groupGeneration.current.needs_programming += 1; groupGeneration.current.current_clients += 1; Object.entries(groupTimers.current).forEach(([key, timer]) => { if (timer !== null) window.clearTimeout(timer); groupTimers.current[key as 'needs_programming' | 'current_clients'] = null }); plansGeneration.current += 1; setNeeds(null); setCurrent(null); setPlansFor(null); setPlans(null); setOpening(null); setError(null); setGym(nextGym) }) }}>{gyms.map(item => <option key={item.gym_id} value={item.gym_id}>{item.gym_name}</option>)}</select></label>}
      {gymsMore && <button className="text-button" onClick={() => void loadGyms(true)}>Load more gyms</button>}
      {gym && api.getWorkspaceSettingsV1 && api.saveCoachNameV1 && api.saveWorkspaceNameV1 && <button className="text-button" onClick={() => guardTemplateWorkspace(() => setSettingsOpen(true))}>Workspace settings</button>}
      <button className="text-button signout" onClick={() => guardTemplateWorkspace(onSignOut)}>Sign out</button>
    </aside>
    <section className="connected-main">
      <header className="connected-header phase55-header"><div><p className="eyebrow">COACH DASHBOARD</p><h1>{dashboardTitle}</h1>{dashboardSubtitle && <p>{dashboardSubtitle}</p>}</div>{!plansFor && !templateLibraryOpen && <div className="phase55-header-actions">{selectedGym && (selectedGym.role === 'owner' || selectedGym.role === 'admin') && <><button className="button outline" onClick={() => setRemoval({ client: null })}>Removed clients</button><button className="button outline" onClick={() => setAddingAthlete(true)}>+ Add athlete</button></>}{(activeWorkoutTemplateApi || programTemplateApi) && <button className="button primary" onClick={() => { setLibraryKind(programTemplateApi ? 'program' : 'workout'); setTemplateLibraryOpen(true) }}>Build template</button>}</div>}</header>
      {settingsOpen && gym && <Modal label="Workspace settings" busy={settingsBusy} onClose={() => { if (!settingsDirty || window.confirm('Discard unsaved workspace details?')) { setSettingsOpen(false); setSettingsDirty(false) } }}><WorkspaceSettings api={api as typeof api & OwnerOnboardingApi} gym={gym} onBusyChange={setSettingsBusy} onDirtyChange={setSettingsDirty} onSaved={value => { onCoachNameSaved?.(value.coach.display_name); setGyms(current => current.map(item => item.gym_id === value.workspace.id ? { ...item, gym_name: value.workspace.name } : item)); void loadGyms(false, gym) }} /><div className="dialog-actions"><button className="button outline" disabled={settingsBusy} onClick={() => { if (!settingsDirty || window.confirm('Discard unsaved workspace details?')) { setSettingsOpen(false); setSettingsDirty(false) } }}>Close settings</button></div></Modal>}
      {templateUnavailable && <p className="workspace-error" role="status">Workout templates are temporarily unavailable. Calendar editing remains available.</p>}
      {error && <p className="workspace-error" role="alert">{error}</p>}
      {templateLibraryOpen ? <div className="phase9-library-shell"><ManualTabList className="phase9-library-tabs" aria-label="Template kinds">{programTemplateApi && <button role="tab" aria-selected={libraryKind === 'program'} onClick={() => setLibraryKind('program')}>Program templates</button>}{activeWorkoutTemplateApi && <button role="tab" aria-selected={libraryKind === 'workout'} onClick={() => guardTemplateWorkspace(() => setLibraryKind('workout'))}>Single workouts</button>}</ManualTabList>{libraryKind === 'program' && programTemplateApi && gym ? <ProgramTemplateWorkspace api={programTemplateApi} gym={gym} renderDayEditor={renderProgramTemplateDayEditor} renderRichDayEditor={renderRichProgramTemplateDayEditor} onDirtyChange={setTemplateWorkspaceDirty} onApply={(templateId, builderVersion, name) => { setApplyProgramTemplatePreview(null); setApplyProgramTemplate({ templateId, builderVersion, name, athlete: rosterClients[0]?.item.athlete_id ?? '', programName: name, startOn: nextMonday(), requestId: crypto.randomUUID() }); setApplyProgramTemplateError(null) }} onClose={() => setTemplateLibraryOpen(false)} /> : activeWorkoutTemplateApi ? <WorkoutTemplateLibrary api={activeWorkoutTemplateApi} gym={gym} onUnavailable={() => { setTemplateUnavailable(true); setTemplateLibraryOpen(false) }} onClose={() => setTemplateLibraryOpen(false)} /> : <p role="status">Template library unavailable.</p>}</div> : plansFor ? <section className="phase55-plans" aria-label="Plans">
        <button className="text-button phase55-back" onClick={resetPlans}>← Back to clients</button>
        {plansCurrentCalendarUnavailable && <section className="phase55-recovery" role="status"><span className="phase55-recovery-mark" aria-hidden="true">!</span><div><h2>Current calendar needs review</h2><p>Your saved plans are still here. This older assignment does not have calendar information the editor can safely open. Build a new plan with a Monday start date, then publish a ready day or week to make it current. Earlier released work stays in history.</p></div></section>}
        <div className="phase55-plans-toolbar"><div><p className="eyebrow">PROGRAM HISTORY</p><h2>{plansAthleteName ?? 'Selected client'}</h2></div>{gym && plansView === 'working' && <button className="button primary" onClick={() => setCreatingNextFor({ gym, athlete: plansFor, athleteName: plansAthleteName ?? clients.find(item => item.athlete_id === plansFor)?.roster_name ?? 'Selected client', expectedCurrentAssignment: plansExpectedCurrentAssignment })}>Build next plan</button>}</div>
        {activeProgramArchiveApi && <ManualTabList className="phase6-plans-tabs" aria-label="Program views"><button role="tab" aria-selected={plansView === 'working'} onClick={() => { setPlans(null); setPlansView('working') }}>Working programs</button><button role="tab" aria-selected={plansView === 'archived'} onClick={() => { setPlans(null); setPlansView('archived') }}>Archived</button></ManualTabList>}
        {!plans ? <p className="phase55-group-state" role="status">Loading programs…</p> : plans.items.length === 0 ? <p className="phase55-empty">{plansView === 'archived' ? 'No archived programs.' : 'No programs in this view.'}</p> : <div className="phase55-plan-list">{planDates.error && <p role="alert">Program dates could not be loaded. <button className="text-button" onClick={planDates.retry}>Retry dates</button></p>}{plans.items.map(plan => <article key={plan.assignment_id}><div><h2>{plan.program_name ?? 'Plan'}</h2><p>{plan.lifecycle_bucket.replaceAll('_', ' ')} · {plan.start_on ?? 'No start date'}{plan.end_on ? ` – ${plan.end_on}` : ''}</p>{planDates.items.find(item => item.program_id === plan.program_id) && <ProgramPublicationSummary item={planDates.items.find(item => item.program_id === plan.program_id)!} />}</div><div className="phase6-plan-actions">{plan.program_id && gym && plan.lifecycle_bucket === 'current_active' && <button className="button outline" onClick={() => setOpening({ gym, assignment: plan.assignment_id, athlete: plansFor, athleteName: plansAthleteName ?? clients.find(item => item.athlete_id === plansFor)?.roster_name ?? 'Selected client', expectedCurrentAssignment: plan.assignment_id })}>Open calendar</button>}{plan.program_id && gym && plan.assignment_status === 'paused' && !plan.has_release && plan.program_status !== 'archived' && !(plansRequiresCurrentAssignment && !plansExpectedCurrentAssignment) && <button className="button outline" onClick={() => setOpening({ gym, assignment: plan.assignment_id, athlete: plansFor, athleteName: plansAthleteName ?? clients.find(item => item.athlete_id === plansFor)?.roster_name ?? 'Selected client', expectedCurrentAssignment: plansExpectedCurrentAssignment })}>Open plan</button>}{'archive_eligible' in plan && plan.archive_eligible && <button className="button outline" onClick={() => setArchiveDialog({ action: plansView === 'archived' ? 'restore' : 'archive', plan })}>{plansView === 'archived' ? 'Restore' : 'Archive'}</button>}{'archive_blocker' in plan && plan.archive_blocker === 'current_program' && <small>End the current plan explicitly before archiving it. Saved workouts and history are retained.</small>}{'archive_blocker' in plan && plansView === 'archived' && plan.archive_blocker === 'restore_state_missing' && <small>Restore unavailable because this older archive has no recorded previous state.</small>}</div></article>)}</div>}
        {plans?.has_more && <button className="button outline" onClick={() => void loadPlans(true)}>Load more plans</button>}
      </section> : <div className="phase9-home-layout">{gym && <MaxReportInbox key={gym} api={api as Partial<BacklogRevisionApi>} gym={gym} refreshKey={reportRevision} onOpen={report => setProfileFor({ athleteId: report.athlete_id, athleteName: report.athlete_name, initialTab: 'maxes', reportId: report.report_id })} />}<section className="phase55-dashboard-body phase8-roster" aria-label="Client roster"><div className="phase8-roster-toolbar"><label className="phase55-search"><span>Search roster</span><input aria-label="Search client roster" placeholder="Search by client or program" value={search.needs} onChange={event => { const value = event.target.value; setSearch({ needs: value, current: value }); scheduleGroup('needs_programming', value); scheduleGroup('current_clients', value) }} /></label><div className="phase8-roster-filters" role="group" aria-label="Filter roster">{([['all', 'All'], ['needs_programming', 'Needs program'], ['draft', 'Draft'], ['programmed', 'Programmed']] as const).map(([key, label]) => <button key={key} className={rosterFilter === key ? 'selected' : ''} aria-pressed={rosterFilter === key} onClick={() => setRosterFilter(key)}>{label}<span>{key === 'all' ? rosterClients.length : rosterClients.filter(entry => clientState(entry).key === key).length}</span></button>)}</div></div>{!needs || !current ? <p className="phase55-group-state" role="status">{dashboardSearchPending ? 'Searching clients…' : 'Loading clients…'}</p> : filteredRoster.length === 0 ? showWelcome ? <section className="owner-welcome"><h2>Your workspace is ready{coachDisplayName ? `, ${coachDisplayName}` : ''}.</h2><p>Add your first athlete to start building their program.</p><div className="dialog-actions"><button className="button primary" onClick={() => setAddingAthlete(true)}>Add first athlete</button>{programTemplateApi && <button className="button outline" onClick={() => { setLibraryKind('program'); setTemplateLibraryOpen(true) }}>Build a reusable template</button>}</div></section> : <p className="phase55-empty">No clients match this view.</p> : <div className="phase8-roster-list">{filteredRoster.map(entry => { const state = clientState(entry); return <div key={entry.item.athlete_id} className="phase8-roster-entry"><button className="phase8-roster-row" onClick={() => selectClient(entry.item)}><span className="phase55-avatar" aria-hidden="true">{initials(entry.item.roster_name)}</span><span className="phase8-client-name"><strong>{entry.item.roster_name}</strong><small>{entry.item.current_assignment?.program_name ?? ('resumable_plan' in entry.item ? (entry.item as CoachDashboardRosterItemV4).resumable_plan?.program_name : null) ?? (state.key === 'needs_programming' ? 'No current program' : 'Program needs review')}</small></span><span className={`phase8-status ${state.key}`}>{state.label}</span><span className="phase55-client-arrow" aria-hidden="true">→</span></button><div className="phase9-roster-actions">{'resumable_plan_count' in entry.item && !entry.item.current_assignment_available && (entry.item as CoachDashboardRosterItemV4).resumable_plan_count > 0 && <button className="button outline" onClick={() => openClientPlan(entry.item)}>{(entry.item as CoachDashboardRosterItemV4).resumable_plan_count === 1 ? 'Open program' : 'Choose a plan'}</button>}<button className="button outline" onClick={() => setProfileFor({ athleteId: entry.item.athlete_id, athleteName: entry.item.roster_name })}>Profile</button>{pairingApi && <button className="button outline" onClick={() => setPairingFor({ athleteId: entry.item.athlete_id, athleteName: entry.item.roster_name })}>Connect app</button>}{(selectedGym?.role === 'owner' || selectedGym?.role === 'admin') && <button className="text-button" onClick={() => setRemoval({ client: { athlete: entry.item.athlete_id, name: entry.item.roster_name } })}>Remove client</button>}</div></div>})}</div>}<div className="phase8-load-more">{needs?.has_more && (rosterFilter === 'all' || rosterFilter !== 'programmed') && <button className="button outline" disabled={pending.needs_programming} onClick={() => void loadGroup('needs_programming', groupQuery.current.needs_programming, true, needs)}>Load more clients needing programming</button>}{current?.has_more && (rosterFilter === 'all' || rosterFilter === 'programmed') && <button className="button outline" disabled={pending.current_clients} onClick={() => void loadGroup('current_clients', groupQuery.current.current_clients, true, current)}>Load more programmed clients</button>}</div></section><div>{gym && <PersonalTrackingInbox key={gym} api={api} gym={gym} />}<RecentActivityPanel api={activityApi} gym={gym} /></div> </div>}
      {applyProgramTemplate && !profileFor && <Modal label="Use program template for client" busy={applyProgramTemplateBusy} onClose={() => { setApplyProgramTemplate(null); setApplyProgramTemplatePreview(null) }}><h2>Use template for a client</h2><p>This creates a separate draft plan. The template will not change the client's plan later.</p><div className="phase9-apply-fields"><label>Client<select value={applyProgramTemplate.athlete} disabled={applyProgramTemplateBusy} onChange={event => { setApplyProgramTemplatePreview(null); setApplyProgramTemplate(current => current ? { ...current, athlete: event.target.value, requestId: crypto.randomUUID() } : null) }}>{rosterClients.map(entry => <option key={entry.item.athlete_id} value={entry.item.athlete_id}>{entry.item.roster_name}</option>)}</select></label><label>Plan name<input maxLength={120} value={applyProgramTemplate.programName} disabled={applyProgramTemplateBusy} onChange={event => { setApplyProgramTemplatePreview(null); setApplyProgramTemplate(current => current ? { ...current, programName: event.target.value, requestId: crypto.randomUUID() } : null) }} /></label><label>Start Monday<input type="date" value={applyProgramTemplate.startOn} disabled={applyProgramTemplateBusy} onChange={event => { setApplyProgramTemplatePreview(null); setApplyProgramTemplate(current => current ? { ...current, startOn: event.target.value, requestId: crypto.randomUUID() } : null) }} /></label></div>{applyProgramTemplateError && <p role="alert" className="workspace-error">{applyProgramTemplateError}</p>}{applyProgramTemplatePreview && <TemplatePercentReview preview={applyProgramTemplatePreview} />}{applyProgramTemplatePreview && !applyProgramTemplatePreview.ready && <button type="button" className="button outline" onClick={() => setProfileFor({ athleteId: applyProgramTemplate.athlete, athleteName: rosterClients.find(entry => entry.item.athlete_id === applyProgramTemplate.athlete)?.item.roster_name ?? 'Selected client', initialTab: 'maxes' })}>Open programming maxes for this client</button>}<div className="dialog-actions"><button className="button outline" disabled={applyProgramTemplateBusy} onClick={() => { setApplyProgramTemplate(null); setApplyProgramTemplatePreview(null) }}>Cancel</button><button className="button outline" disabled={applyProgramTemplateBusy || !applyProgramTemplate.athlete} onClick={() => void reviewSelectedProgramTemplate()}>{applyProgramTemplateBusy ? 'Reviewing…' : 'Review percentage loads'}</button><button className="button primary" disabled={applyProgramTemplateBusy || !canApplyTemplatePercentPreview(applyProgramTemplatePreview) || !applyProgramTemplate.programName.trim()} onClick={() => void applySelectedProgramTemplate()}>{applyProgramTemplateBusy ? 'Creating…' : 'Create draft plan'}</button></div></Modal>}
      {creatingNextFor && <CreateSkeleton api={{ ...api, createCalendarProgram: lifecycleApi.createCalendarProgramV2 }} gymId={creatingNextFor.gym} athletes={[{ athlete_id: creatingNextFor.athlete, roster_name: creatingNextFor.athleteName }]} selectedAthlete={creatingNextFor.athlete} onClose={() => setCreatingNextFor(null)} onComplete={async assignment => { const next = creatingNextFor; setCreatingNextFor(null); setOpening({ ...next, assignment }) }} mutation={plansMutation} setMutation={setPlansMutation} />}
      {archiveDialog && <ProgramArchiveDialog action={archiveDialog.action} programName={archiveDialog.plan.program_name ?? 'this program'} busy={plansMutation !== null} onConfirm={() => void mutateProgramArchive()} onClose={() => setArchiveDialog(null)} />}
      {pairingFor && pairingApi && <AthletePairingDialog api={pairingApi} athleteId={pairingFor.athleteId} athleteName={pairingFor.athleteName} onClose={() => setPairingFor(null)} />}
      {profileFor && gym && <AthleteProfileDialog api={api} gymId={gym} athleteId={profileFor.athleteId} athleteName={profileFor.athleteName} initialReportId={profileFor.reportId} onReportReviewed={() => setReportRevision(value => value + 1)} initialTab={profileFor.initialTab} canEditPresets={selectedGym?.role === 'owner' || selectedGym?.role === 'admin'} onClose={() => setProfileFor(null)} onSaved={async () => { setProfileFor(null); await refreshDashboardGroups() }} onCycleClosed={refreshDashboardGroups} />}
      {removalDialog}
      {addingAthlete && gym && <AddAthlete api={api} gymId={gym} onClose={() => setAddingAthlete(false)} onComplete={async () => { setAddingAthlete(false); refreshDashboardGroups() }} mutation={athleteMutation} setMutation={setAthleteMutation} />}
    </section>
  </main>
}

function profileNumber(form: FormData, key: string): number | null {
  const raw = String(form.get(key) ?? '').trim()
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}
function profileFromForm(form: FormData): AthleteProfileInputV1 {
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
function AthleteProfileFields({ profile, autoFocusName = false }: { profile?: AthleteProfileV1; autoFocusName?: boolean }) {
  const fieldId = useId().replace(/[^a-zA-Z0-9]/g, '')
  return <div className="athlete-profile-fields"><label>Name<input autoFocus={autoFocusName} required maxLength={120} name={autoFocusName ? `intake-name-${fieldId}` : 'name'} autoComplete="off" autoCorrect="off" spellCheck={false} defaultValue={profile?.name ?? ''} /></label><label>Sex<select name="sex_category" defaultValue={profile?.sex_category ?? ''}><option value="">Not provided</option><option value="male">Male</option><option value="female">Female</option></select></label><label>Bodyweight<input name="bodyweight" type="number" min="0.001" max="1500" step="0.001" inputMode="decimal" defaultValue={profile?.bodyweight_value ?? ''} /></label><label>Bodyweight unit<select name="bodyweight_unit" defaultValue={profile?.bodyweight_unit ?? 'lb'}><option value="lb">lb</option><option value="kg">kg</option></select></label><label><span>Athlete logging unit</span><select aria-label="Athlete logging unit" aria-describedby={`logging-unit-${fieldId}`} name="preferred_weight_unit" defaultValue={profile?.preferred_weight_unit ?? 'lb'}><option value="lb">lb</option><option value="kg">kg</option></select><small id={`logging-unit-${fieldId}`}>Default unit for recording lifted weights.</small></label><fieldset className="athlete-tested-maxes"><legend>Current tested 1RMs</legend><input type="hidden" name="tested_1rm_unit" value={profile?.tested_1rm_unit ?? 'lb'} />{(['squat', 'bench', 'deadlift'] as const).map(lift => <TestedMaxEntry key={lift} lift={lift} original={profile?.[`tested_1rm_${lift}`] ?? null} canonicalUnit={profile?.tested_1rm_unit ?? 'lb'} />)}<small className="athlete-profile-wide">Saved and synced in {profile?.tested_1rm_unit ?? 'lb'}. Each lift’s unit changes its display; edited values convert to this shared unit when saved (up to 3 decimals).</small><small className="athlete-profile-wide">Max entry is optional. These tested 1RMs sync with the athlete profile and require coach approval for programming. Percentage loads prefer a training max, then an approved tested 1RM; estimated 1RMs are never used. Unresolved percentages can be saved in templates and drafts, but cannot be published.</small></fieldset></div>
}
type ProgrammingMaxesUi = ProgrammingMaxesV1
type AthleteTrackingUi = AthleteTrackingV1
type AthleteMetricsUi = CoachAthleteMetricsV1
type AthleteTrainingReportUi = TrainingReportV1
type PercentageCoachApiUi = PercentageProgrammingApi
type AthleteProfileTab = 'overview' | 'metrics' | 'report' | 'maxes' | 'tracking'
function AthleteProfileDialog({ api, gymId, athleteId, athleteName, canEditPresets = false, initialTab = 'overview', initialReportId, onReportReviewed, onClose, onSaved, onCycleClosed }: { api: ConnectedCoachApi & Partial<PercentageCoachApiUi> & Partial<ConnectedCoachApiV4>; gymId: string; athleteId: string; athleteName: string; canEditPresets?: boolean; initialTab?: AthleteProfileTab; initialReportId?: string; onReportReviewed?(): void; onClose(): void; onSaved(): Promise<void>; onCycleClosed?(): void | Promise<void> }) {
  const [profile, setProfile] = useState<AthleteProfileV1 | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<AthleteProfileTab>(initialTab)
  const [maxes, setMaxes] = useState<ProgrammingMaxesUi | null>(null)
  const [tracking, setTracking] = useState<AthleteTrackingUi | null>(null)
  const [maxesError, setMaxesError] = useState<string | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [maxDate, setMaxDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [maxValue, setMaxValue] = useState('')
  const [maxExercise, setMaxExercise] = useState('')
  const [maxType, setMaxType] = useState<'tested_1rm' | 'training_max'>('training_max')
  const [profileLift, setProfileLift] = useState<'squat' | 'bench' | 'deadlift'>('squat')
  const [pendingReportCount, setPendingReportCount] = useState<number | null>(null)
  const [trackExercise, setTrackExercise] = useState('')
  const [presetDraft, setPresetDraft] = useState({ squat: '', bench: '', deadlift: '' })
  const [metrics, setMetrics] = useState<AthleteMetricsUi | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [metricsRetry, setMetricsRetry] = useState(0)
  const [assignments, setAssignments] = useState<Awaited<ReturnType<ConnectedCoachApiV4['getCoachNavigationAssignmentsV4']>> | null>(null)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [assignmentRetry, setAssignmentRetry] = useState(0)
  const [reportAssignment, setReportAssignment] = useState('')
  const [report, setReport] = useState<AthleteTrainingReportUi | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportRetry, setReportRetry] = useState(0)
  const [cycleClosing, setCycleClosing] = useState(false)
  const [cycleError, setCycleError] = useState<string | null>(null)
  useEffect(() => { let active = true; void api.getAthleteProfileV1({ target_gym: gymId, target_athlete: athleteId }).then(value => { if (active) setProfile(value) }).catch(cause => { if (active) setError(errorText(cause)) }); return () => { active = false } }, [api, gymId, athleteId])
  const reloadMaxes = async () => { if (!api.getProgrammingMaxesV1) return; try { setMaxesError(null); setMaxes(await api.getProgrammingMaxesV1({ target_gym: gymId, target_athlete: athleteId })) } catch (cause) { setMaxesError(errorText(cause)) } }
  const reloadTracking = async () => { if (!api.getAthleteTrackingV1) return; try { setTrackingError(null); const value = await api.getAthleteTrackingV1({ target_gym: gymId, target_athlete: athleteId }); setTracking(value); setPresetDraft({ squat: value.system_required.find(item => item.lift === 'squat')?.exercise_id ?? '', bench: value.system_required.find(item => item.lift === 'bench')?.exercise_id ?? '', deadlift: value.system_required.find(item => item.lift === 'deadlift')?.exercise_id ?? '' }) } catch (cause) { setTrackingError(errorText(cause)) } }
  useEffect(() => { void reloadMaxes(); void reloadTracking() }, [api, gymId, athleteId])
  useEffect(() => { if (!api.getCoachAthleteMetricsV1) return; let active = true; setMetricsError(null); void api.getCoachAthleteMetricsV1({ target_gym: gymId, target_athlete: athleteId }).then(value => { if (active) setMetrics(value) }).catch(cause => { if (active) setMetricsError(errorText(cause)) }); return () => { active = false } }, [api, gymId, athleteId, metricsRetry])
  useEffect(() => { if (!api.getCoachNavigationAssignmentsV4) return; let active = true; setAssignmentError(null); void api.getCoachNavigationAssignmentsV4({ gym: gymId, athlete: athleteId, cursor: null, page_size: 50, expected_read_token: null }).then(value => { if (active) { setAssignments(value); const firstCompleted = value.items.find(item => item.assignment_status === 'completed'); setReportAssignment(firstCompleted?.assignment_id ?? '') } }).catch(cause => { if (active) setAssignmentError(errorText(cause)) }); return () => { active = false } }, [api, gymId, athleteId, assignmentRetry])
  useEffect(() => { if (!api.getCoachTrainingReportV1 || !reportAssignment) { setReport(null); return }; let active = true; setReport(null); setReportError(null); void api.getCoachTrainingReportV1({ target_gym: gymId, target_athlete: athleteId, assignment_id: reportAssignment }).then(value => { if (active) setReport(value) }).catch(cause => { if (active) setReportError(errorText(cause)) }); return () => { active = false } }, [api, gymId, athleteId, reportAssignment, reportRetry])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!profile || busy) return
    setBusy(true); setError(null)
    try { await api.saveAthleteProfileV1({ request_id: crypto.randomUUID(), target_gym: gymId, target_athlete: athleteId, expected_version: profile.profile_version, profile: profileFromForm(new FormData(event.currentTarget)) }); await onSaved() }
    catch (cause) { if (cause instanceof CoachApiError && cause.code === 'serialization_retry') { try { setProfile(await api.getAthleteProfileV1({ target_gym: gymId, target_athlete: athleteId })); setError('This profile changed on another device. The latest values are shown; review and save again.') } catch (reloadCause) { setError(errorText(reloadCause)) } } else setError(errorText(cause)) }
    finally { setBusy(false) }
  }
  const saveMax = async (exerciseId: string, value: number, unit: 'lb' | 'kg', source: 'coach_entry' | 'profile_approval' | 'workout_approval', candidateId: string | null = null) => {
    if (!api.saveProgrammingMaxV1 || busy || !maxDate) return
    setBusy(true); setMaxesError(null)
    try { await api.saveProgrammingMaxV1({ request_id: crypto.randomUUID(), target_gym: gymId, target_athlete: athleteId, exercise_id: exerciseId, max_type: source === 'workout_approval' || source === 'profile_approval' ? 'tested_1rm' : maxType, value, unit, effective_from: maxDate, source, expected_profile_version: source === 'profile_approval' ? maxes?.profile.profile_version ?? null : source === 'workout_approval' ? maxes?.candidates.find(candidate => candidate.id === candidateId)?.profile_version ?? null : null, candidate_id: candidateId }); await reloadMaxes(); setMaxValue('') }
    catch (cause) { setMaxesError(errorText(cause)) } finally { setBusy(false) }
  }
  const setRequired = async (exerciseId: string, required: boolean) => {
    if (!api.setCoachTrackingV1 || !tracking || busy) return
    setBusy(true); setTrackingError(null)
    try { await api.setCoachTrackingV1({ request_id: crypto.randomUUID(), target_gym: gymId, target_athlete: athleteId, exercise_id: exerciseId, required, expected_version: tracking.tracking_version }); await reloadTracking() }
    catch (cause) { setTrackingError(errorText(cause)) } finally { setBusy(false) }
  }
  const dismissCandidate = async (candidateId: string) => {
    if (!api.dismissProgrammingMaxCandidateV1 || busy) return
    setBusy(true); setMaxesError(null)
    try { await api.dismissProgrammingMaxCandidateV1({ target_gym: gymId, target_athlete: athleteId, candidate_id: candidateId }); await reloadMaxes() }
    catch (cause) { setMaxesError(errorText(cause)) } finally { setBusy(false) }
  }
  const loadMoreAssignments = async () => {
    if (!api.getCoachNavigationAssignmentsV4 || !assignments?.next_cursor) return
    try { setAssignmentError(null); const next = await api.getCoachNavigationAssignmentsV4({ gym: gymId, athlete: athleteId, cursor: assignments.next_cursor, page_size: 50, expected_read_token: assignments.navigation_read_token }); setAssignments(current => current ? { ...next, items: [...current.items, ...next.items.filter(item => !current.items.some(previous => previous.assignment_id === item.assignment_id))] } : next); if (!reportAssignment) setReportAssignment(next.items.find(item => item.assignment_status === 'completed')?.assignment_id ?? '') }
    catch (cause) { setAssignmentError(errorText(cause)) }
  }
  const closeCycleFor = async (assignmentId: string) => {
    if (!api.completeCoachAssignmentCycleV1 || cycleClosing) return
    if (!window.confirm('Close this cycle and make its final training report available? Every assigned workout must be completed or skipped.')) return
    setCycleClosing(true); setCycleError(null)
    try {
      await api.completeCoachAssignmentCycleV1({ target_gym: gymId, target_athlete: athleteId, assignment_id: assignmentId })
      setAssignments(current => current ? { ...current, items: current.items.map(item => item.assignment_id === assignmentId ? { ...item, assignment_status: 'completed' as const } : item) } : current)
      setReportAssignment(assignmentId)
      setReportRetry(value => value + 1)
      await onCycleClosed?.()
    } catch (cause) { setCycleError(errorText(cause)) }
    finally { setCycleClosing(false) }
  }
  const savePreset = async (lift: 'squat' | 'bench' | 'deadlift') => {
    if (!canEditPresets || !api.setGymCompetitionExerciseV1 || !presetDraft[lift] || busy) return
    setBusy(true); setTrackingError(null)
    try { await api.setGymCompetitionExerciseV1({ target_gym: gymId, target_lift: lift, target_exercise: presetDraft[lift] }); await reloadTracking(); await reloadMaxes() }
    catch (cause) { setTrackingError(errorText(cause)) } finally { setBusy(false) }
  }
  const liftName = (exerciseId: string) => maxes?.basis_options.find(option => option.exercise_id === exerciseId)?.name ?? tracking?.effective.find(item => item.exercise_id === exerciseId)?.name ?? 'Exercise'
  const selectedProfilePreset = tracking?.system_required.find(item => item.lift === profileLift)
  const profileLifts = [['Squat', profile?.tested_1rm_squat], ['Bench', profile?.tested_1rm_bench], ['Deadlift', profile?.tested_1rm_deadlift]] as const
  return <div className="modal-backdrop athlete-workspace-backdrop" role="presentation" onKeyDown={event => { if (event.key === 'Escape') onClose(); else trapDialogTab(event) }}><div className="dialog athlete-profile-dialog athlete-workspace" role="dialog" aria-modal="true" aria-labelledby="athlete-profile-title"><button className="close" aria-label="Close athlete profile" type="button" onClick={onClose}>×</button><p className="eyebrow">ATHLETE WORKSPACE</p><h2 id="athlete-profile-title">{athleteName}</h2><ManualTabList panelId="athlete-profile-panel" className="athlete-profile-tabs" aria-label="Athlete profile sections">{([['overview', 'Overview'], ['metrics', 'Metrics'], ['report', 'Training report'], ['maxes', 'Programming maxes'], ['tracking', 'Tracking settings']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}</ManualTabList><div id="athlete-profile-panel" role="tabpanel" aria-label={tab === 'maxes' ? 'Programming maxes' : tab === 'report' ? 'Training report' : tab === 'tracking' ? 'Tracking settings' : tab === 'metrics' ? 'Metrics' : 'Overview'}>
    {tab === 'overview' && <><p>Shared athlete profile. Coach and athlete edits sync; newer changes must be reviewed before saving.</p>{maxes?.candidates.some(candidate => candidate.state === 'pending') && <div className="athlete-pr-alert" role="status"><strong>{maxes.candidates.filter(candidate => candidate.state === 'pending').length} athlete-confirmed 1RM {maxes.candidates.filter(candidate => candidate.state === 'pending').length === 1 ? 'report needs' : 'reports need'} coach review</strong><p>The athlete confirmed the logged single. Programming maxes stay at their approved values until you review it.</p><button type="button" className="button outline" onClick={() => setTab('maxes')}>Review reported 1RM</button></div>}{!profile && !error ? <p role="status">Loading profile…</p> : profile ? <><div className="athlete-profile-summary">{profileLifts.map(([name, value]) => <div key={name}><small>Reported {name} 1RM</small><strong>{value === null ? 'Not reported' : `${value} ${profile.tested_1rm_unit}`}</strong></div>)}</div><form onSubmit={submit}><AthleteProfileFields key={profile.profile_version} profile={profile} /><div className="dialog-actions"><button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div></form></> : null}{error && <p role="alert" className="auth-error">{error}</p>}</>}
    {tab === 'metrics' && <section className="athlete-profile-section"><h3>Metrics</h3><p>Tracked lift trends and the 30 most recent logged sessions. Estimated 1RMs are analysis only; percentage prescriptions use coach-approved maxes.</p>{!api.getCoachAthleteMetricsV1 ? <p>Metrics are unavailable in this workspace version.</p> : metricsError ? <div role="alert"><p>{metricsError}</p><button type="button" className="button outline" onClick={() => setMetricsRetry(value => value + 1)}>Retry</button></div> : !metrics ? <p role="status">Loading athlete metrics…</p> : <><div className="athlete-metric-grid">{metrics.tracked_lifts.length === 0 ? <p>No tracked lifts have logged sets yet.</p> : metrics.tracked_lifts.map(lift => <article key={lift.exercise_id}><small>{lift.name}</small><strong>{lift.estimated_1rm === null ? '—' : `${Math.round(lift.estimated_1rm)} ${lift.estimated_1rm_unit ?? ''}`}</strong><span>Estimated 1RM</span><p>Top logged weight: {lift.top_weight === null ? 'Not logged' : `${lift.top_weight} ${lift.top_unit ?? ''}`}</p>{lift.latest_at && <time dateTime={lift.latest_at}>Last logged {new Date(lift.latest_at).toLocaleDateString()}</time>}</article>)}</div><div className="athlete-profile-subsection"><h4>Logged workouts and exercises</h4>{metrics.recent_sessions.length === 0 ? <p>No logged workouts yet.</p> : <ul className="athlete-session-list">{metrics.recent_sessions.map(session => <li key={session.workout_session_id}><details><summary>{session.completed_at ? new Date(session.completed_at).toLocaleDateString() : 'Date unavailable'} · {session.state} · {session.exercises.length} exercises</summary>{session.exercises.length === 0 ? <p>No exercise sets logged.</p> : session.exercises.map(exercise => <div key={`${session.workout_session_id}:${exercise.exercise_id ?? exercise.name}`} className="athlete-session-exercise"><strong>{exercise.name}</strong><ul>{exercise.sets.map(set => <li key={set.set_log_id}>{set.completed ? 'Completed' : 'Not completed'} · {set.reps ?? '—'} reps · {set.weight === null ? 'No weight' : `${set.weight} ${set.unit ?? ''}`}{set.rpe === null ? '' : ` · RPE ${set.rpe}`}</li>)}</ul></div>)}</details></li>)}</ul>}</div></>}</section>}
    {tab === 'report' && <section className="athlete-profile-section"><h3>Completed-cycle training report</h3><p>Final reports use all logged program work across lift families and become available only after the assigned program is complete.</p>{assignmentError && <div role="alert"><p>{assignmentError}</p><button type="button" className="button outline" onClick={() => setAssignmentRetry(value => value + 1)}>Retry</button></div>}{!api.getCoachTrainingReportV1 || !api.getCoachNavigationAssignmentsV4 ? <p>Training reports are unavailable in this workspace version.</p> : !assignments ? assignmentError ? null : <p role="status">Loading program history…</p> : <><label className="athlete-report-picker">Completed program<select value={reportAssignment} onChange={event => setReportAssignment(event.target.value)}><option value="">Choose a completed program</option>{assignments.items.filter(item => item.assignment_status === 'completed').map(item => <option key={item.assignment_id} value={item.assignment_id}>{item.program_name}</option>)}</select></label>{assignments.has_more && <button type="button" className="button outline" onClick={() => void loadMoreAssignments()}>Load more programs</button>}{!reportAssignment ? <p role="status">No completed program is available for a final report yet.</p> : reportError ? <div role="alert"><p>{reportError}</p><button type="button" className="button outline" onClick={() => setReportRetry(value => value + 1)}>Retry</button></div> : !report ? <p role="status">Loading training report…</p> : !report.ready || !report.summary ? <p role="status">This cycle is not fully complete; its final report is not ready.</p> : <><div className="athlete-report-stats"><div><small>Completed sessions</small><strong>{report.summary.completed_sessions} / {report.summary.sessions}</strong></div><div><small>Logged sets</small><strong>{report.summary.logged_sets}</strong></div><div><small>Total volume</small><strong>{Math.round(report.summary.total_volume).toLocaleString()} {report.summary.volume_unit}</strong></div><div><small>Average RPE</small><strong>{report.summary.average_rpe === null ? '—' : report.summary.average_rpe.toFixed(1)}</strong></div></div><div className="athlete-profile-subsection"><h4>Top logged sets</h4>{report.summary.top_sets.length === 0 ? <p>No completed weighted sets in this cycle.</p> : <ul className="athlete-max-list">{report.summary.top_sets.map((set, index) => <li key={`${set.exercise_id ?? set.exercise_name}:${set.performed_at}:${index}`}><strong>{set.exercise_name}</strong><span>{set.weight} {set.unit} × {set.reps}{set.rpe === null ? '' : ` · RPE ${set.rpe}`}</span><time dateTime={set.performed_at}>{new Date(set.performed_at).toLocaleDateString()}</time></li>)}</ul>}</div></>}</>}</section>}
    {tab === 'maxes' && <section className="athlete-profile-section"><h3>Programming maxes</h3><p>Max entry is optional. Percentage prescriptions automatically use a training max first, then an approved tested 1RM. Reported 1RMs and workout singles require coach review; estimated 1RMs are never used. You can save unresolved templates and drafts; publishing requires an approved max.</p>{maxesError && <div role="alert"><p>{maxesError}</p><button type="button" className="button outline" onClick={() => void reloadMaxes()}>Retry</button></div>}{!api.getProgrammingMaxesV1 ? <p>Programming max management is unavailable in this workspace version.</p> : !maxes && !maxesError ? <p role="status">Loading programming maxes…</p> : maxes && <><label className="athlete-max-date">Effective date<input type="date" value={maxDate} onChange={event => setMaxDate(event.target.value)} /></label><MaxReportInbox key={`${gymId}:${athleteId}`} api={api as Partial<BacklogRevisionApi>} gym={gymId} athlete={athleteId} review effectiveDate={maxDate} selectedReportId={initialReportId} onReviewed={async () => { onReportReviewed?.(); await reloadMaxes() }} onPendingCount={setPendingReportCount} />{!(api as Partial<BacklogRevisionApi>).getCoachMaxReportInboxV1 && maxes.candidates.filter(candidate => candidate.state === 'pending').length > 0 && <div className="athlete-profile-subsection"><h4>Athlete-confirmed singles awaiting coach review</h4>{maxes.candidates.filter(candidate => candidate.state === 'pending').map(candidate => <article key={candidate.id} className="athlete-max-card"><strong>{liftName(candidate.exercise_id)} · {candidate.value} {candidate.unit}</strong><p>Reported {new Date(candidate.created_at).toLocaleString()}{candidate.actual_rpe === null ? '' : ` · RPE ${candidate.actual_rpe}`}. Athlete confirmed this result; it has not changed the programming max.</p><button type="button" className="button outline" disabled={busy || !maxDate} onClick={() => void saveMax(candidate.exercise_id, candidate.value, candidate.unit, 'workout_approval', candidate.id)}>Approve as tested 1RM</button> {api.dismissProgrammingMaxCandidateV1 && <button type="button" className="button quiet" disabled={busy} onClick={() => void dismissCandidate(candidate.id)}>Dismiss report</button>}</article>)}</div>}<div className="athlete-profile-subsection"><h4>Approved max history</h4>{maxes.maxes.length === 0 ? <p>No coach-approved maxes yet.</p> : <ul className="athlete-max-list">{maxes.maxes.map(record => <li key={record.id}><strong>{liftName(record.exercise_id)}</strong><span>{record.max_type === 'training_max' ? 'Training max' : 'Tested 1RM'} · {record.value} {record.unit}</span><time dateTime={record.effective_from}>Effective {record.effective_from}</time></li>)}</ul>}</div><div className="athlete-max-entry athlete-reported-entry"><h4>Use a reported profile 1RM</h4><label className="reported-lift-field"><span>Reported lift</span><select value={profileLift} onChange={event => setProfileLift(event.target.value as 'squat' | 'bench' | 'deadlift')}><option value="squat">Squat</option><option value="bench">Bench</option><option value="deadlift">Deadlift</option></select></label><p className="athlete-reported-instruction"><strong>{maxes.profile[`tested_1rm_${profileLift}`] === null ? 'Not reported' : `${maxes.profile[`tested_1rm_${profileLift}`]} ${maxes.profile.tested_1rm_unit}`}</strong><span>Approve reported {profileLift} 1RM for {selectedProfilePreset?.name ?? 'the configured competition lift'}. Confirm the test date above before approval.{pendingReportCount !== null && pendingReportCount > 0 && <> Review the pending reports above before approving a profile value.</>}</span></p><button type="button" className="button outline" disabled={busy || Boolean((api as Partial<BacklogRevisionApi>).getCoachMaxReportInboxV1 && (pendingReportCount === null || pendingReportCount > 0)) || !selectedProfilePreset || !maxDate || maxes.profile[`tested_1rm_${profileLift}`] === null} onClick={() => { const value = maxes.profile[`tested_1rm_${profileLift}`]; if (value !== null && selectedProfilePreset) void saveMax(selectedProfilePreset.exercise_id, value, maxes.profile.tested_1rm_unit, 'profile_approval') }}>Approve reported 1RM</button></div><form className="athlete-max-entry" onSubmit={event => { event.preventDefault(); if (maxExercise && Number(maxValue) > 0) void saveMax(maxExercise, Number(maxValue), profile?.preferred_weight_unit ?? 'lb', 'coach_entry') }}><h4>Set a coach-approved max</h4><label>Exercise<select required value={maxExercise} onChange={event => setMaxExercise(event.target.value)}><option value="">Choose exercise</option>{maxes.basis_options.filter(option => !option.archived_at).map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}</select></label><label>Max type<select value={maxType} onChange={event => setMaxType(event.target.value as 'tested_1rm' | 'training_max')}><option value="tested_1rm">Tested 1RM</option><option value="training_max">Training max</option></select></label><label>Weight ({profile?.preferred_weight_unit ?? 'lb'})<input required type="number" min="0.001" max="3000" step="0.001" value={maxValue} onChange={event => setMaxValue(event.target.value)} /></label><button className="button primary" disabled={busy || !maxDate}>Save approved max</button></form></>}</section>}
    {tab === 'tracking' && <section className="athlete-profile-section"><h3>Tracked lifts</h3><p>Competition lifts are always tracked. Coach-required lifts are locked in the athlete app; athletes can add other lifts themselves.</p>{trackingError && <div role="alert"><p>{trackingError}</p><button type="button" className="button outline" onClick={() => void reloadTracking()}>Retry</button></div>}{!api.getAthleteTrackingV1 ? <p>Tracking settings are unavailable in this workspace version.</p> : !tracking && !trackingError ? <p role="status">Loading tracked lifts…</p> : tracking && <><div className="athlete-profile-subsection"><h4>Competition lift presets</h4><p>These three presets apply throughout this gym. Competition lifts are always tracked.</p>{(['squat', 'bench', 'deadlift'] as const).map(lift => { const current = tracking.system_required.find(item => item.lift === lift); return <div className="athlete-preset-row" key={lift}><label>{lift[0].toUpperCase() + lift.slice(1)}<select value={presetDraft[lift]} disabled={!canEditPresets || !api.setGymCompetitionExerciseV1 || busy} onChange={event => setPresetDraft(previous => ({ ...previous, [lift]: event.target.value }))}><option value="">No preset</option>{maxes?.basis_options.filter(option => !option.archived_at).map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}</select></label><span>Current: {current?.name ?? 'Not configured'}</span>{canEditPresets && <button type="button" className="button outline" disabled={busy || !presetDraft[lift] || presetDraft[lift] === current?.exercise_id} onClick={() => void savePreset(lift)}>Save preset</button>}</div> })}</div><div className="athlete-profile-subsection"><h4>Competition lifts · always tracked</h4>{tracking.system_required.length === 0 ? <p>No competition lifts configured.</p> : <ul>{tracking.system_required.map(item => <li key={item.exercise_id}>{item.name} · System required</li>)}</ul>}</div><div className="athlete-profile-subsection"><h4>Coach-required lifts</h4>{tracking.coach_required.length === 0 ? <p>No additional lifts required by the coach.</p> : <ul>{tracking.coach_required.map(item => <li key={item.exercise_id}>{item.name} <button type="button" className="text-button" disabled={busy} onClick={() => void setRequired(item.exercise_id, false)}>Remove coach requirement</button></li>)}</ul>}</div><div className="athlete-profile-subsection"><h4>Athlete-added lifts</h4>{tracking.athlete_added.length === 0 ? <p>No athlete-added lifts.</p> : <ul>{tracking.athlete_added.map(item => <li key={item.exercise_id}>{item.name} · Athlete can remove</li>)}</ul>}</div><div className="athlete-track-add"><label>Require another lift<select value={trackExercise} onChange={event => setTrackExercise(event.target.value)}><option value="">Choose exercise</option>{maxes?.basis_options.filter(option => !option.archived_at && !tracking.coach_required.some(item => item.exercise_id === option.exercise_id) && !tracking.system_required.some(item => item.exercise_id === option.exercise_id)).map(item => <option key={item.exercise_id} value={item.exercise_id}>{item.name}</option>)}</select></label><button type="button" className="button primary" disabled={busy || !trackExercise} onClick={() => { void setRequired(trackExercise, true); setTrackExercise('') }}>Require lift</button></div></>}</section>}
  </div><div className="dialog-actions">{tab === 'report' && assignments?.items.find(item => item.assignment_status === 'active') && api.completeCoachAssignmentCycleV1 && <><button type="button" className="button outline" disabled={cycleClosing} onClick={() => { const active = assignments.items.find(item => item.assignment_status === 'active'); if (active) void closeCycleFor(active.assignment_id) }}>{cycleClosing ? 'Closing cycle…' : 'Close finished cycle'}</button>{cycleError && <p role="alert">{cycleError}</p>}</>}<button type="button" className="button quiet" onClick={onClose}>Close</button></div></div></div>
}
const pairingStateLabel: Record<AthleteConnectionStatus['state'], string> = {
  not_connected: 'Not connected', invite_ready: 'Connection link ready', paired: 'Phone connected', waiting_for_download: 'Waiting for workouts to download',
  partially_downloaded: 'Some workouts downloaded', downloaded: 'Workouts downloaded', opened: 'Workouts opened', expired: 'Connection link expired', revoked: 'Connection removed',
}

export function AthletePairingDialog({ api, athleteId, athleteName, onClose }: { api: PwaPairingCoachApi; athleteId: string; athleteName: string; onClose(): void }) {
  const [status, setStatus] = useState<AthleteConnectionStatus | null>(null)
  const [invite, setInvite] = useState<{ url: string; expiresAt: string; qr: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const load = async () => { setMessage(null); try { setStatus(await api.getAthleteConnectionStatus(athleteId)); return true } catch { setMessage('Connection status is unavailable. Try again.'); return false } }
  useEffect(() => { void load() }, [athleteId])
  const mutate = async (action: 'issue' | 'revoke-invite' | 'revoke-device') => {
    const replacing = action === 'issue' && !!status && ['paired', 'waiting_for_download', 'partially_downloaded', 'downloaded', 'opened'].includes(status.state)
    const confirmed = action === 'issue'
      ? !replacing || window.confirm(`Create a link for ${athleteName}'s new phone? Connecting with this link disconnects the previous phone. Send it only to ${athleteName}.`)
      : window.confirm(action === 'revoke-invite' ? `Cancel ${athleteName}'s unused connection link?` : `Disconnect ${athleteName}'s current phone?`)
    if (!confirmed) return
    setBusy(true); setMessage(null); setNotice(false)
    try {
      if (action === 'issue') {
        const replacement = !!status && ['paired', 'waiting_for_download', 'partially_downloaded', 'downloaded', 'opened'].includes(status.state)
        const result = await api.issueAthleteInvite(athleteId, replacement)
        const qr = await QRCode.toDataURL(result.invite_url, { errorCorrectionLevel: 'M', margin: 2, width: 320 })
        setInvite({ url: result.invite_url, expiresAt: result.expires_at, qr })
      } else if (action === 'revoke-invite') { await api.revokeAthleteInvite(athleteId); setInvite(null) }
      else await api.revokeAthleteDevice(athleteId)
      const refreshed = await load()
      if (action === 'revoke-invite' && refreshed) { setNotice(true); setMessage('Connection link cancelled.') }
    } catch (cause) {
      const code = cause instanceof PwaPairingApiError ? cause.code : 'request_rejected'
      setMessage(code === 'replacement_required' ? 'Use Replace device for an already paired athlete.' : code === 'serialization_retry' ? 'The connection changed. Try again.' : 'The connection action could not be completed.')
    } finally { setBusy(false) }
  }
  const copy = async () => {
    if (!invite) return
    try { if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable'); await navigator.clipboard.writeText(invite.url); setNotice(true); setMessage('Invite link copied.') }
    catch { input.current?.focus(); input.current?.select(); setNotice(false); setMessage('Select and copy the link below.') }
  }
  const copySetupMessage = async () => {
    if (!invite) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable')
      await navigator.clipboard.writeText(athleteSetupMessage(athleteName))
      setNotice(true); setMessage('Setup message copied. Send it first, then send the invitation link separately.')
    } catch { setNotice(false); setMessage('Could not copy the setup message. Try again using a browser that allows clipboard access.') }
  }
  const share = async () => {
    if (!invite) return
    if (!navigator.share) { await copy(); return }
    try { await navigator.share({ title: `UNRACK invite for ${athleteName}`, text: 'Open this link after installing the UNRACK athlete app.', url: invite.url }) }
    catch (cause) { if ((cause as DOMException)?.name !== 'AbortError') await copy() }
  }
  const activeDevice = !!status && ['paired', 'waiting_for_download', 'partially_downloaded', 'downloaded', 'opened'].includes(status.state)
  return <Modal label={`Connect ${athleteName}'s app`} busy={busy} onClose={onClose}><div className="phase9-pairing-dialog"><p className="eyebrow">ATHLETE APP</p><h2>Connect {athleteName}</h2>
    <p className="phase9-pairing-risk">Send this link only to {athleteName}. Anyone with the link can access their published program and workout history. It works once and expires after 48 hours. Connecting a new phone disconnects their previous phone.</p>
    {!status ? <p role="status">Loading connection status…</p> : <><p className="phase9-pairing-status"><strong>{pairingStateLabel[status.state]}</strong>{status.expected_receipts > 0 && <span>{status.acknowledged_receipts} of {status.expected_receipts} workouts downloaded · {status.opened_receipts} of {status.expected_receipts} opened</span>}</p>
      {status.invite_expires_at && status.invite_active && <p>Connection link expires {new Date(status.invite_expires_at).toLocaleString()}.</p>}</>}
    {invite && <section className="phase9-invite-once" aria-label="One-time invite"><p><strong>Copy or share this now.</strong> This link will not be shown again.</p><img src={invite.qr} alt="QR code for athlete invitation" /><label>Invitation link<input ref={input} readOnly value={invite.url} onFocus={event => event.currentTarget.select()} /></label><small>Expires {new Date(invite.expiresAt).toLocaleString()}.</small><p>Send the setup message first, then send the invitation link in a separate message.</p><div className="dialog-actions"><button className="button outline" disabled={busy} onClick={() => void copySetupMessage()}>Copy setup message</button><button className="button outline" disabled={busy} onClick={() => void copy()}>Copy link</button><button className="button primary" onClick={() => void share()}>Share</button></div></section>}
    {message && <p role="status" className={notice ? 'workspace-notice' : 'workspace-error'}>{message}</p>}
    <div className="dialog-actions">{status?.invite_active && <button className="button outline" disabled={busy} onClick={() => void mutate('revoke-invite')}>Cancel connection link</button>}{activeDevice && <button className="button outline" disabled={busy} onClick={() => void mutate('revoke-device')}>Disconnect phone</button>}<button className="button primary" disabled={busy || !status} onClick={() => void mutate('issue')}>{busy ? 'Working…' : activeDevice ? 'Connect new phone' : 'Create connection link'}</button><button className="button outline" disabled={busy} onClick={onClose}>Done</button></div>
  </div></Modal>
}

function OverviewActivityDialog({api,gym,activityId,onClose}:{api:Phase9ActivityApi;gym:string;activityId:string;onClose():void}){
  const [detail,setDetail]=useState<CoachWorkoutActivityDetailV1|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0)
  useEffect(()=>{let active=true;setError(false);setDetail(null);void api.getCoachWorkoutActivityDetailV1!({gym,activity_id:activityId}).then(value=>{if(active)setDetail(value)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[api,gym,activityId,retry])
  return <Modal label="Workout activity details" busy={false} onClose={onClose}><div className="phase9-activity-detail"><div className="phase9-activity-detail-head"><h2>Workout details</h2><button className="button outline" onClick={onClose}>Close</button></div>{error?<div role="alert"><p>Workout details could not be loaded.</p><button className="button outline" onClick={()=>setRetry(value=>value+1)}>Retry</button></div>:detail?<ActivityDetailContent detail={detail}/>:<p role="status">Loading workout details…</p>}</div></Modal>
}

function RecentActivityPanel({ api, gym }: { api: Phase9ActivityApi | null; gym: string | null }) {
  const [page, setPage] = useState<CoachRecentActivityPageV1 | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<{ gym: string; activityId: string } | null>(null)
  const [detail, setDetail] = useState<CoachWorkoutActivityDetailV1 | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)
  const [detailRetry, setDetailRetry] = useState(0)
  useEffect(() => {
    if (!api || !gym) { setPage(null); setLoading(false); setError(false); return }
    let cancelled = false
    setPage(null); setLoading(true); setError(false)
    void api.getCoachRecentActivityPageV1({ gym, cursor: null, page_size: 5 }).then(result => {
      if (!cancelled) setPage(result)
    }).catch(() => { if (!cancelled) setError(true) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [api, gym, retry])
  useEffect(() => {
    setSelected(null); setDetail(null); setDetailError(false); setDetailLoading(false)
  }, [gym, api])
  useEffect(() => {
    if (!api?.getCoachWorkoutActivityDetailV1 || !gym || !selected || selected.gym !== gym) { setDetail(null); setDetailLoading(false); return }
    let cancelled = false
    setDetail(null); setDetailLoading(true); setDetailError(false)
    void api.getCoachWorkoutActivityDetailV1({ gym, activity_id: selected.activityId }).then(result => {
      if (!cancelled) setDetail(result)
    }).catch(() => { if (!cancelled) setDetailError(true) }).finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [api, gym, selected, detailRetry])
  return <aside className="phase9-activity" aria-label="Recent client activity"><div className="phase9-activity-heading"><p className="eyebrow">RECENT ACTIVITY</p><h2>Client activity</h2></div>
    {!api ? <p className="phase9-activity-state">Activity is temporarily unavailable.</p> : !gym || loading ? <p className="phase9-activity-state" role="status">Loading recent activity…</p> : error ? <div className="phase9-activity-state" role="status"><p>Recent activity could not be loaded.</p><button className="button outline" onClick={() => setRetry(value => value + 1)}>Retry</button></div> : !page?.items.length ? <p className="phase9-activity-state">No completed or skipped workouts yet.</p> : <div className="phase9-activity-list">{page.items.map(item => <button key={item.activity_id} type="button" className="phase9-activity-item" disabled={!api.getCoachWorkoutActivityDetailV1} onClick={() => setSelected({ gym, activityId: item.activity_id })} aria-label={`View ${item.roster_name} ${item.outcome} workout details for ${item.day_label}`}><span className={`phase9-activity-icon ${item.outcome}`} aria-hidden="true">{item.outcome === 'completed' ? '✓' : '–'}</span><span><strong>{item.roster_name}</strong><span className="phase9-activity-summary">{item.outcome === 'completed' ? 'Completed' : 'Skipped'} {item.day_label} · {item.program_name}</span><time dateTime={item.performed_at}>{new Date(item.performed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></span></button>)}</div>}
    {selected?.gym === gym && <Modal label="Workout activity details" busy={false} onClose={() => setSelected(null)}><div className="phase9-activity-detail"><div className="phase9-activity-detail-head"><div><p className="eyebrow">WORKOUT ACTIVITY</p><h2>{detail?.roster_name ?? 'Workout details'}</h2></div><button className="button outline" onClick={() => setSelected(null)}>Close</button></div>{detailLoading ? <p role="status">Loading workout details…</p> : detailError ? <div role="alert"><p>Workout details could not be loaded. Check your connection or access and try again.</p><button className="button outline" onClick={() => setDetailRetry(value => value + 1)}>Retry</button></div> : detail ? <ActivityDetailContent detail={detail} /> : null}</div></Modal>}
  </aside>
}

const activityTime = (value: string | null) => value === null ? 'Not recorded' : new Date(value).toLocaleString()
const activityValue = (value: number | null, unit = '') => value === null ? 'Not recorded' : `${value}${unit ? ` ${unit}` : ''}`
function plannedSetSummary(set: CoachActivityPlannedSetV1, defaultUnit: 'lb' | 'kg') {
  const sets = set.sets_mode === 'range' ? `${set.sets_min}–${set.sets_max}` : String(set.sets_min)
  const setLabel = set.sets_mode === 'exact' && set.sets_min === 1 ? 'set' : 'sets'
  const dose = set.dose_mode === 'reps' ? set.reps_mode === 'athlete_choice' ? 'athlete choice reps' : `${set.dose_min}${set.dose_max === null ? '' : `–${set.dose_max}`} reps`
    : set.dose_mode === 'amrap' ? 'AMRAP' : `${set.dose_min} ${set.dose_mode === 'distance' ? set.distance_unit : set.dose_mode === 'time' ? 'seconds' : 'steps'}`
  const load = set.load_mode === 'exact' ? `${set.exact_weight} ${set.unit_override ?? defaultUnit}`
    : set.load_mode === 'percent' ? `${set.percent}%${set.of_max_id ? ' of pinned max' : ''}${set.percent_basis_max_type ? ` · ${set.percent_basis_max_type.replaceAll('_', ' ')}` : ''}${set.resolved_max_effective_from === null ? '' : ` · max effective ${set.resolved_max_effective_from}`}${set.resolved_weight === null ? '' : ` · resolved ${set.resolved_weight} ${set.unit_override ?? defaultUnit}`}${set.manual_override === null ? '' : ` · manual override ${set.manual_override} ${set.unit_override ?? defaultUnit}`}`
      : set.load_mode === 'rpe' ? `RPE ${set.rpe_min}${set.rpe_max === null ? '' : `–${set.rpe_max}`}`
        : set.load_mode === 'qualitative' ? `Effort ${set.qualitative}` : set.load_mode
  return `${sets} ${setLabel} · ${dose} · ${load} · ${set.laterality.replaceAll('_', ' ')} · ${set.load_basis.replaceAll('_', ' ')}${set.rest_seconds === null ? '' : ` · ${set.rest_seconds}s rest`}`
}
function ActivityDetailContent({ detail }: { detail: CoachWorkoutActivityDetailV1 }) {
  const exercises = [...detail.planned.movement_groups.flatMap(group => group.exercises), ...detail.planned.ungrouped_exercises].sort((a, b) => a.ordinal - b.ordinal)
  const performed = new Map(detail.performed_exercises.map(exercise => [exercise.revision_exercise_row_id, exercise]))
  const movementGroups = new Map(detail.planned.movement_groups.flatMap(group => group.exercises.map(exercise => [exercise.revision_exercise_row_id, group] as const)))
  return <><p className="phase9-activity-outcome">{detail.outcome === 'completed' ? 'Completed' : 'Skipped'} · {detail.program_name} · {detail.planned.day.subtitle ?? detail.planned.day.label}</p>
    <div className="phase9-activity-facts"><div><strong>Performed</strong><time dateTime={detail.performed_at}>{activityTime(detail.performed_at)}</time></div><div><strong>Recorded by sync</strong><time dateTime={detail.recorded_at}>{activityTime(detail.recorded_at)}</time></div><div><strong>Current session state</strong><span>{detail.session.state.replaceAll('_', ' ')}</span></div><div><strong>Started</strong><span>{activityTime(detail.session.started_at)}</span></div><div><strong>{detail.outcome === 'completed' ? 'Completed at' : 'Skipped at'}</strong><span>{activityTime(detail.outcome === 'completed' ? detail.session.completed_at : detail.session.skipped_at)}</span></div></div>
    <section><h3>Session</h3><p><strong>Athlete note:</strong> {detail.session.athlete_note ?? 'Not recorded'}</p>{detail.outcome === 'skipped' && <p><strong>Skip reason:</strong> {detail.session.skip_reason ?? 'Not recorded'}</p>}{detail.planned.day.workout_instruction && <p><strong>Coach instruction:</strong> {detail.planned.day.workout_instruction}</p>}</section>
    <section><h3>Delivery and sync</h3><div className="phase9-activity-facts"><div><strong>Downloaded</strong><span>{activityTime(detail.delivery.acknowledged_at)}</span></div><div><strong>Opened</strong><span>{activityTime(detail.delivery.opened_at)}</span></div><div><strong>Receipt consumed</strong><span>{activityTime(detail.delivery.consumed_at)}</span></div><div><strong>Last session update</strong><span>{activityTime(detail.session.updated_at)}</span></div></div></section>
    <section><h3>Planned and performed</h3>{exercises.length === 0 ? <p>No exercises were prescribed.</p> : exercises.map(exercise => { const log = performed.get(exercise.revision_exercise_row_id); const movementGroup = movementGroups.get(exercise.revision_exercise_row_id); return <article className="phase9-activity-exercise" key={exercise.revision_exercise_row_id}><h4>{exercise.exercise_name}</h4>{movementGroup && <p><strong>Movement group:</strong> {movementGroup.title ?? movementGroup.group_type} · {movementGroup.group_type}{movementGroup.rounds_min === null ? '' : ` · ${movementGroup.rounds_min}${movementGroup.rounds_max === null ? '' : `–${movementGroup.rounds_max}`} rounds`}</p>}{exercise.protocol && <p><strong>Protocol:</strong> {exercise.protocol}</p>}{exercise.exercise_instruction && <p><strong>Coach instruction:</strong> {exercise.exercise_instruction}</p>}{exercise.movement_note && <p><strong>Coach note:</strong> {exercise.movement_note}</p>}<p><strong>Athlete note:</strong> {log?.athlete_note ?? 'Not recorded'}</p>{log && <p><strong>Exercise sync:</strong> {activityTime(log.updated_at)}</p>}{exercise.set_groups.map(group => { const logs = log?.sets.filter(set => set.revision_set_group_id === group.revision_set_group_id).sort((a, b) => a.set_number - b.set_number) ?? []; return <div className="phase9-activity-set-group" key={group.revision_set_group_id}><p><strong>Planned:</strong> {plannedSetSummary(group, detail.planned.revision.default_unit)}</p>{group.note && <p><strong>Coach set note:</strong> {group.note}</p>}{logs.length === 0 ? <p>No set facts recorded.</p> : <ol>{logs.map(set => <li key={set.id}><strong>Set {set.set_number}: {set.completed ? 'Completed' : 'Incomplete'}</strong><span>Reps {activityValue(set.actual_reps)} · Time {activityValue(set.actual_seconds, 's')} · Steps {activityValue(set.actual_steps)} · Distance {activityValue(set.actual_distance, set.actual_distance_unit ?? '')} · Weight {activityValue(set.actual_weight, set.actual_weight_unit ?? '')} · RPE {activityValue(set.actual_rpe)}</span>{set.athlete_note && <span><strong>Athlete set note:</strong> {set.athlete_note}</span>}<time dateTime={set.device_updated_at}>Device update: {activityTime(set.device_updated_at)}</time><time dateTime={set.updated_at}>Synced update: {activityTime(set.updated_at)}</time></li>)}</ol>}</div>})}</article> })}</section>
  </>
}

function ProgramArchiveDialog({ action, programName, busy, onConfirm, onClose }: { action: 'archive' | 'restore'; programName: string; busy: boolean; onConfirm(): void; onClose(): void }) {
  const titleId = useId()
  const descriptionId = useId()
  const cancel = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancel.current?.focus()
    return () => opener.current?.focus()
  }, [])
  const archiving = action === 'archive'
  return <div className="modal-backdrop" role="presentation" onKeyDown={event => { if (event.key === 'Escape' && !busy) onClose(); else trapDialogTab(event) }}>
    <section className="dialog phase6-archive-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <h2 id={titleId}>{archiving ? 'Archive program?' : 'Restore program?'}</h2>
      <p id={descriptionId}>{archiving ? <><strong>{programName}</strong> will move out of Working programs. Its saved workouts and athlete history will remain, and you can restore it later.</> : <><strong>{programName}</strong> will return to Working programs in its exact previous state.</>}</p>
      <div className="dialog-actions"><button ref={cancel} className="button outline" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy} onClick={onConfirm}>{busy ? (archiving ? 'Archiving…' : 'Restoring…') : (archiving ? 'Archive program' : 'Restore program')}</button></div>
    </section>
  </div>
}
type WorkoutTemplateSelection = {
  detail: Awaited<ReturnType<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateDetailV1']>> | Awaited<ReturnType<NonNullable<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateDetailV2']>>>
  day: Awaited<ReturnType<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateDayV1']>> | Awaited<ReturnType<NonNullable<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateDayV2']>>> | WorkoutTemplateDayV3Ui
  // A newly-created template is intentionally unsupported until its first
  // exercise is saved, so its day read correctly returns null. The create RPC
  // supplies this authoritative token for first-time authoring.
  dayIdentityToken: string | null
}
type WorkoutTemplateDayV3Ui = Omit<Awaited<ReturnType<NonNullable<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateDayV2']>>>, 'contract_version'> & { contract_version: 3; exercise_options: RichExerciseOptionUi[] }
type RichWorkoutTrackingApiUi = {
  getCoachWorkoutTemplateDayV3(input: Parameters<NonNullable<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateDayV2']>>[0]): Promise<WorkoutTemplateDayV3Ui>
  saveCoachWorkoutTemplateDayV3(input: Parameters<NonNullable<Phase55WorkoutTemplateLibraryApi['saveCoachWorkoutTemplateDayV2']>>[0]): Promise<unknown>
}
const richWorkoutTemplateAvailable = (api: Phase55WorkoutTemplateLibraryApi) => Boolean(api.getCoachWorkoutTemplateLibraryPageV2 && api.getCoachWorkoutTemplateDetailV2 && api.getCoachWorkoutTemplateDayV2 && api.saveCoachWorkoutTemplateDayV2 && api.setCoachWorkoutTemplateReadinessV2 && api.applyCoachWorkoutTemplateV2)

function blankWorkoutTemplateDay(identity_token: string): SaveCoachProgramDayV3 {
  return { identity_token, ordinal: 1, label: 'Workout', subtitle: null, marked_rest: false, workout_instruction: null, exercises: [] }
}

function WorkoutTemplateLibrary({ api, gym, onClose, onUnavailable }: { api: Phase55WorkoutTemplateLibraryApi; gym: string | null; onClose(): void; onUnavailable(): void }) {
  const [lifecycle, setLifecycle] = useState<'active' | 'historical'>('active')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<Awaited<ReturnType<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateLibraryPageV1']>> | Awaited<ReturnType<NonNullable<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateLibraryPageV2']>>> | null>(null)
  const [selected, setSelected] = useState<WorkoutTemplateSelection | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestGeneration = useRef(0)
  const queryTimer = useRef<number | null>(null)
  const firstLoad = useRef(true)
  const unavailable = (cause: unknown) => cause instanceof CoachApiError && cause.code === 'request_rejected' && cause.status === 404
  const stale = (cause: unknown) => cause instanceof CoachApiError && cause.code === 'workout_template_stale'
  const load = async (more = false, retry = true, inheritedGeneration: number | null = null) => {
    if (!gym) return
    const generation = inheritedGeneration ?? ++requestGeneration.current
    const requestGym = gym, requestLifecycle = lifecycle, requestQuery = query
    const prior = more ? page : null
    if (more && !prior) return
    setBusy(true); setError(null)
    try {
      const input = { gym: requestGym, lifecycle: requestLifecycle, search_text: requestQuery || null, cursor: prior?.next_cursor ?? null, page_size: 20, expected_read_token: prior?.next_read_token ?? null }
      const result = richWorkoutTemplateAvailable(api) ? await api.getCoachWorkoutTemplateLibraryPageV2!(input) : await api.getCoachWorkoutTemplateLibraryPageV1(input)
      if (generation !== requestGeneration.current || gym !== requestGym || lifecycle !== requestLifecycle || query !== requestQuery) return
      setPage(current => more && current && current.contract_version === result.contract_version ? { ...result, items: [...current.items, ...result.items] } as typeof result : result)
    } catch (cause) { if (generation !== requestGeneration.current) return; if (unavailable(cause)) onUnavailable(); else if (stale(cause) && retry) { setPage(null); await load(false, false, generation) } else setError(errorText(cause)) } finally { if (generation === requestGeneration.current) setBusy(false) }
  }
  useEffect(() => {
    setPage(null); setSelected(null); setError(null)
    if (firstLoad.current) { firstLoad.current = false; void load(false); return }
    setBusy(true)
    queryTimer.current = window.setTimeout(() => { queryTimer.current = null; void load(false) }, 250)
    return () => { if (queryTimer.current !== null) { window.clearTimeout(queryTimer.current); queryTimer.current = null } }
  }, [gym, lifecycle, query])
  const changeQuery = (value: string) => { const next = boundedTemplateSearch(value); if (next === query) return; requestGeneration.current += 1; setPage(null); setSelected(null); setError(null); setBusy(true); setQuery(next) }
  const open = async (template: string, dayIdentityToken: string | null = null, retry = true, inheritedGeneration: number | null = null): Promise<void> => {
    const generation = inheritedGeneration ?? ++requestGeneration.current
    setBusy(true); setError(null)
    try { const [detail, day] = await Promise.all([richWorkoutTemplateAvailable(api) ? api.getCoachWorkoutTemplateDetailV2!({ template, expected_read_token: null }) : api.getCoachWorkoutTemplateDetailV1({ template, expected_read_token: null }), richWorkoutTemplateAvailable(api) && (api as Phase55WorkoutTemplateLibraryApi & Partial<RichWorkoutTrackingApiUi>).getCoachWorkoutTemplateDayV3 && (api as Phase55WorkoutTemplateLibraryApi & Partial<RichWorkoutTrackingApiUi>).saveCoachWorkoutTemplateDayV3 ? (api as Phase55WorkoutTemplateLibraryApi & RichWorkoutTrackingApiUi).getCoachWorkoutTemplateDayV3({ template, expected_read_token: null }) : richWorkoutTemplateAvailable(api) ? api.getCoachWorkoutTemplateDayV2!({ template, expected_read_token: null }) : api.getCoachWorkoutTemplateDayV1({ template, expected_read_token: null })]); if (generation !== requestGeneration.current) return; if (detail.builder_version !== day.builder_version) throw new CoachApiError('workout_template_stale', 409); setSelected({ detail, day, dayIdentityToken: day.day?.identity_token ?? dayIdentityToken }) }
    catch (cause) { if (generation !== requestGeneration.current) return; if (unavailable(cause)) onUnavailable(); else if (stale(cause) && retry) await open(template, dayIdentityToken, false, generation); else setError(errorText(cause)) } finally { if (generation === requestGeneration.current) setBusy(false) }
  }
  const create = async (event: FormEvent) => {
    event.preventDefault(); if (!gym || !name.trim()) return
    const generation = ++requestGeneration.current
    setBusy(true); setError(null)
    try { const created = await api.createCoachWorkoutTemplateV1({ gym, template_name: name.trim() }); if (generation !== requestGeneration.current) return; setName(''); await open(created.template_id, created.day_identity_token, true, generation); await load(false, true, generation) }
    catch (cause) { if (generation !== requestGeneration.current) return; if (unavailable(cause)) onUnavailable(); else setError(errorText(cause)) } finally { if (generation === requestGeneration.current) setBusy(false) }
  }
  if (!gym) return <section className="phase55-plans"><p role="status">Select a gym to manage workout templates.</p></section>
  return <section className="phase55-template-library" aria-label="Workout template library"><button className="text-button" onClick={onClose}>Back to clients</button>{error && <p className="workspace-error" role="alert">{error}</p>}<div className="template-library-toolbar"><form onSubmit={create}><label>New workout template<input placeholder="e.g. Full body strength" value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label><button className="button primary" disabled={busy || !name.trim()}>Create template</button></form><label>Search workout templates<input maxLength={160} value={query} onChange={event => changeQuery(event.target.value)} /></label><label>Library view<select value={lifecycle} disabled={busy} onChange={event => { requestGeneration.current += 1; setLifecycle(event.target.value as 'active' | 'historical') }}><option value="active">Active templates</option><option value="historical">Archived templates</option></select></label></div><p role="status" aria-live="polite">{busy ? 'Loading workout templates…' : `${page?.items.length ?? 0} workout templates loaded.`}</p><div className="template-library-grid"><section>{page?.items.map(item => <button key={item.template_id} disabled={busy} className="phase55-client" onClick={() => void open(item.template_id)}><strong>{item.name}</strong><small>{item.readiness === 'ready' ? 'Ready' : 'Draft'} · {('rich_supported' in item ? item.rich_supported : item.supported) ? 'Supported' : 'Needs review'}</small></button>)}{page?.has_more && <button disabled={busy} onClick={() => void load(true)}>Load more templates</button>}</section>{selected && <WorkoutTemplateEditor api={api} selected={selected} busy={busy} setBusy={setBusy} setError={setError} beginMutation={() => ++requestGeneration.current} isCurrent={generation => generation === requestGeneration.current} onReload={async generation => { if (generation !== requestGeneration.current) return; await open(selected.detail.template_id, selected.dayIdentityToken, true, generation); if (generation === requestGeneration.current) await load(false, true, generation) }} onUnavailable={onUnavailable} />}</div></section>
}

function WorkoutTemplateEditor({ api, selected, busy, setBusy, setError, beginMutation, isCurrent, onReload, onUnavailable }: { api: Phase55WorkoutTemplateLibraryApi; selected: WorkoutTemplateSelection; busy: boolean; setBusy(value: boolean): void; setError(value: string | null): void; beginMutation(): number; isCurrent(generation: number): boolean; onReload(generation: number): Promise<void>; onUnavailable(): void }) {
  const { detail, day } = selected
  const ensureExerciseApi = api as Phase55WorkoutTemplateLibraryApi & Partial<EnsureCoachExerciseApiUi>
  const unavailable = (cause: unknown) => cause instanceof CoachApiError && cause.code === 'request_rejected' && cause.status === 404
  const mutate = async (operation: () => Promise<unknown>) => { const generation = beginMutation(); setBusy(true); setError(null); try { await operation(); if (!isCurrent(generation)) return; await onReload(generation) } catch (cause) { if (!isCurrent(generation)) return; if (unavailable(cause)) onUnavailable(); else setError(errorText(cause)) } finally { if (isCurrent(generation)) setBusy(false) } }
  const authoringDay = day.day ?? (selected.dayIdentityToken ? blankWorkoutTemplateDay(selected.dayIdentityToken) : null)
  const trackingApi = api as Phase55WorkoutTemplateLibraryApi & Partial<RichWorkoutTrackingApiUi>
  const rich = (day.contract_version === 2 && api.saveCoachWorkoutTemplateDayV2) || (day.contract_version === 3 && trackingApi.saveCoachWorkoutTemplateDayV3)
  return <section className="phase55-template-editor" aria-label="Workout template editor"><h2>{detail.name}</h2><p>{detail.archived_at ? 'Archived — read only' : detail.readiness === 'ready' ? 'Ready to add to an empty day' : ('rich_supported' in detail ? detail.rich_supported : detail.supported) ? 'Draft — readiness check required' : 'Draft — add the first exercise to make this workout template supported'}</p>{!detail.archived_at && rich && day.day && <ApprovedWorkoutEditor buildPayload={(draft, original) => richDaySavePayload(draft, original, true)} plateIncrement={detail.plate_increment} key={`${detail.template_id}:${detail.builder_version}:${day.day.identity_token}`} day={day.day as RichTemplateDay} template percentBasisOptions={day.contract_version === 2 || day.contract_version === 3 ? day.percent_basis_options : []} exerciseOptions={day.contract_version === 3 ? day.exercise_options : []} trackingSupported={day.contract_version === 3} onEnsureExercise={ensureExerciseApi.ensureCoachExerciseV1 ? name => ensureExerciseApi.ensureCoachExerciseV1!({ target_gym: detail.gym_id, exercise_name: name }) : undefined} defaultUnit={detail.default_unit} disabled={busy} onSave={async draft => { const generation = beginMutation(); setBusy(true); try { const input = { template: detail.template_id, expected_builder_version: detail.builder_version, day: draft as RichTemplateDaySave }; if (day.contract_version === 3 && trackingApi.saveCoachWorkoutTemplateDayV3) await trackingApi.saveCoachWorkoutTemplateDayV3(input); else await api.saveCoachWorkoutTemplateDayV2!(input); if (!isCurrent(generation)) return; await onReload(generation) } catch (cause) { if (!isCurrent(generation)) return; if (unavailable(cause)) onUnavailable(); else setError(errorText(cause)); throw cause } finally { if (isCurrent(generation)) setBusy(false) } }} />}{!detail.archived_at && !rich && authoringDay && <WorkoutTemplateDayEditor key={`${detail.template_id}:${detail.builder_version}:${authoringDay.identity_token}`} day={authoringDay as SaveCoachProgramDayV3} defaultUnit={detail.default_unit} busy={busy} onSave={async draft => { const generation = beginMutation(); setBusy(true); try { await api.saveCoachWorkoutTemplateDayV1({ template: detail.template_id, expected_builder_version: detail.builder_version, day: draft }); if (!isCurrent(generation)) return; await onReload(generation) } catch (cause) { if (!isCurrent(generation)) return; if (unavailable(cause)) onUnavailable(); else setError(errorText(cause)); throw cause } finally { if (isCurrent(generation)) setBusy(false) } }} />}{!detail.archived_at && !authoringDay && <p role="status">The new workout template is still loading. Retry from the library if this persists.</p>}{!detail.archived_at && <div className="dialog-actions"><button className="button outline" disabled={busy || !(rich ? 'rich_supported' in detail && detail.rich_supported : detail.supported)} onClick={() => void mutate(() => rich ? api.setCoachWorkoutTemplateReadinessV2!({ template: detail.template_id, expected_builder_version: detail.builder_version, target_readiness: detail.readiness === 'ready' ? 'draft' : 'ready' }) : api.setCoachWorkoutTemplateReadinessV1({ template: detail.template_id, expected_builder_version: detail.builder_version, target_readiness: detail.readiness === 'ready' ? 'draft' : 'ready' }))}>{detail.readiness === 'ready' ? 'Mark draft' : 'Mark ready'}</button><button className="button outline" disabled={busy} onClick={() => void mutate(() => api.archiveCoachWorkoutTemplateV1({ template: detail.template_id, expected_builder_version: detail.builder_version }))}>Archive template</button></div>}{detail.archived_at && <button className="button outline" disabled={busy} onClick={() => void mutate(() => api.restoreCoachWorkoutTemplateV1({ template: detail.template_id, expected_builder_version: detail.builder_version }))}>Restore template</button>}</section>
}

type RichAnyDay = RichProgramDay | RichTemplateDay
type RichAnyGroup = RichProgramGroup | RichTemplateGroup
type RichAnyExercise = RichProgramExercise | RichTemplateExercise
type RichAnySet = RichProgramSet | RichTemplateSet
const richNodeId = (node: RichAnyGroup | RichAnyExercise | RichAnySet): string | null => 'identity_token' in node ? node.identity_token : node.id
const richSaveKey = (template: boolean) => template ? 'id' : 'identity_token'
const richSame = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

/** Authoritative read metadata never crosses the save boundary. Unchanged nodes use preserve markers. */
export function richDaySavePayload(day: RichAnyDay, original: RichAnyDay, template: boolean): RichProgramDaySave | RichTemplateDaySave {
  const key = richSaveKey(template)
  const find = <T extends RichAnyGroup | RichAnyExercise | RichAnySet>(items: T[], item: T): T | undefined => items.find(previous => richNodeId(previous) !== null && richNodeId(previous) === richNodeId(item))
  const originalExercises = [...original.movement_groups.flatMap(group => group.exercises as RichAnyExercise[]), ...original.ungrouped_exercises as RichAnyExercise[]]
  const saveSet = (row: RichAnySet, previous?: RichAnySet) => {
    const id = richNodeId(row)
    if (id && previous && richSame(row, previous)) return { mode: 'preserve', [key]: id, ordinal: row.ordinal }
    const { mode: _mode, identity_token: _identity, id: _id, of_max_id: _ofMax, resolved_weight: _resolvedWeight, resolved_max_effective_from: _resolvedFrom, resolved_at: _resolvedAt, manual_override: _manual, ...fields } = row as RichProgramSet & RichTemplateSet
    return { mode: 'replace', [key]: id, ...fields, ...(!template ? { manual_override: 'manual_override' in row ? row.manual_override : null } : {}) }
  }
  const saveExercise = (exercise: RichAnyExercise, previous?: RichAnyExercise) => {
    const id = richNodeId(exercise)
    if (id && previous && richSame(exercise, previous)) return { mode: 'preserve', [key]: id, ordinal: exercise.ordinal, group_ordinal: exercise.group_ordinal }
    const { mode: _mode, identity_token: _identity, id: _id, set_groups: _sets, ...fields } = exercise as RichProgramExercise & RichTemplateExercise
    return { mode: 'replace', [key]: id, ...fields, set_groups: exercise.set_groups.map(row => saveSet(row, previous && find(previous.set_groups as RichAnySet[], row))) }
  }
  const saveGroup = (group: RichAnyGroup, previous?: RichAnyGroup) => {
    const id = richNodeId(group)
    if (id && previous && richSame(group, previous)) return { mode: 'preserve', [key]: id, ordinal: group.ordinal }
    const { mode: _mode, identity_token: _identity, id: _id, exercises: _exercises, ...fields } = group as RichProgramGroup & RichTemplateGroup
    return { mode: 'replace', [key]: id, ...fields, exercises: group.exercises.map(exercise => saveExercise(exercise, find(originalExercises, exercise))) }
  }
  return {
    identity_token: day.identity_token, ordinal: day.ordinal, label: day.label, subtitle: day.subtitle,
    marked_rest: day.marked_rest, workout_instruction: day.workout_instruction,
    movement_groups: day.movement_groups.map(group => saveGroup(group, find(original.movement_groups as RichAnyGroup[], group))),
    ungrouped_exercises: day.ungrouped_exercises.map(exercise => saveExercise(exercise, find(originalExercises, exercise))),
  } as RichProgramDaySave | RichTemplateDaySave
}

type RichExerciseOptionUi = ExerciseOptionV1
type EnsureCoachExerciseApiUi = { ensureCoachExerciseV1(input: { target_gym: string; exercise_name: string }): Promise<RichExerciseOptionUi> }
type RichAssignmentTrackingApiUi = {
  getCoachAssignmentDayV7(input: Parameters<NonNullable<Phase5CorrectionApi['getCoachAssignmentDayV6']>>[0]): Promise<Omit<CoachAssignmentDayV6, 'contract_version'> & { contract_version: 7; exercise_options: RichExerciseOptionUi[] }>
  saveCoachProgramDayV5(input: { program: string; assignment: string; expected_builder_version: number; week_identity_token: string; day: RichProgramDaySave }): Promise<unknown>
}
type PercentPreviewUi = ProgramPercentPreviewV1
type PercentRecalculationApiUi = Pick<PercentageProgrammingApi, 'previewProgramPercentV1' | 'applyProgramPercentV1' | 'getCoachAthleteCalendarV1'>
function RichDayEditor({ day, template, percentBasisOptions, exerciseOptions = [], trackingSupported = false, onEnsureExercise, onSetExerciseTracking, defaultUnit, disabled, onDirtyChange, registerSave, onSave }: { day: RichAnyDay; template: boolean; percentBasisOptions: RichPercentBasisOption[]; exerciseOptions?: RichExerciseOptionUi[]; trackingSupported?: boolean; onEnsureExercise?(name: string): Promise<RichExerciseOptionUi>; onSetExerciseTracking?(exerciseId: string, tracked: boolean): Promise<void>; defaultUnit: 'lb' | 'kg'; disabled: boolean; onDirtyChange?(dirty: boolean): void; registerSave?(save: () => Promise<boolean>): void; onSave(day: RichProgramDaySave | RichTemplateDaySave): Promise<void> }) {
  const newSet = (): any => ({ mode: 'replace', [richSaveKey(template)]: null, ordinal: 1, sets_mode: 'exact', sets_min: 1, sets_max: null, dose_mode: 'reps', reps_mode: 'exact', dose_min: 8, dose_max: null, distance_unit: null, laterality: 'bilateral', load_mode: 'exact', load_basis: 'total', exact_weight: 0, percent: null, percent_basis_exercise_id: null, percent_basis_max_type: null, rpe_min: null, rpe_max: null, qualitative: null, unit_override: 'lb', rest_seconds: null, note: null, ...(!template ? { manual_override: null, of_max_id: null, resolved_weight: null, resolved_max_effective_from: null, resolved_at: null } : {}) })
  const newExercise = (): any => ({ mode: 'replace', [richSaveKey(template)]: null, ordinal: 1, group_ordinal: null, status: 'programmed', name: '', instruction: null, note: null, protocol: null, ...(trackingSupported ? { exercise_id: null, track_in_metrics: false } : {}), set_groups: [newSet()] })
  const seedEmptyTrainingDay = (source: RichAnyDay): RichAnyDay => {
    if (source.marked_rest || source.movement_groups.length > 0 || source.ungrouped_exercises.length > 0) return source
    const seeded: any = structuredClone(source)
    seeded.ungrouped_exercises.push(newExercise())
    return seeded
  }
  const [draft, setDraft] = useState<RichAnyDay>(() => seedEmptyTrainingDay(day))
  const [localError, setLocalError] = useState<string | null>(null)
  const [addedOptions, setAddedOptions] = useState<RichExerciseOptionUi[]>([])
  const [trackingOverrides, setTrackingOverrides] = useState<Record<string, boolean>>({})
  const [libraryBusy, setLibraryBusy] = useState(false)
  const availableExercises = [...exerciseOptions, ...addedOptions.filter(option => !exerciseOptions.some(existing => existing.exercise_id === option.exercise_id))]
  const dirty = !richSame(seedEmptyTrainingDay(day), draft)
  useEffect(() => { setDraft(seedEmptyTrainingDay(day)); setLocalError(null); setAddedOptions([]); setTrackingOverrides({}) }, [day])
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  const mutate = (change: (next: any) => void) => setDraft(current => { const next = structuredClone(current); change(next); return next })
  const normalize = (next: any) => {
    let exerciseOrdinal = 0
    next.movement_groups.forEach((group: any, groupIndex: number) => { group.ordinal = groupIndex + 1; group.exercises.forEach((exercise: any, index: number) => { exercise.ordinal = ++exerciseOrdinal; exercise.group_ordinal = index + 1; exercise.set_groups.forEach((row: any, setIndex: number) => { row.ordinal = setIndex + 1 }) }) })
    next.ungrouped_exercises.forEach((exercise: any) => { exercise.ordinal = ++exerciseOrdinal; exercise.group_ordinal = null; exercise.set_groups.forEach((row: any, index: number) => { row.ordinal = index + 1 }) })
  }
  const groups = draft.movement_groups as RichAnyGroup[]
  const ungrouped = draft.ungrouped_exercises as RichAnyExercise[]
  const allExercises = [...groups.flatMap(group => group.exercises as RichAnyExercise[]), ...ungrouped] as RichAnyExercise[]
  const supersetErrors = groups.flatMap((group, index) => {
    const issue = group.group_type === 'superset' ? supersetIssue(group.exercises) : null
    return issue ? [`Superset ${index + 1}: ${supersetIssueMessage(issue)}`] : []
  })
  const validText = (value: string | null, limit: number, required = false) => value === null ? !required : Boolean(value.trim()) && [...value].length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
  const validNumber = (value: number | null, min: number, max: number, places = 0) => value !== null && Number.isFinite(value) && value >= min && value <= max && (places === 0 ? Number.isInteger(value) : Number.isInteger(Math.round(value * 10 ** places)) && Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) < 1e-6)
  const validOptional = (value: number | null, min: number, max: number, places = 0) => value === null || validNumber(value, min, max, places)
  const validSet = (row: RichAnySet) => {
    const originalSets = [...day.movement_groups.flatMap(group => group.exercises.flatMap(exercise => exercise.set_groups as RichAnySet[])), ...day.ungrouped_exercises.flatMap(exercise => exercise.set_groups as RichAnySet[])] as RichAnySet[]
    if (richNodeId(row) && originalSets.some(previous => richNodeId(previous) === richNodeId(row) && richSame(previous, row))) return true
    const count = validNumber(row.sets_min, 1, 20) && (row.sets_mode === 'exact' ? row.sets_max === null : validNumber(row.sets_max, row.sets_min, 20))
    const dose = row.dose_mode === 'amrap' ? row.reps_mode === null && row.dose_min === null && row.dose_max === null && row.distance_unit === null
      : row.dose_mode === 'reps' ? row.distance_unit === null && (row.reps_mode === 'athlete_choice' ? row.dose_min === null && row.dose_max === null : validNumber(row.dose_min, 1, 9999999) && (row.reps_mode === 'exact' ? row.dose_max === null : row.reps_mode === 'range' && validNumber(row.dose_max, row.dose_min!, 9999999)))
      : row.reps_mode === null && row.dose_max === null && (row.dose_mode === 'distance' ? validNumber(row.dose_min, 0.001, 9999999.999, 3) && row.distance_unit !== null : validNumber(row.dose_min, 1, 9999999) && row.distance_unit === null)
    const load = row.load_mode === 'exact' ? validNumber(row.exact_weight, 0, 9999999.999, 3)
      : row.load_mode === 'bodyweight' ? row.exact_weight === 0
      : row.load_mode === 'percent' ? validNumber(row.percent, 0.001, 200, 3) && Boolean(row.percent_basis_exercise_id && row.percent_basis_max_type)
        && percentBasisOptions.some(option => option.exercise_id === row.percent_basis_exercise_id && (!('max_type' in option) || option.max_type === row.percent_basis_max_type))
        && (!('manual_override' in row) || validOptional(row.manual_override, 0, 9999999.999, 3))
      : row.load_mode === 'rpe' ? validNumber(row.rpe_min, 1, 10, 1) && validOptional(row.rpe_max, row.rpe_min!, 10, 1)
      : row.load_mode === 'qualitative' ? row.qualitative !== null : true
    return count && dose && load && validOptional(row.rpe_min, 1, 10, 1) && (row.rpe_min !== null || row.rpe_max === null) && validOptional(row.rpe_max, row.rpe_min ?? 1, 10, 1) && validOptional(row.rest_seconds, 0, 86400) && validText(row.note, 500)
  }
  const invalid = !validText(draft.label, 120, true) || !validText(draft.subtitle, 500) || !validText(draft.workout_instruction, 1000)
    || supersetErrors.length > 0 || groups.length > 12 || allExercises.length > 12 || draft.marked_rest && allExercises.length > 0
    || groups.some(group => group.group_type === 'circuit' && (!validNumber(group.rounds_min, 1, 100) || !validOptional(group.rounds_max, group.rounds_min!, 100)) || !validText(group.title, 120))
    || allExercises.some(exercise => !validText(exercise.name, 120, true) || !validText(exercise.instruction, 1000) || !validText(exercise.note, 500) || !validText(exercise.protocol, 1000)
      || exercise.set_groups.length === 0 || exercise.set_groups.length > 20 || exercise.set_groups.reduce((sum, row) => sum + (row.sets_max ?? row.sets_min), 0) > 20 || exercise.set_groups.some(row => !validSet(row)))
  const whitespaceOnly = (value: string | null) => value !== null && !value.trim()
  const hasWhitespaceOnlyText = [draft.subtitle, draft.workout_instruction, ...groups.map(group => group.title),
    ...allExercises.flatMap(exercise => [exercise.instruction, exercise.note, exercise.protocol, ...exercise.set_groups.map(row => row.note)])].some(whitespaceOnly)
  const whitespaceMessage = 'Optional text must be empty or contain non-space characters.'
  useEffect(() => {
    setLocalError(current => dirty && hasWhitespaceOnlyText ? whitespaceMessage : current === whitespaceMessage ? null : current)
  }, [dirty, hasWhitespaceOnlyText])
  const save = async (): Promise<boolean> => { if (!dirty || invalid || disabled || libraryBusy) return false; setLocalError(null); try { await onSave(richDaySavePayload(draft, day, template)); return true } catch (cause) { setLocalError(errorText(cause)); return false } }
  useEffect(() => { registerSave?.(save) })
  const editExercise = (groupIndex: number | null, exerciseIndex: number, change: (exercise: any) => void) => mutate(next => { const exercise = groupIndex === null ? next.ungrouped_exercises[exerciseIndex] : next.movement_groups[groupIndex].exercises[exerciseIndex]; change(exercise); normalize(next) })
  const moveExercise = (groupIndex: number | null, exerciseIndex: number, destination: number | null, shift = 0) => mutate(next => {
    const source = groupIndex === null ? next.ungrouped_exercises : next.movement_groups[groupIndex].exercises
    const [exercise] = source.splice(exerciseIndex, 1)
    const target = destination === null ? next.ungrouped_exercises : next.movement_groups[destination].exercises
    target.splice(destination === groupIndex ? Math.max(0, Math.min(target.length, exerciseIndex + shift)) : target.length, 0, exercise)
    normalize(next)
  })
  const moveGroup = (index: number, shift: -1 | 1) => mutate(next => {
    const [group] = next.movement_groups.splice(index, 1)
    next.movement_groups.splice(index + shift, 0, group)
    normalize(next)
  })
  const editSet = (groupIndex: number | null, exerciseIndex: number, setIndex: number, change: (row: any) => void) => editExercise(groupIndex, exerciseIndex, exercise => change(exercise.set_groups[setIndex]))
  const numeric = (value: string): number | null => value === '' ? null : Number(value)
  const setFields = (row: RichAnySet, groupIndex: number | null, exerciseIndex: number, setIndex: number) => {
    const edit = (change: (row: any) => void) => editSet(groupIndex, exerciseIndex, setIndex, change)
    const owner = groupIndex === null ? ungrouped[exerciseIndex] : groups[groupIndex].exercises[exerciseIndex]
    const ownerExerciseId = 'exercise_id' in owner && typeof owner.exercise_id === 'string' ? owner.exercise_id : null
    const defaultBasisExerciseId = availableExercises.find(option => option.exercise_id === ownerExerciseId)?.default_basis_exercise_id ?? ownerExerciseId
    const defaultBasisType = percentBasisOptions.some(option => option.exercise_id === defaultBasisExerciseId && 'max_type' in option && option.max_type === 'training_max') ? 'training_max' : percentBasisOptions.some(option => option.exercise_id === defaultBasisExerciseId && 'max_type' in option && option.max_type === 'tested_1rm') ? 'tested_1rm' : 'training_max'
    const numberInput = (label: string, value: number | null, field: string, min = 0, step = '1') => <label>{label}<input type="number" min={min} step={step} value={value ?? ''} disabled={disabled} onChange={event => edit(next => { next[field] = numeric(event.target.value) })} /></label>
    const selectedBasis = percentBasisOptions.find(option => option.exercise_id === row.percent_basis_exercise_id && (!('max_type' in option) || option.max_type === row.percent_basis_max_type))
    const percentageExplanation = row.load_mode !== 'percent' ? null : !row.percent_basis_exercise_id
      ? 'Choose the exercise whose approved max this percentage uses.'
      : !selectedBasis ? template ? 'The athlete needs an approved max for this basis when the template is applied.' : 'No approved max is available for this exercise and max type. Set one in Programming maxes.'
      : 'value' in selectedBasis && typeof selectedBasis.value === 'number' && 'unit' in selectedBasis && 'effective_from' in selectedBasis && row.percent !== null
        ? `${row.percent}% of ${selectedBasis.name} ${row.percent_basis_max_type === 'training_max' ? 'training max' : 'tested 1RM'} (${selectedBasis.value} ${selectedBasis.unit}, effective ${selectedBasis.effective_from}) = ${(selectedBasis.value * row.percent / 100).toFixed(1)} ${selectedBasis.unit} before program rounding${'manual_override' in row && row.manual_override !== null ? `; manual weight override ${row.manual_override} ${row.unit_override ?? defaultUnit}` : ''}.`
        : `${row.percent ?? '—'}% of ${selectedBasis.name} ${row.percent_basis_max_type === 'training_max' ? 'training max' : 'tested 1RM'}; the athlete's approved max is resolved when this template is applied.`
    return <fieldset key={richNodeId(row) ?? `set-${setIndex}`} className="rich-set"><legend>Prescription {setIndex + 1}</legend><div className="rich-field-grid"><label>Sets<select value={row.sets_mode} disabled={disabled} onChange={event => edit(next => { next.sets_mode = event.target.value; next.sets_max = event.target.value === 'range' ? next.sets_min : null })}><option value="exact">Exact</option><option value="range">Range</option></select></label>{numberInput('Sets minimum', row.sets_min, 'sets_min', 1)}{row.sets_mode === 'range' && numberInput('Sets maximum', row.sets_max, 'sets_max', 1)}<label>Dose<select value={row.dose_mode} disabled={disabled} onChange={event => edit(next => { next.dose_mode = event.target.value; next.reps_mode = event.target.value === 'reps' ? 'exact' : null; next.dose_min = event.target.value === 'amrap' ? null : 8; next.dose_max = null; next.distance_unit = event.target.value === 'distance' ? 'm' : null })}><option value="reps">Repetitions</option><option value="time">Time (seconds)</option><option value="steps">Steps</option><option value="distance">Distance</option><option value="amrap">AMRAP</option></select></label>{row.dose_mode === 'reps' && <label>Reps<select value={row.reps_mode ?? 'exact'} disabled={disabled} onChange={event => edit(next => { next.reps_mode = event.target.value; next.dose_min = event.target.value === 'athlete_choice' ? null : 8; next.dose_max = event.target.value === 'range' ? 10 : null })}><option value="exact">Exact</option><option value="range">Range</option><option value="athlete_choice">Athlete choice</option></select></label>}{row.dose_mode !== 'amrap' && row.reps_mode !== 'athlete_choice' && numberInput(row.dose_mode === 'reps' ? 'Reps minimum' : row.dose_mode === 'time' ? 'Seconds' : row.dose_mode === 'distance' ? 'Distance' : 'Steps', row.dose_min, 'dose_min', row.dose_mode === 'distance' ? 0.001 : 1, row.dose_mode === 'distance' ? '0.001' : '1')}{row.reps_mode === 'range' && numberInput('Reps maximum', row.dose_max, 'dose_max', 1)}{row.dose_mode === 'distance' && <label>Distance unit<select value={row.distance_unit ?? 'm'} disabled={disabled} onChange={event => edit(next => { next.distance_unit = event.target.value })}><option value="m">m</option><option value="km">km</option><option value="ft">ft</option><option value="mi">mi</option></select></label>}<label>Laterality<select value={row.laterality} disabled={disabled} onChange={event => edit(next => { next.laterality = event.target.value })}><option value="bilateral">Bilateral</option><option value="each_side">Each side</option><option value="alternating">Alternating</option></select></label><label>Load<select value={row.load_mode} disabled={disabled} onChange={event => edit(next => { next.load_mode = event.target.value; next.exact_weight = event.target.value === 'exact' || event.target.value === 'bodyweight' ? 0 : null; next.percent = event.target.value === 'percent' ? 75 : null; next.percent_basis_exercise_id = event.target.value === 'percent' ? defaultBasisExerciseId : null; next.percent_basis_max_type = event.target.value === 'percent' ? defaultBasisType : null; next.rpe_min = event.target.value === 'rpe' ? 7 : null; next.rpe_max = null; next.qualitative = event.target.value === 'qualitative' ? 'M' : null; if ('manual_override' in next) next.manual_override = null })}><option value="exact">Exact weight</option><option value="percent">Percentage</option><option value="rpe">RPE</option><option value="qualitative">Effort cue</option><option value="bodyweight">Bodyweight</option><option value="none">No load</option><option value="tbd">Decide later</option></select></label><label>Load basis<select value={row.load_basis} disabled={disabled} onChange={event => edit(next => { next.load_basis = event.target.value })}><option value="total">Total</option><option value="added_to_bodyweight">Added to bodyweight</option><option value="per_hand">Per hand</option></select></label>{row.load_mode === 'exact' && <>{numberInput('Weight', row.exact_weight, 'exact_weight', 0, '0.001')}<label>Weight unit<select value={row.unit_override ?? defaultUnit} disabled={disabled} onChange={event => edit(next => { next.unit_override = event.target.value })}><option value="lb">lb</option><option value="kg">kg</option></select></label></>}{row.load_mode === 'percent' && <>{numberInput('Percent', row.percent, 'percent', 0.001, '0.001')}<label>Based on exercise<select value={row.percent_basis_exercise_id ?? ''} disabled={disabled} onChange={event => edit(next => { next.percent_basis_exercise_id = event.target.value || null })}><option value="">Choose library exercise</option>{percentBasisOptions.filter((option, index, options) => options.findIndex(candidate => candidate.exercise_id === option.exercise_id) === index).map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}{row.percent_basis_exercise_id && !percentBasisOptions.some(option => option.exercise_id === row.percent_basis_exercise_id) && <option value={row.percent_basis_exercise_id}>Existing selected exercise</option>}</select></label><label>Maximum type<select value={row.percent_basis_max_type ?? 'training_max'} disabled={disabled} onChange={event => edit(next => { next.percent_basis_max_type = event.target.value })}><option value="training_max">Training max</option><option value="tested_1rm">Tested 1RM</option></select></label>{!template && numberInput('Manual weight override', 'manual_override' in row ? row.manual_override : null, 'manual_override', 0, '0.001')}</>}{percentageExplanation && <p className="rich-wide rich-percent-explanation" role="status">{percentageExplanation}</p>}{row.load_mode === 'rpe' && <>{numberInput('RPE minimum', row.rpe_min, 'rpe_min', 1, '0.1')}{numberInput('RPE maximum', row.rpe_max, 'rpe_max', 1, '0.1')}</>}{row.load_mode === 'qualitative' && <label>Effort cue<select value={row.qualitative ?? 'M'} disabled={disabled} onChange={event => edit(next => { next.qualitative = event.target.value })}><option value="L">Light</option><option value="M">Moderate</option><option value="MH">Moderately heavy</option><option value="H">Heavy</option></select></label>}{numberInput('Rest seconds', row.rest_seconds, 'rest_seconds', 0)}<label className="rich-wide">Set note<textarea maxLength={500} value={row.note ?? ''} disabled={disabled} onChange={event => edit(next => { next.note = event.target.value || null })} /></label></div><button type="button" className="text-button" disabled={disabled} onClick={() => editExercise(groupIndex, exerciseIndex, exercise => { exercise.set_groups.splice(setIndex, 1) })}>Remove prescription</button></fieldset>
  }
  const ensureTrackedExercise = async (exercise: RichAnyExercise, groupIndex: number | null, index: number) => {
    const name = exercise.name.trim()
    if (!onEnsureExercise || !name || libraryBusy || disabled) return
    setLibraryBusy(true); setLocalError(null)
    try { const option = await onEnsureExercise(name); setAddedOptions(current => current.some(item => item.exercise_id === option.exercise_id) ? current : [...current, option]); editExercise(groupIndex, index, next => { next.exercise_id = option.exercise_id; next.track_in_metrics = true; next.name = option.name }) }
    catch (cause) { setLocalError(errorText(cause)) } finally { setLibraryBusy(false) }
  }
  const exerciseTrackingFields = (exercise: RichAnyExercise, groupIndex: number | null, index: number) => {
    if (!trackingSupported) return null
    const selectedId = 'exercise_id' in exercise && typeof exercise.exercise_id === 'string' ? exercise.exercise_id : ''
    const tracked = trackingOverrides[selectedId] ?? ('track_in_metrics' in exercise && exercise.track_in_metrics === true)
    return <div className="rich-tracking-fields"><label>Library exercise<select aria-label={`Library exercise for ${exercise.name || `Exercise ${exercise.ordinal}`}`} value={selectedId} disabled={disabled || libraryBusy} onChange={event => editExercise(groupIndex, index, next => { next.exercise_id = event.target.value || null; const chosen = availableExercises.find(option => option.exercise_id === event.target.value); if (chosen && !next.name.trim()) next.name = chosen.name; if (!event.target.value) next.track_in_metrics = false })}><option value="">Choose library exercise</option>{availableExercises.map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}</select></label>{!selectedId && onEnsureExercise && <button type="button" className="button outline" disabled={disabled || libraryBusy || !exercise.name.trim()} onClick={() => void ensureTrackedExercise(exercise, groupIndex, index)}>{libraryBusy ? 'Adding…' : 'Add to exercise library & track'}</button>}<small>{selectedId ? tracked ? 'Coach-required during this assignment. The athlete cannot turn this source off.' : 'This program does not require Metrics tracking for this exercise.' : 'Choose an existing library exercise or add this named lift to track it with a stable ID.'}</small></div>
  }
  const editPhysicalSet = (groupIndex: number | null, exerciseIndex: number, setIndex: number, physicalIndex: number, change: (row: any) => void) => editExercise(groupIndex, exerciseIndex, exercise => {
    const row = exercise.set_groups[setIndex]
    if (row.sets_mode === 'exact' && row.sets_min > 1) {
      const split = Array.from({ length: row.sets_min }, (_, index) => ({ ...row, [richSaveKey(template)]: index === 0 ? richNodeId(row) : null, sets_min: 1, ordinal: row.ordinal + index }))
      change(split[physicalIndex])
      exercise.set_groups.splice(setIndex, 1, ...split)
    } else change(row)
  })
  const changeSetCount = (groupIndex: number | null, exerciseIndex: number, delta: -1 | 1) => editExercise(groupIndex, exerciseIndex, exercise => {
    const rows = exercise.set_groups
    const last = rows.at(-1)
    if (!last) { if (delta > 0) rows.push(newSet()); return }
    if (delta > 0) rows.push({ ...last, [richSaveKey(template)]: null, ordinal: rows.length + 1, sets_mode: 'exact', sets_min: 1, sets_max: null })
    else if (last.sets_mode === 'exact' && last.sets_min > 1) last.sets_min -= 1
    else if (rows.length > 1) rows.pop()
  })
  const toggleTracking = async (exercise: RichAnyExercise, groupIndex: number | null, index: number) => {
    if (!trackingSupported || disabled || libraryBusy) return
    const exerciseId = 'exercise_id' in exercise && typeof exercise.exercise_id === 'string' ? exercise.exercise_id : null
    if (!exerciseId) {
      if (onEnsureExercise && exercise.name.trim()) await ensureTrackedExercise(exercise, groupIndex, index)
      else setLocalError('Name this exercise to add it to the library before tracking.')
      return
    }
    const tracked = trackingOverrides[exerciseId] ?? ('track_in_metrics' in exercise && exercise.track_in_metrics === true)
    if (onSetExerciseTracking) {
      if (dirty) { setLocalError('Save day edits before changing tracking.'); return }
      setLibraryBusy(true); setLocalError(null)
      try { await onSetExerciseTracking(exerciseId, !tracked); setTrackingOverrides(current => ({ ...current, [exerciseId]: !tracked })) }
      catch (cause) { setLocalError(errorText(cause)) }
      finally { setLibraryBusy(false) }
    } else editExercise(groupIndex, index, next => { next.track_in_metrics = !tracked })
  }
  const changeCompactLoad = (exercise: RichAnyExercise, groupIndex: number | null, exerciseIndex: number, setIndex: number, physicalIndex: number, choice: string) => editPhysicalSet(groupIndex, exerciseIndex, setIndex, physicalIndex, next => {
    const mode = choice === 'lb' || choice === 'kg' ? 'exact' : choice
    if (next.load_mode === mode) { if (mode === 'exact') next.unit_override = choice; return }
    next.load_mode = mode
    next.exact_weight = mode === 'exact' || mode === 'bodyweight' ? 0 : null
    next.percent = mode === 'percent' ? 75 : null
    const selectedId = 'exercise_id' in exercise && typeof exercise.exercise_id === 'string' ? exercise.exercise_id : null
    const candidateId = availableExercises.find(option => option.exercise_id === selectedId)?.default_basis_exercise_id ?? selectedId
    const availableBasis = percentBasisOptions.some(option => option.exercise_id === candidateId)
    next.percent_basis_exercise_id = mode === 'percent' && availableBasis ? candidateId : null
    next.percent_basis_max_type = mode === 'percent' ? percentBasisOptions.some(option => option.exercise_id === candidateId && 'max_type' in option && option.max_type === 'training_max') ? 'training_max' : percentBasisOptions.some(option => option.exercise_id === candidateId && 'max_type' in option && option.max_type === 'tested_1rm') ? 'tested_1rm' : 'training_max' : null
    next.qualitative = mode === 'qualitative' ? 'M' : null
    if (mode === 'rpe' && next.rpe_min === null) next.rpe_min = 7
    if (mode !== 'percent' && 'manual_override' in next) next.manual_override = null
    if (mode === 'exact') next.unit_override = choice
  })
  const compactLoadCell = (exercise: RichAnyExercise, groupIndex: number | null, exerciseIndex: number, row: RichAnySet, setIndex: number, physicalIndex: number, rowIndex: number): ReactNode => {
    const label = `${exercise.name || `Exercise ${exercise.ordinal}`} set ${rowIndex + 1}`
    const selectedBasis = row.load_mode === 'percent' ? percentBasisOptions.find(option => option.exercise_id === row.percent_basis_exercise_id && (!('max_type' in option) || option.max_type === row.percent_basis_max_type)) : undefined
    const percentResult = selectedBasis && 'value' in selectedBasis && typeof selectedBasis.value === 'number' && 'unit' in selectedBasis && typeof selectedBasis.unit === 'string' && row.percent !== null
      ? `≈ ${(selectedBasis.value * row.percent / 100).toFixed(1)} ${selectedBasis.unit} before rounding` : null
    if (setIndex < 0) return <><td>—</td><td>—</td></>
    if (row.sets_mode === 'range') return <td colSpan={2} title="Shared range prescription. Edit in Details.">{row.load_mode === 'exact' ? `${row.exact_weight ?? '—'} ${row.unit_override ?? defaultUnit}` : row.load_mode === 'percent' ? `${row.percent ?? '—'}%` : row.load_mode === 'qualitative' ? row.qualitative ?? 'Effort' : row.load_mode === 'bodyweight' ? 'BW' : row.load_mode === 'none' ? 'None' : row.load_mode === 'rpe' ? 'RPE load' : 'Later'}</td>
    return <><td className="rich-compact-load-value">{(row.load_mode === 'exact' || row.load_mode === 'percent') && <input aria-label={`${label} load`} type="number" min={row.load_mode === 'percent' ? 0.001 : 0} max={row.load_mode === 'percent' ? 200 : 9999999.999} step="0.001" value={row.load_mode === 'percent' ? row.percent ?? '' : row.exact_weight ?? ''} disabled={disabled} onChange={event => editPhysicalSet(groupIndex, exerciseIndex, setIndex, physicalIndex, next => { if (next.load_mode === 'percent') next.percent = numeric(event.target.value); else next.exact_weight = numeric(event.target.value) })} />}{row.load_mode === 'qualitative' && <select aria-label={`${label} effort`} className="rich-compact-effort" value={row.qualitative ?? 'M'} disabled={disabled} onChange={event => editPhysicalSet(groupIndex, exerciseIndex, setIndex, physicalIndex, next => { next.qualitative = event.target.value })}><option value="L">Light</option><option value="M">Moderate</option><option value="MH">Moderately heavy</option><option value="H">Heavy</option></select>}{!['exact', 'percent', 'qualitative'].includes(row.load_mode) && <span className="rich-compact-load-placeholder">—</span>}</td><td className="rich-compact-load-type-cell"><select aria-label={`${label} load type`} className="rich-compact-load-type" value={row.load_mode === 'exact' ? row.unit_override ?? defaultUnit : row.load_mode} disabled={disabled} onChange={event => changeCompactLoad(exercise, groupIndex, exerciseIndex, setIndex, physicalIndex, event.target.value)}><option value="lb">lb</option><option value="kg">kg</option><option value="percent">%</option><option value="qualitative">Effort</option><option value="bodyweight">BW</option><option value="none">None</option><option value="rpe">RPE load</option><option value="tbd">Later</option></select>{row.load_mode === 'percent' && <span className="rich-compact-percent-hint" title={percentResult ?? (!selectedBasis ? 'Choose basis in Details' : 'Percentage prescription')}>ⓘ</span>}</td></>
  }
  const renderCompactExercise = (exercise: RichAnyExercise, groupIndex: number | null, index: number): ReactNode => {
    const rows = exercise.set_groups.flatMap((row, setIndex) => Array.from({ length: row.sets_mode === 'range' ? 1 : Math.max(1, row.sets_min) }, (_, physicalIndex) => ({ row, setIndex, physicalIndex })))
    if (rows.length === 0) rows.push({ row: newSet() as RichAnySet, setIndex: -1, physicalIndex: 0 })
    const count = exercise.set_groups.reduce((sum, row) => sum + row.sets_min, 0)
    const hasRange = exercise.set_groups.some(row => row.sets_mode === 'range')
    const exerciseId = 'exercise_id' in exercise && typeof exercise.exercise_id === 'string' ? exercise.exercise_id : null
    const isTracked = exerciseId && exerciseId in trackingOverrides ? trackingOverrides[exerciseId] : 'track_in_metrics' in exercise && exercise.track_in_metrics === true
    const hasOtherNotes = Boolean(exercise.instruction || exercise.protocol || exercise.set_groups.some(row => row.note))
    return <Fragment key={richNodeId(exercise) ?? `${groupIndex}-${index}`}>
      <tr className="rich-compact-exercise-header-row"><th colSpan={6} scope="rowgroup" className="rich-compact-exercise-cell"><div className="rich-compact-exercise-header"><div className="rich-compact-exercise-name"><input aria-label={`Exercise ${exercise.ordinal} name`} title={exercise.name} placeholder="Exercise name" maxLength={120} value={exercise.name} disabled={disabled} onChange={event => editExercise(groupIndex, index, next => { next.name = event.target.value })} /></div><div className="rich-compact-exercise-controls">{trackingSupported && <button type="button" className={isTracked ? 'rich-compact-track is-tracked' : 'rich-compact-track'} disabled={disabled || libraryBusy} onClick={() => void toggleTracking(exercise, groupIndex, index)}>{isTracked ? '● Tracked' : '○ Track'}</button>}<span className="rich-compact-stepper"><button type="button" aria-label={`Remove a set from ${exercise.name || `exercise ${exercise.ordinal}`}`} disabled={disabled || hasRange || count <= 1} onClick={() => changeSetCount(groupIndex, index, -1)}>−</button><span>{hasRange ? exercise.set_groups.map(row => row.sets_mode === 'range' ? `${row.sets_min}–${row.sets_max}` : row.sets_min).join(' + ') : count} {hasRange || count !== 1 ? 'sets' : 'set'}</span><button type="button" aria-label={`Add a set to ${exercise.name || `exercise ${exercise.ordinal}`}`} disabled={disabled || hasRange || count >= 20} onClick={() => changeSetCount(groupIndex, index, 1)}>+</button></span></div><details className="rich-compact-details"><summary aria-label={`Details for ${exercise.name || `exercise ${exercise.ordinal}`}`}>⋯</summary><div className="rich-field-grid"><label>Status<select value={exercise.status} disabled={disabled} onChange={event => editExercise(groupIndex, index, next => { next.status = event.target.value })}><option value="programmed">Programmed</option><option value="not_programmed">Not programmed</option></select></label><label className="rich-wide">Instruction<textarea maxLength={1000} value={exercise.instruction ?? ''} disabled={disabled} onChange={event => editExercise(groupIndex, index, next => { next.instruction = event.target.value || null })} /></label><label className="rich-wide">Protocol<textarea maxLength={1000} value={exercise.protocol ?? ''} disabled={disabled} onChange={event => editExercise(groupIndex, index, next => { next.protocol = event.target.value || null })} /></label></div>{exerciseTrackingFields(exercise, groupIndex, index)}{exercise.set_groups.map((set, setIndex) => setFields(set, groupIndex, index, setIndex))}<div className="rich-row-actions"><label>Move to<select value={groupIndex === null ? 'ungrouped' : String(groupIndex)} disabled={disabled} onChange={event => moveExercise(groupIndex, index, event.target.value === 'ungrouped' ? null : Number(event.target.value))}><option value="ungrouped">Ungrouped</option>{groups.map((group, target) => <option key={richNodeId(group) ?? target} value={target}>Movement group {target + 1}</option>)}</select></label><button type="button" className="button outline" disabled={disabled || index === 0} onClick={() => moveExercise(groupIndex, index, groupIndex, -1)}>Move up</button><button type="button" className="button outline" disabled={disabled || index === (groupIndex === null ? ungrouped.length : groups[groupIndex].exercises.length) - 1} onClick={() => moveExercise(groupIndex, index, groupIndex, 1)}>Move down</button><button type="button" className="button outline" disabled={disabled || count >= 20} onClick={() => editExercise(groupIndex, index, next => { next.set_groups.push(newSet()) })}>Add prescription</button><button type="button" className="text-button" disabled={disabled} onClick={() => mutate(next => { (groupIndex === null ? next.ungrouped_exercises : next.movement_groups[groupIndex].exercises).splice(index, 1); normalize(next) })}>Remove exercise</button></div></details></div></th></tr>
      <tr className="rich-compact-column-head"><th scope="col">Set</th><th scope="col">Reps</th><th scope="col">Load</th><th scope="col">Type</th><th scope="col">RPE <small>optional</small></th><th scope="col">Exercise note</th></tr>
      {rows.map(({ row, setIndex, physicalIndex }, rowIndex) => <tr key={`${richNodeId(exercise) ?? `${groupIndex}-${index}`}-${setIndex}-${physicalIndex}`} className={rowIndex === 0 ? 'rich-compact-exercise-start' : ''}>

      <td className="rich-compact-set-number" title={row.sets_mode === 'range' ? 'Shared range prescription. Edit in Details.' : undefined}>{row.sets_mode === 'range' ? `${row.sets_min}–${row.sets_max}` : rowIndex + 1}</td>
      <td>{setIndex >= 0 && row.dose_mode === 'reps' && row.reps_mode === 'exact' ? <input aria-label={`${exercise.name} set ${rowIndex + 1} reps`} type="number" min={1} max={9999999} value={row.dose_min ?? ''} disabled={disabled || row.sets_mode !== 'exact'} onChange={event => editPhysicalSet(groupIndex, index, setIndex, physicalIndex, next => { next.dose_min = numeric(event.target.value) })} /> : <span title="Edit this prescription in Details">{row.dose_mode === 'amrap' ? 'AMRAP' : row.reps_mode === 'range' ? `${row.dose_min}–${row.dose_max}` : row.reps_mode === 'athlete_choice' ? 'Choice' : `${row.dose_min ?? '—'} ${row.dose_mode}`}</span>}</td>
      {compactLoadCell(exercise, groupIndex, index, row, setIndex, physicalIndex, rowIndex)}
      <td>{setIndex >= 0 ? <input aria-label={`${exercise.name} set ${rowIndex + 1} RPE optional`} type="number" min={1} max={10} step="0.1" placeholder="—" value={row.rpe_min ?? ''} disabled={disabled || row.sets_mode !== 'exact'} onChange={event => editPhysicalSet(groupIndex, index, setIndex, physicalIndex, next => { next.rpe_min = numeric(event.target.value); next.rpe_max = null; if (next.load_mode === 'rpe' && next.rpe_min === null) next.load_mode = 'tbd' })} /> : '—'}</td>
      {rowIndex === 0 && <td rowSpan={rows.length} className="rich-compact-note-cell"><textarea aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} note`} maxLength={500} value={exercise.note ?? ''} disabled={disabled} placeholder="Technique cues or coaching notes" onChange={event => editExercise(groupIndex, index, next => { next.note = event.target.value || null })} />{hasOtherNotes && <small>Instruction, protocol, or set notes in Details</small>}</td>}
    </tr>)}</Fragment>
  }
  return <form className="rich-day-editor rich-compact-editor" aria-label="Rich day editor" onSubmit={event => { event.preventDefault(); void save() }}><div className="rich-compact-heading"><label>Day of the week<span>{weekdayForOrdinal(draft.ordinal)}</span></label><label>Workout name<input maxLength={500} value={draft.subtitle ?? workoutTitle(draft.label, draft.ordinal) ?? ''} disabled={disabled} onChange={event => mutate(next => { next.subtitle = event.target.value || null; if (workoutTitle(next.label, next.ordinal)) next.label = weekdayForOrdinal(next.ordinal) })} /></label><details><summary>Rest day and workout notes</summary><div className="rich-field-grid"><label><input type="checkbox" checked={draft.marked_rest} disabled={disabled || allExercises.length > 0} onChange={event => mutate(next => { next.marked_rest = event.target.checked })} /> Rest day</label><label className="rich-wide">Workout instruction<textarea maxLength={1000} value={draft.workout_instruction ?? ''} disabled={disabled} onChange={event => mutate(next => { next.workout_instruction = event.target.value || null })} /></label></div></details></div>{draft.marked_rest && allExercises.length === 0 ? <p className="rich-compact-rest">Rest day · no exercises assigned</p> : <div className="rich-compact-scroll"><table aria-label="Workout programming"><colgroup><col style={{width:'7%'}}/><col style={{width:'12%'}}/><col style={{width:'16%'}}/><col style={{width:'10%'}}/><col style={{width:'12%'}}/><col style={{width:'43%'}}/></colgroup><tbody>{groups.map((group, groupIndex) => <Fragment key={richNodeId(group) ?? `new-group-${groupIndex}`}>{<tr key={`group-${richNodeId(group) ?? groupIndex}`} className="rich-compact-group-row"><th colSpan={6} scope="rowgroup"><details><summary>{`${group.group_type === 'superset' ? 'Superset' : 'Movement group'} ${groupIndex + 1}${group.title ? ` · ${group.title}` : ''}`}</summary><div className="rich-field-grid"><label>Group type<select value={group.group_type} disabled={disabled} onChange={event => mutate(next => { next.movement_groups[groupIndex].group_type = event.target.value; if (event.target.value === 'circuit' && next.movement_groups[groupIndex].rounds_min === null) next.movement_groups[groupIndex].rounds_min = 3 })}><option value="superset">Superset</option><option value="circuit">Circuit</option></select></label><label>Group title<input maxLength={120} value={group.title ?? ''} disabled={disabled} onChange={event => mutate(next => { next.movement_groups[groupIndex].title = event.target.value || null })} /></label>{group.group_type === 'circuit' && <><label>Rounds minimum<input type="number" min={1} max={100} value={group.rounds_min ?? ''} disabled={disabled} onChange={event => mutate(next => { next.movement_groups[groupIndex].rounds_min = numeric(event.target.value) })} /></label><label>Rounds maximum<input type="number" min={1} max={100} value={group.rounds_max ?? ''} disabled={disabled} onChange={event => mutate(next => { next.movement_groups[groupIndex].rounds_max = numeric(event.target.value) })} /></label></>}</div><div className="rich-row-actions"><button type="button" className="button outline" disabled={disabled || groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)}>Move group up</button><button type="button" className="button outline" disabled={disabled || groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, 1)}>Move group down</button><button type="button" className="button outline" disabled={disabled || allExercises.length >= 12} onClick={() => mutate(next => { next.movement_groups[groupIndex].exercises.push(newExercise()); normalize(next) })}>Add group exercise</button><button type="button" className="text-button" disabled={disabled} onClick={() => mutate(next => { next.movement_groups.splice(groupIndex, 1); normalize(next) })}>Remove group</button></div></details></th></tr>}{group.exercises.map((exercise, index) => renderCompactExercise(exercise, groupIndex, index))}</Fragment>)}{ungrouped.map((exercise, index) => renderCompactExercise(exercise, null, index))}</tbody></table></div>}<div className="rich-compact-actions"><button type="button" className="button outline" disabled={disabled || draft.marked_rest || allExercises.length >= 12} onClick={() => mutate(next => { next.ungrouped_exercises.push(newExercise()); normalize(next) })}>＋ Add exercise</button><button type="button" className="button outline" disabled={disabled || draft.marked_rest || groups.length >= 12 || allExercises.length >= 12} onClick={() => mutate(next => { next.movement_groups.push({ mode: 'replace', [richSaveKey(template)]: null, ordinal: 1, group_type: 'superset', title: null, rounds_min: null, rounds_max: null, exercises: [newExercise()] }); normalize(next) })}>Add movement group</button></div>{supersetErrors.map(message => <p key={message} className="workspace-error" role="alert">{message}</p>)}{localError && <p className="workspace-error" role="alert">{localError}</p>}{invalid && dirty && <p className="workspace-error" role="status">Complete each exercise and prescription before saving. Rest days cannot contain exercises.</p>}<div className="dialog-actions"><button type="submit" className="button primary" disabled={disabled || libraryBusy || !dirty || invalid}>Save day</button></div></form>
}

function WorkoutTemplateDayEditor({ day, defaultUnit, busy, onSave }: { day: SaveCoachProgramDayV3; defaultUnit: 'lb' | 'kg'; busy: boolean; onSave(day: SaveCoachProgramDayV3): Promise<void> }) {
  const [draft, setDraft] = useState(day)
  useEffect(() => setDraft(day), [day])
  const emptySet = () => ({ identity_token: null, ordinal: 1, reps: { mode: 'exact' as const, value: 8 }, load_kind: 'bodyweight' as const, load_value: null, unit_override: null, effective_unit: null })
  const emptyExercise = () => ({ mode: 'replace' as const, identity_token: null, ordinal: 1, name: '', note: null, protocol: null, set_rows: [emptySet()] })
  const normalize = (next: SaveCoachProgramDayV3) => ({ ...next, exercises: next.exercises.filter(exercise => exercise.mode === 'replace').map((exercise, exerciseIndex) => ({ ...exercise, ordinal: exerciseIndex + 1, set_rows: exercise.set_rows.map((set, setIndex) => ({ ...set, ordinal: setIndex + 1 })) })) } as SaveCoachProgramDayV3)
  const replaceExercise = (index: number, change: (exercise: Extract<SaveCoachProgramDayV3['exercises'][number], { mode: 'replace' }>) => Extract<SaveCoachProgramDayV3['exercises'][number], { mode: 'replace' }>) => setDraft(current => normalize({ ...current, exercises: current.exercises.map((exercise, item) => exercise.mode === 'replace' && item === index ? change(exercise) : exercise) } as SaveCoachProgramDayV3))
  const replaceSet = (exerciseIndex: number, setIndex: number, change: (set: Extract<Extract<SaveCoachProgramDayV3['exercises'][number], { mode: 'replace' }>['set_rows'][number], object>) => Extract<Extract<SaveCoachProgramDayV3['exercises'][number], { mode: 'replace' }>['set_rows'][number], object>) => replaceExercise(exerciseIndex, exercise => ({ ...exercise, set_rows: exercise.set_rows.map((set, item) => item === setIndex ? change(set) : set) }))
  const exerciseCount = draft.exercises.filter(exercise => exercise.mode === 'replace').length
  const setCount = draft.exercises.reduce((count, exercise) => count + (exercise.mode === 'replace' ? exercise.set_rows.length : 0), 0)
  const moveExercise = (index: number, direction: -1 | 1) => setDraft(current => { const next = current.exercises.filter(exercise => exercise.mode === 'replace'); const other = index + direction; if (other < 0 || other >= next.length) return current; [next[index], next[other]] = [next[other], next[index]]; return normalize({ ...current, exercises: next } as SaveCoachProgramDayV3) })
  const moveSet = (exerciseIndex: number, setIndex: number, direction: -1 | 1) => replaceExercise(exerciseIndex, exercise => {
    const next = [...exercise.set_rows]; const other = setIndex + direction
    if (other < 0 || other >= next.length) return exercise
    ;[next[setIndex], next[other]] = [next[other], next[setIndex]]
    return { ...exercise, set_rows: next }
  })
  const setLoadKind = (exerciseIndex: number, setIndex: number, load_kind: 'exact' | 'rpe' | 'qualitative' | 'bodyweight' | 'none' | 'tbd') => replaceSet(exerciseIndex, setIndex, set => ({ ...set, load_kind, load_value: load_kind === 'exact' ? 0 : load_kind === 'rpe' ? 7 : load_kind === 'qualitative' ? 'M' : null, unit_override: load_kind === 'exact' ? defaultUnit : null, effective_unit: load_kind === 'exact' ? defaultUnit : null }))
  const bounded = (value: string | null, limit: number) => value === null || [...value].length <= limit
  const validReps = (set: Extract<Extract<SaveCoachProgramDayV3['exercises'][number], { mode: 'replace' }>['set_rows'][number], object>) => set.reps.mode === 'exact'
    ? Number.isInteger(set.reps.value) && set.reps.value >= 1 && set.reps.value <= 100
    : Number.isInteger(set.reps.min) && Number.isInteger(set.reps.max) && set.reps.min >= 1 && set.reps.max <= 100 && set.reps.min <= set.reps.max
  const invalid = !draft.label.trim() || !bounded(draft.label, 120) || !bounded(draft.subtitle, 500) || !bounded(draft.workout_instruction, 1000)
    || exerciseCount === 0 || setCount === 0 || draft.exercises.some(exercise => exercise.mode !== 'replace' || !exercise.name.trim() || !bounded(exercise.name, 120) || !bounded(exercise.note, 500) || !bounded(exercise.protocol, 1000) || exercise.set_rows.length === 0 || exercise.set_rows.some(set => !validReps(set)))
  return <form className="template-day-editor" onSubmit={event => { event.preventDefault(); if (!invalid) void onSave(normalize(draft)) }}>
    <label>Workout title<input placeholder="e.g. Upper body strength" maxLength={120} value={draft.label} disabled={busy} onChange={event => setDraft(current => ({ ...current, label: event.target.value }))} /></label>
    <label>Workout subtitle (optional)<input maxLength={500} value={draft.subtitle ?? ''} disabled={busy} onChange={event => setDraft(current => ({ ...current, subtitle: event.target.value || null }))} /></label>
    <label>Workout instruction (optional)<textarea maxLength={1000} value={draft.workout_instruction ?? ''} disabled={busy} onChange={event => setDraft(current => ({ ...current, workout_instruction: event.target.value || null }))} /></label>
    {draft.exercises.map((exercise, exerciseIndex) => exercise.mode === 'replace' && <fieldset className="template-exercise" key={`${exercise.identity_token ?? 'new'}-${exerciseIndex}`}><legend>Exercise {exerciseIndex + 1}</legend>
      <label>Exercise {exerciseIndex + 1}<input placeholder="Exercise name" maxLength={120} value={exercise.name} disabled={busy} onChange={event => replaceExercise(exerciseIndex, current => ({ ...current, name: event.target.value }))} /></label>
      <label>Exercise note {exerciseIndex + 1} (optional)<input maxLength={500} value={exercise.note ?? ''} disabled={busy} onChange={event => replaceExercise(exerciseIndex, current => ({ ...current, note: event.target.value || null }))} /></label>
      <label>Exercise cue {exerciseIndex + 1} (optional)<input maxLength={1000} value={exercise.protocol ?? ''} disabled={busy} onChange={event => replaceExercise(exerciseIndex, current => ({ ...current, protocol: event.target.value || null }))} /></label>
      <div className="dialog-actions"><button type="button" disabled={busy || exerciseIndex === 0} onClick={() => moveExercise(exerciseIndex, -1)}>Move exercise {exerciseIndex + 1} up</button><button type="button" disabled={busy || exerciseIndex === exerciseCount - 1} onClick={() => moveExercise(exerciseIndex, 1)}>Move exercise {exerciseIndex + 1} down</button><button type="button" disabled={busy} onClick={() => setDraft(current => normalize({ ...current, exercises: current.exercises.filter((_, item) => item !== exerciseIndex) } as SaveCoachProgramDayV3))}>Remove exercise {exerciseIndex + 1}</button></div>
      {exercise.set_rows.map((set, setIndex) => <fieldset className="template-set" key={`${set.identity_token ?? 'new'}-${setIndex}`}><legend>Set {setIndex + 1}</legend>
        <label>Repetitions mode<select value={set.reps.mode} disabled={busy} onChange={event => replaceSet(exerciseIndex, setIndex, current => event.target.value === 'range' ? { ...current, reps: { mode: 'range', min: current.reps.mode === 'range' ? current.reps.min : 8, max: current.reps.mode === 'range' ? current.reps.max : 10 } } : { ...current, reps: { mode: 'exact', value: current.reps.mode === 'exact' ? current.reps.value : current.reps.min } })}><option value="exact">Exact reps</option><option value="range">Rep range</option></select></label>
        {set.reps.mode === 'exact' ? <label>Exact reps<input type="number" min="1" max="100" value={set.reps.value} disabled={busy} onChange={event => replaceSet(exerciseIndex, setIndex, current => ({ ...current, reps: { mode: 'exact', value: Number(event.target.value) } }))} /></label> : <><label>Minimum reps<input type="number" min="1" max="100" value={set.reps.min} disabled={busy} onChange={event => replaceSet(exerciseIndex, setIndex, current => current.reps.mode === 'range' ? { ...current, reps: { ...current.reps, min: Number(event.target.value) } } : current)} /></label><label>Maximum reps<input type="number" min="1" max="100" value={set.reps.max} disabled={busy} onChange={event => replaceSet(exerciseIndex, setIndex, current => current.reps.mode === 'range' ? { ...current, reps: { ...current.reps, max: Number(event.target.value) } } : current)} /></label></>}
        <label>Load mode<select value={set.load_kind} disabled={busy} onChange={event => setLoadKind(exerciseIndex, setIndex, event.target.value as 'exact' | 'rpe' | 'qualitative' | 'bodyweight' | 'none' | 'tbd')}><option value="exact">Weight</option><option value="bodyweight">Bodyweight</option><option value="rpe">RPE</option><option value="qualitative">Effort cue</option><option value="none">No load</option><option value="tbd">Decide later</option></select></label>
        {set.load_kind === 'exact' && <><label>Weight<input type="number" min="0" max="2000" step="0.001" value={typeof set.load_value === 'number' ? set.load_value : 0} disabled={busy} onChange={event => replaceSet(exerciseIndex, setIndex, current => ({ ...current, load_value: Number(event.target.value) }))} /></label><label>Weight unit<select value={set.unit_override ?? defaultUnit} disabled={busy} onChange={event => replaceSet(exerciseIndex, setIndex, current => ({ ...current, unit_override: event.target.value as 'lb' | 'kg', effective_unit: event.target.value as 'lb' | 'kg' }))}><option value="lb">lb</option><option value="kg">kg</option></select></label></>}
        {set.load_kind === 'rpe' && <label>RPE<input type="number" min="1" max="10" step="0.1" value={typeof set.load_value === 'number' ? set.load_value : 7} disabled={busy} onChange={event => replaceSet(exerciseIndex, setIndex, current => ({ ...current, load_value: Number(event.target.value) }))} /></label>}
        {set.load_kind === 'qualitative' && <label>Effort cue<select value={typeof set.load_value === 'string' ? set.load_value : 'M'} disabled={busy} onChange={event => replaceSet(exerciseIndex, setIndex, current => ({ ...current, load_value: event.target.value as 'L' | 'M' | 'MH' | 'H' }))}><option value="L">Light</option><option value="M">Moderate</option><option value="MH">Moderately heavy</option><option value="H">Heavy</option></select></label>}
        <div className="dialog-actions"><button type="button" disabled={busy || setIndex === 0} onClick={() => moveSet(exerciseIndex, setIndex, -1)}>Move set {setIndex + 1} up</button><button type="button" disabled={busy || setIndex === exercise.set_rows.length - 1} onClick={() => moveSet(exerciseIndex, setIndex, 1)}>Move set {setIndex + 1} down</button><button type="button" disabled={busy || exercise.set_rows.length === 1} onClick={() => replaceExercise(exerciseIndex, current => ({ ...current, set_rows: current.set_rows.filter((_, item) => item !== setIndex) }))}>Remove set {setIndex + 1}</button></div>
      </fieldset>)}
      <button type="button" disabled={busy || setCount >= 20} onClick={() => replaceExercise(exerciseIndex, current => ({ ...current, set_rows: [...current.set_rows, emptySet()] }))}>Add set</button>
    </fieldset>)}
    <div className="dialog-actions"><button type="button" disabled={busy || exerciseCount >= 12 || setCount >= 20} onClick={() => setDraft(current => normalize({ ...current, exercises: [...current.exercises, emptyExercise()] } as SaveCoachProgramDayV3))}>Add exercise</button><button className="button primary" disabled={busy || invalid}>Save workout template</button></div>
    <small>Workout templates support exact or range repetitions, weight, bodyweight, RPE, effort cues, no-load, and decide-later rows. Percentage loads are not supported.</small>
  </form>
}

function WorkoutTemplatePicker({ api, gym, busy, onClose, onUnavailable, onChoose }: { api: Phase55WorkoutTemplateLibraryApi; gym: string; busy: boolean; onClose(): void; onUnavailable(): void; onChoose(template: { template_id: string; builder_version: number }): void }) {
  const [page, setPage] = useState<Awaited<ReturnType<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateLibraryPageV1']>> | Awaited<ReturnType<NonNullable<Phase55WorkoutTemplateLibraryApi['getCoachWorkoutTemplateLibraryPageV2']>>> | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // API requests cannot be aborted by this transport. Incrementing this token
  // cancels their authority instead: only the newest query may change results
  // or clear its loading state.
  const requestGeneration = useRef(0)
  const queryTimer = useRef<number | null>(null)
  const firstLoad = useRef(true)
  const stale = (cause: unknown) => cause instanceof CoachApiError && cause.code === 'workout_template_stale'
  const load = async (more = false, retry = true) => {
    const generation = ++requestGeneration.current
    const requestQuery = query
    const prior = more ? page : null
    if (more && !prior) return
    setLoading(true); setError(null)
    try {
      const input = { gym, lifecycle: 'active' as const, search_text: requestQuery || null, cursor: prior?.next_cursor ?? null, page_size: 20, expected_read_token: prior?.next_read_token ?? null }
      const result = richWorkoutTemplateAvailable(api) ? await api.getCoachWorkoutTemplateLibraryPageV2!(input) : await api.getCoachWorkoutTemplateLibraryPageV1(input)
      if (generation !== requestGeneration.current || requestQuery !== query) return
      setPage(current => more && current && current.contract_version === result.contract_version ? { ...result, items: [...current.items, ...result.items] } as typeof result : result)
    } catch (cause) {
      if (generation !== requestGeneration.current) return
      if (cause instanceof CoachApiError && cause.code === 'request_rejected' && cause.status === 404) onUnavailable()
      else if (stale(cause) && retry) { setPage(null); await load(false, false) }
      else setError(errorText(cause))
    } finally { if (generation === requestGeneration.current) setLoading(false) }
  }
  useEffect(() => {
    setPage(null)
    if (firstLoad.current) { firstLoad.current = false; void load(false); return }
    queryTimer.current = window.setTimeout(() => { queryTimer.current = null; void load(false) }, 250)
    return () => { if (queryTimer.current !== null) { window.clearTimeout(queryTimer.current); queryTimer.current = null } }
  }, [api, gym, query])
  const changeQuery = (value: string) => {
    const next = boundedTemplateSearch(value)
    if (next === query) return
    requestGeneration.current += 1
    setPage(null); setError(null); setLoading(true); setQuery(next)
  }
  return <Modal label="Add workout from template" busy={busy} onClose={onClose}><h2>Add workout from template</h2><label>Search workout templates<input autoFocus maxLength={160} value={query} onChange={event => changeQuery(event.target.value)} /></label><p role="status" aria-live="polite">{loading ? 'Loading templates…' : page ? `${page.items.length} templates available.` : 'Loading templates…'}</p>{error && <p role="alert">{error}</p>}<div className="template-picker-list">{page?.items.map(item => <button key={item.template_id} disabled={busy || loading || item.readiness !== 'ready' || !('rich_supported' in item ? item.rich_supported : item.supported)} onClick={() => onChoose(item)}>{item.name} <small>{item.readiness === 'ready' && ('rich_supported' in item ? item.rich_supported : item.supported) ? 'Ready' : 'Unavailable'}</small></button>)}{page?.has_more && <button disabled={busy || loading} onClick={() => void load(true)}>Load more templates</button>}</div><div className="dialog-actions"><button disabled={busy} onClick={onClose}>Cancel</button></div></Modal>
}

function Phase55NoCurrentAssignment({ api, lifecycleApi, client, onBack, onPlans, onCreated }: { api: ConnectedCoachApiV4; lifecycleApi: Phase55AssignmentLifecycleApi; client: { gym: string; athlete: string; athleteName: string }; onBack(): void; onPlans(): void; onCreated(assignment: string): void }) {
  const [creating, setCreating] = useState(false)
  const [mutation, setMutation] = useState<'create' | null>(null)
  const weekdays = weekdayNames.map((weekday, index) => <article key={weekday} className="week-slot empty-week-slot" role="listitem"><p>{weekday}</p><strong>No workout planned</strong><small>Start a program to schedule this day.</small><span>Day {index + 1}</span></article>)
  return <main className="connected-app approved-home phase55-empty-calendar">
    <aside className="connected-roster" aria-label="Roster"><div className="brand"><span>UNRACK</span><small>COACH</small></div><button className="text-button" onClick={onBack}>Back to clients</button></aside>
    <section className="connected-main"><header className="connected-header"><div><p className="eyebrow">{client.athleteName.toUpperCase()}</p><h1>Week</h1><p>No current program</p></div><button className="button outline" onClick={onPlans}>Plans</button></header><section className="empty-calendar-workspace" aria-label="Empty seven-day calendar"><p>Start a program to create this client’s first calendar. It will remain a paused draft until you mark it ready and activate it.</p><div className="week-slot-list" role="list" aria-label="Empty seven-day calendar">{weekdays}</div><button className="button primary" onClick={() => setCreating(true)}>Start program</button></section></section>
    {creating && <CreateSkeleton api={{ ...api, createCalendarProgram: lifecycleApi.createCalendarProgramV2 }} gymId={client.gym} athletes={[{ athlete_id: client.athlete, roster_name: client.athleteName }]} selectedAthlete={client.athlete} onClose={() => setCreating(false)} onComplete={async assignment => { setCreating(false); onCreated(assignment) }} mutation={mutation} setMutation={setMutation} />}
  </main>
}

function ConnectedCoachAppV3({ api, onSignOut }: Props) {
  const [workspace, setWorkspace] = useState<CoachWorkspace | null>(null)
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null)
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null)
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [creating, setCreating] = useState(false)
  const [mutation, setMutationState] = useState<'save' | 'publish' | 'add' | 'create' | null>(null)
  const mutationRef = useRef<typeof mutation>(null)
  const setMutation = (value: typeof mutation) => { mutationRef.current = value; setMutationState(value) }
  const [notice, setNotice] = useState<string | null>(null)
  const [templateNotice, setTemplateNotice] = useState(false)
  const [dayEditorDirty, setDayEditorDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [discardVersion, setDiscardVersion] = useState(0)

  const mounted = useRef(true)
  const generation = useRef(0)
  const dayEditorDirtyRef = useRef(false)
  const dialogOpener = useRef<HTMLElement | null>(null)
  const discardOpener = useRef<HTMLElement | null>(null)
  const pendingNavigation = useRef<(() => void) | null>(null)
  const onDayEditorDirtyChange = (dirty: boolean) => { dayEditorDirtyRef.current = dirty; setDayEditorDirty(dirty) }
  const requestNavigation = (navigation: () => void) => {
    if (mutationRef.current) return
    if (!dayEditorDirtyRef.current) { navigation(); return }
    discardOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pendingNavigation.current = navigation
    setConfirmDiscard(true)
  }
  const keepEditing = () => { pendingNavigation.current = null; setConfirmDiscard(false); queueMicrotask(() => discardOpener.current?.focus()) }
  const discardChanges = () => { if (mutationRef.current) return; const navigation = pendingNavigation.current; pendingNavigation.current = null; onDayEditorDirtyChange(false); setDiscardVersion(current => current + 1); setConfirmDiscard(false); navigation?.() }
  const openDialog = (kind: 'add' | 'create', athleteId: string | null = null, opener: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null) => { dialogOpener.current = opener; setSelectedAthlete(athleteId); kind === 'add' ? setAdding(true) : setCreating(true) }
  const closeDialog = (kind: 'add' | 'create') => { kind === 'add' ? setAdding(false) : setCreating(false); queueMicrotask(() => dialogOpener.current?.focus()) }
  const reload = async (assignment = selectedAssignment) => {
    const request = ++generation.current
    setLoading(true); setError(null)
    try { const next = await api.getCoachWorkspaceV3({ selected_assignment: assignment }); if (!mounted.current || request !== generation.current) return false; setWorkspace(next); return true }
    catch (cause) { if (mounted.current && request === generation.current) setError(errorText(cause)); return false }
    finally { if (mounted.current && request === generation.current) setLoading(false) }
  }
  useEffect(() => { mounted.current = true; void reload(null); return () => { mounted.current = false; generation.current++ } }, [])
  useEffect(() => {
    if (!dayEditorDirty) return
    const guardBrowserNavigation = (event: BeforeUnloadEvent) => { if (dayEditorDirtyRef.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guardBrowserNavigation)
    return () => window.removeEventListener('beforeunload', guardBrowserNavigation)
  }, [dayEditorDirty])
  const gym = workspace?.gyms.find(item => item.gym_id === selectedGymId) ?? workspace?.gyms[0]
  const selected = workspace?.selected ?? null
  const selectProgram = (assignment: string) => { if (mutation || assignment === selected?.assignment_id) return; requestNavigation(() => { setSelectedAssignment(assignment); void reload(assignment) }) }

  if (loading && !workspace) return <main className="connected-status" role="status">Loading your coach workspace…</main>
  if (error && !workspace) return <main className="connected-status"><p role="alert">{error}</p><button className="button primary" onClick={() => void reload()}>Retry</button></main>
  if (!gym) return <main className="connected-status"><p>No gym workspace is connected to this owner account.</p><button className="text-button" onClick={onSignOut}>Sign out</button></main>

  const retryDisabled = Boolean(mutation) || loading || confirmDiscard || adding || creating
  const athlete = gym.roster.find(item => item.athlete_id === selected?.athlete_id)
  return <main className="connected-app">
    <aside className="connected-roster" aria-label="Roster">
      <div className="brand"><span>UNRACK</span><small>COACH</small></div>
      {workspace!.gyms.length > 1 ? <label className="gym-picker">Gym<select aria-label="Select gym" disabled={Boolean(mutation)} value={gym.gym_id} onChange={event => { const gymId = event.target.value; requestNavigation(() => { setSelectedGymId(gymId); setSelectedAssignment(null); void reload(null) }) }}>{workspace!.gyms.map(item => <option key={item.gym_id} value={item.gym_id}>{item.gym_name}</option>)}</select></label> : <p className="eyebrow">{gym.gym_name} · {gym.role}</p>}
      {(gym.role === 'owner' || gym.role === 'admin') && <button className="button primary" disabled={Boolean(mutation)} onClick={event => { const opener = event.currentTarget; requestNavigation(() => openDialog('add', null, opener)) }}>+ Add athlete</button>}
      <h2>Athletes</h2>
      {gym.roster.length === 0 ? <p className="empty-copy">Your roster is empty.</p> : gym.roster.map(person => <section className="connected-athlete" key={person.athlete_id}>
        <div><span>{initials(person.roster_name)}</span><strong>{person.roster_name}</strong><small>{person.active_device_count} active device{person.active_device_count === 1 ? '' : 's'}</small></div>
        {person.programs.map(program => <button key={program.assignment_id} disabled={Boolean(mutation)} className={`program-nav-item${selected?.assignment_id === program.assignment_id ? ' selected' : ''}`} onClick={() => selectProgram(program.assignment_id)}><span className="program-nav-name">{program.program_name}</span><small><span className="program-lifecycle">{programLifecycleLabel(program.program_status)}</span><span className="program-version">Version {program.builder_version}</span></small></button>)}
        <button className="link-button" disabled={Boolean(mutation)} onClick={event => { const opener = event.currentTarget; requestNavigation(() => openDialog('create', person.athlete_id, opener)) }}>+ Program</button>
      </section>)}
      <button className="text-button signout" disabled={Boolean(mutation)} onClick={() => requestNavigation(onSignOut)}>Sign out</button>
    </aside>
    <section className="connected-main">
      <header className="connected-header"><div><p className="eyebrow">LIVE WORKSPACE</p><h1>{selected ? selected.name : 'Select a program'}</h1>{athlete && <p>{athlete.roster_name} · Builder version {selected?.builder_version}</p>}</div><button className="button outline" disabled={Boolean(mutation)} onClick={() => requestNavigation(() => void reload())}>Reload</button></header>
      {error && <p className="workspace-error" role="alert">{error} <button disabled={retryDisabled} onClick={() => requestNavigation(() => void reload())}>Retry</button></p>}
      {loading && <p role="status" className="loading-inline">Refreshing workspace…</p>}
      {!selected ? <section className="empty-workspace"><h2>No program selected</h2><p>Select a program from the roster, or build a new plan for an athlete.</p><div className="empty-actions"><button className="button primary" disabled={Boolean(mutation)} onClick={event => { const opener = event.currentTarget; requestNavigation(() => openDialog('create', gym.roster[0]?.athlete_id ?? null, opener)) }}>Build new program</button><button className="button outline" onClick={() => setTemplateNotice(true)}>Apply template</button></div>{templateNotice && <p role="status">Templates are not available yet. Template selection and application are planned for Phase 5.</p>}</section> : <><DeliveryBadge athlete={athlete} assignmentId={selected.assignment_id} />{<ProgramBuilder onSaved={result => setWorkspace(current => reconcileSavedDay(current, result))} retryDisabled={retryDisabled} selected={selected} api={api} onReload={() => reload(selected.assignment_id)} requestNavigation={requestNavigation} discardVersion={discardVersion} refreshing={loading} onDirtyChange={onDayEditorDirtyChange} mutation={mutation} setMutation={setMutation} notice={notice} setNotice={setNotice} />}</>}
    </section>
    {adding && <AddAthlete api={api} gymId={gym.gym_id} onClose={() => closeDialog('add')} onComplete={async () => { if (await reload()) closeDialog('add') }} mutation={mutation} setMutation={setMutation} />}
    {creating && <CreateSkeleton api={api} gymId={gym.gym_id} athletes={gym.roster} selectedAthlete={selectedAthlete} onClose={() => closeDialog('create')} onComplete={async (assignment) => { setSelectedAssignment(assignment); if (await reload(assignment)) closeDialog('create') }} mutation={mutation} setMutation={setMutation} />}
    {confirmDiscard && !mutation && <DiscardChangesDialog onKeep={keepEditing} onDiscard={discardChanges} />}
  </main>
}

function DeliveryBadge({ athlete, assignmentId }: { athlete: CoachWorkspace['gyms'][number]['roster'][number] | undefined; assignmentId: string }) {
  const delivery = athlete?.programs.find(program => program.assignment_id === assignmentId)?.delivery
  if (!delivery) return null
  const label = deliveryLabel(delivery.status)
  return <p className="delivery-badge" aria-label={`Delivery ${label}`}>Delivery: <strong>{label}</strong> · {delivery.acknowledged_receipts}/{delivery.expected_receipts} acknowledged{delivery.status === 'awaiting_device' ? ' · athlete device not connected' : ''}</p>
}

function ProgramBuilder({ retryDisabled, selected, api, onSaved, onReload, requestNavigation, discardVersion, refreshing, onDirtyChange, mutation, setMutation, notice, setNotice }: { retryDisabled: boolean; selected: NonNullable<CoachWorkspace['selected']>; api: ConnectedCoachApi; onSaved(result: SaveCoachProgramDayV2Result): void; onReload(): Promise<boolean>; requestNavigation(navigation: () => void): void; discardVersion: number; refreshing: boolean; onDirtyChange(dirty: boolean): void; mutation: 'save' | 'publish' | 'add' | 'create' | null; setMutation(value: 'save' | 'publish' | 'add' | 'create' | null): void; notice: string | null; setNotice(value: string | null): void }) {
  const [weekToken, setWeekToken] = useState(selected.weeks[0]?.identity_token ?? '')
  const week = selected.weeks.find(item => item.identity_token === weekToken) ?? selected.weeks[0]
  const [view, setView] = useState<'Day' | 'Week' | 'Plan'>('Week')
  const [dayOrdinal, setDayOrdinal] = useState<number | null>(null)
  const slots = week ? programSlots(selected.calendar, week) : []
  const activeSlot = slots.find(slot => slot.ordinal === dayOrdinal) ?? slots.find(slot => slot.day) ?? slots[0]
  useEffect(() => setDayOrdinal(null), [week?.identity_token])
  useEffect(() => setView('Week'), [selected.program_id])
  const views = ['Day', 'Week', 'Plan'] as const
  const onSlotKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? slots.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + slots.length) % slots.length
    const nextSlot = slots[next]
    if (nextSlot.ordinal !== activeSlot?.ordinal) requestNavigation(() => { setDayOrdinal(nextSlot.ordinal); document.getElementById(`calendar-slot-${nextSlot.ordinal}`)?.focus() })
  }
  useEffect(() => setWeekToken(selected.weeks[0]?.identity_token ?? ''), [selected.program_id])
  const version = useRef(selected.builder_version)
  useEffect(() => { version.current = selected.builder_version }, [selected.builder_version, selected.program_id])
  const saveDay = async (day: SaveCoachProgramDayV2) => {
    if (!week || !selected.phase3_editable || mutation) throw new Error('This day is unavailable for editing.')
    setMutation('save'); setNotice(null)
    try {
      const result = await api.saveCoachProgramDayV2({ program: selected.program_id, assignment: selected.assignment_id, expected_builder_version: version.current, week_identity_token: week.identity_token, day })
      version.current = result.builder_version
      onSaved(result)
      return result.day
    } finally { setMutation(null) }
  }
  const publish = async () => {
    if (mutation) return
    setMutation('publish'); setNotice(null)
    try {
      const fresh = await api.getCoachWorkspaceV3({ selected_assignment: selected.assignment_id }); const current = fresh.selected
      if (!current?.publish_boundary) throw new Error('This draft has no publish boundary. Reload and save a valid training day first.')
      if (current.empty_unmarked_day_tokens.length) { setNotice('Publish blocked: mark empty days as rest or add work to each day.'); return }
      await api.publishProgram({ program: current.program_id, assignment: current.assignment_id, boundary_kind: current.publish_boundary.kind, boundary_id: current.publish_boundary.id, expected_builder_version: current.builder_version }); setNotice('Published. Delivery status is now live.'); await onReload()
    } catch (cause) { setNotice(errorText(cause)) } finally { setMutation(null) }
  }
  return <>
    <div className="builder-toolbar">{view !== 'Plan' && <ManualTabList aria-label="Program weeks">{selected.weeks.map((item, index) => <button id={`connected-week-${item.identity_token}`} disabled={Boolean(mutation)} role="tab" aria-controls={`connected-week-panel-${item.identity_token}`} aria-selected={week?.identity_token === item.identity_token} tabIndex={week?.identity_token === item.identity_token ? 0 : -1} key={item.identity_token} onClick={() => { if (item.identity_token !== week?.identity_token) requestNavigation(() => setWeekToken(item.identity_token)) }}>Week {item.ordinal || index + 1}</button>)}</ManualTabList>}<span className="save-state">{mutation ? 'Saving…' : 'Draft'}</span>{view !== 'Plan' && <button className="button primary" disabled={Boolean(mutation) || !selected.phase3_editable} onClick={() => requestNavigation(() => void publish())}>Publish</button>}</div>
    {notice && <p className={notice.startsWith('Saved') || notice.startsWith('Published') ? 'workspace-notice' : 'workspace-error'} role="status">{notice}{!notice.startsWith('Saved') && !notice.startsWith('Published') && <button disabled={retryDisabled} onClick={() => requestNavigation(() => void onReload())}>Retry</button>}</p>}
    {selected.empty_unmarked_day_tokens.length > 0 && <p className="warning" role="alert"><strong>Empty-day warning</strong> Mark empty days as rest or add training work before publishing: {selected.weeks.flatMap(item => item.days.filter(day => selected.empty_unmarked_day_tokens.includes(day.identity_token)).map(day => `Week ${item.ordinal} · ${weekdayForOrdinal(day.ordinal)}`)).join(', ')}.</p>}
    <ManualTabList className="program-views" aria-label="Program view">{views.map(item => <button key={item} id={`builder-view-${item}`} disabled={Boolean(mutation)} role="tab" aria-selected={view === item} aria-controls="program-view-panel" tabIndex={view === item ? 0 : -1} onClick={() => { if (item !== view) requestNavigation(() => setView(item)) }}>{item}</button>)}</ManualTabList>
    {!selected.calendar && <p className="positional-note">Positional program · dates are not scheduled.</p>}
    <div id="program-view-panel" role="tabpanel" aria-labelledby={`builder-view-${view}`}>
      {view === 'Plan' ? <div className="plan-overview"><p>Read-only plan overview</p>{selected.weeks.map(item => <section key={item.identity_token} aria-label={`Plan week ${item.ordinal}`}><h2>Week {item.ordinal}</h2><div className="plan-slots">{programSlots(selected.calendar, item).map(slot => <div className="plan-slot" key={slot.ordinal}><strong>{selected.calendar ? weekdayForOrdinal(slot.ordinal) : slot.label}</strong>{slot.plannedDate && <time dateTime={slot.plannedDate}>{slot.plannedDate}</time>}<span>{slotStatus(slot.day)}</span>{slot.day?.exercises.length ? <small>{slot.day.exercises.map(exercise => exercise.name).join(', ')}</small> : null}</div>)}</div>{!item.days.length && !selected.calendar && <p>No days authored in this week.</p>}</section>)}</div> : <>
        <div id={`connected-week-panel-${week?.identity_token}`} role="tabpanel" aria-labelledby={`connected-week-${week?.identity_token}`}>
          {view === 'Week' && <div className="week-slot-list" aria-label="Week slots">{slots.map((slot, index) => <button key={slot.ordinal} id={`calendar-slot-${slot.ordinal}`} className="week-slot" disabled={Boolean(mutation)} aria-label={`${selected.calendar ? weekdayForOrdinal(slot.ordinal) : slot.label}${slot.plannedDate ? ` ${slot.plannedDate}` : ''} · ${slotStatus(slot.day)}`} aria-pressed={activeSlot?.ordinal === slot.ordinal} tabIndex={activeSlot?.ordinal === slot.ordinal ? 0 : -1} onKeyDown={event => onSlotKeyDown(event, index)} onClick={() => { if (slot.ordinal !== activeSlot?.ordinal) requestNavigation(() => setDayOrdinal(slot.ordinal)) }}><strong>{selected.calendar ? weekdayForOrdinal(slot.ordinal) : slot.label}</strong>{slot.plannedDate && <time dateTime={slot.plannedDate}>{slot.plannedDate}</time>}<span>{slotStatus(slot.day)}</span><small>{slot.day?.exercises.length ? slot.day.exercises.map(exercise => exercise.name).join(', ') : null}</small></button>)}</div>}
          {slots.length > 0 && <label className={view === 'Day' ? 'day-picker' : 'day-picker mobile-day-picker'}>Day<select disabled={Boolean(mutation)} value={activeSlot?.ordinal} onChange={event => { const ordinal = Number(event.target.value); if (ordinal !== activeSlot?.ordinal) requestNavigation(() => setDayOrdinal(ordinal)) }}>{slots.map(slot => <option key={slot.ordinal} value={slot.ordinal}>{selected.calendar ? weekdayForOrdinal(slot.ordinal) : slot.label} · {slotStatus(slot.day)}</option>)}</select></label>}
          <div className="selected-day-editor">{activeSlot?.day ? <DayEditor key={`${week.identity_token}:${activeSlot.day.identity_token}`} day={week.days.find(day => day.identity_token === activeSlot.day?.identity_token)!} fixedWeekday={Boolean(selected.calendar)} defaultUnit={selected.default_unit} disabled={!selected.phase3_editable || !week.days.find(day => day.identity_token === activeSlot.day?.identity_token)?.day_editable || activeSlot.day.locked_any || Boolean(mutation) || refreshing} refreshing={refreshing} saving={mutation === 'save'} discardVersion={discardVersion} onDirtyChange={onDirtyChange} onSave={saveDay} /> : <section className="connected-day"><h2>{activeSlot ? (selected.calendar ? weekdayForOrdinal(activeSlot.ordinal) : activeSlot.label) : 'No authored days'}</h2><p>{activeSlot ? 'Unscheduled — no workout or rest day is authored for this slot.' : 'This week has no authored days.'}</p></section>}</div>
        </div>
      </>}
    </div>
  </>
}



function requestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80
  const value = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

type DayFocus = { week: string; token: string; ordinal: number }
type CopyPreview =
  | { contract: 'v3'; canonicalInputHash: string; input: PreviewBuilderWeekCopyV3Input; requestId: string; result: PreviewBuilderWeekCopyV3Result }
  | { contract: 'v1'; canonicalInputHash: string; input: PreviewBuilderCopyV1Input; requestId: string; result: PreviewBuilderCopyV1Result }
  | { contract: 'v2'; canonicalInputHash: string; input: PreviewBuilderCopyV2Input; requestId: string; result: PreviewBuilderCopyV2Result }
type CopyDestinationChoice = Pick<CopyDestination, 'week_identity_token' | 'collision_policy'>
type CopyState = { kind: 'day' | 'week'; sourceWeek: string; sourceDay: string | null; destinations: CopyDestinationChoice[]; preview: CopyPreview | null; result: ApplyBuilderCopyV1Result | ApplyBuilderCopyV2Result | null; confirmingOverwrite?: boolean; copying?: boolean }
type ProgressionPreview = { canonicalInputHash: string; input: PreviewBuilderProgressionV1Input; requestId: string; result: PreviewBuilderProgressionV1Result }
type ProgressionState = { scope: ProgressionScope; transform: ProgressionTransform; preview: ProgressionPreview | null; result: ApplyBuilderProgressionV1Result | null }
type ProgressionV2Preview = { canonicalInputHash: string; input: PreviewBuilderProgressionV2Input; requestId: string; result: PreviewBuilderProgressionV2Result }
type ProgressionV2State = {
  sourceWeek: string
  sourceDay: string
  scope: ProgressionV2Scope
  destinationWeekTokens: string[]
  rule: ProgressionV2Rule
  overrides: ProgressionV2Override[]
  replaceReviewedWeeks: boolean
  preview: ProgressionV2Preview | null
  previewing: boolean
  frozen: boolean
}
type ReadinessState = Pick<SetCoachProgramReadinessV1Result, 'issue_count' | 'issues_truncated' | 'issues'>
type Recovery = { label: string; retry(): void }
type TargetFocusRequest = {
  target: string
  assignmentId: string
  dayIdentityToken: string
  week: string
  ordinal: number
  loadGeneration: number
}

const tokenKey = (token: object): string => JSON.stringify(token)
const readConflict = (cause: unknown) => cause instanceof CoachApiError && (cause.code === 'navigation_read_changed' || cause.code === 'assignment_read_changed')
const staleAuthority = (cause: unknown) => cause instanceof CoachApiError && (
  cause.code === 'assignment_read_changed' || cause.code === 'stale_builder_version' || cause.code === 'serialization_retry'
  || cause.code === 'day_locked' || cause.code === 'identity_conflict' || cause.code === 'progression_scope_invalid'
  || cause.code === 'day_slot_already_authored' || cause.code === 'copy_preview_changed' || cause.code === 'progression_preview_changed'
)
const definitiveAuthority = (cause: unknown) => cause instanceof CoachApiError && (cause.code === 'access_denied' || cause.code === 'program_archived' || cause.code === 'session_expired')
const uncertainMutation = (cause: unknown) => cause instanceof CoachApiError && (cause.code === 'network_unavailable' || cause.code === 'invalid_response')
const uncertainTemplateMutation = (cause: unknown) => uncertainMutation(cause) || cause instanceof CoachApiError && cause.status !== null && cause.status >= 500
const retryableReadFailure = (cause: unknown) => cause instanceof CoachApiError && (readConflict(cause) || cause.code === 'serialization_retry' || cause.code === 'network_unavailable')
const canonicalInputHash = (input: PreviewBuilderCopyV1Input | PreviewBuilderProgressionV1Input | PreviewBuilderProgressionV2Input) => JSON.stringify(input)
const copySelectionKey = (state: CopyState | null) => state ? JSON.stringify({
  kind: state.kind,
  sourceWeek: state.sourceWeek,
  sourceDay: state.sourceDay,
  destinations: state.destinations,
}) : null
const frozenCopyState = (frozen: CopyPreview): CopyState => ({
  kind: frozen.input.copy_kind,
  sourceWeek: frozen.input.source.week_identity_token,
  sourceDay: 'day_identity_token' in frozen.input.source ? frozen.input.source.day_identity_token : null,
  destinations: frozen.input.destinations.map(destination => ({
    week_identity_token: destination.week_identity_token,
    collision_policy: destination.collision_policy,
  })),
  preview: frozen,
  result: null,
  copying: false,
})
const frozenProgressionV2State = (frozen: ProgressionV2Preview, isFrozen: boolean): ProgressionV2State => ({
  sourceWeek: frozen.input.source.week_identity_token,
  sourceDay: frozen.input.source.day_identity_token,
  scope: frozen.input.scope,
  destinationWeekTokens: frozen.input.destination_week_identity_tokens,
  rule: frozen.input.rule,
  overrides: frozen.input.overrides,
  replaceReviewedWeeks: frozen.input.replace_reviewed_weeks,
  preview: frozen,
  previewing: false,
  frozen: isFrozen,
})
const validDecimal = (value: number, maximum: number, places: number): boolean => {
  if (!Number.isFinite(value) || value <= 0 || value > maximum) return false
  const rendered = Math.abs(value).toString()
  const decimal = rendered.indexOf('.')
  return !/[eE]/.test(rendered) && (decimal < 0 || rendered.length - decimal - 1 <= places)
}
const validProgressionTransform = (transform: ProgressionTransform): boolean => {
  switch (transform.kind) {
    case 'exact_load': return validDecimal(transform.amount, 2000, 3)
    case 'percent_points': return validDecimal(transform.amount, 200, 3)
    case 'reps': return Number.isInteger(transform.amount) && transform.amount >= 1 && transform.amount <= 99
    case 'sets': return Number.isInteger(transform.amount) && transform.amount >= 1 && transform.amount <= 19
    case 'rpe': return validDecimal(transform.amount, 9, 1)
  }
}

function buildProgressionInput(detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5 | null, focus: DayFocus | null, day: CoachProgramDayV3 | CoachProgramDayV5 | null, state: ProgressionState): PreviewBuilderProgressionV1Input | null {
  if (!detail || !focus || !day || !validProgressionTransform(state.transform)) return null
  const expectedKind = state.transform.kind === 'sets' ? 'exercises' : 'set_rows'
  if (state.scope.kind !== expectedKind || state.scope.week_identity_tokens.length !== 1 || state.scope.week_identity_tokens[0] !== focus.week || !state.scope.identity_tokens.length) return null
  const available = new Set(expectedKind === 'exercises' ? day.exercises.map(exercise => exercise.identity_token) : day.exercises.flatMap(exercise => exercise.set_groups.map(row => row.identity_token)))
  if (new Set(state.scope.identity_tokens).size !== state.scope.identity_tokens.length || state.scope.identity_tokens.some(token => !available.has(token))) return null
  return { program: detail.program_id, assignment: detail.assignment_id, expected_builder_version: detail.builder_version, scope: state.scope, transform: state.transform }
}

const validProgressionV2Rule = (rule: ProgressionV2Rule): boolean => {
  if (rule.kind === 'exact_load') return validDecimal(rule.amount, 2000, 3)
  if (rule.kind === 'percent_points') return validDecimal(rule.amount, 200, 3)
  if (rule.kind === 'rpe') return validDecimal(rule.amount, 9, 1)
  return Number.isInteger(rule.amount) && rule.amount >= 1 && rule.amount <= (rule.kind === 'sets' ? 19 : 99)
}

function buildProgressionV2Input(detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5 | null, focus: DayFocus | null, day: CoachProgramDayV3 | CoachProgramDayV5 | null, state: ProgressionV2State): PreviewBuilderProgressionV2Input | null {
  if (!detail || !focus || !day || focus.week !== state.sourceWeek || focus.token !== state.sourceDay
    || !validProgressionV2Rule(state.rule) || state.destinationWeekTokens.length < 1
    || state.destinationWeekTokens.length > 12 || new Set(state.destinationWeekTokens).size !== state.destinationWeekTokens.length) return null
  const sourceWeek = detail.weeks.find(week => week.week_identity_token === state.sourceWeek)
  const sourceOrdinal = sourceWeek?.week_ordinal
  if (!sourceOrdinal || state.destinationWeekTokens.some(token => {
    const week = detail.weeks.find(item => item.week_identity_token === token)
    return !week || week.week_ordinal < sourceOrdinal
  })) return null
  if (state.scope.kind === 'exercises') {
    const available = new Set(day.exercises.map(exercise => exercise.identity_token))
    if (state.scope.source_exercise_identity_tokens.length < 1
      || new Set(state.scope.source_exercise_identity_tokens).size !== state.scope.source_exercise_identity_tokens.length
      || state.scope.source_exercise_identity_tokens.some(token => !available.has(token))) return null
  }
  return {
    program: detail.program_id, assignment: detail.assignment_id,
    expected_builder_version: detail.builder_version,
    source: { week_identity_token: state.sourceWeek, day_identity_token: state.sourceDay },
    scope: state.scope, destination_week_identity_tokens: state.destinationWeekTokens,
    rule: state.rule, overrides: state.overrides,
    replace_reviewed_weeks: state.replaceReviewedWeeks,
  }
}

function V4WeekOverview({ week, locked, onChooseDay, onAuthorDay, onTemplateDay }: { week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5; locked: boolean; onChooseDay(slot: V4WeekSlot): void; onAuthorDay?(slot: V4WeekSlot): void; onTemplateDay?(slot: V4WeekSlot): void }) {
  return <section className="v4-week-overview" role="region" aria-label={`Week ${week.week_ordinal} overview`}><div role="list">{projectV4WeekSlots(week).map(slot => {
    const title = slot.workout_title ?? workoutTitle(slot.label, slot.day_ordinal)
    const canAuthor = Boolean(onAuthorDay) && slot.status === 'unscheduled'
    const canTemplate = Boolean(onTemplateDay) && (slot.status === 'unscheduled' || slot.status === 'authored_empty')
    const canOpenExisting = Boolean(slot.day_identity_token) && (slot.status === 'authored_empty' || slot.status === 'rest')
    const slotLocked = locked || slot.locked_any
    const stateLabel = slot.status === 'workout' ? 'Training' : slot.status === 'authored_empty' ? 'Needs programming' : 'Rest day'
    return <article className={`day-status-${slot.status}`} aria-label={`${slot.weekday} calendar day`} data-state={slot.status} data-week-token={week.week_identity_token} data-day-ordinal={slot.day_ordinal} key={slot.day_ordinal} role="listitem">
      <header><h3>{slot.weekday}</h3><time dateTime={slot.planned_date ?? undefined}>{slot.planned_date ?? 'Date not set'}</time></header>
      {slot.status === 'workout' && slot.day_identity_token ? <button className="calendar-workout" aria-label={`${v4DaySlotLabel(slot)} · ${slot.locked_any ? 'Read only' : 'Review or edit'}`} disabled={slotLocked} onClick={() => onChooseDay(slot)}><span className="calendar-state-label">{stateLabel}</span><strong>{title ?? 'Workout'}</strong><small>{slot.exercise_count} {slot.exercise_count === 1 ? 'exercise' : 'exercises'} · {slot.set_row_count} {slot.set_row_count === 1 ? 'set' : 'sets'}</small><span className="calendar-workout-action">{slot.locked_any ? 'Read only' : 'Review or edit'}{!slot.locked_any && <span aria-hidden="true"> →</span>}</span></button>
        : slot.status === 'rest' ? <div className="calendar-day-state"><span className="calendar-state-label">{stateLabel}</span></div>
          : slot.status === 'authored_empty' ? <div className="calendar-day-state"><span className="calendar-state-label">{stateLabel}</span><strong>Finish this training day</strong><small>Add a workout or mark it as rest.</small></div>
            : <div className="calendar-day-state"><span className="calendar-state-label">{stateLabel}</span><strong>No training assigned</strong><small>Add a training day whenever the plan changes.</small></div>}
      {(canOpenExisting || canAuthor || canTemplate) && <div className="calendar-day-actions">{canOpenExisting && <button className="add-workout-slot" aria-label={`${slot.status === 'rest' ? 'Add training day' : 'Program day'} for ${slot.weekday}`} disabled={slotLocked} onClick={() => onChooseDay(slot)}>{slot.status === 'rest' ? 'Add training day' : 'Program day'}</button>}{canAuthor && <button className="add-workout-slot" aria-label={`Add training day for ${slot.weekday}`} disabled={slotLocked} onClick={() => onAuthorDay?.(slot)}>Add training day</button>}{canTemplate && <button className="template-workout-slot" aria-label={`Add workout from template for ${slot.weekday}`} disabled={slotLocked} onClick={() => onTemplateDay?.(slot)}>Use template</button>}</div>}
    </article>
  })}</div></section>
}

function UndoNotice({ expiresAt, description, disabled, onUndo }: { expiresAt: string; description: string; disabled: boolean; onUndo(): void }) {
  const deadline = Date.parse(expiresAt)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 1000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  }, [expiresAt])
  if (!Number.isFinite(deadline) || deadline <= now) return <aside className="undo-notice" role="status">The Undo window has ended.</aside>
  const localDeadline = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(deadline)
  return <aside className="undo-notice" aria-label="Undo available"><strong>Undo {description}</strong><span>Undo available until <time dateTime={expiresAt}>{localDeadline}</time></span><button disabled={disabled} onClick={() => { if (deadline > Date.now()) onUndo(); else setNow(Date.now()) }}>Undo</button></aside>
}

function V4PlanOverview({ weeks, readiness, onChooseWeek, onCopyWeek }: { weeks: Array<CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5>; readiness: 'draft' | 'ready'; onChooseWeek(week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5): void; onCopyWeek?(week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5): void }) {
  const orderedWeeks = [...weeks].sort((a, b) => a.week_ordinal - b.week_ordinal)
  return <section className="v4-plan-overview" role="region" aria-label="Program outline">
    <header><div><p className="eyebrow">PROGRAM OUTLINE</p><h2>{orderedWeeks.length} {orderedWeeks.length === 1 ? 'week' : 'weeks'}</h2></div><span className={`readiness-state ${readiness}`}>Coach programming · {readiness === 'ready' ? 'Ready' : 'Draft'}</span></header>
    <div className="v4-plan-weeks">{orderedWeeks.map(week => {
      const slots = projectV4WeekSlots(week)
      const training = slots.filter(slot => slot.status === 'workout').length
      const needsProgramming = slots.filter(slot => slot.status === 'authored_empty').length
      const rest = slots.length - training - needsProgramming
      return <article className="v4-plan-week" key={week.week_identity_token}>
        <header><div><p className="eyebrow">WEEK {week.week_ordinal}</p><h3>Week {week.week_ordinal}</h3><p>{training} training {training === 1 ? 'day' : 'days'} · {rest} rest {rest === 1 ? 'day' : 'days'} · {needsProgramming} {needsProgramming === 1 ? 'day needs' : 'days need'} programming</p></div><div className="phase4-actions">{onCopyWeek && <button className="button outline" onClick={() => onCopyWeek(week)}>Copy week</button>}<button className="button outline" onClick={() => onChooseWeek(week)}>Open week {week.week_ordinal}</button></div></header>
        <div className="v4-plan-days">{slots.map(slot => {
          const state = slot.status === 'workout' ? 'Training' : slot.status === 'authored_empty' ? 'Needs programming' : 'Rest day'
          const description = slot.status === 'workout' ? slot.workout_title ?? workoutTitle(slot.label, slot.day_ordinal) ?? 'Workout' : slot.status === 'authored_empty' ? 'Finish this training day' : 'No training assigned'
          return <div className={`v4-plan-day day-status-${slot.status}`} key={slot.day_ordinal}>
            <div className="v4-plan-day-date"><strong>{slot.weekday}</strong><time dateTime={slot.planned_date ?? undefined}>{slot.planned_date ?? 'Date not set'}</time></div>
            <span className="v4-plan-day-state">{state}</span><span className="v4-plan-day-name">{description}</span>
            {slot.status === 'workout' && <small>{slot.exercise_count} {slot.exercise_count === 1 ? 'exercise' : 'exercises'} · {slot.set_row_count} {slot.set_row_count === 1 ? 'set' : 'sets'}</small>}
          </div>
        })}</div>
      </article>
    })}</div>
  </section>
}

function ConnectedCoachAppV4({ api, correctionsApi, phase54Api, assignmentLifecycleApi = null, workoutTemplateApi = null, programTemplateApi = null, onWorkoutTemplateUnavailable, activationExpectedCurrentAssignment = null, onSignOut, initialGym = null, initialAssignment = null, initialAthlete = null, initialAthleteName = null, clientFirst = false, backLabel = 'Back to clients', onBackToDashboard, onViewPlans, onCurrentAssignmentDrift, onAssignmentActivated, registerNavigationGuard }: { api: ConnectedCoachApiV4; correctionsApi: Phase5CorrectionApi | null; phase54Api: Phase5CorrectionApi | null; assignmentLifecycleApi?: Phase55AssignmentLifecycleApi | null; workoutTemplateApi?: Phase55WorkoutTemplateLibraryApi | null; programTemplateApi?: Phase9ProgramTemplateApi | null; onWorkoutTemplateUnavailable?(): void; activationExpectedCurrentAssignment?: string | null; onSignOut(): void; initialGym?: string | null; initialAssignment?: string | null; initialAthlete?: string | null; initialAthleteName?: string | null; clientFirst?: boolean; backLabel?: string; onBackToDashboard?(): void; onViewPlans?(): void; onCurrentAssignmentDrift?(): void; onAssignmentActivated?(assignment: string): void; registerNavigationGuard?(guard: (action: () => void) => void): void }) {
  const recoveryPrincipal = useContext(WorkoutRecoveryPrincipalContext)
  const recoveryEpoch = useContext(WorkoutRecoveryEpochContext)
  const workoutRecovery = useRef<WorkoutRecoveryController | null>(null)
  const registerWorkoutRecovery = useCallback((controller: WorkoutRecoveryController | null) => { workoutRecovery.current = controller }, [])
  const recoveryMounted = useRef(false)
  useLayoutEffect(() => { recoveryMounted.current = true; return () => { recoveryMounted.current = false; workoutRecovery.current = null } }, [])
  const oct18Api = api as ConnectedCoachApiV4 & Partial<October18CoachApi>
  type CompactResult = { undo: { undo_id: string; expires_at: string } | null }
  const compactApi = api as ConnectedCoachApiV4 & Partial<{
    moveCoachProgramDayV1(input: { request_id: string; program: string; assignment: string; expected_builder_version: number; week_identity_token: string; source_day_identity_token: string; destination_day_ordinal: number; swap: boolean }): Promise<CompactResult>
    appendCoachProgramWeekV1(input: { request_id: string; program: string; assignment: string; expected_builder_version: number }): Promise<unknown>
    setCoachProgramExerciseTrackingV1(input: { request_id: string; program: string; assignment: string; expected_builder_version: number; exercise_id: string; tracked: boolean }): Promise<unknown>
    undoCompactProgrammingOperationV1(input: { request_id: string; root_kind: 'program'; root_id: string; assignment: string; expected_builder_version: number; undo_id: string }): Promise<unknown>
  }>
  const [moveWorkout, setMoveWorkout] = useState<{ requestId: string; assignment: string; program: string; version: number; source: DayFocus; destination: number; reviewed: boolean; destinationNeedsReview?: boolean } | null>(null)
  const [compactUndo, setCompactUndo] = useState<{ requestId: string; program: string; assignment: string; undo_id: string; expires_at: string } | null>(null)
  const appendWeekRequest = useRef({ canonicalInputHash: '', requestId: '' })
  const richTrackingApi = phase54Api as (Phase5CorrectionApi & Partial<RichAssignmentTrackingApiUi>) | null
  const percentApi = api as ConnectedCoachApiV4 & Partial<PercentRecalculationApiUi>
  const ensureExerciseApi = api as ConnectedCoachApiV4 & Partial<EnsureCoachExerciseApiUi>
  type GymItems = Awaited<ReturnType<ConnectedCoachApiV4['getCoachNavigationGymsV4']>>['items']
  type RosterItems = Awaited<ReturnType<ConnectedCoachApiV4['getCoachNavigationRosterV4']>>['items']
  type AssignmentItems = Awaited<ReturnType<ConnectedCoachApiV4['getCoachNavigationAssignmentsV4']>>['items']
  const [gyms, setGyms] = useState<GymItems>([])
  const [gymCursor, setGymCursor] = useState<CoachNavigationGymsCursor | null>(null)
  const [gymToken, setGymToken] = useState<CoachNavigationGymsReadToken | null>(null)
  const [gymsMore, setGymsMore] = useState(false)
  const [gym, setGymState] = useState<string | null>(null)
  const [roster, setRoster] = useState<RosterItems>([])
  const [rosterCursor, setRosterCursor] = useState<CoachNavigationRosterCursor | null>(null)
  const [rosterToken, setRosterToken] = useState<CoachNavigationRosterReadToken | null>(null)
  const [rosterMore, setRosterMore] = useState(false)
  const [athlete, setAthleteState] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<AssignmentItems>([])
  const [assignmentCursor, setAssignmentCursor] = useState<CoachNavigationAssignmentsCursor | null>(null)
  const [assignmentToken, setAssignmentToken] = useState<CoachNavigationAssignmentsReadToken | null>(null)
  const [assignmentsMore, setAssignmentsMore] = useState(false)
  const [unavailableAssignments, setUnavailableAssignments] = useState<Set<string>>(() => new Set())
  const [assignment, setAssignmentState] = useState<string | null>(null)
  const [detail, setDetail] = useState<CoachAssignmentDetailV4 | CoachAssignmentDetailV5 | null>(null)
  const [focusedDay, setFocusedDay] = useState<CoachAssignmentDayV4['day'] | CoachAssignmentDayV5['day'] | CoachAssignmentDayV6['day'] | null>(null)
  const [richPercentBasisOptions, setRichPercentBasisOptions] = useState<RichPercentBasisOption[]>([])
  const [richExerciseOptions, setRichExerciseOptions] = useState<RichExerciseOptionUi[]>([])
  const [richTrackingSupported, setRichTrackingSupported] = useState(false)
  const [percentPreview, setPercentPreview] = useState<PercentPreviewUi | null>(null)
  const [percentReviewError, setPercentReviewError] = useState<string | null>(null)
  const focusedDayRegion = useRef<HTMLDivElement>(null)
  const focusedDayLoadingHeight = useRef(0)
  const [focus, setFocusState] = useState<DayFocus | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingNavigation, setLoadingNavigation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<Recovery | null>(null)
  const [copy, setCopy] = useState<CopyState | null>(null)
  const copyRef = useRef<CopyState | null>(null)
  const copyGeneration = useRef(0)
  const updateCopy = (value: CopyState | null | ((current: CopyState | null) => CopyState | null)) => {
    const next = typeof value === 'function' ? value(copyRef.current) : value
    if (copySelectionKey(next) !== copySelectionKey(copyRef.current)) copyGeneration.current += 1
    copyRef.current = next
    setCopy(next)
  }
  const [progression, setProgression] = useState<ProgressionState | null>(null)
  const [progressionV2, setProgressionV2] = useState<ProgressionV2State | null>(null)
  const progressionV2Ref = useRef<ProgressionV2State | null>(null)
  const progressionV2Generation = useRef(0)
  const progressionV2Capability = progressionV2Api(phase54Api)
  const commitProgressionV2 = (value: ProgressionV2State | null | ((current: ProgressionV2State | null) => ProgressionV2State | null), invalidate: boolean) => {
    const next = typeof value === 'function' ? value(progressionV2Ref.current) : value
    if (invalidate) progressionV2Generation.current += 1
    progressionV2Ref.current = next
    setProgressionV2(next)
  }
  const updateProgressionV2 = (value: ProgressionV2State | null | ((current: ProgressionV2State | null) => ProgressionV2State | null)) => commitProgressionV2(value, true)
  const reflectProgressionV2 = (value: ProgressionV2State | null | ((current: ProgressionV2State | null) => ProgressionV2State | null)) => commitProgressionV2(value, false)
  const [readiness, setReadiness] = useState<ReadinessState | null>(null)
  const [operationResult, setOperationResult] = useState<CoachBuilderOperationResult | null>(null)
  const [creating, setCreating] = useState(false)
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([])
  const [exerciseHistoryQuery, setExerciseHistoryQuery] = useState('')
  const [exerciseHistoryRevision, setExerciseHistoryRevision] = useState(0)
  const [targetFocus, setTargetFocus] = useState<TargetFocusRequest | null>(null)
  const [workspaceView, setWorkspaceView] = useState<'Day' | 'Week' | 'Plan'>(clientFirst ? 'Day' : 'Week')
  const [selectedWeekToken, setSelectedWeekToken] = useState<string | null>(null)
  const [templatePicker, setTemplatePicker] = useState<{ slot: V4WeekSlot; week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5 } | null>(null)
  const [templateReview, setTemplateReview] = useState<{ template: { template_id: string; builder_version: number }; slot: V4WeekSlot; week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5; shellRequestId: string; preview: TemplatePercentPreviewV1 | null; error: string | null; retryInput?: ApplyWorkoutTemplateV4Input } | null>(null)
  const [templateMaxProfileOpen, setTemplateMaxProfileOpen] = useState(false)
  const [publishScopeOpen, setPublishScopeOpen] = useState(false)
  const [publishScopeKind, setPublishScopeKind] = useState<'week' | 'program'>('program')
  const [publishWeekToken, setPublishWeekToken] = useState<string | null>(null)
  const [saveAsTemplate, setSaveAsTemplate] = useState<{ name: string; requestId: string } | null>(null)
  const [templateIssues, setTemplateIssues] = useState<CoachTemplateReadinessV1 | null>(null)
  const [resumePublishAfterTemplate, setResumePublishAfterTemplate] = useState(false)
  const [templateFeatureUnavailable, setTemplateFeatureUnavailable] = useState(false)
  const usableWorkoutTemplateApi = templateFeatureUnavailable ? null : workoutTemplateApi
  const [dirty, setDirtyState] = useState(false)
  const [editorCanSave, setEditorCanSave] = useState(false)
  const [guard, setGuard] = useState<(() => void | Promise<void>) | null>(null)
  const [guardPending, setGuardPending] = useState(false)
  const guardBusy = useRef(false), guardGeneration = useRef(0)
  const guardContext = useRef<{ controller: WorkoutRecoveryController | null; assignment: string | null; focus: DayFocus | null; authority: string } | null>(null)
  const dirtyRef = useRef(false)
  const saveDraft = useRef<(() => Promise<boolean>) | null>(null)
  const assignmentRef = useRef<string | null>(null)
  const pendingInitialAssignment = useRef(initialAssignment)
  const pendingInitialAthlete = useRef(initialAthlete)
  const pendingInitialGym = useRef(initialGym)
  const clientFirstExpectedCurrentAssignment = useRef(activationExpectedCurrentAssignment)
  const detailRef = useRef<CoachAssignmentDetailV4 | CoachAssignmentDetailV5 | null>(null)
  const focusRef = useRef<DayFocus | null>(null)
  const recoveryAuthority = JSON.stringify([recoveryPrincipal, recoveryEpoch, gym, athlete, assignment, focus?.week, focus?.token])
  const recoveryAuthorityRef = useRef(recoveryAuthority); recoveryAuthorityRef.current = recoveryAuthority
  const recoveryWorkspaceAuthority = JSON.stringify([recoveryPrincipal, recoveryEpoch, gym, athlete, assignment])
  const recoveryWorkspaceAuthorityRef = useRef(recoveryWorkspaceAuthority); recoveryWorkspaceAuthorityRef.current = recoveryWorkspaceAuthority
  const targetAfterLoad = useRef<TargetFocusRequest | null>(null)
  const gymGeneration = useRef(0)
  const rosterGeneration = useRef(0)
  const assignmentGeneration = useRef(0)
  const detailGeneration = useRef(0)
  const publishRequest = useRef({ canonicalInputHash: '', requestId: '' })
  const undoRequest = useRef({ canonicalInputHash: '', requestId: '' })
  const authorDayRequest = useRef({ canonicalInputHash: '', requestId: '' })
  const exerciseHistoryCache = useRef(new Map<string, string[]>())
  const exerciseHistoryGeneration = useRef(0)
  const locked = busy || Boolean(recovery) || Boolean(templateReview?.retryInput)
  const setDirty = (next: boolean) => { dirtyRef.current = next; setDirtyState(next) }
  const stableRequestId = (holder: { current: { canonicalInputHash: string; requestId: string } }, hash: string) => {
    if (holder.current.canonicalInputHash !== hash) holder.current = { canonicalInputHash: hash, requestId: requestId() }
    return holder.current.requestId
  }
  const clearTargetIntent = (generation?: number) => {
    if (generation === undefined || targetAfterLoad.current?.loadGeneration === generation) targetAfterLoad.current = null
    setTargetFocus(current => generation === undefined || current?.loadGeneration === generation ? null : current)
  }

  const clearAssignment = () => {
    detailGeneration.current += 1; assignmentRef.current = null; detailRef.current = null; focusRef.current = null
    clearTargetIntent(); setAssignmentState(null); setDetail(null); setFocusState(null); setFocusedDay(null); updateCopy(null); setMoveWorkout(null); setCompactUndo(null); setProgression(null); updateProgressionV2(null); setReadiness(null); setOperationResult(null); setPercentPreview(null); setPercentReviewError(null); setTemplatePicker(null); setTemplateReview(null); setTemplateMaxProfileOpen(false); setWorkspaceView(clientFirst ? 'Day' : 'Week'); setSelectedWeekToken(null); setDirty(false); saveDraft.current = null
  }
  const retireAssignment = (assignmentId: string, message: string) => {
    setUnavailableAssignments(current => new Set(current).add(assignmentId)); clearAssignment(); setError(message)
  }
  const clearAthlete = () => {
    assignmentGeneration.current += 1; setAssignments([]); setAssignmentCursor(null); setAssignmentToken(null); setAssignmentsMore(false); clearAssignment()
  }
  const clearGym = () => {
    rosterGeneration.current += 1; setRoster([]); setRosterCursor(null); setRosterToken(null); setRosterMore(false); setAthleteState(null); clearAthlete()
  }

  const loadGyms = async (more: boolean) => {
    const generation = more ? gymGeneration.current : ++gymGeneration.current
    const expected = more ? gymToken : null
    setLoadingNavigation(true); setError(null)
    try {
      const page = await api.getCoachNavigationGymsV4({ cursor: more ? gymCursor : null, page_size: 20, expected_read_token: expected })
      if (generation !== gymGeneration.current) return
      if (expected && tokenKey(page.navigation_read_token) !== tokenKey(expected)) { setGyms([]); setGymState(null); clearGym(); void loadGyms(false); return }
      setGyms(current => more ? [...current.filter(item => !page.items.some(next => next.gym_id === item.gym_id)), ...page.items] : page.items)
      setGymCursor(page.next_cursor); setGymToken(page.navigation_read_token); setGymsMore(page.has_more)
      if (!more) {
        const first = clientFirst ? page.items.find(item => item.gym_id === pendingInitialGym.current)?.gym_id ?? null : page.items[0]?.gym_id ?? null
        pendingInitialGym.current = null; setGymState(first)
        if (clientFirst) {
          const initialAthleteId = pendingInitialAthlete.current
          const initialAssignmentId = pendingInitialAssignment.current
          if (!first || !initialAthleteId || !initialAssignmentId) { onBackToDashboard?.(); return }
          pendingInitialAthlete.current = null; pendingInitialAssignment.current = null
          setAthleteState(initialAthleteId); assignmentRef.current = initialAssignmentId; setAssignmentState(initialAssignmentId)
          void loadAssignmentImage(initialAssignmentId, null)
        } else if (first) void loadRoster(first, false)
      }
    } catch (cause) {
      if (generation !== gymGeneration.current) return
      if (readConflict(cause)) { setGyms([]); setGymCursor(null); setGymToken(null); setGymState(null); clearGym(); void loadGyms(false) }
      else setError(errorText(cause))
    } finally { if (generation === gymGeneration.current) setLoadingNavigation(false) }
  }
  const loadRoster = async (gymId: string, more: boolean) => {
    const generation = more ? rosterGeneration.current : ++rosterGeneration.current
    const expected = more ? rosterToken : null
    setLoadingNavigation(true); setError(null)
    try {
      const page = await api.getCoachNavigationRosterV4({ gym: gymId, cursor: more ? rosterCursor : null, page_size: 50, expected_read_token: expected })
      if (generation !== rosterGeneration.current) return
      if (expected && tokenKey(page.navigation_read_token) !== tokenKey(expected)) { setRoster([]); setAthleteState(null); clearAthlete(); void loadRoster(gymId, false); return }
      setRoster(current => more ? [...current.filter(item => !page.items.some(next => next.athlete_id === item.athlete_id)), ...page.items] : page.items)
      setRosterCursor(page.next_cursor); setRosterToken(page.navigation_read_token); setRosterMore(page.has_more)
      if (!more) { const first = clientFirst ? page.items.find(item => item.athlete_id === pendingInitialAthlete.current)?.athlete_id ?? null : page.items.some(item => item.athlete_id === pendingInitialAthlete.current) ? pendingInitialAthlete.current : page.items[0]?.athlete_id ?? null; pendingInitialAthlete.current = null; setAthleteState(first); if (first) void loadAssignments(gymId, first, false); else if (clientFirst) onBackToDashboard?.() }
    } catch (cause) {
      if (generation !== rosterGeneration.current) return
      if (readConflict(cause)) { setRoster([]); setRosterCursor(null); setRosterToken(null); setAthleteState(null); clearAthlete(); void loadRoster(gymId, false) }
      else setError(errorText(cause))
    } finally { if (generation === rosterGeneration.current) setLoadingNavigation(false) }
  }
  const loadAssignments = async (gymId: string, athleteId: string, more: boolean) => {
    const generation = more ? assignmentGeneration.current : ++assignmentGeneration.current
    const expected = more ? assignmentToken : null
    setLoadingNavigation(true); setError(null)
    try {
      const page = await api.getCoachNavigationAssignmentsV4({ gym: gymId, athlete: athleteId, cursor: more ? assignmentCursor : null, page_size: 50, expected_read_token: expected })
      if (generation !== assignmentGeneration.current) return
      if (expected && tokenKey(page.navigation_read_token) !== tokenKey(expected)) { setAssignments([]); clearAssignment(); void loadAssignments(gymId, athleteId, false); return }
      setAssignments(current => more ? [...current.filter(item => !page.items.some(next => next.assignment_id === item.assignment_id)), ...page.items] : page.items)
      setAssignmentCursor(page.next_cursor); setAssignmentToken(page.navigation_read_token); setAssignmentsMore(page.has_more)
      if (!more && pendingInitialAssignment.current && page.items.some(item => item.assignment_id === pendingInitialAssignment.current)) {
        const initial = pendingInitialAssignment.current; pendingInitialAssignment.current = null
        assignmentRef.current = initial; setAssignmentState(initial); void loadAssignmentImage(initial, null)
      } else if (!more && clientFirst) onBackToDashboard?.()
    } catch (cause) {
      if (generation !== assignmentGeneration.current) return
      if (readConflict(cause)) { setAssignments([]); setAssignmentCursor(null); setAssignmentToken(null); clearAssignment(); void loadAssignments(gymId, athleteId, false) }
      else setError(errorText(cause))
    } finally { if (generation === assignmentGeneration.current) setLoadingNavigation(false) }
  }

  const loadAssignmentImage = async (assignmentId: string, requestedFocus: DayFocus | null, restart = true, requireFocus = false, preserveOnFailure = false, focusTarget: string | null = null, reuseDetail = false): Promise<boolean> => {
    const generation = ++detailGeneration.current
    clearTargetIntent()
    const intendedTarget: TargetFocusRequest | null = focusTarget && requestedFocus ? {
      target: focusTarget,
      assignmentId,
      dayIdentityToken: requestedFocus.token,
      week: requestedFocus.week,
      ordinal: requestedFocus.ordinal,
      loadGeneration: generation,
    } : null
    targetAfterLoad.current = intendedTarget
    setError(null)
    try {
      // The day RPC revalidates authority and this token in its own database snapshot.
      // Reuse only the summary of the exact requested day; a changed token falls back
      // to the full authoritative image below before any editor is rendered.
      const cachedDetail = reuseDetail && requestedFocus && detailRef.current?.assignment_id === assignmentId
        && detailRef.current.weeks.some(week => week.week_identity_token === requestedFocus.week
          && week.days.some(day => day.day_identity_token === requestedFocus.token && day.day_ordinal === requestedFocus.ordinal))
        ? detailRef.current : null
      const nextDetail = cachedDetail ?? (phase54Api ? await phase54Api.getCoachAssignmentDetailV5({ assignment: assignmentId }) : await api.getCoachAssignmentDetailV4({ assignment: assignmentId }))
      if (generation !== detailGeneration.current || assignmentRef.current !== assignmentId || nextDetail.assignment_id !== assignmentId) { clearTargetIntent(generation); return false }
      if (clientFirst && (assignmentId !== initialAssignment || nextDetail.athlete_id !== initialAthlete)) { onBackToDashboard?.(); clearTargetIntent(generation); return false }
      if (clientFirst) {
        const expectedCurrentAssignment = clientFirstExpectedCurrentAssignment.current
        const expectsCurrent = assignmentId === expectedCurrentAssignment
        const lifecycleMatchesIntent = expectsCurrent ? nextDetail.assignment_status === 'active' : nextDetail.assignment_status === 'paused'
        if (!lifecycleMatchesIntent) { clearTargetIntent(generation); onCurrentAssignmentDrift?.(); return false }
      }
      let nextFocus = requestedFocus ?? (clientFirst ? (() => { const week = nextDetail.weeks[0]; const day = week?.days.find(item => item.day_identity_token); return week && day?.day_identity_token ? {week:week.week_identity_token,token:day.day_identity_token,ordinal:day.day_ordinal} : null })() : null)
      let nextDay: CoachAssignmentDayV4['day'] | CoachAssignmentDayV5['day'] | CoachAssignmentDayV6['day'] | null = null
      let nextPercentBasisOptions: RichPercentBasisOption[] = []
      if (nextFocus) {
        const intendedFocus = nextFocus
        const week = nextDetail.weeks.find(item => item.week_identity_token === intendedFocus.week)
        const summary = week?.days.find(item => item.day_ordinal === intendedFocus.ordinal)
        nextFocus = summary?.day_identity_token ? { week: intendedFocus.week, token: summary.day_identity_token, ordinal: intendedFocus.ordinal } : null
        if (nextFocus) {
          const dayInput = { assignment: assignmentId, day_identity_token: nextFocus.token, expected_detail_read_token: nextDetail.detail_read_token }
          const response = richTrackingApi?.getCoachAssignmentDayV7 && richTrackingApi.saveCoachProgramDayV5 ? await richTrackingApi.getCoachAssignmentDayV7(dayInput) : phase54Api?.getCoachAssignmentDayV6 && phase54Api.saveCoachProgramDayV4 ? await phase54Api.getCoachAssignmentDayV6(dayInput) : phase54Api ? await phase54Api.getCoachAssignmentDayV5(dayInput) : await api.getCoachAssignmentDayV4(dayInput)
          if (response.assignment_id !== assignmentId || response.program_id !== nextDetail.program_id || response.builder_version !== nextDetail.builder_version || response.detail_read_token !== nextDetail.detail_read_token) throw new CoachApiError('assignment_read_changed', 409)
          const responseIdentity = response.day.mode === 'editable' ? response.day.content.identity_token : response.day.day_identity_token
          const responseOrdinal = response.day.mode === 'editable' ? response.day.content.ordinal : response.day.day_ordinal
          if (responseIdentity !== nextFocus.token || responseOrdinal !== nextFocus.ordinal) throw new CoachApiError('assignment_read_changed', 409)
          nextDay = response.day
          if ('percent_basis_options' in response) nextPercentBasisOptions = response.percent_basis_options
          setRichExerciseOptions('exercise_options' in response ? response.exercise_options : [])
          setRichTrackingSupported('exercise_options' in response)
        }
        if (requireFocus && !nextFocus) throw new CoachApiError('assignment_read_changed', 409)
      }
      if (generation !== detailGeneration.current || assignmentRef.current !== assignmentId) { clearTargetIntent(generation); return false }
      const invalidCopy = copy ? copySelectionError(nextDetail, copy, Boolean(phase54Api)) : null
      detailRef.current = nextDetail; focusRef.current = nextFocus; setFocusState(nextFocus); setFocusedDay(nextDay); setRichPercentBasisOptions(nextPercentBasisOptions); setDetail(nextDetail); setDirty(false)
      const pendingTarget = targetAfterLoad.current
      if (pendingTarget && pendingTarget.loadGeneration === generation && pendingTarget.assignmentId === assignmentId
        && requestedFocus && pendingTarget.week === requestedFocus.week && pendingTarget.ordinal === requestedFocus.ordinal && pendingTarget.dayIdentityToken === requestedFocus.token
        && nextFocus?.week === pendingTarget.week && nextFocus.ordinal === pendingTarget.ordinal && nextFocus.token === pendingTarget.dayIdentityToken
        && nextDay?.mode === 'editable' && nextDay.content.identity_token === pendingTarget.dayIdentityToken) {
        targetAfterLoad.current = null; setTargetFocus(pendingTarget)
      } else clearTargetIntent(generation)
      // Do not close a copy review that was opened while this earlier image was loading.
      // A review already open when this image started is stale and must be closed.
      updateCopy(current => invalidCopy ? null : current === copy ? null : current)
      setProgression(current => current && !current.result ? { ...current, preview: null } : current)
      if (invalidCopy) setError(`${invalidCopy} The copy review was closed.`)
      return true
    } catch (cause) {
      if (generation !== detailGeneration.current) { clearTargetIntent(generation); return false }
      const intendedCurrent = clientFirst && assignmentId === clientFirstExpectedCurrentAssignment.current
      if (intendedCurrent && cause instanceof CoachApiError && !retryableReadFailure(cause)) { clearTargetIntent(generation); onCurrentAssignmentDrift?.(); return false }
      if (definitiveAuthority(cause)) { retireAssignment(assignmentId, errorText(cause)); return true }
      if (!preserveOnFailure && !(readConflict(cause) && restart)) { detailRef.current = null; setDetail(null); setFocusedDay(null) }
      saveDraft.current = null
      clearTargetIntent(generation)
      if (readConflict(cause) && restart) return loadAssignmentImage(assignmentId, requestedFocus, false, requireFocus, preserveOnFailure, focusTarget)
      setError(errorText(cause)); return false
    }
  }

  const refreshAssignmentImage = async (assignmentId: string, requestedFocus: DayFocus | null, restart = true): Promise<boolean> => {
    const gymId = gym
    const athleteId = athlete
    if (!gymId || !athleteId) { setError('The affected athlete scope is no longer available.'); return false }
    const generation = ++assignmentGeneration.current
    detailGeneration.current += 1; assignmentRef.current = null; setAssignmentState(null); saveDraft.current = null
    setAssignments([]); setAssignmentCursor(null); setAssignmentToken(null); setAssignmentsMore(false); setLoadingNavigation(true)
    try {
      let cursor: CoachNavigationAssignmentsCursor | null = null
      let expected: CoachNavigationAssignmentsReadToken | null = null
      let items: AssignmentItems = []
      let hasMore = false
      do {
        const page = await api.getCoachNavigationAssignmentsV4({ gym: gymId, athlete: athleteId, cursor, page_size: 50, expected_read_token: expected })
        if (generation !== assignmentGeneration.current) return false
        if (expected && tokenKey(page.navigation_read_token) !== tokenKey(expected)) throw new CoachApiError('navigation_read_changed', 409)
        items = [...items.filter(item => !page.items.some(next => next.assignment_id === item.assignment_id)), ...page.items]
        cursor = page.next_cursor; expected = page.navigation_read_token; hasMore = page.has_more
      } while (!items.some(item => item.assignment_id === assignmentId) && hasMore && cursor)
      setAssignments(items); setAssignmentCursor(cursor); setAssignmentToken(expected); setAssignmentsMore(hasMore)
      if (!items.some(item => item.assignment_id === assignmentId)) { clearAssignment(); setError('The selected program is no longer assigned to this athlete. The stale editor was closed.'); return true }
      assignmentRef.current = assignmentId; setAssignmentState(assignmentId); focusRef.current = requestedFocus; setFocusState(requestedFocus)
      return loadAssignmentImage(assignmentId, requestedFocus, true, Boolean(requestedFocus), true)
    } catch (cause) {
      if (generation !== assignmentGeneration.current) return false
      if (cause instanceof CoachApiError && cause.code === 'navigation_read_changed' && restart) return refreshAssignmentImage(assignmentId, requestedFocus, false)
      if (definitiveAuthority(cause)) { retireAssignment(assignmentId, errorText(cause)); return true }
      setError(errorText(cause)); return false
    } finally { if (generation === assignmentGeneration.current) setLoadingNavigation(false) }
  }

  useEffect(() => {
    if (clientFirst) {
      if (!initialGym || !initialAthlete || !initialAssignment) { onBackToDashboard?.(); return }
      setGymState(initialGym); setAthleteState(initialAthlete); assignmentRef.current = initialAssignment; setAssignmentState(initialAssignment)
      void loadAssignmentImage(initialAssignment, null)
    } else void loadGyms(false)
    return () => { gymGeneration.current += 1; rosterGeneration.current += 1; assignmentGeneration.current += 1; detailGeneration.current += 1 }
  }, [])
  useEffect(() => {
    const generation = ++exerciseHistoryGeneration.current
    if (!correctionsApi || !gym) { setExerciseSuggestions([]); return }
    const query = exerciseHistoryQuery.trim().replace(/\s+/gu, ' ')
    const key = `${gym}\u0000${query.toLocaleLowerCase('en-US')}`
    const cached = exerciseHistoryCache.current.get(key)
    if (cached) { setExerciseSuggestions(cached); return }
    const timer = window.setTimeout(() => {
      void correctionsApi.listExerciseNameHistoryV1({ gym, query, result_limit: 20 }).then(result => {
        if (generation !== exerciseHistoryGeneration.current) return
        const names = result.items.map(item => item.name)
        exerciseHistoryCache.current.set(key, names); setExerciseSuggestions(names)
      }).catch(() => { if (generation === exerciseHistoryGeneration.current) setExerciseSuggestions([]) })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [correctionsApi, gym, exerciseHistoryQuery, exerciseHistoryRevision])
  useEffect(() => {
    if (!targetFocus) return
    const matchesCurrentScope = detailGeneration.current === targetFocus.loadGeneration
      && assignmentRef.current === targetFocus.assignmentId && assignment === targetFocus.assignmentId && detail?.assignment_id === targetFocus.assignmentId
      && focusRef.current?.week === targetFocus.week && focusRef.current.ordinal === targetFocus.ordinal && focusRef.current.token === targetFocus.dayIdentityToken
      && focus?.week === targetFocus.week && focus.ordinal === targetFocus.ordinal && focus.token === targetFocus.dayIdentityToken
      && focusedDay?.mode === 'editable' && focusedDay.content.identity_token === targetFocus.dayIdentityToken
    if (!matchesCurrentScope) { setTargetFocus(current => current?.loadGeneration === targetFocus.loadGeneration ? null : current); return }
    const target = document.getElementById(`phase4-target-${targetFocus.target}`)
    if (target) target.focus()
    setTargetFocus(current => current?.loadGeneration === targetFocus.loadGeneration ? null : current)
  }, [assignment, detail, focus, focusedDay, targetFocus])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const chooseGym = (gymId: string) => { if (gymId === gym) return; clearGym(); setGymState(gymId); void loadRoster(gymId, false) }
  const chooseAthlete = (athleteId: string) => { if (!gym || athleteId === athlete) return; clearAthlete(); setAthleteState(athleteId); void loadAssignments(gym, athleteId, false) }
  const chooseAssignment = (assignmentId: string) => { if (assignmentId === assignment) return; clearAssignment(); assignmentRef.current = assignmentId; setAssignmentState(assignmentId); void loadAssignmentImage(assignmentId, null) }
  const chooseDay = (next: DayFocus, focusTarget: string | null = null) => {
    focusedDayLoadingHeight.current = focusedDayRegion.current?.getBoundingClientRect().height ?? 0
    clearTargetIntent(); focusRef.current = next; setFocusState(next); setFocusedDay(null); setProgression(null); updateProgressionV2(null); setDirty(false); saveDraft.current = null
    if (assignmentRef.current) void loadAssignmentImage(assignmentRef.current, next, true, false, false, focusTarget, true)
  }
  const guarded = (action: () => void | Promise<void>) => {
    if (locked || guardBusy.current) return
    if (!dirtyRef.current) { void action(); return }
    guardGeneration.current++
    guardContext.current = { controller: workoutRecovery.current, assignment: assignmentRef.current, focus: focusRef.current, authority: recoveryWorkspaceAuthorityRef.current }
    setGuard(() => action)
  }
  const cancelGuard = () => {
    if (guardBusy.current) return
    guardGeneration.current++; guardContext.current = null; setGuard(null)
  }
  useEffect(() => { registerNavigationGuard?.(guarded) })
  const retryAuthoritative = async (assignmentId: string, requestedFocus: DayFocus | null) => {
    setBusy(true)
    const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
    setBusy(false)
    if (refreshed) { setRecovery(null); if (assignmentRef.current === assignmentId) setError(null) }
  }
  const requireAuthoritativeRefresh = (assignmentId: string, requestedFocus: DayFocus | null) => {
    setRecovery({ label: 'Retry authoritative refresh', retry: () => { void retryAuthoritative(assignmentId, requestedFocus) } })
  }
  const performMutation = async <T,>(label: string, run: () => Promise<T>, onResult: (result: T) => void, onDefinitiveFailure?: () => void, refreshDetailDirectly = false) => {
    const assignmentId = detailRef.current?.assignment_id ?? assignmentRef.current
    const requestedFocus = focusRef.current
    setBusy(true); setError(null); setRecovery(null)
    try {
      const result = await run(); onResult(result)
      const refreshed = assignmentId ? await (refreshDetailDirectly ? loadAssignmentImage(assignmentId, requestedFocus, true, Boolean(requestedFocus), true) : refreshAssignmentImage(assignmentId, requestedFocus)) : false
      if (!refreshed && assignmentId) requireAuthoritativeRefresh(assignmentId, requestedFocus)
    } catch (cause) {
      if (cause instanceof CoachApiError && cause.code === 'current_assignment_drift' && onCurrentAssignmentDrift) { onCurrentAssignmentDrift(); return }
      const message = errorText(cause); setError(message)
      if (uncertainMutation(cause)) setRecovery({ label: `Retry ${label}`, retry: () => { void performMutation(label, run, onResult, onDefinitiveFailure) } })
      else {
        onDefinitiveFailure?.()
        if (definitiveAuthority(cause) && assignmentId) retireAssignment(assignmentId, message)
        else if (staleAuthority(cause) && assignmentId) {
          const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
          if (!refreshed) requireAuthoritativeRefresh(assignmentId, requestedFocus)
          else {
            if (label === 'copy') updateCopy(null)
            setError(`${message} Authoritative assignment data was refreshed; review and start the operation again.`)
          }
        }
      }
    } finally { setBusy(false) }
  }
  const saveFocusedDraft = async (payload: EditorDay): Promise<EditorDay> => {
    if (!detail || !focus) throw new Error('No focused day is available.')
    const assignmentId = detail.assignment_id
    const requestedFocus = focus
    setBusy(true); setError(null)
    try {
      const input = { program: detail.program_id, assignment: assignmentId, expected_builder_version: detail.builder_version, week_identity_token: focus.week }
      const savedWithHistory = !phase54Api && correctionsApi ? await correctionsApi.saveCoachProgramDayV2AndRecordHistory({ ...input, day: saveV2Day(payload) }) : null
      const saved = phase54Api ? await phase54Api.saveCoachProgramDayV3({ ...input, day: saveV3Day(payload) }) : savedWithHistory?.save ?? await api.saveCoachProgramDayV2({ ...input, day: saveV2Day(payload) })
      const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
      if (!refreshed) { requireAuthoritativeRefresh(assignmentId, requestedFocus); throw new Error('Saved, but the authoritative refresh failed. Retry refresh before continuing.') }
      setWorkspaceView(clientFirst ? 'Day' : 'Week')
      if (savedWithHistory) {
        exerciseHistoryCache.current.clear(); setExerciseHistoryRevision(revision => revision + 1)
        if (!savedWithHistory.history_recorded) setNotice('Day saved. Exercise-name suggestions could not be updated this time.')
      }
      return editorDay(saved.day)
    } catch (cause) {
      const message = errorText(cause); setError(message)
      if (uncertainMutation(cause) || staleAuthority(cause)) {
        const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
        if (!refreshed) requireAuthoritativeRefresh(assignmentId, requestedFocus)
        else setError(`${message} Authoritative assignment data was refreshed.`)
      } else if (definitiveAuthority(cause)) retireAssignment(assignmentId, message)
      throw cause
    } finally { setBusy(false) }
  }
  const saveRichFocusedDraft = async (payload: RichProgramDaySave): Promise<void> => {
    if (!detail || !focus || !phase54Api?.saveCoachProgramDayV4) throw new Error('The rich day editor is unavailable.')
    const assignmentId = detail.assignment_id, requestedFocus = focus
    const authority = recoveryAuthorityRef.current
    const stillCurrent = () => recoveryMounted.current && recoveryAuthorityRef.current === authority
    const checkpoint = workoutRecovery.current?.begin()
    setBusy(true); setError(null)
    try {
      const input = { program: detail.program_id, assignment: assignmentId, expected_builder_version: detail.builder_version, week_identity_token: focus.week, day: payload }
      if (richTrackingSupported && richTrackingApi?.saveCoachProgramDayV5) await richTrackingApi.saveCoachProgramDayV5(input)
      else await phase54Api.saveCoachProgramDayV4(input)
      if (!stillCurrent()) throw new Error('The workout workspace changed while saving. Reopen it to check the saved result.')
      if (!(await refreshAssignmentImage(assignmentId, requestedFocus))) {
        requireAuthoritativeRefresh(assignmentId, requestedFocus)
        throw new Error('Saved, but the authoritative refresh failed. Retry refresh before continuing.')
      }
      if (!stillCurrent()) throw new Error('The workout workspace changed while saving. Reopen it to check the saved result.')
      checkpoint?.commit()
      if (correctionsApi) { try { const names = [...payload.ungrouped_exercises, ...payload.movement_groups.flatMap(group => 'exercises' in group ? group.exercises : richEditableDay?.movement_groups.find(original=>original.identity_token===group.identity_token)?.exercises ?? [])].flatMap(exercise => 'name' in exercise && exercise.name ? [exercise.name] : richEditableDay ? [...richEditableDay.ungrouped_exercises,...richEditableDay.movement_groups.flatMap(group=>group.exercises)].filter(original=>original.identity_token===exercise.identity_token).map(original=>original.name) : []); if (names.length) await correctionsApi.recordExerciseNameHistoryV1({program:detail.program_id,assignment:assignmentId,names}); exerciseHistoryCache.current.clear(); setExerciseHistoryRevision(value=>value+1) } catch { setNotice('Workout saved. Exercise suggestions could not be updated this time.') } }
      if (stillCurrent()) setWorkspaceView('Day')
    } catch (cause) {
      checkpoint?.abort()
      if (!stillCurrent()) throw cause
      const message = errorText(cause); setError(message)
      if (uncertainMutation(cause) || staleAuthority(cause)) {
        const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
        if (!refreshed) requireAuthoritativeRefresh(assignmentId, requestedFocus)
        else setError(`${message} Authoritative assignment data was refreshed.`)
      } else if (definitiveAuthority(cause)) retireAssignment(assignmentId, message)
      throw cause
    } finally { setBusy(false) }
  }
  const finishGuard = async (mode: 'save' | 'discard') => {
    const action = guard, context = guardContext.current
    if (!action || guardBusy.current) return
    const operation = guardGeneration.current, authority = context?.authority ?? recoveryWorkspaceAuthorityRef.current
    const stillCurrent = () => recoveryMounted.current && recoveryWorkspaceAuthorityRef.current === authority && guardGeneration.current === operation
    guardBusy.current = true; setGuardPending(true)
    if (mode === 'discard') setBusy(true)
    try {
      if (mode === 'save') {
        if (!saveDraft.current || !(await saveDraft.current()) || !stillCurrent()) return
      } else {
        // A failed refresh can remove the old editor. Keep its original handle
        // and focus for retry rather than capturing the replacement editor.
        const checkpoint = (context?.controller ?? workoutRecovery.current)?.begin()
        try {
          const target = context?.assignment ?? assignmentRef.current
          if (!target || !(await loadAssignmentImage(target, context?.focus ?? focusRef.current))) { checkpoint?.abort(); return }
          if (!stillCurrent()) { checkpoint?.abort(); return }
          checkpoint?.commit()
        } catch { checkpoint?.abort(); return }
      }
      if (!stillCurrent()) return
      guardContext.current = null; guardGeneration.current++
      setDirty(false); setGuard(null); await action()
    } finally {
      guardBusy.current = false
      if (recoveryMounted.current) { setGuardPending(false); if (mode === 'discard') setBusy(false) }
    }
  }

  const markReady = () => {
    const current = detailRef.current
    if (!current) return
    const input = { program: current.program_id, assignment: current.assignment_id, expected_builder_version: current.builder_version, target_state: 'ready' as const }
    void performMutation('readiness', () => api.setCoachProgramReadinessV1(input), result => {
      if (result.readiness === 'draft') setReadiness({ issue_count: result.issue_count, issues_truncated: result.issues_truncated, issues: result.issues })
      else { setReadiness(null); setNotice('Ready for publishing.') }
    })
  }
  const publish = () => {
    const current = detailRef.current
    if (!current?.publish_boundary) return
    const key = `${current.assignment_id}:${current.builder_version}:${current.publish_boundary.id}`
    const request_id = stableRequestId(publishRequest, key)
    if (current.assignment_status === 'paused' && assignmentLifecycleApi) {
      const input = { request_id, candidate_assignment: current.assignment_id, expected_current_assignment: activationExpectedCurrentAssignment, boundary_kind: current.publish_boundary.kind, boundary_id: current.publish_boundary.id, expected_builder_version: current.builder_version }
      void performMutation('publish', () => assignmentLifecycleApi.activateAndPublishCoachAssignmentV1(input), result => { clientFirstExpectedCurrentAssignment.current = result.assignment_id; publishRequest.current = { canonicalInputHash: '', requestId: '' }; setOperationResult(result); setNotice('Program activated and published.'); onAssignmentActivated?.(result.assignment_id) }, () => { publishRequest.current = { canonicalInputHash: '', requestId: '' } }, clientFirst)
      return
    }
    const input = { request_id, program: current.program_id, assignment: current.assignment_id, boundary_kind: current.publish_boundary.kind, boundary_id: current.publish_boundary.id, expected_builder_version: current.builder_version }
    void performMutation('publish', () => api.publishReadyProgramV1(input), result => { publishRequest.current = { canonicalInputHash: '', requestId: '' }; setOperationResult(result); setNotice(`Published release ${result.release_id}.`) }, () => { publishRequest.current = { canonicalInputHash: '', requestId: '' } })
  }
  const publishSelectedScope = () => {
    const current = detailRef.current
    if (!current) return
    const scope_token = publishScopeKind === 'week' ? publishWeekToken : null
    if (publishScopeKind === 'week' && !current.weeks.some(week => week.week_identity_token === scope_token)) {
      setError('The selected week is no longer available. Choose a week before publishing.')
      return
    }
    const key = `${current.assignment_id}:${current.builder_version}:${publishScopeKind}:${scope_token ?? 'all'}`
    const request_id = stableRequestId(publishRequest, key)
    if (current.assignment_status === 'paused') {
      if (!api.activateAndPublishCoachScopeV1) return
      const input = { request_id, candidate_assignment: current.assignment_id, expected_current_assignment: activationExpectedCurrentAssignment, expected_builder_version: current.builder_version, scope_kind: publishScopeKind, scope_token }
      void performMutation('publish', () => api.activateAndPublishCoachScopeV1!(input), result => {
        publishRequest.current = { canonicalInputHash: '', requestId: '' }; setPublishScopeOpen(false)
        clientFirstExpectedCurrentAssignment.current = result.assignment_id
        setNotice(`${publishScopeKind === 'week' ? 'Week' : 'Program'} published. Earlier released work remains available to the client.`)
        onAssignmentActivated?.(result.assignment_id)
      }, undefined, clientFirst)
      return
    }
    if (!api.publishCoachScopeV1) return
    const input = { request_id, program: current.program_id, assignment: current.assignment_id, expected_builder_version: current.builder_version, scope_kind: publishScopeKind, scope_token }
    void performMutation('publish', () => api.publishCoachScopeV1!(input), () => {
      publishRequest.current = { canonicalInputHash: '', requestId: '' }; setPublishScopeOpen(false)
      setNotice(`${publishScopeKind === 'week' ? 'Week' : 'Program'} published. Earlier released work remains available to the client.`)
    })
  }
  const saveCurrentAsTemplate = async () => {
    const current = detailRef.current
    if (!programTemplateApi || !current || !saveAsTemplate?.name.trim()) return
    setTemplateIssues(null)
    if (oct18Api.getCoachProgramTemplateReadinessV1) {
      setBusy(true); setError(null)
      try {
        const readiness = await oct18Api.getCoachProgramTemplateReadinessV1({ program: current.program_id, assignment: current.assignment_id })
        if (detailRef.current?.builder_version !== current.builder_version || detailRef.current?.assignment_id !== current.assignment_id) { setError('The program changed during review. Refresh and save the current program.'); return }
        if (!readiness.ready) { setTemplateIssues(readiness); setError('Complete these workouts before saving a template. Your source programming is unchanged.'); return }
      } catch (cause) { if (!(cause instanceof CoachApiError && cause.status === 404)) { setError(errorText(cause)); return } }
      finally { setBusy(false) }
    }
    const input = { request_id: saveAsTemplate.requestId, program: current.program_id,
      assignment: current.assignment_id, expected_builder_version: current.builder_version,
      template_name: saveAsTemplate.name.trim() }
    void performMutation('save template', () => programTemplateApi.saveCoachProgramAsTemplateV2(input), () => {
      setSaveAsTemplate(null)
      if (resumePublishAfterTemplate) setPublishScopeOpen(true)
      setResumePublishAfterTemplate(false)
      setNotice('Saved an independent copy in the program template library.')
    })
  }
  const closeSaveAsTemplate = () => {
    setSaveAsTemplate(null); setTemplateIssues(null)
    if (resumePublishAfterTemplate) setPublishScopeOpen(true)
    setResumePublishAfterTemplate(false)
  }
  const undo = () => {
    const current = detailRef.current
    if (!current?.authoring.pending_undo) return
    const pending = current.authoring.pending_undo
    if (!(Date.parse(pending.expires_at) > Date.now())) { setNotice('The Undo window has ended.'); return }
    const key = `${current.assignment_id}:${current.builder_version}:${pending.undo_id}`
    const input = { request_id: stableRequestId(undoRequest, key), program: current.program_id, assignment: current.assignment_id, undo_id: pending.undo_id, expected_builder_version: current.builder_version }
    void performMutation('undo', () => api.undoBuilderOperationV1(input), () => { undoRequest.current = { canonicalInputHash: '', requestId: '' }; setNotice('Undo complete. Your plan was restored.') }, () => { undoRequest.current = { canonicalInputHash: '', requestId: '' } })
  }
  const authorCalendarDay = async (slot: V4WeekSlot, week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5) => {
    const current = detailRef.current
    if (!correctionsApi || !current || slot.status !== 'unscheduled') return
    const key = `${current.assignment_id}:${current.builder_version}:${week.week_identity_token}:${slot.day_ordinal}:workout_shell`
    const input = {
      request_id: stableRequestId(authorDayRequest, key), program: current.program_id,
      assignment: current.assignment_id, expected_builder_version: current.builder_version,
      week_identity_token: week.week_identity_token, day_ordinal: slot.day_ordinal,
      authoring_kind: 'workout_shell' as const, day_label: slot.weekday,
    }
    setBusy(true); setError(null); setRecovery(null)
    try {
      const result = await correctionsApi.authorCalendarDayV1(input)
      authorDayRequest.current = { canonicalInputHash: '', requestId: '' }
      const nextFocus = { week: result.week_identity_token, token: result.day_identity_token, ordinal: result.day_ordinal }
      const refreshed = await refreshAssignmentImage(result.assignment_id, nextFocus)
      if (!refreshed) requireAuthoritativeRefresh(result.assignment_id, nextFocus)
      else { setWorkspaceView('Day'); setNotice('Workout created. Add the first exercise.') }
    } catch (cause) {
      const message = errorText(cause); setError(message)
      if (uncertainMutation(cause)) setRecovery({ label: 'Retry add workout', retry: () => { void authorCalendarDay(slot, week) } })
      else if (definitiveAuthority(cause)) retireAssignment(current.assignment_id, message)
      else if (staleAuthority(cause)) {
        const refreshed = await refreshAssignmentImage(current.assignment_id, null)
        if (!refreshed) requireAuthoritativeRefresh(current.assignment_id, null)
        else setError(`${message} Authoritative assignment data was refreshed; choose the day again.`)
      }
    } finally { setBusy(false) }
  }
  const focusTemplateDestination = (weekIdentityToken: string, dayOrdinal: number) => {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-week-token="${weekIdentityToken}"][data-day-ordinal="${dayOrdinal}"] button:not(:disabled)`)?.focus())
  }
  const reviewWorkoutTemplate = async (template: { template_id: string; builder_version: number }, slot: V4WeekSlot, week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5, shellRequestId: string = crypto.randomUUID()) => {
    const current = detailRef.current
    const previewApi = usableWorkoutTemplateApi?.previewCoachTemplatePercentV1
    if (!current || !athlete || !previewApi || !usableWorkoutTemplateApi || (slot.status !== 'unscheduled' && slot.status !== 'authored_empty')) {
      setError('Percentage preflight is unavailable. This template cannot be applied yet.')
      return
    }
    setTemplatePicker(null)
    setTemplateReview({ template, slot, week, shellRequestId, preview: null, error: null })
    try {
      const preview = await previewApi({ template: template.template_id, athlete, expected_template_builder_version: template.builder_version, program: current.program_id, expected_program_builder_version: current.builder_version })
      if (detailRef.current?.program_id !== current.program_id || detailRef.current?.builder_version !== current.builder_version) {
        setTemplateReview(review => review ? { ...review, error: 'The program changed while loading this preview. Close and choose the current day again.' } : null)
        return
      }
      setTemplateReview(review => review && review.template.template_id === template.template_id && review.shellRequestId === shellRequestId ? { ...review, preview, error: null } : review)
    } catch (cause) { setTemplateReview(review => review && review.shellRequestId === shellRequestId ? { ...review, error: errorText(cause) } : review) }
  }
  const applyWorkoutTemplate = async (retryInput?: ApplyWorkoutTemplateV4Input) => {
    const review = templateReview
    const current = detailRef.current
    const preview = review?.preview
    if (busy || !review || !usableWorkoutTemplateApi) return
    // Replay the original receipt even after a refresh changes the builder or slot.
    if (!retryInput && (!preview || !canApplyTemplatePercentPreview(preview) || !current || current.program_id !== preview.program_id || current.builder_version !== preview.program_builder_version || preview.template_id !== review.template.template_id || preview.template_builder_version !== review.template.builder_version)) return
    const base = retryInput ?? { template: review.template.template_id, expected_template_builder_version: review.template.builder_version, program: current!.program_id, assignment: current!.assignment_id, expected_program_builder_version: current!.builder_version, destination_week_identity_token: review.week.week_identity_token, preview_fingerprint: preview!.fingerprint }
    const atomicInput: ApplyWorkoutTemplateV4Input | null = retryInput ?? (review.slot.status === 'unscheduled' ? { ...base, destination_day_ordinal: review.slot.day_ordinal, destination_day_label: review.slot.weekday, shell_request_id: review.shellRequestId } : null)
    const assignmentId = base.assignment
    setBusy(true); setError(null); setRecovery(null); setNotice(null)
    try {
      if (atomicInput) {
        if (!usableWorkoutTemplateApi.applyCoachWorkoutTemplateV4) throw new Error('Atomic template application is unavailable. Nothing was changed.')
        await usableWorkoutTemplateApi.applyCoachWorkoutTemplateV4(atomicInput)
      } else {
        if (!review.slot.day_identity_token || !usableWorkoutTemplateApi.applyCoachWorkoutTemplateV3) throw new Error('Template application is unavailable. Nothing was changed.')
        await usableWorkoutTemplateApi.applyCoachWorkoutTemplateV3({ ...base, destination_day_identity_token: review.slot.day_identity_token })
      }
      setTemplateReview(null)
      const refreshed = await refreshAssignmentImage(assignmentId, null)
      if (!refreshed) requireAuthoritativeRefresh(assignmentId, null)
      else { setWorkspaceView(clientFirst ? 'Plan' : 'Week'); setNotice('Workout template added to the calendar.'); focusTemplateDestination(review.week.week_identity_token, review.slot.day_ordinal) }
    } catch (cause) {
      const message = errorText(cause)
      if (cause instanceof CoachApiError && cause.code === 'request_rejected' && cause.status === 404) { setTemplateFeatureUnavailable(true); onWorkoutTemplateUnavailable?.() }
      if (definitiveAuthority(cause)) { retireAssignment(assignmentId, message); return }
      const refreshed = await refreshAssignmentImage(assignmentId, null)
      if (uncertainTemplateMutation(cause)) {
        // Occupancy cannot identify which operation produced a workout.
        setTemplateReview(state => state ? { ...state, retryInput: atomicInput ?? undefined, preview: atomicInput ? state.preview : null, error: atomicInput
          ? 'The result is unconfirmed. Retry the same template application to confirm whether it was added.'
          : `The result is unconfirmed. This application cannot be safely retried automatically. ${refreshed ? 'The calendar was refreshed; review the current day before starting another application.' : 'Refresh and review the current day before starting another application.'}` } : null)
      } else {
        setTemplateReview(state => state ? { ...state, retryInput: undefined, preview: null, error: `${message} ${refreshed ? 'The calendar was refreshed; review percentage loads again before retrying.' : 'Refresh the calendar before reviewing another application.'}` } : null)
      }
      if (!refreshed && !(atomicInput && uncertainTemplateMutation(cause))) requireAuthoritativeRefresh(assignmentId, null)
    } finally { setBusy(false) }
  }
  const frozenCopyMatches = (frozen: CopyPreview, generation: number) => {
    const current = copyRef.current
    const currentDetail = detailRef.current
    if (!current || generation !== copyGeneration.current) return false
    const currentInput = frozen.contract === 'v2'
      ? buildCopyV2Input(currentDetail, current)
      : buildCopyInput(currentDetail, current)
    return Boolean(currentInput && canonicalInputHash(currentInput) === frozen.canonicalInputHash)
  }
  const applyFrozenCopy = async (frozen: CopyPreview, generation: number) => {
    if (!frozenCopyMatches(frozen, generation)) return
    const assignmentId = frozen.input.assignment
    const requestedFocus = focusRef.current
    setError(null); setRecovery(null); updateCopy(current => current ? { ...current, copying: true } : current)
    try {
      const copyV2Api = phase54Api
      if (frozen.contract === 'v2' && !copyV2Api) return
      let result: ApplyBuilderCopyV1Result | ApplyBuilderCopyV2Result
      if (frozen.contract === 'v2') {
        if (!copyV2Api) return
        result = await copyV2Api.applyBuilderCopyV2({ ...frozen.input, request_id: frozen.requestId, preview_guard: frozen.result.preview_guard })
      } else if (frozen.contract === 'v3') {
        if (!oct18Api.applyBuilderWeekCopyV3) throw new Error('Guarded week copy is unavailable. Retry after the workspace update.')
        result = await oct18Api.applyBuilderWeekCopyV3({ ...frozen.input, request_id: frozen.requestId, preview_guard: frozen.result.preview_guard })
      } else result = await api.applyBuilderCopyV1({ ...frozen.input, request_id: frozen.requestId })
      updateCopy(null); setOperationResult(result); setNotice(null)
      const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
      if (!refreshed) requireAuthoritativeRefresh(assignmentId, requestedFocus)
      else setWorkspaceView(clientFirst ? 'Day' : 'Week')
    } catch (cause) {
      if (uncertainMutation(cause)) {
        updateCopy(frozenCopyState(frozen))
        setError('The copy result is being reconciled. Retry to check the same copy request.')
        setRecovery({ label: 'Retry copy', retry: () => { void applyFrozenCopy(frozen, copyGeneration.current) } })
      } else if (definitiveAuthority(cause)) retireAssignment(assignmentId, errorText(cause))
      else if (staleAuthority(cause)) {
        const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
        if (!refreshed) requireAuthoritativeRefresh(assignmentId, requestedFocus)
        else { updateCopy(null); setError('The copy could not be completed because this assignment changed. Review the current plan and try again.') }
      } else setError('Copy could not be completed. Try again.')
    } finally { updateCopy(current => current ? { ...current, copying: false } : current) }
  }
  const previewCopy = async (state: CopyState) => {
    const useV2 = state.kind === 'day' && Boolean(phase54Api)
    const input = useV2 ? buildCopyV2Input(detail, state) : buildCopyInput(detail, state)
    if (!input) return
    const assignmentId = input.assignment
    const requestedFocus = focusRef.current
    const generation = copyGeneration.current
    setError(null); updateCopy(current => current ? { ...current, copying: true } : current)
    try {
      const frozen: CopyPreview = state.kind === 'week' && oct18Api.previewBuilderWeekCopyV3 && input.copy_kind === 'week'
        ? { contract: 'v3', canonicalInputHash: canonicalInputHash(input), input: input as PreviewBuilderWeekCopyV3Input, requestId: requestId(), result: await oct18Api.previewBuilderWeekCopyV3(input as PreviewBuilderWeekCopyV3Input) }
        : useV2 && phase54Api && input.copy_kind === 'day'
        ? { contract: 'v2', canonicalInputHash: canonicalInputHash(input), input: input as PreviewBuilderCopyV2Input, requestId: requestId(), result: await phase54Api.previewBuilderCopyV2(input as PreviewBuilderCopyV2Input) }
        : { contract: 'v1', canonicalInputHash: canonicalInputHash(input), input, requestId: requestId(), result: await api.previewBuilderCopyV1(input) }
      const result = frozen.result
      const requiresOverwrite = result.destinations.some(destination => destination.collisions.some(collision => collision.proposed_action === 'preserve'))
      if (!frozenCopyMatches(frozen, generation)) return
      updateCopy(current => current ? { ...current, preview: frozen, result: null, confirmingOverwrite: requiresOverwrite, copying: false } : current)
      if (frozen.contract !== 'v3' && !requiresOverwrite && result.can_apply) await applyFrozenCopy(frozen, generation)
    } catch (cause) {
      const message = errorText(cause); setError(cause instanceof CoachApiError && cause.status === 404 ? 'Guarded week copy is unavailable while the workspace update finishes. Retry shortly.' : `Copy could not be checked. ${errorText(cause)}`)
      if (staleAuthority(cause)) {
        const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
        if (!refreshed) requireAuthoritativeRefresh(assignmentId, requestedFocus)
        else {
          const reconciliation = copySelectionError(detailRef.current, state, useV2)
          updateCopy(null)
          setError(reconciliation ? `${reconciliation} The copy was not started.` : 'The assignment changed before copying. Review the current plan and try again.')
        }
      } else if (definitiveAuthority(cause)) retireAssignment(assignmentId, message)
    } finally {
      if (generation === copyGeneration.current) updateCopy(current => current ? { ...current, copying: false } : current)
    }
  }
  const previewProgression = async (state: ProgressionState) => {
    const input = buildProgressionInput(detail, focusRef.current, focusedDay?.mode === 'editable' && 'exercises' in focusedDay.content ? focusedDay.content : null, state)
    if (!input) return
    const assignmentId = input.assignment
    const requestedFocus = focusRef.current
    setBusy(true); setError(null)
    try {
      const result = await api.previewBuilderProgressionV1(input)
      setProgression(current => current && canonicalInputHash({ ...input, scope: current.scope, transform: current.transform }) === canonicalInputHash(input) ? { ...current, preview: { canonicalInputHash: canonicalInputHash(input), input, requestId: requestId(), result }, result: null } : current)
    } catch (cause) {
      const message = errorText(cause); setError(message)
      if (staleAuthority(cause)) {
        const refreshed = await refreshAssignmentImage(assignmentId, requestedFocus)
        if (!refreshed) requireAuthoritativeRefresh(assignmentId, requestedFocus)
        else setError(`${message} Authoritative assignment data was refreshed; preview again.`)
      } else if (definitiveAuthority(cause)) retireAssignment(assignmentId, message)
    } finally { setBusy(false) }
  }
  const applyProgression = () => {
    const frozen = progression?.preview
    if (!frozen?.result.can_apply || canonicalInputHash(frozen.input) !== frozen.canonicalInputHash) return
    void performMutation('progression', () => api.applyBuilderProgressionV1({ ...frozen.input, preview_guard: frozen.result.preview_guard, request_id: frozen.requestId }), result => { setProgression(current => current ? { ...current, result } : current); setWorkspaceView(clientFirst ? 'Day' : 'Week'); setNotice('Progression result received from server.') }, () => setProgression(current => current ? { ...current, preview: null, result: null } : current))
  }

  const previewProgressionV2 = async (state: ProgressionV2State, generation: number) => {
    if (generation !== progressionV2Generation.current) return
    const input = buildProgressionV2Input(detailRef.current, focusRef.current,
      focusedDay?.mode === 'editable' && 'exercises' in focusedDay.content ? focusedDay.content : null, state)
    if (!input || !progressionV2Capability) return
    const hash = canonicalInputHash(input)
    setError(null)
    try {
      const result = await progressionV2Capability.previewBuilderProgressionV2(input)
      if (generation !== progressionV2Generation.current) return
      reflectProgressionV2(current => {
        const currentInput = current && buildProgressionV2Input(detailRef.current, focusRef.current,
          focusedDay?.mode === 'editable' && 'exercises' in focusedDay.content ? focusedDay.content : null, current)
        return current && currentInput && canonicalInputHash(currentInput) === hash
          ? { ...current, previewing: false, preview: { canonicalInputHash: hash, input, requestId: requestId(), result } }
          : current
      })
    } catch (cause) {
      if (generation !== progressionV2Generation.current) return
      reflectProgressionV2(current => current ? { ...current, previewing: false, preview: null } : current)
      const message = errorText(cause)
      setError(`${message} Nothing changed.`)
      if (definitiveAuthority(cause)) retireAssignment(input.assignment, message)
      else if (staleAuthority(cause)) {
        const refreshed = await refreshAssignmentImage(input.assignment, focusRef.current)
        if (!refreshed) requireAuthoritativeRefresh(input.assignment, focusRef.current)
        else { updateProgressionV2(null); setError(`${message} Nothing changed; reopen progression after reviewing the refreshed workout.`) }
      }
    }
  }

  useEffect(() => {
    if (!progressionV2?.previewing || progressionV2.frozen || !progressionV2Capability) return
    const currentEditableDay = focusedDay?.mode === 'editable' && 'exercises' in focusedDay.content ? focusedDay.content : null
    const input = buildProgressionV2Input(detail, focus, currentEditableDay, progressionV2)
    if (!input) return
    const hash = canonicalInputHash(input)
    if (progressionV2.preview?.canonicalInputHash === hash) return
    const generation = progressionV2Generation.current
    const timer = window.setTimeout(() => { void previewProgressionV2(progressionV2, generation) }, 250)
    return () => window.clearTimeout(timer)
  }, [progressionV2, progressionV2Capability, detail, focus, focusedDay])

  const frozenProgressionV2Matches = (frozen: ProgressionV2Preview, generation: number, retry: boolean) => {
    if (generation !== progressionV2Generation.current) return false
    const current = progressionV2Ref.current
    if (!current || current.preview !== frozen || current.previewing || current.frozen !== retry
      || canonicalInputHash(frozen.input) !== frozen.canonicalInputHash) return false
    const currentInput = buildProgressionV2Input(detailRef.current, focusRef.current,
      focusedDay?.mode === 'editable' && 'exercises' in focusedDay.content ? focusedDay.content : null, current)
    return Boolean(currentInput && canonicalInputHash(currentInput) === frozen.canonicalInputHash)
  }

  const applyFrozenProgressionV2 = async (frozen: ProgressionV2Preview, generation: number, retry = false) => {
    if (!progressionV2Capability) return
    if (!frozenProgressionV2Matches(frozen, generation, retry)) return
    const input: ApplyBuilderProgressionV2Input = {
      ...frozen.input, request_id: frozen.requestId, preview_guard: frozen.result.preview_guard,
    }
    const requestedFocus = focusRef.current
    const weekLabels = frozen.result.weeks.map(week => week.week_ordinal).join(', ')
    reflectProgressionV2(frozenProgressionV2State(frozen, true))
    setBusy(true); setError(null); setRecovery(null)
    try {
      const result = await progressionV2Capability.applyBuilderProgressionV2(input)
      updateProgressionV2(null)
      setNotice(result.unchanged ? 'No progression changes were needed.' : frozen.result.weeks.length === 1
        ? `Progression applied to Week ${weekLabels}.`
        : `Progression applied to Weeks ${weekLabels}.`)
      const refreshed = await refreshAssignmentImage(input.assignment, requestedFocus)
      if (!refreshed) requireAuthoritativeRefresh(input.assignment, requestedFocus)
      else setWorkspaceView(clientFirst ? 'Day' : 'Week')
    } catch (cause) {
      const message = errorText(cause)
      if (uncertainMutation(cause)) {
        reflectProgressionV2(frozenProgressionV2State(frozen, true))
        setError('The progression result is uncertain. Retry the same progression request to reconcile it.')
        setRecovery({ label: 'Retry progression', retry: () => { void applyFrozenProgressionV2(frozen, generation, true) } })
      } else if (definitiveAuthority(cause)) retireAssignment(input.assignment, message)
      else if (staleAuthority(cause)) {
        const refreshed = await refreshAssignmentImage(input.assignment, requestedFocus)
        updateProgressionV2(null)
        if (!refreshed) requireAuthoritativeRefresh(input.assignment, requestedFocus)
        else setError(`${message} Nothing changed. Review the refreshed workout and try again.`)
      } else {
        reflectProgressionV2(frozenProgressionV2State(frozen, false))
        setError(`${message} Nothing changed.`)
      }
    } finally { setBusy(false) }
  }

  const setGlobalTracking = async (exerciseId: string, tracked: boolean) => {
    const current = detailRef.current, requestedFocus = focusRef.current
    if (!current || !compactApi.setCoachProgramExerciseTrackingV1 || busy || dirtyRef.current) throw new Error('Save your workout changes before changing tracking.')
    setBusy(true); setError(null)
    try {
      await compactApi.setCoachProgramExerciseTrackingV1({ request_id: requestId(), program: current.program_id, assignment: current.assignment_id, expected_builder_version: current.builder_version, exercise_id: exerciseId, tracked })
      if (!(await refreshAssignmentImage(current.assignment_id, requestedFocus))) { requireAuthoritativeRefresh(current.assignment_id, requestedFocus); throw new Error('Tracking changed. Refresh this program before editing again.') }
      setNotice(tracked ? 'This lift is tracked wherever it appears for this athlete.' : 'Coach tracking removed for this lift. Athlete-selected or required tracking can still apply.')
    } catch (cause) { setError(errorText(cause)); throw cause } finally { setBusy(false) }
  }
  const appendProgramWeek = async () => {
    const current = detailRef.current
    if (!current || !compactApi.appendCoachProgramWeekV1 || busy) return
    setBusy(true); setError(null)
    try {
      const key = `${current.assignment_id}:${current.program_id}:${current.builder_version}`
      await compactApi.appendCoachProgramWeekV1({ request_id: stableRequestId(appendWeekRequest, key), program: current.program_id, assignment: current.assignment_id, expected_builder_version: current.builder_version })
      appendWeekRequest.current = { canonicalInputHash: '', requestId: '' }
      if (!(await refreshAssignmentImage(current.assignment_id, focusRef.current))) requireAuthoritativeRefresh(current.assignment_id, focusRef.current)
      else setNotice('New week added. Choose a day to start programming or copy an existing week.')
    } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
  }
  const applyWorkoutMove = async () => {
    const state = moveWorkout, current = detailRef.current
    if (!state || !current || !compactApi.moveCoachProgramDayV1 || busy || state.program !== current.program_id || state.assignment !== current.assignment_id || state.version !== current.builder_version) return
    const target = current.weeks.find(week => week.week_identity_token === state.source.week)?.days.find(day => day.day_ordinal === state.destination)
    const occupied = Boolean(state.destinationNeedsReview || target && (target.status !== 'rest' && target.status !== 'unscheduled' || ('workout_title' in target && typeof target.workout_title === 'string' && target.workout_title.trim())))
    if (occupied && !state.reviewed) return
    setBusy(true); setError(null)
    try {
      const result = await compactApi.moveCoachProgramDayV1({ request_id: state.requestId, program: state.program, assignment: state.assignment, expected_builder_version: state.version, week_identity_token: state.source.week, source_day_identity_token: state.source.token, destination_day_ordinal: state.destination, swap: occupied })
      setMoveWorkout(null)
      if (!(await refreshAssignmentImage(state.assignment, null))) requireAuthoritativeRefresh(state.assignment, null)
      else { setWorkspaceView(clientFirst ? 'Day' : 'Week'); setNotice(occupied ? 'Workouts swapped. Both workouts and their notes were kept.' : 'Workout moved. Its previous day is now a rest day.'); setCompactUndo(result.undo ? { ...result.undo, requestId: requestId(), program: state.program, assignment: state.assignment } : null) }
    } catch (cause) {
      if (cause instanceof CoachApiError && cause.code === 'copy_collision_review_required') {
        setMoveWorkout(current => current ? { ...current, requestId: requestId(), destinationNeedsReview: true, reviewed: false } : null)
        setError('This day has existing workout content or notes. Confirm the swap to keep both days intact.')
      } else setError(errorText(cause))
    } finally { setBusy(false) }
  }
  const undoWorkoutMove = async () => {
    const state = compactUndo, current = detailRef.current
    if (!state || !current || !compactApi.undoCompactProgrammingOperationV1 || busy || state.program !== current.program_id || state.assignment !== current.assignment_id) return
    setBusy(true); setError(null)
    try {
      await compactApi.undoCompactProgrammingOperationV1({ request_id: state.requestId, root_kind: 'program', root_id: state.program, assignment: state.assignment, expected_builder_version: current.builder_version, undo_id: state.undo_id })
      setCompactUndo(null)
      if (!(await refreshAssignmentImage(state.assignment, null))) requireAuthoritativeRefresh(state.assignment, null)
      else setNotice('Undo complete. The workouts are back on their previous days.')
    } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
  }
  const weeks = detail?.weeks ?? []
  const selectedWeek = weeks.find(week => week.week_identity_token === selectedWeekToken) ?? weeks[0]
  const publishWeek = weeks.find(week => week.week_identity_token === publishWeekToken)
  const selectedWeekIndex = selectedWeek ? weeks.findIndex(week => week.week_identity_token === selectedWeek.week_identity_token) : -1
  const previousWeek = selectedWeekIndex > 0 ? weeks[selectedWeekIndex - 1] : null
  const editableDay = focusedDay?.mode === 'editable' && 'exercises' in focusedDay.content ? focusedDay.content : null
  const richEditableDay = focusedDay?.mode === 'editable' && 'movement_groups' in focusedDay.content ? focusedDay.content : null
  const copyPreviousDraft = async ():Promise<RichProgramDay|null> => {
    const image=detailRef.current, destination=focusRef.current
    if (!image || !destination || !richEditableDay || !previousWeek || !phase54Api?.getCoachAssignmentDayV6) return null
    const source=previousWeek.days.find(day=>day.day_ordinal===destination.ordinal && day.exercise_count>0 && day.day_identity_token)
    if (!source?.day_identity_token) { setNotice('No workout was assigned to this day in the previous week.'); return null }
    const input={assignment:image.assignment_id,day_identity_token:source.day_identity_token,expected_detail_read_token:image.detail_read_token}
    const response=richTrackingApi?.getCoachAssignmentDayV7 ? await richTrackingApi.getCoachAssignmentDayV7(input) : await phase54Api.getCoachAssignmentDayV6(input)
    if (detailRef.current?.detail_read_token!==image.detail_read_token || focusRef.current?.token!==destination.token || response.detail_read_token!==image.detail_read_token || response.day.mode!=='editable' || !('movement_groups' in response.day.content)) throw new Error('The program changed. Reload before copying.')
    const sourceDay=response.day.content
    const copied=structuredClone(sourceDay)
    copied.identity_token=destination.token;copied.ordinal=destination.ordinal;copied.label=weekdayForOrdinal(destination.ordinal)
    copied.movement_groups.forEach(group=>{group.identity_token=null as unknown as string;group.exercises.forEach(exercise=>{exercise.identity_token=null as unknown as string;exercise.set_groups.forEach(row=>{row.identity_token=null as unknown as string})})})
    copied.ungrouped_exercises.forEach(exercise=>{exercise.identity_token=null as unknown as string;exercise.set_groups.forEach(row=>{row.identity_token=null as unknown as string})})
    return copied
  }
  const publishDisabledReason = !detail?.publish_boundary ? 'Publish unavailable until this program has a current publish boundary.' : detail.authoring.readiness !== 'ready' ? 'Publish unavailable: complete the readiness check first.' : null
  const scopedPublishAvailable = Boolean(api.publishCoachScopeV1 && api.activateAndPublishCoachScopeV1)
  const openPublishScopes = () => {
    setPublishWeekToken(selectedWeek?.week_identity_token ?? weeks[0]?.week_identity_token ?? null)
    setPublishScopeKind('program')
    setPublishScopeOpen(true)
  }
  const selectWeek = (week: CoachAssignmentWeekSummaryV4) => guarded(() => {
    setSelectedWeekToken(week.week_identity_token)
    if (workspaceView === 'Day' && phase54Api?.getCoachAssignmentDayV6 && phase54Api.saveCoachProgramDayV4) {
      const slot = projectV4WeekSlots(week).find(item => item.day_ordinal === focusRef.current?.ordinal && item.day_identity_token)
      setWorkspaceView('Day')
      if (slot?.day_identity_token) chooseDay({ week: week.week_identity_token, token: slot.day_identity_token, ordinal: slot.day_ordinal })
      else focusFirstAuthoredDay(week)
    } else if (!clientFirst) setWorkspaceView('Week')
  })
  const selectDay = (slot: V4WeekSlot, week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5) => guarded(() => {
    if (!slot.day_identity_token) return
    setSelectedWeekToken(week.week_identity_token); setWorkspaceView('Day'); chooseDay({ week: week.week_identity_token, token: slot.day_identity_token, ordinal: slot.day_ordinal })
  })
  const focusFirstAuthoredDay = (week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5) => {
    const slot = projectV4WeekSlots(week).find(item => item.day_identity_token)
    if (slot?.day_identity_token) chooseDay({ week: week.week_identity_token, token: slot.day_identity_token, ordinal: slot.day_ordinal })
    else { focusRef.current = null; setFocusState(null); setFocusedDay(null); saveDraft.current = null; setDirty(false) }
  }
  const selectFocusedWeek = (week: CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5) => guarded(() => {
    setSelectedWeekToken(week.week_identity_token); setWorkspaceView('Day')
    focusFirstAuthoredDay(week)
  })
  const selectView = (view: 'Day' | 'Week' | 'Plan') => guarded(() => {
    setWorkspaceView(view)
    if (view === 'Day' && selectedWeek && focusRef.current?.week !== selectedWeek.week_identity_token) focusFirstAuthoredDay(selectedWeek)
  })
  useEffect(() => { if (workspaceView !== 'Plan' || !selectedWeekToken) return; const frame=requestAnimationFrame(()=>document.getElementById(`approved-week-${selectedWeekToken}`)?.scrollIntoView({block:'center',behavior:'smooth'})); return ()=>cancelAnimationFrame(frame) },[workspaceView,selectedWeekToken])
  const authoredDays = weeks.flatMap(week => projectV4WeekSlots(week).filter(slot => slot.day_identity_token).map(slot => ({ week, slot })))
  const exportProgram = async () => {
    const image = detailRef.current
    if (!image || assignmentRef.current !== image.assignment_id) return
    const generation = detailGeneration.current
    const selectedAssignment = image.assignment_id
    setBusy(true); setError(null); setNotice(null)
    try {
      const days = new Map<string, ExportDay>()
      for (const week of image.weeks) for (const summary of week.days) {
        if (!summary.day_identity_token) continue
        const input = { assignment: selectedAssignment, day_identity_token: summary.day_identity_token, expected_detail_read_token: image.detail_read_token }
        const response = phase54Api?.getCoachAssignmentDayV6 && phase54Api.saveCoachProgramDayV4 ? await phase54Api.getCoachAssignmentDayV6(input) : phase54Api ? await phase54Api.getCoachAssignmentDayV5(input) : await api.getCoachAssignmentDayV4(input)
        if (generation !== detailGeneration.current || assignmentRef.current !== selectedAssignment || detailRef.current?.detail_read_token !== image.detail_read_token || response.assignment_id !== selectedAssignment || response.program_id !== image.program_id || response.builder_version !== image.builder_version || response.detail_read_token !== image.detail_read_token) throw new CoachApiError('assignment_read_changed', 409)
        const identity = response.day.mode === 'editable' ? response.day.content.identity_token : response.day.day_identity_token
        const ordinal = response.day.mode === 'editable' ? response.day.content.ordinal : response.day.day_ordinal
        if (identity !== summary.day_identity_token || ordinal !== summary.day_ordinal || days.has(identity)) throw new CoachApiError('assignment_read_changed', 409)
        days.set(identity, response.day)
      }
      if (generation !== detailGeneration.current || assignmentRef.current !== selectedAssignment || detailRef.current?.detail_read_token !== image.detail_read_token) throw new CoachApiError('assignment_read_changed', 409)
      const athleteName = roster.find(item => item.athlete_id === image.athlete_id)?.roster_name ?? initialAthleteName ?? 'Athlete'
      await downloadProgramXlsx(buildProgramExportSheets(image, days, athleteName), image.program_name, () => generation === detailGeneration.current && assignmentRef.current === selectedAssignment && detailRef.current?.detail_read_token === image.detail_read_token)
      setNotice('Excel program downloaded.')
    } catch (cause) {
      setError(cause instanceof CoachApiError ? errorText(cause) : cause instanceof Error ? cause.message : 'The Excel export could not be completed.')
    } finally { setBusy(false) }
  }
  const reviewPercentUpdates = async () => {
    if (!detail || !percentApi.previewProgramPercentV1 || !percentApi.applyProgramPercentV1 || busy) return
    const reviewedProgram = detail.program_id, reviewedAssignment = detail.assignment_id, reviewedVersion = detail.builder_version
    setBusy(true); setPercentReviewError(null); setPercentPreview(null)
    try { const result = await percentApi.previewProgramPercentV1({ program: reviewedProgram, expected_builder_version: reviewedVersion }); if (detailRef.current?.program_id !== reviewedProgram || detailRef.current?.assignment_id !== reviewedAssignment || detailRef.current.builder_version !== reviewedVersion) return; setPercentPreview(result) }
    catch (cause) { setPercentReviewError(errorText(cause)); setError(errorText(cause)) } finally { setBusy(false) }
  }
  const applyPercentUpdates = async () => {
    if (!detail || !percentPreview || !percentApi.applyProgramPercentV1 || busy || detail.program_id !== percentPreview.program_id || detail.builder_version !== percentPreview.builder_version) return
    const reviewedAssignment = detail.assignment_id, requestedFocus = focusRef.current
    setBusy(true); setPercentReviewError(null)
    try { const result = await percentApi.applyProgramPercentV1({ program: detail.program_id, expected_builder_version: detail.builder_version, preview_fingerprint: percentPreview.fingerprint }); if (!(await refreshAssignmentImage(reviewedAssignment, requestedFocus))) { requireAuthoritativeRefresh(reviewedAssignment, requestedFocus); throw new Error('Updates were applied, but the program could not be refreshed. Reload before editing.') } setPercentPreview(null); setNotice(`${result.applied_count} percentage ${result.applied_count === 1 ? 'set' : 'sets'} updated.`) }
    catch (cause) { setPercentReviewError(errorText(cause)) } finally { setBusy(false) }
  }
  const focusedAuthoredIndex = focus ? authoredDays.findIndex(entry => entry.week.week_identity_token === focus.week && entry.slot.day_identity_token === focus.token) : -1
  const previousAuthoredDay = focusedAuthoredIndex > 0 ? authoredDays[focusedAuthoredIndex - 1] : null
  const nextAuthoredDay = focusedAuthoredIndex >= 0 && focusedAuthoredIndex < authoredDays.length - 1 ? authoredDays[focusedAuthoredIndex + 1] : null
  return <main className="connected-app phase4-app">
    <aside className="connected-roster" aria-label="Roster">
      <div className="brand"><span>UNRACK</span><small>COACH</small></div>
      {!clientFirst && <>{gyms.length === 0 && !gymsMore ? <p className="phase4-workspace-name">{gymToken ? 'No accessible workspaces' : 'Loading workspaces…'}</p> : gyms.length === 1 && !gymsMore ? <p className="phase4-workspace-name"><span>Workspace</span><strong>{gyms[0].gym_name}</strong></p> : <label className="phase4-scope-picker">Gym<select aria-label="Select gym" disabled={locked} value={gym ?? ''} onChange={event => guarded(() => chooseGym(event.target.value))}>{gyms.map(item => <option key={item.gym_id} value={item.gym_id}>{item.gym_name}</option>)}</select></label>}
      {gymsMore && <button disabled={locked || loadingNavigation} onClick={() => void loadGyms(true)}>Load more gyms</button>}</>}
      {!clientFirst && <><label className="phase4-scope-picker">Athlete<select aria-label="Select athlete" disabled={locked || !gym} value={athlete ?? ''} onChange={event => guarded(() => chooseAthlete(event.target.value))}>{roster.map(item => <option key={item.athlete_id} value={item.athlete_id}>{item.roster_name}</option>)}</select></label>
      {rosterMore && <button disabled={locked || loadingNavigation} onClick={() => gym && void loadRoster(gym, true)}>Load more athletes</button>}</>}
      {clientFirst ? <><h2>Clients</h2><p className="sidebar-client-name">{initialAthleteName ?? 'Selected client'}</p><button className="text-button" onClick={onBackToDashboard}>{backLabel}</button>{onViewPlans && <button className="text-button" onClick={onViewPlans}>View plans</button>}</> : <><h2>Programs</h2>
        {assignments.map(item => <button disabled={locked || unavailableAssignments.has(item.assignment_id)} key={item.assignment_id} className={`program-nav-item${assignment === item.assignment_id ? ' selected' : ''}`} onClick={() => guarded(() => chooseAssignment(item.assignment_id))}><span className="program-nav-name">{item.program_name}</span><small>{unavailableAssignments.has(item.assignment_id) ? 'Unavailable in this session' : <><span className="program-lifecycle">{programLifecycleLabel(item.program_status)}</span><span className="assignment-status">{assignmentStatusLabel(item.assignment_status)}</span><span className="program-version">Version {item.builder_version}</span></>}</small></button>)}
        {assignmentsMore && <button disabled={locked || loadingNavigation} onClick={() => gym && athlete && void loadAssignments(gym, athlete, true)}>Load more programs</button>}
        <button className="button primary" disabled={locked || !gym || !athlete} onClick={() => guarded(() => setCreating(true))}>New program</button></>}
      <button className="text-button signout" disabled={locked} onClick={() => guarded(onSignOut)}>Sign out</button>
    </aside>
    <section className="connected-main">
      <header className="connected-header"><div><p className="eyebrow">LIVE WORKSPACE</p><h1>{detail?.program_name ?? 'Select a program'}</h1>{detail && <p>{roster.find(item => item.athlete_id === detail.athlete_id)?.roster_name ?? 'Assigned athlete'} · {weeks.length} {weeks.length === 1 ? 'week' : 'weeks'} · Builder version {detail.builder_version}</p>}</div></header>
      {error && !copy && !progression && !progressionV2 && !publishScopeOpen && !saveAsTemplate && <p className="workspace-error" role="alert">{error} {recovery && <button disabled={busy} onClick={recovery.retry}>{recovery.label}</button>}</p>}
      {loadingNavigation && <p className="loading-inline" role="status">Loading navigation…</p>}
      {notice && <p className="phase4-live" role={notice === 'Workout template added to the calendar.' ? 'alert' : 'status'} aria-live={notice === 'Workout template added to the calendar.' ? 'assertive' : undefined}>{notice}{notice.startsWith('Undo complete.') && <button className="text-button" aria-label="Dismiss undo confirmation" onClick={() => setNotice(null)}>Dismiss</button>}</p>}
      {detail && <>
        <div className="builder-toolbar"><span className="save-state">{dirty?'Unsaved changes':'Workout saved'}</span><button className="button primary" disabled={locked || (!scopedPublishAvailable && Boolean(publishDisabledReason))} title={!scopedPublishAvailable ? publishDisabledReason ?? undefined : undefined} onClick={() => guarded(scopedPublishAvailable ? openPublishScopes : publish)}>{clientFirst ? 'Publish program' : scopedPublishAvailable ? 'Review publish options' : detail.assignment_status === 'paused' && assignmentLifecycleApi ? 'Activate & publish' : 'Publish'}</button></div><details className="approved-tools"><summary>Program tools</summary>{clientFirst && selectedWeek && usableWorkoutTemplateApi && correctionsApi && <button className="button outline" disabled={locked || !focus || Boolean(richEditableDay && (richEditableDay.movement_groups.length || richEditableDay.ungrouped_exercises.length))} onClick={()=>guarded(()=>{ const slot=projectV4WeekSlots(selectedWeek).find(slot=>slot.day_ordinal===(focus?.ordinal??1));if(slot)setTemplatePicker({slot,week:selectedWeek}) })}>Add workout from template</button>}        <div className="builder-toolbar"><span className="save-state">{dirty ? 'Unsaved day edits — save or discard before another action.' : 'Day edits are saved.'}</span><span className={`readiness-state ${detail.authoring.readiness}`}>{detail.authoring.readiness === 'ready' ? 'Ready to publish whole program' : 'Draft — choose a ready day or week to publish'}</span><button className="button outline" disabled={locked} onClick={() => guarded(exportProgram)}>{busy ? 'Preparing Excel…' : 'Export Excel'}</button><button className="button outline" aria-label="Mark Ready" disabled={locked} onClick={() => guarded(markReady)}>Check readiness</button>{programTemplateApi && <button className="button outline" disabled={locked} onClick={() => guarded(() => { setError(null); setRecovery(null); setResumePublishAfterTemplate(false); setSaveAsTemplate({ name: detail.program_name, requestId: crypto.randomUUID() }) })}>Save to template library</button>}{!scopedPublishAvailable && publishDisabledReason && <span className="publish-disabled-reason" role="status">{publishDisabledReason}</span>}</div></details>
        {detail.authoring.pending_undo && <UndoNotice expiresAt={detail.authoring.pending_undo.expires_at} description={detail.authoring.pending_undo.target_description} disabled={locked} onUndo={() => guarded(undo)} />}
        {compactUndo?.program === detail.program_id && <UndoNotice expiresAt={compactUndo.expires_at} description="Workout move" disabled={locked} onUndo={() => guarded(undoWorkoutMove)} />}
        {clientFirst ? <>        <div className="approved-program-nav"><ManualTabList className="program-views" aria-label="Program view">{(['Day', 'Plan'] as const).map(view => <button key={view} role="tab" aria-selected={workspaceView === view} onClick={() => selectView(view)}>{view === 'Plan' ? 'Program overview' : 'Day'}</button>)}</ManualTabList><div><button className="button outline" disabled={locked} onClick={() => { const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; const match = weeks.flatMap(week => projectV4WeekSlots(week).map(slot => ({week,slot}))).find(item => item.slot.planned_date === today); if (!match) { setNotice('Today is outside this program’s dates.'); return } if (workspaceView === 'Plan') selectWeek(match.week); else if (match.slot.day_identity_token) selectDay(match.slot,match.week); else guarded(() => authorCalendarDay(match.slot,match.week)) }}>This week</button>{oct18Api.previewBuilderWeekCopyV3 && oct18Api.applyBuilderWeekCopyV3 && <button className="button outline" disabled={locked || !selectedWeek || !previousWeek} onClick={() => guarded(() => { if (selectedWeek && previousWeek) updateCopy({ kind: 'week', sourceWeek: previousWeek.week_identity_token, sourceDay: null, destinations: [{ week_identity_token: selectedWeek.week_identity_token, collision_policy: 'preserve' }], preview: null, result: null }) })}>Copy all from previous week</button>}<label>Week <select aria-label="Focused week" disabled={locked} value={selectedWeek?.week_identity_token ?? ''} onChange={event => {const week=weeks.find(item=>item.week_identity_token===event.target.value);if(week)selectWeek(week)}}>{weeks.map(week=><option key={week.week_identity_token} value={week.week_identity_token}>Week {week.week_ordinal}</option>)}</select></label>{workspaceView === 'Day' && <button className="button primary" disabled={locked || !dirty || Boolean(richEditableDay && !editorCanSave)} onClick={() => void saveDraft.current?.()}>Save workout</button>}</div></div>
        {workspaceView === 'Plan' && <section className="approved-week-bands" aria-label="Program overview">{weeks.map(week=><article className={`approved-week-band${selectedWeek?.week_identity_token===week.week_identity_token?' selected':''}`} id={`approved-week-${week.week_identity_token}`} key={week.week_identity_token}><header><h3>Week {week.week_ordinal}</h3><span>{week.days[0]?.planned_date} – {week.days.at(-1)?.planned_date}</span></header><div>{projectV4WeekSlots(week).map(slot=><div className="approved-calendar-slot" data-week-token={week.week_identity_token} data-day-ordinal={slot.day_ordinal} key={slot.day_ordinal}><button disabled={locked || slot.locked_any || (!slot.day_identity_token && !correctionsApi)} onClick={()=>slot.day_identity_token?selectDay(slot,week):guarded(()=>authorCalendarDay(slot,week))}><span>{slot.weekday.slice(0,3)} <time>{slot.planned_date?new Date(`${slot.planned_date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'}):''}</time></span><strong>{slot.workout_title ?? (slot.status==='workout'?workoutTitle(slot.label,slot.day_ordinal):'Recovery day')}</strong><small>{slot.status==='workout'?`${slot.exercise_count} exercises · ${slot.set_row_count} sets`:'No training assigned'}</small><small>{slot.status==='workout'?'Open workout →':'+ Add workout'}</small></button>{usableWorkoutTemplateApi && correctionsApi && (slot.status === 'unscheduled' || slot.status === 'authored_empty') && <button className="approved-calendar-template" aria-label={`Add workout from template for ${slot.weekday}`} disabled={locked || slot.locked_any} onClick={()=>guarded(()=>setTemplatePicker({slot,week}))}>Add from template</button>}</div>)}</div></article>)}</section>}
        {workspaceView === 'Day' && <>{selectedWeek && <><div className="approved-day-strip" role="group" aria-label="Week and day navigation"><button className="button outline" disabled={locked || selectedWeekIndex<=0} onClick={()=>previousWeek&&selectWeek(previousWeek)}>← Previous week</button><ManualTabList panelId="workout-day-panel" className="approved-day-tabs" aria-label="Days of the week">{projectV4WeekSlots(selectedWeek).map(slot=><button key={slot.day_ordinal} role="tab" disabled={locked || (!slot.day_identity_token && !correctionsApi)} aria-selected={slot.day_ordinal===focus?.ordinal} aria-current={slot.planned_date === localToday() ? 'date' : undefined} aria-label={`${slot.weekday.slice(0,3)} ${slot.planned_date ? new Date(`${slot.planned_date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : ''}${detail.calendar.selected_weekdays.includes(slot.day_ordinal) ? ', Planned training day' : ''}`} onClick={()=>slot.day_identity_token?selectDay(slot,selectedWeek):guarded(()=>authorCalendarDay(slot,selectedWeek))}><strong>{slot.weekday.slice(0,3)}</strong><time>{slot.planned_date?new Date(`${slot.planned_date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'}):''}</time>{(slot.exercise_count > 0 || detail.calendar.selected_weekdays.includes(slot.day_ordinal)) && <span className="approved-training-marker">{slot.exercise_count > 0 ? 'Programmed' : 'Training'}</span>}</button>)}</ManualTabList><button className="button outline" disabled={locked || selectedWeekIndex>=weeks.length-1} onClick={()=>weeks[selectedWeekIndex+1]&&selectWeek(weeks[selectedWeekIndex+1])}>Next week →</button></div><div className="approved-day-heading"><h2>{focus?weekdayForOrdinal(focus.ordinal):'Choose a day'} <small>{richEditableDay?.planned_date}</small></h2><div><button className="button outline" disabled={locked || !previousAuthoredDay} onClick={()=>previousAuthoredDay&&selectDay(previousAuthoredDay.slot,previousAuthoredDay.week)}>← Previous day</button><button className="button outline" disabled={locked || !nextAuthoredDay} onClick={()=>nextAuthoredDay&&selectDay(nextAuthoredDay.slot,nextAuthoredDay.week)}>Next day →</button></div></div></>}
        <div className="approved-authoring-grid"><div id="workout-day-panel" role="tabpanel" aria-label={focus ? weekdayForOrdinal(focus.ordinal) : 'Workout day'} className="phase4-focused-day" ref={focusedDayRegion} aria-busy={Boolean(focus && !focusedDay)} style={focus && !focusedDay ? { minHeight: focusedDayLoadingHeight.current } : undefined}>{focus?.week !== selectedWeek?.week_identity_token ? <p>Select an authored day to begin.</p> : richEditableDay && focus ? <ApprovedWorkoutEditor recovery={recoveryPrincipal && gym && athlete && focus ? { scope: { principal: recoveryPrincipal, gym, athlete, assignment: detail.assignment_id, program: detail.program_id, week: focus.week, day: focus.token }, revision: detail.builder_version, epoch: recoveryEpoch } : undefined} registerRecovery={registerWorkoutRecovery} onSaveReadinessChange={setEditorCanSave} buildPayload={(draft, original) => richDaySavePayload(draft, original, false)} historySuggestions={exerciseSuggestions} onHistoryQuery={setExerciseHistoryQuery} onCopyPrevious={copyPreviousDraft} copyPreviousDisabled={!previousWeek} key={`${detail.detail_read_token}:${focus.token}`} day={richEditableDay} template={false} percentBasisOptions={richPercentBasisOptions} exerciseOptions={richExerciseOptions} trackingSupported={richTrackingSupported} onSetExerciseTracking={compactApi.setCoachProgramExerciseTrackingV1 ? setGlobalTracking : undefined} onEnsureExercise={gym && ensureExerciseApi.ensureCoachExerciseV1 ? name => ensureExerciseApi.ensureCoachExerciseV1!({ target_gym: gym, exercise_name: name }) : undefined} defaultUnit={detail.default_unit} plateIncrement={detail.plate_increment} disabled={locked || !detail.phase4_editable || !richEditableDay.day_editable || richEditableDay.locked_any} onDirtyChange={setDirty} registerSave={callback => { saveDraft.current = callback }} onSave={draft => saveRichFocusedDraft(draft as RichProgramDaySave)} /> : editableDay && focus ? <DayEditor key={`${detail.detail_read_token}:${focus.token}`} day={editableDay} fixedWeekday weekdayLabel={'system_weekday' in editableDay ? editableDay.system_weekday : undefined} phase54={Boolean(phase54Api)} defaultUnit={detail.default_unit} disabled={locked || !detail.phase4_editable} refreshing={busy} saving={busy} discardVersion={0} exerciseSuggestions={correctionsApi ? exerciseSuggestions : undefined} onExerciseNameQuery={correctionsApi ? setExerciseHistoryQuery : undefined} onDirtyChange={setDirty} registerSave={callback => { saveDraft.current = callback }} onSave={saveFocusedDraft} /> : focusedDay?.mode === 'legacy_oversize' ? <LegacyOversizeDay day={focusedDay} /> : focus ? <p role="status">Loading focused day…</p> : <p>Select an authored day to begin.</p>}</div><aside className="approved-inspector"><p className="eyebrow">Program at a glance</p><h2>{detail.program_name}</h2><p>Week {selectedWeek?.week_ordinal} of {weeks.length}</p><dl><div><dt>Training days</dt><dd>{detail.calendar.selected_weekdays.length} / 7</dd></div><div><dt>Workout edits</dt><dd>{dirty?'Unsaved':'Saved'}</dd></div><div><dt>Units</dt><dd>{detail.default_unit}</dd></div></dl>{onViewPlans&&<button className="button outline" onClick={()=>guarded(onViewPlans)}>Program history →</button>}<ProgramPublicationDetails api={api as Partial<BacklogRevisionApi>} gym={gym ?? ''} athlete={detail.athlete_id} programIds={[detail.program_id]} refreshKey={detail.detail_read_token} /></aside></div></>}</> : <>        {workspaceView === 'Week' && <div className="phase4-actions"><button className="button outline" disabled={locked || !selectedWeek} onClick={() => guarded(() => { if (selectedWeek) updateCopy({ kind: 'week', sourceWeek: selectedWeek.week_identity_token, sourceDay: null, destinations: [], preview: null, result: null }) })}>Copy week</button>{previousWeek && selectedWeek && <button className="button outline" disabled={locked} onClick={() => guarded(() => updateCopy({ kind: 'week', sourceWeek: previousWeek.week_identity_token, sourceDay: null, destinations: [{ week_identity_token: selectedWeek.week_identity_token, collision_policy: 'preserve' }], preview: null, result: null }))}>Copy from last week</button>}</div>}
        <div className="v4-workspace-nav"><ManualTabList className="program-views" aria-label="Program view">{(['Day', 'Week', 'Plan'] as const).map(view => <button key={view} role="tab" aria-selected={workspaceView === view} onClick={() => selectView(view)}>{view}</button>)}</ManualTabList><div className="v4-week-tabs" aria-label="Program weeks">{weeks.map(week => <button key={week.week_identity_token} className={selectedWeek?.week_identity_token === week.week_identity_token ? 'selected' : ''} disabled={locked} onClick={() => selectWeek(week)}>Week {week.week_ordinal}</button>)}{compactApi.appendCoachProgramWeekV1 && <button className="button outline" disabled={locked || weeks.length >= 12} onClick={() => guarded(appendProgramWeek)}>+ Add week</button>}</div></div>
        {workspaceView === 'Week' && selectedWeek && <V4WeekOverview week={selectedWeek} locked={locked} onChooseDay={slot => selectDay(slot, selectedWeek)} onAuthorDay={correctionsApi ? slot => void authorCalendarDay(slot, selectedWeek) : undefined} onTemplateDay={usableWorkoutTemplateApi && correctionsApi ? slot => guarded(() => setTemplatePicker({ slot, week: selectedWeek })) : undefined} />}
        {workspaceView === 'Plan' && <V4PlanOverview weeks={weeks} readiness={detail.authoring.readiness} onChooseWeek={selectWeek} onCopyWeek={locked ? undefined : week => guarded(() => updateCopy({ kind: 'week', sourceWeek: week.week_identity_token, sourceDay: null, destinations: [], preview: null, result: null }))} />}
        {workspaceView === 'Day' && <>{phase54Api?.getCoachAssignmentDayV6 && phase54Api.saveCoachProgramDayV4 && selectedWeek ? <ManualTabList panelId="workout-day-panel" className="ptw-day-tabs" aria-label="Days of the week">{projectV4WeekSlots(selectedWeek).map(slot => <button key={slot.day_ordinal} role="tab" disabled={locked || (!slot.day_identity_token && !correctionsApi)} aria-selected={slot.day_ordinal === focus?.ordinal} onClick={() => slot.day_identity_token ? selectDay(slot, selectedWeek) : guarded(() => authorCalendarDay(slot, selectedWeek))}><strong>{slot.weekday.slice(0,3)}</strong><span>{slot.status === 'workout' ? slot.workout_title ?? 'Workout' : slot.status === 'authored_empty' ? 'Add workout' : 'Rest day'}</span></button>)}</ManualTabList> : <><div className="v4-day-navigation" aria-label="Navigate training days"><button className="button outline" disabled={locked || !previousAuthoredDay} aria-label={previousAuthoredDay ? `Previous training day, Week ${previousAuthoredDay.week.week_ordinal} ${previousAuthoredDay.slot.weekday}` : 'No previous training day'} onClick={() => { if (previousAuthoredDay) selectDay(previousAuthoredDay.slot, previousAuthoredDay.week) }}>← Previous day</button><span>{focus && selectedWeek ? `Week ${selectedWeek.week_ordinal} · ${weekdayForOrdinal(focus.ordinal)}` : 'Choose a training day'}</span><button className="button outline" disabled={locked || !nextAuthoredDay} aria-label={nextAuthoredDay ? `Next training day, Week ${nextAuthoredDay.week.week_ordinal} ${nextAuthoredDay.slot.weekday}` : 'No next training day'} onClick={() => { if (nextAuthoredDay) selectDay(nextAuthoredDay.slot, nextAuthoredDay.week) }}>Next day →</button></div><div className="phase4-picker-row v4-day-focus"><label>Week<select aria-label="Focused week" disabled={locked} value={selectedWeek?.week_identity_token ?? ''} onChange={event => { const week = weeks.find(item => item.week_identity_token === event.target.value); if (week) selectFocusedWeek(week) }}>{weeks.map(week => <option key={week.week_identity_token} value={week.week_identity_token}>Week {week.week_ordinal}</option>)}</select></label><label>Day<select aria-label="Focused day" disabled={locked || !selectedWeek} value={focus?.week === selectedWeek?.week_identity_token ? focus.ordinal : ''} onChange={event => { const slot = selectedWeek && projectV4WeekSlots(selectedWeek).find(item => item.day_ordinal === Number(event.target.value)); if (slot && selectedWeek) selectDay(slot, selectedWeek) }}>{selectedWeek && projectV4WeekSlots(selectedWeek).map(slot => <option disabled={!slot.day_identity_token} key={slot.day_ordinal} value={slot.day_ordinal}>{v4DaySlotLabel(slot)}</option>)}</select></label></div></>}{workspaceView === 'Day' && <div className="phase4-actions"><button className="button outline" disabled={locked || !focus || focusedDay?.mode === 'legacy_oversize' && !focusedDay.copy_source_eligible} onClick={() => guarded(() => { if (focus) updateCopy({ kind: 'day', sourceWeek: focus.week, sourceDay: focus.token, destinations: [], preview: null, result: null }) })}>Copy workout</button>{compactApi.moveCoachProgramDayV1 && <button className="button outline" disabled={locked || !focus || !richEditableDay || !richEditableDay.day_editable || richEditableDay.locked_any} onClick={() => guarded(() => { if (focus) { setError(null); setMoveWorkout({ requestId: requestId(), assignment: detail.assignment_id, program: detail.program_id, version: detail.builder_version, source: focus, destination: focus.ordinal === 7 ? 1 : focus.ordinal + 1, reviewed: false }) } })}>Move workout</button>}{previousWeek && focus && selectedWeek && projectV4WeekSlots(selectedWeek).find(slot => slot.day_ordinal === focus.ordinal)?.status !== 'workout' && previousWeek.days.find(day => day.day_ordinal === focus.ordinal && day.exercise_count > 0) && <button className="button outline" disabled={locked} onClick={() => guarded(() => { const source = previousWeek.days.find(day => day.day_ordinal === focus.ordinal); if (source) updateCopy({ kind: 'day', sourceWeek: previousWeek.week_identity_token, sourceDay: source.day_identity_token, destinations: [{ week_identity_token: selectedWeek.week_identity_token, collision_policy: 'preserve' }], preview: null, result: null }) })}>Copy from last week</button>}<button className="button outline" disabled={locked || !editableDay || !focus} onClick={() => guarded(() => { if (!focus || !editableDay) return; if (progressionV2Capability) updateProgressionV2({ sourceWeek: focus.week, sourceDay: focus.token, scope: { kind: 'entire_workout' }, destinationWeekTokens: [], rule: { kind: 'exact_reps', direction: 'add', amount: 1 }, overrides: [], replaceReviewedWeeks: false, preview: null, previewing: false, frozen: false }); else setProgression({ scope: { kind: 'set_rows', week_identity_tokens: [focus.week], identity_tokens: [] }, transform: { kind: 'reps', direction: 'add', amount: 1 }, preview: null, result: null })})}>{progressionV2Capability ? 'Progress workout' : 'Progression'}</button></div>}<div id="workout-day-panel" role="tabpanel" aria-label={focus ? weekdayForOrdinal(focus.ordinal) : 'Workout day'} className="phase4-focused-day" ref={focusedDayRegion} aria-busy={Boolean(focus && !focusedDay)} style={focus && !focusedDay ? { minHeight: focusedDayLoadingHeight.current } : undefined}>{focus?.week !== selectedWeek?.week_identity_token ? <p>Select an authored day to begin.</p> : richEditableDay && focus ? <RichDayEditor key={`${detail.detail_read_token}:${focus.token}`} day={richEditableDay} template={false} percentBasisOptions={richPercentBasisOptions} exerciseOptions={richExerciseOptions} trackingSupported={richTrackingSupported} onSetExerciseTracking={compactApi.setCoachProgramExerciseTrackingV1 ? setGlobalTracking : undefined} onEnsureExercise={gym && ensureExerciseApi.ensureCoachExerciseV1 ? name => ensureExerciseApi.ensureCoachExerciseV1!({ target_gym: gym, exercise_name: name }) : undefined} defaultUnit={detail.default_unit} disabled={locked || !detail.phase4_editable || !richEditableDay.day_editable || richEditableDay.locked_any} onDirtyChange={setDirty} registerSave={callback => { saveDraft.current = callback }} onSave={draft => saveRichFocusedDraft(draft as RichProgramDaySave)} /> : editableDay && focus ? <DayEditor key={`${detail.detail_read_token}:${focus.token}`} day={editableDay} fixedWeekday weekdayLabel={'system_weekday' in editableDay ? editableDay.system_weekday : undefined} phase54={Boolean(phase54Api)} defaultUnit={detail.default_unit} disabled={locked || !detail.phase4_editable} refreshing={busy} saving={busy} discardVersion={0} exerciseSuggestions={correctionsApi ? exerciseSuggestions : undefined} onExerciseNameQuery={correctionsApi ? setExerciseHistoryQuery : undefined} onDirtyChange={setDirty} registerSave={callback => { saveDraft.current = callback }} onSave={saveFocusedDraft} /> : focusedDay?.mode === 'legacy_oversize' ? <LegacyOversizeDay day={focusedDay} /> : focus ? <p role="status">Loading focused day…</p> : <p>Select an authored day to begin.</p>}</div></>}</>}
      </>}
      {readiness && <ReadinessIssues readiness={readiness} onGo={issue => { if (issue.day_identity_token) guarded(() => { setReadiness(null); setNotice(`Opening Week ${issue.week_ordinal}, day ${issue.day_ordinal}.`); setSelectedWeekToken(issue.week_identity_token); setWorkspaceView('Day'); const target = issue.set_identity_token ?? issue.exercise_identity_token; chooseDay({ week: issue.week_identity_token, token: issue.day_identity_token!, ordinal: issue.day_ordinal }, target) }) }} />}
    </section>
    {moveWorkout && detail && <Modal label="Move workout" busy={busy} onClose={() => setMoveWorkout(null)}><h2>Move {weekdayForOrdinal(moveWorkout.source.ordinal)}’s workout</h2><p>Move the entire workout, including exercises, loads, and notes. If the destination already has a workout, swap the two days to keep both.</p><label>Move to<select value={moveWorkout.destination} disabled={busy} onChange={event => setMoveWorkout(current => current ? { ...current, requestId: requestId(), destination: Number(event.target.value), reviewed: false, destinationNeedsReview: false } : null)}>{weekdayNames.map((name, index) => <option key={name} value={index + 1} disabled={index + 1 === moveWorkout.source.ordinal}>{name}</option>)}</select></label>{(() => { const target = detail.weeks.find(week => week.week_identity_token === moveWorkout.source.week)?.days.find(day => day.day_ordinal === moveWorkout.destination); return moveWorkout.destinationNeedsReview || target && (target.status !== 'rest' && target.status !== 'unscheduled' || ('workout_title' in target && typeof target.workout_title === 'string' && target.workout_title.trim())) ? <label><input type="checkbox" checked={moveWorkout.reviewed} disabled={busy} onChange={event => setMoveWorkout(current => current ? { ...current, reviewed: event.target.checked } : null)} /> Swap with {weekdayForOrdinal(moveWorkout.destination)}’s existing workout. Keep both workouts.</label> : <p>The previous day will become a rest day.</p> })()}{moveWorkout.version !== detail.builder_version && <p role="alert">This program changed. Close this dialog and review the move again.</p>}{error && <p role="alert">{error}</p>}<div className="dialog-actions"><button className="button outline" disabled={busy} onClick={() => setMoveWorkout(null)}>Cancel</button><button className="button primary" disabled={busy || moveWorkout.version !== detail.builder_version || (() => { const target = detail.weeks.find(week => week.week_identity_token === moveWorkout.source.week)?.days.find(day => day.day_ordinal === moveWorkout.destination); return Boolean((moveWorkout.destinationNeedsReview || target && (target.status !== 'rest' && target.status !== 'unscheduled' || ('workout_title' in target && typeof target.workout_title === 'string' && target.workout_title.trim()))) && !moveWorkout.reviewed) })()} onClick={() => void applyWorkoutMove()}>{busy ? 'Moving…' : 'Move workout'}</button></div></Modal>}
    {copy && detail && <CopyDialog copy={copy} weeks={weeks} detail={detail} busy={busy} locked={locked} error={error} recovery={recovery} multiDay={Boolean(phase54Api)} guardedWeek={Boolean(oct18Api.previewBuilderWeekCopyV3 && oct18Api.applyBuilderWeekCopyV3)} onChange={next => { setRecovery(null); updateCopy(next) }} onCopy={next => guarded(() => { const state = next ?? copy; if (!next && state.preview?.contract === 'v3' && !state.confirmingOverwrite) return applyFrozenCopy(state.preview, copyGeneration.current); return previewCopy(state) })} onClose={() => updateCopy(null)} />}
    {progression && detail && editableDay && focus && <ProgressionDialog progression={progression} detail={detail} focusWeek={focus.week} day={editableDay} busy={busy} locked={locked} error={error} recovery={recovery} onChange={setProgression} onPreview={() => guarded(() => previewProgression(progression))} onApply={() => guarded(applyProgression)} onClose={() => setProgression(null)} />}
    {progressionV2 && detail && editableDay && focus && progressionV2Capability && <ProgressionV2Dialog state={progressionV2} detail={detail} focus={focus} day={editableDay} busy={busy} locked={locked} error={error} recovery={recovery} onChange={next => { setRecovery(null); updateProgressionV2(next) }} onApply={() => { const generation = progressionV2Generation.current; const frozen = progressionV2Ref.current?.preview; if (frozen?.result.can_apply) void applyFrozenProgressionV2(frozen, generation) }} onClose={() => updateProgressionV2(null)} />}
    {operationResult && <Modal label="Operation result" busy={locked} onClose={() => setOperationResult(null)}><h2>Result</h2><OperationResult result={operationResult} closeDisabled={locked} close={() => setOperationResult(null)} />{recovery && <RecoveryNotice recovery={recovery} busy={busy} />}</Modal>}
    {percentPreview && detail && <Modal label="Review percentage updates" busy={busy} onClose={() => { setPercentPreview(null); setPercentReviewError(null) }}><div className="percent-recalc-review"><h2>Review percentage updates</h2><p>{percentPreview.counts.changed} sets would change · {percentPreview.counts.skipped} skipped. Locked or performed sets, missing maxes, manual overrides, and incompatible units remain as they are.</p>{percentPreview.program_id !== detail.program_id || percentPreview.builder_version !== detail.builder_version ? <p role="alert">This preview is stale. Close it and review the current program again.</p> : null}{percentReviewError && <p role="alert">{percentReviewError}</p>}<div className="percent-recalc-list">{percentPreview.changes.length === 0 ? <p>No percentage prescriptions need updating.</p> : percentPreview.changes.map(change => <div key={change.set_identity_token} className="percent-recalc-row"><strong>{change.exercise_name} · {change.percent}% of {change.max_type === 'training_max' ? 'training max' : 'tested 1RM'}</strong><span>{change.old_weight === null ? 'Unresolved' : `${change.old_weight} ${change.unit}`} → {change.new_weight === null ? 'Unresolved' : `${change.new_weight} ${change.unit}`}</span><small>{change.skip_reason ? `Skipped: ${change.skip_reason.replaceAll('_', ' ')}` : 'Eligible'}</small></div>)}</div><div className="dialog-actions"><button className="button outline" disabled={busy} onClick={() => { setPercentPreview(null); setPercentReviewError(null) }}>Cancel</button><button className="button primary" disabled={busy || percentPreview.counts.changed === 0 || percentPreview.program_id !== detail.program_id || percentPreview.builder_version !== detail.builder_version} onClick={() => void applyPercentUpdates()}>{busy ? 'Updating…' : `Apply ${percentPreview.counts.changed} updates`}</button></div></div></Modal>}
    {creating && gym && <CreateSkeleton api={api} gymId={gym} athletes={roster} selectedAthlete={athlete} onClose={() => setCreating(false)} onComplete={async assignmentId => { const refreshed = await refreshAssignmentImage(assignmentId, null); if (refreshed) setCreating(false) }} mutation={busy ? 'create' : null} setMutation={value => setBusy(Boolean(value))} />}
    {templateFeatureUnavailable && <p className="workspace-error" role="status">Workout templates are temporarily unavailable. Calendar editing remains available.</p>}
    {templatePicker && usableWorkoutTemplateApi && gym && <WorkoutTemplatePicker api={usableWorkoutTemplateApi} gym={gym} busy={busy} onClose={() => setTemplatePicker(null)} onUnavailable={() => { setTemplatePicker(null); setTemplateFeatureUnavailable(true); onWorkoutTemplateUnavailable?.() }} onChoose={template => void reviewWorkoutTemplate(template, templatePicker.slot, templatePicker.week)} />}
    {templateReview && !templateMaxProfileOpen && <Modal label="Review workout template loads" busy={busy} onClose={() => { if (!templateReview.retryInput) setTemplateReview(null) }}><h2>Review workout template loads</h2><p>{templateReview.slot.status === 'unscheduled' ? 'Applying this template will create and fill the selected day in one step.' : 'Applying this template will replace the selected empty workout day.'} The weights below use this athlete’s coach-approved maxes.</p>{templateReview.error && <p role="alert" className="workspace-error">{templateReview.error}</p>}{!templateReview.preview && !templateReview.error && <p role="status">Reviewing percentage loads…</p>}{templateReview.preview && <TemplatePercentReview preview={templateReview.preview} />}{templateReview.preview && !templateReview.preview.ready && <div role="alert"><p>You can apply this workout as a draft. Approve the missing programming maxes before publishing.</p><button type="button" className="button outline" disabled={Boolean(templateReview.retryInput)} onClick={() => setTemplateMaxProfileOpen(true)}>Open programming maxes</button></div>}<div className="dialog-actions"><button className="button outline" disabled={busy || Boolean(templateReview.retryInput)} onClick={() => setTemplateReview(null)}>Cancel</button><button className="button outline" disabled={busy || Boolean(templateReview.retryInput) || (!templateReview.preview && !templateReview.error)} onClick={() => void reviewWorkoutTemplate(templateReview.template, templateReview.slot, templateReview.week, templateReview.shellRequestId)}>Review again</button><button className="button primary" disabled={busy || (!templateReview.retryInput && (!templateReview.preview || !canApplyTemplatePercentPreview(templateReview.preview) || detail?.builder_version !== templateReview.preview.program_builder_version))} onClick={() => void applyWorkoutTemplate(templateReview.retryInput)}>{busy ? 'Applying…' : templateReview.retryInput ? 'Retry same template application' : 'Apply workout template'}</button></div></Modal>}
    {templateMaxProfileOpen && gym && athlete && <AthleteProfileDialog api={api} gymId={gym} athleteId={athlete} athleteName={roster.find(item => item.athlete_id === athlete)?.roster_name ?? initialAthleteName ?? 'Selected athlete'} initialTab="maxes" onClose={() => setTemplateMaxProfileOpen(false)} onSaved={async () => { setTemplateMaxProfileOpen(false) }} />}
    {publishScopeOpen && detail && <Modal label="Review publish options" busy={busy} onClose={() => setPublishScopeOpen(false)}><h2>Choose what this client can see</h2><p>Only the selected scope will be released. Unpublished days and weeks stay private.</p>{error && <p className="workspace-error" role="alert">{error}</p>}{recovery && <RecoveryNotice recovery={recovery} busy={busy} />}<div className="phase9-publish-choices">
      <label><input type="radio" name="publish-scope" checked={publishScopeKind === 'week'} disabled={!weeks.length || busy} onChange={() => setPublishScopeKind('week')} /><span><strong>Individual training week</strong><small>Choose one week to release its authored workouts and rest days.</small></span></label>
      {publishScopeKind === 'week' && <label className="phase9-publish-day">Week<select aria-label="Week to publish" disabled={busy} value={publishWeek ? publishWeekToken ?? '' : ''} onChange={event => setPublishWeekToken(event.target.value)}>{!publishWeek && <option value="" disabled>Choose a week</option>}{weeks.map(week => <option key={week.week_identity_token} value={week.week_identity_token}>Week {week.week_ordinal}</option>)}</select>{!publishWeek && <span role="alert">The selected week is no longer available. Choose a week before publishing.</span>}</label>}
      <label><input type="radio" name="publish-scope" checked={publishScopeKind === 'program'} disabled={busy} onChange={() => setPublishScopeKind('program')} /><span><strong>Full program</strong><small>Release all ready program content.</small></span></label>
    </div><div className="phase9-publish-preview"><strong>Visibility preview</strong>{publishScopeKind === 'week' ? <ul>{publishWeek && projectV4WeekSlots(publishWeek).map(slot => <li key={slot.day_ordinal}>{slot.weekday}: {slot.status === 'unscheduled' ? 'Not assigned — not delivered' : slot.status === 'rest' ? 'Rest day' : slot.workout_title ?? workoutTitle(slot.label, slot.day_ordinal) ?? 'Workout'}</li>)}</ul> : <p>All {weeks.length} weeks. The server will preserve previously released work and check remaining content.</p>}<p>The server checks readiness and release history before publishing. Publishing makes this content available to the athlete; it does not confirm their device has downloaded it.</p></div><div className="dialog-actions">{programTemplateApi && <button className="button outline" disabled={busy} onClick={() => { setError(null); setRecovery(null); setPublishScopeOpen(false); setResumePublishAfterTemplate(true); setSaveAsTemplate({ name: detail.program_name, requestId: crypto.randomUUID() }) }}>Save to template library</button>}<button className="button outline" disabled={busy} onClick={() => setPublishScopeOpen(false)}>Cancel</button><button className="button primary" disabled={busy || publishScopeKind === 'week' && !publishWeek} onClick={publishSelectedScope}>{busy ? 'Publishing…' : detail.assignment_status === 'paused' ? 'Activate and publish' : 'Publish selection'}</button></div></Modal>}
    {saveAsTemplate && <Modal label="Save program to template library" busy={busy} onClose={closeSaveAsTemplate}><h2>Save to template library</h2>{templateIssues && <section aria-label="Workouts that need repair"><ul>{templateIssues.issues.map(issue => <li key={issue.day_identity_token}><button className="text-button" disabled={busy} onClick={() => { setSaveAsTemplate(null); setTemplateIssues(null); setResumePublishAfterTemplate(false); setPublishScopeOpen(false); setWorkspaceView('Day'); chooseDay({ week: issue.week_identity_token, token: issue.day_identity_token, ordinal: issue.day_ordinal }) }}>Week {issue.week_ordinal} · {weekdayForOrdinal(issue.day_ordinal)}{issue.label ? ` · ${issue.label}` : ''} — Open workout</button></li>)}</ul>{!templateIssues.issues.length && <p>Review the source workouts and complete their prescriptions before retrying.</p>}</section>}<p>This creates an independent copy without client dates, max values, or workout history.</p>{error && <p className="workspace-error" role="alert">{error}</p>}{recovery && <RecoveryNotice recovery={recovery} busy={busy} />}<label className="phase9-save-template-name">Template name<input maxLength={120} value={saveAsTemplate.name} disabled={busy} onChange={event => { setError(null); setRecovery(null); setSaveAsTemplate(current => current ? { name: event.target.value, requestId: crypto.randomUUID() } : null) }} /></label><div className="dialog-actions"><button className="button outline" disabled={busy} onClick={closeSaveAsTemplate}>Cancel</button><button className="button primary" disabled={busy || !saveAsTemplate.name.trim()} onClick={saveCurrentAsTemplate}>{busy ? 'Saving…' : 'Save copy'}</button></div></Modal>}
    {guard && <DirtyGuard busy={busy || guardPending} onSave={() => void finishGuard('save')} onDiscard={() => void finishGuard('discard')} onCancel={cancelGuard} />}
  </main>
}

function copySelectionError(detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5 | null, copy: CopyState, multiDay = false): string | null {
  if (!detail) return 'The assignment must be refreshed before copying.'
  const sourceWeek = detail.weeks.find(week => week.week_identity_token === copy.sourceWeek)
  if (!sourceWeek) return 'The selected source week no longer exists. Close this review and choose a current source.'
  if (copy.kind === 'day' && (!copy.sourceDay || !sourceWeek.days.some(day => day.day_identity_token === copy.sourceDay))) return 'The selected source day no longer exists. Close this review and choose a current source.'
  if (!copy.destinations.length) return 'Select at least one destination week.'
  if (copy.kind === 'day' && !multiDay && copy.destinations.length !== 1) return 'Day copy requires exactly one destination week.'
  if (copy.destinations.length > 11) return 'Select no more than 11 destination weeks.'
  const destinationTokens = copy.destinations.map(destination => destination.week_identity_token)
  if (new Set(destinationTokens).size !== destinationTokens.length || destinationTokens.includes(copy.sourceWeek)) return 'The copy destinations are no longer valid. Reselect current destination weeks.'
  if (copy.destinations.some(destination => !detail.weeks.some(week => week.week_identity_token === destination.week_identity_token))) return 'A selected destination week no longer exists. Close this review and reselect current destinations.'
  return null
}

function buildCopyInput(detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5 | null, copy: CopyState, multiDay = false): PreviewBuilderCopyV1Input | null {
  if (copySelectionError(detail, copy, multiDay) || !detail) return null
  if (copy.kind === 'day') {
    const sourceDay = detail.weeks.find(week => week.week_identity_token === copy.sourceWeek)?.days.find(day => day.day_identity_token === copy.sourceDay)
    if (!copy.sourceDay || !sourceDay) return null
    return { program: detail.program_id, assignment: detail.assignment_id, expected_builder_version: detail.builder_version, copy_kind: 'day', source: { week_identity_token: copy.sourceWeek, day_identity_token: copy.sourceDay }, destinations: copy.destinations.map(destination => ({ ...destination, day_ordinal: sourceDay.day_ordinal })) }
  }
  return { program: detail.program_id, assignment: detail.assignment_id, expected_builder_version: detail.builder_version, copy_kind: 'week', source: { week_identity_token: copy.sourceWeek }, destinations: copy.destinations }
}

function buildCopyV2Input(detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5 | null, copy: CopyState): PreviewBuilderCopyV2Input | null {
  const input = buildCopyInput(detail, copy, true)
  if (!input || input.copy_kind !== 'day' || !('day_identity_token' in input.source)
    || input.destinations.some(destination => !('day_ordinal' in destination))) return null
  const destinations = input.destinations.flatMap(destination => 'day_ordinal' in destination ? [destination] : [])
  if (destinations.length !== input.destinations.length) return null
  return { ...input, copy_kind: 'day', source: input.source, destinations }
}

function Modal({ label, busy, onClose, children }: { label: string; busy: boolean; onClose(): void; children: ReactNode }) {
  const backdrop = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  useEffect(() => {
    const focusInside = () => (backdrop.current?.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? backdrop.current?.querySelector<HTMLElement>('[role="dialog"]'))?.focus()
    focusInside()
    const contain = (event: FocusEvent) => { if (backdrop.current && event.target instanceof Node && !backdrop.current.contains(event.target)) focusInside() }
    document.addEventListener('focusin', contain)
    return () => { document.removeEventListener('focusin', contain); queueMicrotask(() => opener.current?.focus()) }
  }, [])
  return <div ref={backdrop} className="modal-backdrop" role="presentation" onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose() } else trapDialogTab(event) }}><section className="dialog phase4-dialog" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</section></div>
}

type CopySourceDay = CoachAssignmentWeekSummaryV4['days'][number] | CoachAssignmentWeekSummaryV5['days'][number]
const copySourceDayLabel = (day: CopySourceDay) => {
  const systemWeekday = 'system_weekday' in day ? day.system_weekday : weekdayForOrdinal(day.day_ordinal)
  const title = 'workout_title' in day ? day.workout_title : workoutTitle(day.label, day.day_ordinal)
  return `${systemWeekday} · ${dayStatusLabel(day.status)}${title ? ` · ${title}` : ''}`
}
function CopyDialog({ copy, weeks, detail, busy, locked, error, recovery, multiDay, guardedWeek, onChange, onCopy, onClose }: { copy: CopyState; weeks: Array<CoachAssignmentWeekSummaryV4 | CoachAssignmentWeekSummaryV5>; detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5; busy: boolean; locked: boolean; error: string | null; recovery: Recovery | null; multiDay: boolean; guardedWeek: boolean; onChange(next: CopyState): void; onCopy(next?: CopyState): void; onClose(): void }) {
  const invalidate = (next: Omit<CopyState, 'preview' | 'result'>) => onChange({ ...next, preview: null, result: null, confirmingOverwrite: false })
  const dayOptions = detail.weeks.find(week => week.week_identity_token === copy.sourceWeek)?.days.filter(day => day.day_identity_token) ?? []
  const validation = copySelectionError(detail, copy, multiDay)
  const copyUnavailable = Boolean(copy.preview && !copy.preview.result.can_apply && !copy.confirmingOverwrite)
  const copyInputsDisabled = locked || Boolean(copy.copying)
  return <Modal label="Copy" busy={locked || Boolean(copy.copying)} onClose={onClose}><h2>Copy</h2>{error && <p className="workspace-error" role="alert">{error}</p>}{copy.result ? <><OperationResult result={copy.result} closeDisabled={locked} close={onClose} />{recovery && <RecoveryNotice recovery={recovery} busy={busy} />}</> : <>
    <p>Choose a source and destination, then copy.</p>
    <div className="phase4-form-row"><label>Copy scope<select disabled={copyInputsDisabled} value={copy.kind} onChange={event => { const kind = event.target.value === 'week' ? 'week' : 'day'; const sourceDay = kind === 'day' ? dayOptions[0]?.day_identity_token ?? null : null; invalidate({ ...copy, kind, sourceDay, destinations: copy.destinations.filter(destination => destination.week_identity_token !== copy.sourceWeek) }) }}><option value="day">Day</option><option value="week">Week</option></select></label><label>Source week<select disabled={copyInputsDisabled} value={copy.sourceWeek} onChange={event => { const sourceWeek = event.target.value; const sourceDay = copy.kind === 'day' ? detail.weeks.find(week => week.week_identity_token === sourceWeek)?.days.find(day => day.day_identity_token)?.day_identity_token ?? null : null; invalidate({ ...copy, sourceWeek, sourceDay, destinations: copy.destinations.filter(destination => destination.week_identity_token !== sourceWeek) }) }}>{weeks.map(week => <option value={week.week_identity_token} key={week.week_identity_token}>Week {week.week_ordinal}</option>)}</select></label>{copy.kind === 'day' && <label>Source day<select disabled={copyInputsDisabled} value={copy.sourceDay ?? ''} onChange={event => invalidate({ ...copy, sourceDay: event.target.value, kind: copy.kind, sourceWeek: copy.sourceWeek, destinations: copy.destinations })}>{dayOptions.map(day => <option key={day.day_identity_token} value={day.day_identity_token ?? ''}>{copySourceDayLabel(day)}</option>)}</select></label>}</div>
    <fieldset disabled={copyInputsDisabled}><legend>Destination weeks</legend>{weeks.filter(week => week.week_identity_token !== copy.sourceWeek).map(week => {
      const selected = copy.destinations.find(destination => destination.week_identity_token === week.week_identity_token)
      return <div className="copy-destination-choice" key={week.week_identity_token}><label><input type="checkbox" disabled={copyInputsDisabled} checked={Boolean(selected)} onChange={() => invalidate({ ...copy, destinations: selected ? copy.destinations.filter(destination => destination.week_identity_token !== week.week_identity_token) : copy.kind === 'day' && !multiDay ? [{ week_identity_token: week.week_identity_token, collision_policy: 'preserve' }] : [...copy.destinations, { week_identity_token: week.week_identity_token, collision_policy: 'preserve' }] })} /> Week {week.week_ordinal}</label></div>
    })}</fieldset>
    {validation && copy.destinations.length > 0 && <p className="workspace-error" role="alert">{validation}</p>}
    {copyUnavailable && <p className="workspace-error" role="alert">This copy cannot be completed because one or more selected weeks are unavailable.</p>}
    {copy.confirmingOverwrite && <section className="overwrite-confirmation" role="alert"><p>One or more selected weeks already have work. Replace them?</p><button disabled={locked || copy.copying} onClick={() => { const next: CopyState = { ...copy, destinations: copy.destinations.map(choice => ({ ...choice, collision_policy: 'replace' })), preview: null, result: null, confirmingOverwrite: false }; onChange(next); onCopy(next) }}>{copy.kind === 'week' && guardedWeek ? 'Review replacement' : 'Replace and copy'}</button><button disabled={locked || copy.copying} onClick={() => onChange({ ...copy, preview: null, confirmingOverwrite: false })}>Keep existing</button></section>}
    {copy.preview?.contract === 'v3' && <section className="oct18-week-copy-review" aria-label="Reviewed week copy"><h3>Review all days before saving</h3><p>Copies saved programming only. This saves the selected weeks together and does not publish them.</p>{copy.preview.result.destinations.map(destination => <article key={destination.week_identity_token}><h4>Week {destination.week_ordinal} · {destination.classification}</h4><ul>{destination.destination_days.map(day => <li key={day.day_ordinal}>{weekdayForOrdinal(day.day_ordinal)} · {day.label ?? 'Empty day'} · {day.proposed_action}</li>)}{destination.destination_only_days.map(day => <li key={`only-${day.day_ordinal}`}>{weekdayForOrdinal(day.day_ordinal)} · {day.label ?? 'Destination-only day'} · {day.proposed_action === 'delete' ? 'Remove: absent from source week' : day.proposed_action}</li>)}</ul></article>)}</section>}
    {recovery && <RecoveryNotice recovery={recovery} busy={busy} />}
    <div className="dialog-actions"><button className="button primary" disabled={locked || Boolean(copy.copying) || Boolean(copy.confirmingOverwrite) || Boolean(validation) || copyUnavailable} onClick={() => onCopy()}>{copy.copying ? 'Copying…' : copy.preview?.contract === 'v3' && !copy.confirmingOverwrite ? 'Copy and save week' : copy.kind === 'week' && guardedWeek ? 'Review week copy' : 'Copy'}</button><button disabled={locked || Boolean(copy.copying)} onClick={onClose}>Cancel</button></div>
  </>}</Modal>
}

const progressionV2RuleForKind = (kind: ProgressionV2Rule['kind'], unit: 'lb' | 'kg'): ProgressionV2Rule =>
  kind === 'exact_load' ? { kind, direction: 'add', amount: 5, unit }
    : kind === 'sets' ? { kind, direction: 'add', amount: 1 }
      : { kind, direction: 'add', amount: kind === 'rpe' ? 0.5 : 1 }

function progressionV2ValueText(value: ProgressionV2AfterValue, before?: ProgressionV2AfterValue): string {
  if (value.kind === 'exact_load') return `${value.exact_weight}${before?.kind === 'exact_load' && 'unit' in before ? ` ${before.unit}` : ''}`
  if (value.kind === 'percent_points') return `${value.percent}%${'resolved_weight' in value ? ` (${value.resolved_weight} ${value.unit})` : ''}`
  if (value.kind === 'exact_reps') return `${value.reps} reps`
  if (value.kind === 'rep_range') return `${value.min}–${value.max} reps`
  if (value.kind === 'rpe') return `RPE ${value.rpe}`
  return `${value.set_count} sets`
}

function ProgressionV2Dialog({ state, detail, focus, day, busy, locked, error, recovery, onChange, onApply, onClose }: {
  state: ProgressionV2State
  detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5
  focus: DayFocus
  day: CoachProgramDayV3 | CoachProgramDayV5
  busy: boolean
  locked: boolean
  error: string | null
  recovery: Recovery | null
  onChange(next: ProgressionV2State): void
  onApply(): void
  onClose(): void
}) {
  const sourceWeek = detail.weeks.find(week => week.week_identity_token === focus.week)
  const destinationWeeks = detail.weeks.filter(week => week.week_ordinal >= (sourceWeek?.week_ordinal ?? Number.MAX_SAFE_INTEGER))
  const disabled = locked || busy || state.previewing || state.frozen
  const invalidate = (patch: Partial<ProgressionV2State>) => {
    const next = { ...state, ...patch, preview: null, previewing: false, frozen: false }
    next.previewing = Boolean(buildProgressionV2Input(detail, focus, day, next))
    onChange(next)
  }
  const setRuleKind = (kind: ProgressionV2Rule['kind']) => invalidate({ rule: progressionV2RuleForKind(kind, detail.default_unit), overrides: [] })
  const selectedExercises = state.scope.kind === 'exercises' ? state.scope.source_exercise_identity_tokens : []
  const setOverride = (reviewTargetId: string, value: ProgressionV2Override['value']) => invalidate({
    overrides: [...state.overrides.filter(item => item.review_target_id !== reviewTargetId), { review_target_id: reviewTargetId, value }],
  })
  const preview = state.preview?.result
  const collisionCount = preview?.collision_week_identity_tokens.length ?? 0
  const issueText = (issue: PreviewBuilderProgressionV2Result['blocking_issues'][number]) => {
    if (issue.code === 'destination_locked') return 'A selected week is locked and cannot be progressed.'
    if (issue.code === 'no_eligible_targets') return 'No prescriptions in this workout match that change.'
    if (issue.code === 'mixed_effective_units') return 'The selected weight prescriptions do not all use the chosen unit.'
    if (issue.code === 'pinned_max_missing') return 'A selected percentage prescription no longer has its saved max.'
    if (issue.code === 'result_out_of_range') return 'One result is outside the allowed coaching range. Edit it below.'
    return 'One reviewed value changed. Review the current values and try again.'
  }
  const ruleAmount = state.rule.kind === 'exact_load' ? { min: .001, max: 2000, step: .001 }
    : state.rule.kind === 'percent_points' ? { min: .001, max: 200, step: .001 }
      : state.rule.kind === 'rpe' ? { min: .1, max: 9, step: .1 }
        : state.rule.kind === 'sets' ? { min: 1, max: 19, step: 1 } : { min: 1, max: 99, step: 1 }
  return <Modal label="Progress workout" busy={disabled} onClose={onClose}>
    <h2>Progress workout</h2>
    {error && <p className="workspace-error" role="alert">{error}</p>}
    <section className="progression-v2-section"><h3>Starting workout</h3><p><strong>{'system_weekday' in day ? day.system_weekday : weekdayForOrdinal(day.ordinal)}</strong>{('workout_title' in day ? day.workout_title : workoutTitle(day.label, day.ordinal)) ? ` · ${'workout_title' in day ? day.workout_title : workoutTitle(day.label, day.ordinal)}` : ''} · Week {sourceWeek?.week_ordinal}</p>
      <fieldset disabled={disabled}><legend>What should progress?</legend><label><input disabled={disabled} type="radio" name="progression-scope" checked={state.scope.kind === 'entire_workout'} onChange={() => invalidate({ scope: { kind: 'entire_workout' }, overrides: [] })} /> Entire workout</label><label><input disabled={disabled} type="radio" name="progression-scope" checked={state.scope.kind === 'exercises'} onChange={() => invalidate({ scope: { kind: 'exercises', source_exercise_identity_tokens: [] }, overrides: [] })} /> Choose exercises</label>{state.scope.kind === 'exercises' && <div className="progression-exercise-choices">{day.exercises.map(exercise => <label key={exercise.identity_token}><input disabled={disabled} type="checkbox" checked={selectedExercises.includes(exercise.identity_token)} onChange={() => invalidate({ scope: { kind: 'exercises', source_exercise_identity_tokens: selectedExercises.includes(exercise.identity_token) ? selectedExercises.filter(token => token !== exercise.identity_token) : [...selectedExercises, exercise.identity_token] }, overrides: [] })} /> {exercise.name}</label>)}</div>}</fieldset>
    </section>
    <section className="progression-v2-section"><h3>Weeks</h3><fieldset disabled={disabled}><legend>Select the current week and/or later weeks</legend>{destinationWeeks.map(week => <label key={week.week_identity_token}><input disabled={disabled} type="checkbox" checked={state.destinationWeekTokens.includes(week.week_identity_token)} onChange={() => invalidate({ destinationWeekTokens: state.destinationWeekTokens.includes(week.week_identity_token) ? state.destinationWeekTokens.filter(token => token !== week.week_identity_token) : [...state.destinationWeekTokens, week.week_identity_token], overrides: [], replaceReviewedWeeks: false })} /> Week {week.week_ordinal}{week.week_identity_token === sourceWeek?.week_identity_token ? ' (current)' : ''}</label>)}</fieldset></section>
    <section className="progression-v2-section"><h3>Change each week</h3><div className="phase4-form-row"><label>Change<select disabled={disabled} value={state.rule.kind} onChange={event => { const kind = event.target.value as ProgressionV2Rule['kind']; setRuleKind(kind) }}><option value="exact_load">Weight</option><option value="percent_points">% of max</option><option value="exact_reps">Reps</option><option value="rep_range">Rep range</option><option value="rpe">RPE</option><option value="sets">Sets</option></select></label><label>Direction<select disabled={disabled} value={state.rule.direction} onChange={event => invalidate({ rule: state.rule.kind === 'sets' ? { ...state.rule, direction: event.target.value === 'remove' ? 'remove' : 'add' } : { ...state.rule, direction: event.target.value === 'subtract' ? 'subtract' : 'add' }, overrides: [] })}>{state.rule.kind === 'sets' ? <><option value="add">Add</option><option value="remove">Remove</option></> : <><option value="add">Add</option><option value="subtract">Subtract</option></>}</select></label><label>Amount<input disabled={disabled} aria-invalid={!validProgressionV2Rule(state.rule) || undefined} type="number" min={ruleAmount.min} max={ruleAmount.max} step={ruleAmount.step} value={state.rule.amount} onChange={event => invalidate({ rule: { ...state.rule, amount: Number(event.target.value) } as ProgressionV2Rule, overrides: [] })} /></label>{state.rule.kind === 'exact_load' && <label>Unit<select disabled={disabled} value={state.rule.unit} onChange={event => invalidate({ rule: { kind: 'exact_load', direction: state.rule.kind === 'exact_load' ? state.rule.direction : 'add', amount: state.rule.amount, unit: event.target.value === 'kg' ? 'kg' : 'lb' }, overrides: [] })}><option value="lb">lb</option><option value="kg">kg</option></select></label>}</div></section>
    <section className="progression-v2-review" aria-live="polite"><h3>Review and apply</h3>{state.previewing && <p role="status">Reviewing changes…</p>}{!state.previewing && !preview && <p>Select at least one week to see the changes.</p>}{preview?.blocking_issues.map((issue, index) => <p className="workspace-error" role="alert" key={`${issue.code}:${index}`}>{issueText(issue)}</p>)}{preview?.weeks.map(week => <details key={week.week_identity_token} open><summary>Week {week.week_ordinal}{week.collision ? ' · Existing workout' : ''}</summary><p>{week.weekday}{week.workout_title ? ` · ${week.workout_title}` : ''}</p>{week.review_targets.map(target => <div className="progression-review-line" key={target.review_target_id}><span>{target.exercise_name}{target.set_ordinal ? ` · Set ${target.set_ordinal}` : ''}</span><span>{progressionV2ValueText(target.before as ProgressionV2AfterValue)} →</span><ProgressionV2OverrideInput target={target} weekOrdinal={week.week_ordinal} disabled={disabled} onChange={value => setOverride(target.review_target_id, value)} /></div>)}{week.unchanged_count > 0 && <p>{week.unchanged_count} other prescription{week.unchanged_count === 1 ? '' : 's'} unchanged.</p>}</details>)}{collisionCount > 0 && <label className="progression-replace"><input type="checkbox" disabled={disabled} checked={state.replaceReviewedWeeks} onChange={event => invalidate({ replaceReviewedWeeks: event.target.checked })} /> Replace the existing workout in {collisionCount === 1 ? 'this reviewed week' : 'these reviewed weeks'}</label>}</section>
    {recovery && <RecoveryNotice recovery={recovery} busy={busy} />}
    <div className="dialog-actions"><button className="button primary" disabled={disabled || !preview?.can_apply} onClick={onApply}>Apply progression</button><button disabled={disabled} onClick={onClose}>Cancel</button></div>
  </Modal>
}

function ProgressionV2OverrideInput({ target, weekOrdinal, disabled, onChange }: { target: PreviewBuilderProgressionV2Result['weeks'][number]['review_targets'][number]; weekOrdinal: number; disabled: boolean; onChange(value: ProgressionV2Override['value']): void }) {
  const after = target.after
  if (after.kind === 'exact_load') return <label>New weight<input aria-label={`Week ${weekOrdinal} ${target.exercise_name} set ${target.set_ordinal} weight`} disabled={disabled} type="number" min="0" max="2000" step="0.001" value={after.exact_weight} onChange={event => onChange({ kind: after.kind, exact_weight: Number(event.target.value) })} /></label>
  if (after.kind === 'percent_points') return <label>New percent<input aria-label={`Week ${weekOrdinal} ${target.exercise_name} set ${target.set_ordinal} percent`} disabled={disabled} type="number" min="0.001" max="200" step="0.001" value={after.percent} onChange={event => onChange({ kind: after.kind, percent: Number(event.target.value) })} /></label>
  if (after.kind === 'exact_reps') return <label>New reps<input aria-label={`Week ${weekOrdinal} ${target.exercise_name} set ${target.set_ordinal} reps`} disabled={disabled} type="number" min="1" max="100" step="1" value={after.reps} onChange={event => onChange({ kind: after.kind, reps: Number(event.target.value) })} /></label>
  if (after.kind === 'rep_range') return <span className="progression-range-inputs"><label>Minimum<input aria-label={`Week ${weekOrdinal} ${target.exercise_name} set ${target.set_ordinal} minimum reps`} disabled={disabled} type="number" min="1" max="100" step="1" value={after.min} onChange={event => onChange({ kind: after.kind, min: Number(event.target.value), max: after.max })} /></label><label>Maximum<input aria-label={`Week ${weekOrdinal} ${target.exercise_name} set ${target.set_ordinal} maximum reps`} disabled={disabled} type="number" min="1" max="100" step="1" value={after.max} onChange={event => onChange({ kind: after.kind, min: after.min, max: Number(event.target.value) })} /></label></span>
  if (after.kind === 'rpe') return <label>New RPE<input aria-label={`Week ${weekOrdinal} ${target.exercise_name} set ${target.set_ordinal} RPE`} disabled={disabled} type="number" min="1" max="10" step="0.1" value={after.rpe} onChange={event => onChange({ kind: after.kind, rpe: Number(event.target.value) })} /></label>
  return <label>New sets<input aria-label={`Week ${weekOrdinal} ${target.exercise_name} sets`} disabled={disabled} type="number" min="1" max="20" step="1" value={after.set_count} onChange={event => onChange({ kind: after.kind, set_count: Number(event.target.value) })} /></label>
}

function ProgressionDialog({ progression, detail, focusWeek, day, busy, locked, error, recovery, onChange, onPreview, onApply, onClose }: { progression: ProgressionState; detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5; focusWeek: string; day: CoachProgramDayV3 | CoachProgramDayV5; busy: boolean; locked: boolean; error: string | null; recovery: Recovery | null; onChange(next: ProgressionState): void; onPreview(): void; onApply(): void; onClose(): void }) {
  const invalidate = (scope: ProgressionScope, transform: ProgressionTransform) => onChange({ scope, transform, preview: null, result: null })
  const identities = progression.scope.kind === 'set_rows'
    ? day.exercises.flatMap(exercise => exercise.set_groups.map(row => ({ token: row.identity_token, label: `${exercise.name}, set ${row.ordinal}` })))
    : day.exercises.map(exercise => ({ token: exercise.identity_token, label: exercise.name }))
  const focusedWeek = detail.weeks.find(week => week.week_identity_token === focusWeek)
  const setTransformKind = (kind: ProgressionTransform['kind']) => {
    const scope = kind === 'sets'
      ? { kind: 'exercises' as const, week_identity_tokens: progression.scope.week_identity_tokens.includes(focusWeek) ? [focusWeek] : [], identity_tokens: [] }
      : { kind: 'set_rows' as const, week_identity_tokens: progression.scope.week_identity_tokens.includes(focusWeek) ? [focusWeek] : [], identity_tokens: [] }
    invalidate(scope, kind === 'exact_load' ? { kind, direction: 'add', amount: 5, unit: detail.default_unit } : kind === 'sets' ? { kind, direction: 'add', amount: 1 } : { kind, direction: 'add', amount: 1 })
  }
  const updateDirection = (value: string) => {
    const transform = progression.transform
    if (transform.kind === 'sets') invalidate(progression.scope, { ...transform, direction: value === 'remove' ? 'remove' : 'add' })
    else invalidate(progression.scope, { ...transform, direction: value === 'subtract' ? 'subtract' : 'add' })
  }
  const updateUnit = (unit: 'lb' | 'kg') => {
    const transform = progression.transform
    if (transform.kind === 'exact_load') invalidate(progression.scope, { kind: transform.kind, direction: transform.direction, amount: transform.amount, unit })
  }
  const amount = progression.transform.kind === 'exact_load' ? { min: .001, max: 2000, step: .001 }
    : progression.transform.kind === 'percent_points' ? { min: .001, max: 200, step: .001 }
      : progression.transform.kind === 'rpe' ? { min: .1, max: 9, step: .1 }
        : progression.transform.kind === 'reps' ? { min: 1, max: 99, step: 1 } : { min: 1, max: 19, step: 1 }
  const validInput = buildProgressionInput(detail, { week: focusWeek, token: day.identity_token, ordinal: day.ordinal }, day, progression)
  return <Modal label="Progression review" busy={locked} onClose={onClose}><h2>{progression.result ? 'Result' : 'Preview progression'}</h2>{error && <p className="workspace-error" role="alert">{error}</p>}{progression.result ? <><OperationResult result={progression.result} closeDisabled={locked} close={onClose} />{recovery && <RecoveryNotice recovery={recovery} busy={busy} />}</> : <>
    <p>Select stable identities from the loaded focused day. The server decides eligibility and outcomes.</p>
    <p>Target: <strong>{progression.scope.kind === 'set_rows' ? 'Set rows' : 'Exercises'}</strong> (determined by transform)</p>
    <div className="phase4-form-row"><label>Transform<select disabled={locked} value={progression.transform.kind} onChange={event => { const value = event.target.value; setTransformKind(value === 'exact_load' || value === 'percent_points' || value === 'reps' || value === 'sets' || value === 'rpe' ? value : 'reps') }}><option value="exact_load">Exact load</option><option value="percent_points">Percentage points</option><option value="reps">Reps</option><option value="sets">Sets</option><option value="rpe">RPE</option></select></label><label>Direction<select disabled={locked} value={progression.transform.direction} onChange={event => updateDirection(event.target.value)}>{progression.transform.kind === 'sets' ? <><option value="add">Add</option><option value="remove">Remove</option></> : <><option value="add">Add</option><option value="subtract">Subtract</option></>}</select></label><label>Amount<input aria-invalid={!validProgressionTransform(progression.transform) || undefined} disabled={locked} type="number" min={amount.min} max={amount.max} step={amount.step} value={progression.transform.amount} onChange={event => { const nextAmount = Number(event.target.value); const transform = progression.transform; invalidate(progression.scope, transform.kind === 'exact_load' ? { kind: transform.kind, direction: transform.direction, amount: nextAmount, unit: transform.unit } : transform.kind === 'sets' ? { kind: transform.kind, direction: transform.direction, amount: nextAmount } : { kind: transform.kind, direction: transform.direction, amount: nextAmount }) }} /></label>{progression.transform.kind === 'exact_load' && <label>Unit<select disabled={locked} value={progression.transform.unit} onChange={event => updateUnit(event.target.value === 'kg' ? 'kg' : 'lb')}><option value="lb">lb</option><option value="kg">kg</option></select></label>}</div>
    <fieldset disabled={locked}><legend>Loaded week · {progression.scope.week_identity_tokens.length} selected</legend><label><input type="checkbox" checked={progression.scope.week_identity_tokens.includes(focusWeek)} onChange={() => invalidate({ ...progression.scope, week_identity_tokens: progression.scope.week_identity_tokens.includes(focusWeek) ? [] : [focusWeek], identity_tokens: [] }, progression.transform)} /> Week {focusedWeek?.week_ordinal ?? day.ordinal}</label><p>Only identities from this authoritatively loaded week can be selected. Load another week to target it.</p></fieldset>
    <fieldset disabled={locked}><legend>{progression.scope.kind === 'set_rows' ? 'Set rows' : 'Exercises'} · {progression.scope.identity_tokens.length} selected</legend>{identities.map(item => <label key={item.token}><input type="checkbox" checked={progression.scope.identity_tokens.includes(item.token)} onChange={() => invalidate({ ...progression.scope, identity_tokens: progression.scope.identity_tokens.includes(item.token) ? progression.scope.identity_tokens.filter(token => token !== item.token) : [...progression.scope.identity_tokens, item.token] }, progression.transform)} /> {item.label}</label>)}</fieldset>
    {progression.preview && <ProgressionPreviewResult preview={progression.preview.result} />}
    {recovery && <RecoveryNotice recovery={recovery} busy={busy} />}
    <div className="dialog-actions"><button disabled={locked || !validInput} onClick={onPreview}>Preview</button><button className="button primary" disabled={locked || !progression.preview?.result.can_apply} onClick={onApply}>Apply progression</button><button disabled={locked} onClick={onClose}>Cancel</button></div>
  </>}</Modal>
}

function progressionValue(value: ProgressionValue): string {
  switch (value.kind) {
    case 'exact_load': return `${value.exact_weight} ${value.effective_unit}`
    case 'percent_points': return `${value.percent}% → ${value.resolved_weight} ${value.effective_unit} (max ${value.pinned_max_value} ${value.pinned_max_unit}, plate ${value.plate_increment})`
    case 'reps': return `${value.reps} reps`
    case 'sets': return `${value.set_count} sets`
    case 'rpe': return `RPE ${value.rpe}`
  }
}
function ProgressionPreviewResult({ preview }: { preview: PreviewBuilderProgressionV1Result }) {
  return <section className="operation-summary"><h3>Preview</h3><p>{preview.eligible_count} ready to change{preview.skipped_rows.length ? ` · ${preview.skipped_rows.length} skipped` : ''}{preview.locked.length ? ` · ${preview.locked.length} locked` : ''}</p>{preview.representative_changes.map(change => <p key={change.target_identity_token}>{progressionValue(change.before)} will become {progressionValue(change.after)}</p>)}<ProgressionExceptions skipped={preview.skipped_rows} locked={preview.locked} issues={preview.blocking_issues} /></section>
}

function ProgressionExceptions({ skipped, locked, issues }: { skipped: PreviewBuilderProgressionV1Result['skipped_rows']; locked: PreviewBuilderProgressionV1Result['locked']; issues: PreviewBuilderProgressionV1Result['blocking_issues'] }) {
  const blocked = locked.length + issues.length
  return <>{skipped.length > 0 && <p>{skipped.length} selected item{skipped.length === 1 ? '' : 's'} will be skipped.</p>}{blocked > 0 && <p>{blocked} selected item{blocked === 1 ? ' needs' : 's need'} attention before {blocked === 1 ? 'it' : 'they'} can change.</p>}</>
}

function OperationResult({ result, close, closeDisabled = false }: { result: CoachBuilderOperationResult; close(): void; closeDisabled?: boolean }) {
  if (result.operation_type === 'progression') return <div className="operation-result" role="alert" aria-live="assertive"><p>{result.outcome === 'refused' ? 'Progression could not be applied.' : result.unchanged ? 'No progression changes were needed.' : 'Progression applied.'}</p>{result.changes.map(change => <p key={change.target_identity_token}>{progressionValue(change.before)} → {progressionValue(change.after)}</p>)}<button disabled={closeDisabled} onClick={close}>Close</button></div>
  if (result.operation_type === 'undo') return <div className="operation-result" role="alert" aria-live="assertive"><p>Authoritative server result: undid {result.undone_operation_type} operation {result.undo_id}.</p><p>Restored weeks: {result.restored_week_identity_tokens.join(', ') || 'none'}.</p><p>Draft at builder version {result.builder_version_after}; undone {result.undone_at}.</p><button disabled={closeDisabled} onClick={close}>Close</button></div>
  if (result.operation_type === 'publish_ready') return <div className="operation-result" role="alert" aria-live="assertive"><p>Authoritative server result: published release {result.release_id}.</p><p>Ready at builder version {result.builder_version}; published {result.published_at}.</p><button disabled={closeDisabled} onClick={close}>Close</button></div>
  if (result.operation_type === 'activate_assignment') return <div className="operation-result" role="alert" aria-live="assertive"><p>Program activated and published.</p><p>Published {result.published_at}; retired {result.retired_instance_count} unstarted prior workout{result.retired_instance_count === 1 ? '' : 's'}.</p><button disabled={closeDisabled} onClick={close}>Close</button></div>
  return <div className="operation-result" role="alert" aria-live="assertive"><p>{result.unchanged ? 'No copy changes were needed.' : 'Copy complete.'}</p><button disabled={closeDisabled} onClick={close}>Close</button></div>
}
function RecoveryNotice({ recovery, busy }: { recovery: Recovery; busy: boolean }) { return <p className="workspace-error" role="alert">The operation is locked until recovery succeeds. <button disabled={busy} onClick={recovery.retry}>{recovery.label}</button></p> }
function ReadinessIssues({ readiness, onGo }: { readiness: ReadinessState; onGo(issue: CoachReadinessIssueV1): void }) { return <section className="readiness-issues" aria-live="polite"><h2>Not ready — {readiness.issue_count} issues</h2>{readiness.issues_truncated && <p>Showing the first {readiness.issues.length} issues.</p>}{readiness.issues.map((issue, index) => <button key={`${issue.week_identity_token}:${issue.day_ordinal}:${index}`} onClick={() => onGo(issue)}>Week {issue.week_ordinal}, day {issue.day_ordinal}, exercise {issue.exercise_ordinal ?? '—'}, set {issue.set_ordinal ?? '—'}: {readinessIssueLabel(issue.code)}</button>)}</section> }
function DirtyGuard({ busy, onSave, onDiscard, onCancel }: { busy: boolean; onSave(): void; onDiscard(): void; onCancel(): void }) { return <Modal label="Unsaved changes" busy={busy} onClose={onCancel}><h2>Unsaved changes</h2><p>Save or discard this open day before continuing.</p><div className="dialog-actions"><button autoFocus className="button primary" disabled={busy} onClick={onSave}>Save</button><button disabled={busy} onClick={onDiscard}>Discard</button><button disabled={busy} onClick={onCancel}>Cancel</button></div></Modal> }
type LegacyOversizeDayModel = Extract<CoachAssignmentDayV4['day'], { mode: 'legacy_oversize' }> | Extract<CoachAssignmentDayV5['day'], { mode: 'legacy_oversize' }>
function LegacyOversizeDay({ day }: { day: LegacyOversizeDayModel }) {
  const systemWeekday = 'system_weekday' in day ? day.system_weekday : day.label ?? dayStatusLabel(day.status)
  const workout = 'workout_title' in day ? day.workout_title : null
  return <article className="connected-day legacy-oversize" aria-label="View-only day"><header><div><p>DAY {day.day_ordinal}</p><h2>{systemWeekday}{workout ? ` · ${workout}` : ''}</h2></div><span>View-only</span></header><p>This day cannot be edited in the current builder.</p><p>{day.exercise_count} exercises · {day.set_row_count} set rows.</p><p>{day.copy_source_eligible ? 'Server copy is available.' : `Server copy unavailable: ${legacyCopyBlockLabel(day.copy_block_reason)}.`} Progression and editing are unavailable.</p></article>
}

function authoritativeDay(previous: CoachProgramDayV3, saved: SaveCoachProgramDayV2): CoachProgramDayV3 {
  return { ...previous, ...saved, exercises: saved.exercises.map(exercise => exercise.mode === 'preserve'
    ? previous.exercises.find(item => item.identity_token === exercise.identity_token)!
    : { identity_token: exercise.identity_token!, ordinal: exercise.ordinal, name: exercise.name, note: exercise.note, protocol: exercise.protocol, edit_mode: 'replace', unsupported_reason: null,
      set_groups: exercise.set_rows.map(row => ({ ...row, identity_token: row.identity_token!, sets: 1, rest_seconds: null,
        sets_mode: 'exact', sets_min: 1, sets_max: null, dose_mode: 'reps', reps_mode: 'exact', dose_min: row.reps, dose_max: null,
        distance_unit: null, laterality: 'bilateral', load_mode: row.load_kind, load_basis: 'total',
        exact_weight: row.load_kind === 'exact' ? row.load_value : null, percent: null, of_max_id: null, resolved_weight: null,
        resolved_max_effective_from: null, resolved_at: null, manual_override: null, rpe_min: row.load_kind === 'rpe' ? row.load_value : null,
        rpe_max: null, qualitative: row.load_kind === 'qualitative' ? row.load_value : null, percent_basis_exercise_id: null, percent_basis_max_type: null })) }) }
}

function reconcileSavedDay(current: CoachWorkspace | null, result: SaveCoachProgramDayV2Result): CoachWorkspace | null {
  if (!current?.selected || current.selected.assignment_id !== result.assignment_id) return current
  const empty = !result.day.marked_rest && result.day.exercises.length === 0
  const selected = current.selected
  return {
    ...current,
    gyms: current.gyms.map(gym => ({ ...gym, roster: gym.roster.map(athlete => ({ ...athlete, programs: athlete.programs.map(program => program.assignment_id === result.assignment_id ? { ...program, builder_version: result.builder_version } : program) })) })),
    selected: {
      ...selected,
      builder_version: result.builder_version,
      empty_unmarked_day_tokens: [...selected.empty_unmarked_day_tokens.filter(token => token !== result.day_identity_token), ...(empty ? [result.day_identity_token] : [])],
      weeks: selected.weeks.map(week => ({ ...week, days: week.days.map(day => day.identity_token === result.day_identity_token ? authoritativeDay(day, result.day) : day) })),
    },
  }
}

type EditorSetBase = {
  identity_token: string | null
  ordinal: number
  reps: number | CoachRepsV3
  note: string | null
}
type EditorSet = EditorSetBase & (
  | { load_kind: 'exact'; load_value: number; unit_override: 'lb' | 'kg' | null; effective_unit: 'lb' | 'kg' }
  | { load_kind: 'rpe'; load_value: number; unit_override: null; effective_unit: null }
  | { load_kind: 'qualitative'; load_value: 'L' | 'M' | 'MH' | 'H'; unit_override: null; effective_unit: null }
  | { load_kind: 'bodyweight' | 'none' | 'tbd'; load_value: null; unit_override: null; effective_unit: null }
)
type EditableExercise = { mode: 'replace'; identity_token: string | null; ordinal: number; name: string; note: string | null; protocol: string | null; set_rows: EditorSet[] }
type PreservedExercise = { mode: 'preserve'; identity_token: string; ordinal: number }
type EditorDay = Omit<SaveCoachProgramDayV2, 'exercises'> & { exercises: Array<EditableExercise | PreservedExercise> }
type PendingNumericDraft = { exerciseOrdinal: number; rowOrdinal: number; kind: 'reps' | 'load'; value: string }
const numericValidationMessage = (kind: PendingNumericDraft['kind'], row: EditorSet, value: string, phase54 = false): string | null => {
  if (value === '') return kind === 'reps' ? 'Reps is required.' : row.load_kind === 'rpe' ? 'RPE is required.' : 'Weight is required.'
  if (kind === 'reps' && phase54) {
    const exact = /^([1-9]\d*)$/u.exec(value)
    const range = /^([1-9]\d*)-([1-9]\d*)$/u.exec(value)
    if (exact && Number(exact[1]) <= 100) return null
    if (range && Number(range[1]) <= 100 && Number(range[2]) <= 100 && Number(range[1]) <= Number(range[2])) return null
    return 'Reps must be a whole number 1–100 or a range such as 5-10 (minimum cannot exceed maximum).'
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) return kind === 'reps' ? 'Reps must be a whole number from 1–100.' : row.load_kind === 'rpe' ? 'RPE must be 1–10 with at most one decimal place.' : 'Weight must be 0–2000 with at most three decimal places.'
  const parsed = Number(value)
  if (kind === 'reps') return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 100 ? null : 'Reps must be a whole number from 1–100.'
  const maximum = row.load_kind === 'rpe' ? 10 : 2000
  const places = row.load_kind === 'rpe' ? 1 : 3
  return Number.isFinite(parsed) && parsed >= (row.load_kind === 'rpe' ? 1 : 0) && parsed <= maximum && (value.split('.')[1]?.length ?? 0) <= places ? null : row.load_kind === 'rpe' ? 'RPE must be 1–10 with at most one decimal place.' : 'Weight must be 0–2000 with at most three decimal places.'
}
const applyNumericValue = (row: EditorSet, kind: PendingNumericDraft['kind'], value: number | string, phase54 = false): EditorSet => {
  if (kind === 'reps') {
    if (phase54) {
      const [minimum, maximum] = String(value).split('-').map(Number)
      return { ...row, reps: maximum ? { mode: 'range', min: minimum, max: maximum } : { mode: 'exact', value: minimum } }
    }
    if (typeof value !== 'number') throw new Error('Legacy reps must be numbers.')
    return { ...row, reps: value }
  }
  if (row.load_kind === 'exact' || row.load_kind === 'rpe') {
    if (typeof value !== 'number') throw new Error('Numeric load values must be numbers.')
    return { ...row, load_value: value }
  }
  throw new Error('Only exact weight and RPE rows accept numeric load values.')
}
const shapeReason = (reason: string | null) => ({ day_shape: 'The legacy day structure cannot safely be edited here', set_limit: 'More than 20 individual sets', sets_range: 'Set ranges', dose_shape: 'Unsupported dose prescription', load_shape: 'Unsupported load prescription', movement_shape: 'Unsupported movement prescription', exercise_shape: 'Unsupported exercise prescription', movement_groups: 'Movement groups' }[reason ?? ''] ?? 'Unsupported prescription')
const hasUnpairedSurrogate = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= value.length) return true
      const next = value.charCodeAt(i + 1)
      if (next < 0xdc00 || next > 0xdfff) return true
      i += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true
    }
  }
  return false
}
const normalizePhase3Text = (value: string): string => value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/gu, '')
function projectIndividualSet(group: CoachSetGroupV3, identityToken: string | null, ordinal: number): EditorSet {
  if (typeof group.reps !== 'number') throw new Error('An editable set row must have an exact repetition count.')
  const base = { identity_token: identityToken, ordinal, reps: group.reps, note: identityToken ? group.note : null }
  switch (group.load_kind) {
    case 'exact':
      if (typeof group.load_value !== 'number' || group.effective_unit === null) throw new Error('An editable exact-load row must have a weight and unit.')
      return { ...base, load_kind: 'exact', load_value: group.load_value, unit_override: group.unit_override, effective_unit: group.effective_unit }
    case 'rpe':
      if (typeof group.load_value !== 'number') throw new Error('An editable RPE row must have a numeric value.')
      return { ...base, load_kind: 'rpe', load_value: group.load_value, unit_override: null, effective_unit: null }
    case 'qualitative':
      switch (group.load_value) {
        case 'L': return { ...base, load_kind: 'qualitative', load_value: 'L', unit_override: null, effective_unit: null }
        case 'M': return { ...base, load_kind: 'qualitative', load_value: 'M', unit_override: null, effective_unit: null }
        case 'MH': return { ...base, load_kind: 'qualitative', load_value: 'MH', unit_override: null, effective_unit: null }
        case 'H': return { ...base, load_kind: 'qualitative', load_value: 'H', unit_override: null, effective_unit: null }
        default: throw new Error('An editable qualitative row must have a supported effort value.')
      }
    case 'bodyweight': return { ...base, load_kind: 'bodyweight', load_value: null, unit_override: null, effective_unit: null }
    case 'none': return { ...base, load_kind: 'none', load_value: null, unit_override: null, effective_unit: null }
    case 'tbd': return { ...base, load_kind: 'tbd', load_value: null, unit_override: null, effective_unit: null }
    case 'percent': throw new Error('Percent-load exercises must be preserved rather than projected as editable rows.')
  }
}
function projectDay(day: CoachProgramDayV3 | CoachProgramDayV5, fixedWeekday = false, phase54 = false): EditorDay {
  if ('system_weekday' in day) {
    if (!phase54) throw new Error('V5 day data requires the full Phase 5.4 capability.')
    const v5 = day
    return { identity_token: v5.identity_token, ordinal: v5.ordinal, label: v5.system_weekday, subtitle: v5.workout_title, marked_rest: v5.marked_rest, workout_instruction: v5.workout_instruction,
      exercises: v5.exercises.map(exercise => exercise.edit_mode === 'preserve'
        ? { mode: 'preserve' as const, identity_token: exercise.identity_token, ordinal: exercise.ordinal }
        : { mode: 'replace' as const, identity_token: exercise.identity_token, ordinal: exercise.ordinal, name: exercise.name, note: exercise.note, protocol: exercise.protocol,
          set_rows: exercise.set_groups.flatMap(group => Array.from({ length: group.sets ?? group.sets_min }, (_, index) => projectIndividualSetV3(group, index === 0 ? group.identity_token : null, 0))).map((row, index) => ({ ...row, ordinal: index + 1 })) }),
    }
  }
  const v3 = day
  if (!fixedWeekday) return { identity_token: v3.identity_token, ordinal: v3.ordinal, label: v3.label ?? '', subtitle: v3.subtitle, marked_rest: v3.marked_rest, workout_instruction: v3.workout_instruction,
    exercises: v3.exercises.map(exercise => exercise.edit_mode === 'preserve'
      ? { mode: 'preserve', identity_token: exercise.identity_token, ordinal: exercise.ordinal }
      : { mode: 'replace', identity_token: exercise.identity_token, ordinal: exercise.ordinal, name: exercise.name, note: exercise.note, protocol: exercise.protocol,
        set_rows: exercise.set_groups.flatMap(group => Array.from({ length: group.sets ?? group.sets_min }, (_, index) => projectIndividualSet(group, index === 0 ? group.identity_token : null, 0))).map((row, index) => ({ ...row, ordinal: index + 1 })) }),
  }
  const weekday = weekdayForOrdinal(v3.ordinal)
  const legacyTitle = workoutTitle(v3.label, v3.ordinal)
  const preserveLegacyLabel = Boolean(legacyTitle && v3.subtitle && v3.subtitle !== legacyTitle && validLegacyLabel(v3.label!))
  return { identity_token: v3.identity_token, ordinal: v3.ordinal, label: preserveLegacyLabel ? v3.label! : weekday, subtitle: v3.subtitle ?? legacyTitle, marked_rest: v3.marked_rest, workout_instruction: v3.workout_instruction,
    exercises: v3.exercises.map(exercise => exercise.edit_mode === 'preserve'
      ? { mode: 'preserve', identity_token: exercise.identity_token, ordinal: exercise.ordinal }
      : { mode: 'replace', identity_token: exercise.identity_token, ordinal: exercise.ordinal, name: exercise.name, note: exercise.note, protocol: exercise.protocol,
        set_rows: exercise.set_groups.flatMap(group => Array.from({ length: group.sets ?? group.sets_min }, (_, index) => projectIndividualSet(group, index === 0 ? group.identity_token : null, 0))).map((row, index) => ({ ...row, ordinal: index + 1 })) }),
  }
}
function projectIndividualSetV3(group: CoachSetGroupV5, identityToken: string | null, ordinal: number): EditorSet {
  const reps = group.reps
  if (!reps) throw new Error('An editable set row must have a repetition prescription.')
  const base = { identity_token: identityToken, ordinal, reps, note: null }
  switch (group.load_kind) {
    case 'exact': if (typeof group.load_value === 'number' && group.effective_unit) return { ...base, load_kind: 'exact', load_value: group.load_value, unit_override: group.unit_override, effective_unit: group.effective_unit }; break
    case 'rpe': if (typeof group.load_value === 'number') return { ...base, load_kind: 'rpe', load_value: group.load_value, unit_override: null, effective_unit: null }; break
    case 'qualitative': if (group.load_value === 'L' || group.load_value === 'M' || group.load_value === 'MH' || group.load_value === 'H') return { ...base, load_kind: 'qualitative', load_value: group.load_value, unit_override: null, effective_unit: null }; break
    case 'bodyweight': return { ...base, load_kind: 'bodyweight', load_value: null, unit_override: null, effective_unit: null }
    case 'none': return { ...base, load_kind: 'none', load_value: null, unit_override: null, effective_unit: null }
    case 'tbd': return { ...base, load_kind: 'tbd', load_value: null, unit_override: null, effective_unit: null }
  }
  throw new Error('An editable set row has an unsupported load prescription.')
}
function saveV2Set(row: EditorSet): SaveCoachIndividualSet {
  if (typeof row.reps !== 'number') throw new Error('Legacy saves require exact reps.')
  switch (row.load_kind) {
    case 'exact': return { ...row, reps: row.reps }
    case 'rpe': return { ...row, reps: row.reps }
    case 'qualitative': return { ...row, reps: row.reps }
    case 'bodyweight':
    case 'none':
    case 'tbd': return { ...row, reps: row.reps }
  }
}
function saveV3Set(row: EditorSet): SaveCoachIndividualSetV3 {
  if (typeof row.reps === 'number') throw new Error('V5 saves require structured reps.')
  switch (row.load_kind) {
    case 'exact': return { identity_token: row.identity_token, ordinal: row.ordinal, reps: row.reps, load_kind: row.load_kind, load_value: row.load_value, unit_override: row.unit_override, effective_unit: row.effective_unit }
    case 'rpe': return { identity_token: row.identity_token, ordinal: row.ordinal, reps: row.reps, load_kind: row.load_kind, load_value: row.load_value, unit_override: null, effective_unit: null }
    case 'qualitative': return { identity_token: row.identity_token, ordinal: row.ordinal, reps: row.reps, load_kind: row.load_kind, load_value: row.load_value, unit_override: null, effective_unit: null }
    case 'bodyweight':
    case 'none':
    case 'tbd': return { identity_token: row.identity_token, ordinal: row.ordinal, reps: row.reps, load_kind: row.load_kind, load_value: null, unit_override: null, effective_unit: null }
  }
}
function editorSet(row: SaveCoachIndividualSet | SaveCoachIndividualSetV3): EditorSet {
  const note = 'note' in row ? row.note : null
  switch (row.load_kind) {
    case 'exact':
      if (typeof row.load_value !== 'number' || row.effective_unit === null) throw new Error('An exact-load save row requires a weight and unit.')
      return { identity_token: row.identity_token, ordinal: row.ordinal, reps: row.reps, note, load_kind: row.load_kind, load_value: row.load_value, unit_override: row.unit_override, effective_unit: row.effective_unit }
    case 'rpe':
      if (typeof row.load_value !== 'number') throw new Error('An RPE save row requires a numeric value.')
      return { identity_token: row.identity_token, ordinal: row.ordinal, reps: row.reps, note, load_kind: row.load_kind, load_value: row.load_value, unit_override: null, effective_unit: null }
    case 'qualitative':
      if (row.load_value !== 'L' && row.load_value !== 'M' && row.load_value !== 'MH' && row.load_value !== 'H') throw new Error('An effort save row requires a supported value.')
      return { identity_token: row.identity_token, ordinal: row.ordinal, reps: row.reps, note, load_kind: row.load_kind, load_value: row.load_value, unit_override: null, effective_unit: null }
    case 'bodyweight':
    case 'none':
    case 'tbd': return { identity_token: row.identity_token, ordinal: row.ordinal, reps: row.reps, note, load_kind: row.load_kind, load_value: null, unit_override: null, effective_unit: null }
  }
}
function saveV2Day(day: EditorDay): SaveCoachProgramDayV2 {
  return { ...day, exercises: day.exercises.map(exercise => exercise.mode === 'preserve' ? exercise : { ...exercise, set_rows: exercise.set_rows.map(saveV2Set) }) }
}
function saveV3Day(day: EditorDay): SaveCoachProgramDayV3 {
  return { ...day, exercises: day.exercises.map(exercise => exercise.mode === 'preserve' ? exercise : { ...exercise, set_rows: exercise.set_rows.map(saveV3Set) }) }
}
function editorDay(day: SaveCoachProgramDayV2 | SaveCoachProgramDayV3): EditorDay {
  return { ...day, exercises: day.exercises.map(exercise => exercise.mode === 'preserve' ? exercise : ({ ...exercise, set_rows: exercise.set_rows.map(editorSet) })) }
}
const newSet = (ordinal: number, unit: 'lb' | 'kg'): EditorSet => ({ identity_token: null, ordinal, reps: 8, load_kind: 'exact', load_value: 0, effective_unit: unit, unit_override: null, note: null })
function readableGroup(group: CoachSetGroupV3 | CoachSetGroupV5, defaultUnit: 'lb' | 'kg') {
  const range = (minimum: number | null, maximum: number | null) => maximum === null ? `${minimum ?? '—'}` : `${minimum ?? '—'}–${maximum}`
  const sets = group.sets_mode === 'range' ? range(group.sets_min, group.sets_max) : `${group.sets ?? group.sets_min}`
  const v5Reps = typeof group.reps === 'object' && group.reps ? group.reps.mode === 'range' ? range(group.reps.min, group.reps.max) : `${group.reps.value}` : null
  const dose = v5Reps ?? (group.reps_mode === 'athlete_choice' ? 'athlete choice' : group.reps_mode === 'range' ? range(group.dose_min, group.dose_max) : `${group.reps ?? group.dose_min ?? '—'}`)
  const unit = group.effective_unit ?? group.unit_override ?? defaultUnit
  const loadMode = group.load_mode ?? group.load_kind
  const load = loadMode === 'exact' ? `exact ${group.exact_weight ?? group.load_value ?? '—'} ${unit}`
    : group.load_mode === 'percent' ? `percent ${group.percent ?? group.load_value ?? '—'}%${group.of_max_id ? ` of max ${group.of_max_id}` : ''}`
      : group.load_mode === 'rpe' ? `RPE ${range(group.rpe_min, group.rpe_max)}`
        : group.load_mode === 'qualitative' ? `effort ${group.qualitative ?? group.load_value ?? '—'}` : group.load_mode
  const resolution = loadMode === 'percent' ? [
    group.resolved_weight != null ? `resolved ${group.resolved_weight} ${unit}` : null,
    group.manual_override != null ? `manual override ${group.manual_override} ${unit}` : null,
    group.resolved_max_effective_from ? `max effective from ${group.resolved_max_effective_from}` : null,
    group.resolved_at ? `resolved at ${group.resolved_at}` : null,
    group.percent_basis_exercise_id ? `basis exercise ${group.percent_basis_exercise_id}` : null,
    group.percent_basis_max_type ? `basis max type ${group.percent_basis_max_type}` : null,
  ].filter(Boolean) : []
  return [`Sets: ${sets} × ${dose} ${group.dose_mode ?? 'reps'}${group.distance_unit ? ` ${group.distance_unit}` : ''}`, `Load: ${load} (${(group.load_basis ?? 'total').replaceAll('_', ' ')})`, ...resolution, `Laterality: ${(group.laterality ?? 'bilateral').replaceAll('_', ' ')}`, group.rest_seconds !== null ? `Rest: ${group.rest_seconds} seconds` : null, group.note ? `Note: ${group.note}` : null].filter(Boolean).join(' · ')
}
export function renderRichProgramTemplateDayEditor({ day, percentBasisOptions, exerciseOptions = [], trackingSupported = false, onEnsureExercise, onSetExerciseTracking, defaultUnit, plateIncrement, disabled, onDirty, onSave }: { day: RichTemplateDay; percentBasisOptions: RichPercentBasisOption[]; exerciseOptions?: RichExerciseOptionUi[]; trackingSupported?: boolean; onEnsureExercise?(name: string): Promise<RichExerciseOptionUi>; onSetExerciseTracking?(exerciseId: string, tracked: boolean): Promise<void>; defaultUnit: 'lb' | 'kg'; plateIncrement?: number; disabled: boolean; onDirty(value: boolean): void; onSave(day: RichTemplateDaySave): Promise<void> }) {
  return <ApprovedWorkoutEditor buildPayload={(draft, original) => richDaySavePayload(draft, original, true)} key={day.identity_token} day={day} template percentBasisOptions={percentBasisOptions} exerciseOptions={exerciseOptions} trackingSupported={trackingSupported} onEnsureExercise={onEnsureExercise} onSetExerciseTracking={onSetExerciseTracking} defaultUnit={defaultUnit} plateIncrement={plateIncrement} disabled={disabled} onDirtyChange={onDirty} onSave={draft => onSave(draft as RichTemplateDaySave)} />
}

export function renderProgramTemplateDayEditor({ day, defaultUnit, disabled, onDirty, onSave }: { day: SaveCoachProgramDayV3; defaultUnit: 'lb' | 'kg'; disabled: boolean; onDirty(value: boolean): void; onSave(day: SaveCoachProgramDayV3): Promise<void> }) {
  const weekday = weekdayForOrdinal(day.ordinal) as CoachProgramDayV5['system_weekday']
  const adapted = {
    identity_token: day.identity_token, ordinal: day.ordinal, label: weekday, subtitle: day.subtitle,
    system_weekday: weekday, workout_title: day.subtitle, marked_rest: day.marked_rest,
    workout_instruction: day.workout_instruction, locked: false, locked_any: false,
    day_editable: true, day_unsupported_reason: null,
    exercises: day.exercises.filter(exercise => exercise.mode === 'replace').map(exercise => ({
      identity_token: exercise.identity_token, ordinal: exercise.ordinal, name: exercise.name,
      note: exercise.note, protocol: exercise.protocol, edit_mode: 'replace', unsupported_reason: null,
      set_groups: exercise.set_rows.map(row => ({
        ...row, sets: 1, sets_mode: 'exact', sets_min: 1, sets_max: null,
        dose_mode: 'reps', reps_mode: row.reps.mode, dose_min: null, dose_max: null,
        distance_unit: null, laterality: 'bilateral', load_mode: row.load_kind,
        load_basis: 'total', exact_weight: row.load_kind === 'exact' ? row.load_value : null,
        percent: null, of_max_id: null, resolved_weight: null, resolved_max_effective_from: null,
        resolved_at: null, manual_override: null, rpe_min: null, rpe_max: null,
        qualitative: row.load_kind === 'qualitative' ? row.load_value : null,
        percent_basis_exercise_id: null, percent_basis_max_type: null, rest_seconds: null, note: null,
      })),
    })),
  } as unknown as CoachProgramDayV5
  // Keep the shared editor mounted across parent dirty-state renders. The
  // adapted object may be rebuilt, but identity owns the editor lifecycle.
  return <DayEditor key={day.identity_token} day={adapted} fixedWeekday weekdayLabel={weekday} phase54 defaultUnit={defaultUnit} disabled={disabled} refreshing={false} saving={disabled} discardVersion={0} onDirtyChange={onDirty} onSave={async edited => {
    const saved: SaveCoachProgramDayV3 = {
      identity_token: edited.identity_token, ordinal: edited.ordinal, label: edited.label,
      subtitle: edited.subtitle, marked_rest: edited.marked_rest,
      workout_instruction: edited.workout_instruction,
      exercises: edited.exercises.map(exercise => exercise.mode === 'preserve'
        ? { mode: 'preserve', identity_token: exercise.identity_token, ordinal: exercise.ordinal }
        : { mode: 'replace', identity_token: exercise.identity_token, ordinal: exercise.ordinal,
          name: exercise.name, note: exercise.note, protocol: exercise.protocol,
          set_rows: exercise.set_rows.map(({ note: _note, ...row }) => ({ ...row,
            reps: typeof row.reps === 'number' ? { mode: 'exact' as const, value: row.reps } : row.reps })) }),
    }
    await onSave(saved)
    return edited
  }} />
}
function DayEditor({ day, fixedWeekday = false, weekdayLabel, phase54 = false, defaultUnit, disabled, refreshing, saving, discardVersion, exerciseSuggestions, onExerciseNameQuery, onDirtyChange, registerSave, onSave }: {
  day: CoachProgramDayV3 | CoachProgramDayV5; fixedWeekday?: boolean; weekdayLabel?: string; phase54?: boolean; defaultUnit: 'lb' | 'kg'; disabled: boolean; refreshing: boolean; saving: boolean;
  discardVersion: number; exerciseSuggestions?: string[]; onExerciseNameQuery?(query: string): void;
  onDirtyChange(dirty: boolean): void; registerSave?(callback: (() => Promise<boolean>) | null): void; onSave(day: EditorDay): Promise<EditorDay>
}) {
  const [draft, setDraft] = useState<EditorDay>(() => projectDay(day, fixedWeekday, phase54))
  const [baseline, setBaseline] = useState<EditorDay>(() => projectDay(day, fixedWeekday, phase54))
  const [failure, setFailure] = useState<string | null>(null)
  const errorId = useId()
  const exerciseHistoryId = useId()
  const [invalidField, setInvalidField] = useState<string | null>(null)
  const [numericDraftFields, setNumericDraftFields] = useState<Record<string, boolean>>({})
  const numericDraftValues = useRef<Record<string, PendingNumericDraft>>({})
  const textErrorProps = (field: string) => ({ 'aria-invalid': invalidField === field || undefined, 'aria-describedby': invalidField === field ? errorId : undefined })
  const [reloadRequired, setReloadRequired] = useState(false)
  const [undo, setUndo] = useState<EditorDay | null>(null)
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(() => new Set(draft.exercises.map(exercise => exercise.identity_token ?? `new-${exercise.ordinal}`)))
  const [dayNotesExpanded, setDayNotesExpanded] = useState(false)
  const [newExerciseFocus, setNewExerciseFocus] = useState<number | null>(null)
  const editorRoot = useRef<HTMLElement>(null)
  const notifyDirty = useRef(onDirtyChange); notifyDirty.current = onDirtyChange
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || Object.values(numericDraftFields).some(Boolean)
  const hasPendingNumericDraft = () => Object.keys(numericDraftValues.current).length > 0
  const setNumericDraftDirty = (field: string, next: PendingNumericDraft | null) => {
    if (next) numericDraftValues.current[field] = next; else delete numericDraftValues.current[field]
    setNumericDraftFields(current => current[field] === Boolean(next) ? current : { ...current, [field]: Boolean(next) })
  }
  const authoritativeDayKey = JSON.stringify(day)
  // Parent dirty-state renders can rebuild an equivalent adapted object. Reset
  // only when authoritative content changes, not merely its object identity.
  useEffect(() => { const next = projectDay(day, fixedWeekday, phase54); setDraft(next); setBaseline(next); setFailure(null); setInvalidField(null); numericDraftValues.current = {}; setNumericDraftFields({}); setReloadRequired(false); setUndo(null); setExpandedExercises(new Set(next.exercises.map(exercise => exercise.identity_token ?? `new-${exercise.ordinal}`))); setDayNotesExpanded(false); setNewExerciseFocus(null) }, [authoritativeDayKey, fixedWeekday, phase54])
  useEffect(() => { setDraft(baseline); setUndo(null); setFailure(null); setInvalidField(null); numericDraftValues.current = {}; setNumericDraftFields({}) }, [discardVersion])
  useEffect(() => { notifyDirty.current(dirty) }, [dirty])
  useEffect(() => () => notifyDirty.current(false), [])
  useEffect(() => {
    if (newExerciseFocus === null) return
    const input = editorRoot.current?.querySelector<HTMLInputElement>(`[aria-label="Exercise name ${newExerciseFocus}"]`)
    if (input) { input.scrollIntoView({ block: 'center', behavior: 'auto' }); input.focus() }
    setNewExerciseFocus(null)
  }, [newExerciseFocus, draft.exercises.length])
  const blocked = disabled || reloadRequired
  const preserved = draft.exercises.some(exercise => exercise.mode === 'preserve')
  const change = (next: EditorDay) => {
    setUndo(draft); setDraft(next); setFailure(null); setInvalidField(null)
    notifyDirty.current(JSON.stringify(next) !== JSON.stringify(baseline))
  }
  const editExercise = (index: number, exercise: EditableExercise) => change({ ...draft, exercises: draft.exercises.map((item, i) => i === index ? exercise : item) })
  const save = async (): Promise<boolean> => {
    if (!dirty || blocked || saving) return false
    setFailure(null); setInvalidField(null)
    try {
      const text = (value: string | null, field: string, label: string, limit: number, required = false): string | null => {
        const normalized = normalizePhase3Text(value ?? '')
        const message = hasUnpairedSurrogate(value ?? '') ? `${label} contains an unpaired UTF-16 surrogate.` : /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value ?? '') ? `${label} contains unsupported control characters. Tabs and line breaks are allowed.` : required && !normalized ? `${label} is required.` : [...normalized].length > limit ? `${label} must be ${limit} characters or fewer.` : null
        if (message) { setInvalidField(field); throw new Error(message) }
        return normalized || null
      }
      const numericDraft = Object.values(numericDraftValues.current).reduce<EditorDay>((current, pending) => {
        const exerciseIndex = current.exercises.findIndex(exercise => exercise.ordinal === pending.exerciseOrdinal)
        const exercise = current.exercises[exerciseIndex]
        if (!exercise || exercise.mode === 'preserve') return current
        const rowIndex = exercise.set_rows.findIndex(row => row.ordinal === pending.rowOrdinal)
        const row = exercise.set_rows[rowIndex]
        if (!row) return current
        const message = numericValidationMessage(pending.kind, row, pending.value, phase54)
        if (message) throw new Error(message)
        const nextRow = applyNumericValue(row, pending.kind, pending.kind === 'reps' && phase54 ? pending.value : Number(pending.value), phase54)
        return { ...current, exercises: current.exercises.map((item, index) => index === exerciseIndex ? { ...exercise, set_rows: exercise.set_rows.map((item, index) => index === rowIndex ? nextRow : item) } : item) }
      }, draft)
      const normalized: EditorDay = { ...numericDraft,
        label: fixedWeekday ? numericDraft.label : text(numericDraft.label, 'label', 'Day name', 120, true)!,
        subtitle: text(numericDraft.subtitle, 'subtitle', fixedWeekday ? 'Workout title' : 'Subtitle', 500),
        workout_instruction: text(numericDraft.workout_instruction, 'instruction', 'Coach notes', 1000),
        exercises: numericDraft.exercises.map(exercise => exercise.mode === 'preserve' ? exercise : { ...exercise,
          name: text(exercise.name, `exercise-${exercise.ordinal}`, `Exercise ${exercise.ordinal} name`, 120, true)!,
          note: text(exercise.note, `note-${exercise.ordinal}`, `Exercise ${exercise.ordinal} coach note`, 500),
          protocol: exercise.protocol == null ? null : normalizePhase3Text(exercise.protocol) || null,
          set_rows: exercise.set_rows.map(row => ({ ...row, note: row.identity_token ? row.note : null })),
        }),
      }
      for (const exercise of normalized.exercises) if (exercise.mode === 'replace') {
        if (exercise.set_rows.length < 1 || exercise.set_rows.length > 20) throw new Error('Each exercise needs 1–20 individual sets.')
        for (const row of exercise.set_rows) {
          if (phase54) {
            if (typeof row.reps === 'number') throw new Error('V5 saves require a structured repetition prescription.')
            const reps = row.reps.mode === 'range' ? `${row.reps.min}-${row.reps.max}` : String(row.reps.value)
            if (numericValidationMessage('reps', row, reps, true)) throw new Error('Reps must be a whole number 1–100 or a valid range.')
          } else if (typeof row.reps !== 'number' || !Number.isSafeInteger(row.reps) || row.reps < 1 || row.reps > 100) throw new Error('Reps must be a whole number from 1–100.')
          if (row.load_kind === 'exact' && (!Number.isFinite(row.load_value) || row.load_value < 0 || row.load_value > 2000 || Math.abs(row.load_value * 1000 - Math.round(row.load_value * 1000)) > 0.000001)) throw new Error('Weight must be 0–2000 with at most three decimal places.')
          if (row.load_kind === 'rpe' && (!Number.isFinite(row.load_value) || row.load_value < 1 || row.load_value > 10 || Math.abs(row.load_value * 10 - Math.round(row.load_value * 10)) > 0.000001)) throw new Error('RPE must be 1–10 with at most one decimal place.')
        }
      }
      const authoritative = await onSave(normalized)
      numericDraftValues.current = {}; setNumericDraftFields({}); setDraft(authoritative); setBaseline(authoritative); setUndo(null); notifyDirty.current(false)
      return true
    } catch (cause) {
      const code = cause instanceof CoachApiError ? cause.code : null
      setReloadRequired(Boolean(code && ['stale_builder_version', 'serialization_retry', 'day_locked', 'identity_conflict', 'program_archived', 'access_denied', 'session_expired', 'unsupported_shape'].includes(code)))
      const unsupported = day.exercises.filter(exercise => exercise.unsupported_reason)
      const reason = day.day_unsupported_reason ? shapeReason(day.day_unsupported_reason) : unsupported.length ? `${unsupported[0].name}: ${shapeReason(unsupported[0].unsupported_reason)}${unsupported.length > 1 ? ' (and other legacy exercises)' : ''}` : null
      setFailure(code === 'unsupported_shape' && reason ? `${reason}. View-only; reload to review.` : cause instanceof Error ? cause.message : 'The day could not be saved. Try again.')
      return false
    }
  }
  useEffect(() => { registerSave?.(save); return () => registerSave?.(null) }, [registerSave, dirty, blocked, saving, draft, baseline])
  const moveExercise = (index: number, offset: number) => {
    if (preserved) return
    const exercises = [...draft.exercises]; [exercises[index], exercises[index + offset]] = [exercises[index + offset], exercises[index]]
    change({ ...draft, exercises: exercises.map((item, i) => ({ ...item, ordinal: i + 1 })) })
  }
  return <article ref={editorRoot} className={`connected-day prescription-day${fixedWeekday ? ' fixed-weekday-day' : ''}`}>
    <header><div><p>DAY {draft.ordinal}</p><h2>{fixedWeekday ? weekdayLabel ?? weekdayForOrdinal(draft.ordinal) : draft.label}</h2></div><span className="day-save-state" role="status" aria-live="polite">{reloadRequired ? 'Conflict' : saving ? 'Saving' : dirty ? 'Unsaved' : 'Saved'}</span></header>
    {exerciseSuggestions && <datalist id={exerciseHistoryId}>{exerciseSuggestions.map(name => <option value={name} key={name} />)}</datalist>}
    {(day.locked_any || !day.day_editable) && <p className="readonly-reason">{day.locked_any ? 'Locked — athlete started this day.' : day.day_unsupported_reason ? `${shapeReason(day.day_unsupported_reason)} — this day is view-only.` : 'This day is view-only.'}</p>}
    {refreshing && <p role="status">Refreshing</p>}
    {failure && <p id={errorId} className="day-error" role="alert">{failure}{reloadRequired && ' Reload required before further edits.'}</p>}
    <fieldset className="day-details" disabled={blocked}><legend>Day details</legend>
      {fixedWeekday ? <label>Workout title (optional)<input aria-label="Workout title" placeholder="e.g. Upper body strength" value={draft.subtitle ?? ''} {...textErrorProps('subtitle')} onChange={event => change({ ...draft, label: weekdayLabel ?? weekdayForOrdinal(draft.ordinal), subtitle: event.target.value || null })} /></label> : <><label>Day name<input aria-label={`Day name ${draft.ordinal}`} value={draft.label} {...textErrorProps('label')} onChange={event => change({ ...draft, label: event.target.value })} /></label><label>Subtitle (optional)<input aria-label={`Subtitle for ${draft.label || draft.ordinal}`} value={draft.subtitle ?? ''} {...textErrorProps('subtitle')} onChange={event => change({ ...draft, subtitle: event.target.value || null })} /></label></>}
      <div className="day-notes"><button className="text-button" type="button" aria-expanded={dayNotesExpanded} aria-controls={`${errorId}-coach-notes`} onClick={() => setDayNotesExpanded(current => !current)}>{dayNotesExpanded ? 'Hide coach notes (optional)' : 'Show coach notes (optional)'}</button><div className="day-notes-content" id={`${errorId}-coach-notes`}>{!dayNotesExpanded && draft.workout_instruction && <span className="day-notes-indicator">Notes added</span>}{dayNotesExpanded && <label>Coach notes (optional)<textarea aria-label={`Coach notes (optional) for ${fixedWeekday ? weekdayForOrdinal(draft.ordinal) : draft.label}`} value={draft.workout_instruction ?? ''} {...textErrorProps('instruction')} onChange={event => change({ ...draft, workout_instruction: event.target.value || null })} /></label>}</div></div>
    </fieldset>
    {draft.marked_rest ? <div className="rest-day-editor"><p className="empty-copy">Marked rest day.</p><button className="button quiet" disabled={blocked} onClick={() => change({ ...draft, marked_rest: false })}>Create workout</button></div> : !draft.exercises.length ? <p className="empty-copy">No training work.</p> : draft.exercises.map((exercise, index) => {
      if (exercise.mode === 'preserve') {
        const source = day.exercises.find(item => item.identity_token === exercise.identity_token)!
        return <details open className="prescription-exercise preserved-exercise" key={exercise.identity_token}><summary id={`phase4-target-${exercise.identity_token}`}>{source.name} · View-only</summary><p>{shapeReason(source.unsupported_reason)} — preserved without changes.</p>{source.note && <p>{source.note}</p>}{source.protocol && <p>{source.protocol}</p>}{source.set_groups.map(group => <p id={`phase4-target-${group.identity_token}`} tabIndex={-1} key={group.identity_token}>{readableGroup(group, defaultUnit)}</p>)}</details>
      }
      const disclosureKey = exercise.identity_token ?? `new-${exercise.ordinal}`
      return <details open={expandedExercises.has(disclosureKey)} onToggle={event => { const isOpen = event.currentTarget.open; setExpandedExercises(current => { const next = new Set(current); if (isOpen) next.add(disclosureKey); else next.delete(disclosureKey); return next }) }} className="prescription-exercise" key={exercise.identity_token ?? `new-exercise-${index}`}><summary id={exercise.identity_token ? `phase4-target-${exercise.identity_token}` : undefined}>{exercise.name || `Exercise ${exercise.ordinal}`} · {exercise.set_rows.length} sets</summary>
        <div className="exercise-heading"><label>Exercise name<input aria-label={`Exercise name ${exercise.ordinal}`} disabled={blocked} list={exerciseSuggestions ? exerciseHistoryId : undefined} placeholder="Exercise name" value={exercise.name} {...textErrorProps(`exercise-${exercise.ordinal}`)} onFocus={event => onExerciseNameQuery?.(event.currentTarget.value)} onChange={event => { onExerciseNameQuery?.(event.target.value); editExercise(index, { ...exercise, name: event.target.value }) }} onKeyDown={event => { if (event.key !== 'Enter') return; event.preventDefault(); const name = event.currentTarget.value; onExerciseNameQuery?.(name); if (name !== exercise.name) editExercise(index, { ...exercise, name }); event.currentTarget.blur() }} /></label>
          <button className="grid-action" disabled={blocked || preserved || index === 0} aria-label={`Move ${exercise.name || `Exercise ${exercise.ordinal}`} up`} onClick={() => { if (!hasPendingNumericDraft()) moveExercise(index, -1) }}>↑</button>
          <button className="grid-action" disabled={blocked || preserved || index === draft.exercises.length - 1} aria-label={`Move ${exercise.name || `Exercise ${exercise.ordinal}`} down`} onClick={() => { if (!hasPendingNumericDraft()) moveExercise(index, 1) }}>↓</button>
          <button className="grid-action" disabled={blocked || preserved} onClick={() => { if (!hasPendingNumericDraft()) change({ ...draft, exercises: draft.exercises.filter((_, i) => i !== index).map((item, i) => ({ ...item, ordinal: i + 1 })) }) }}>Remove exercise</button>
        </div>
        <label className="exercise-note">Coach note<input aria-label={`Coach note for ${exercise.name || `Exercise ${exercise.ordinal}`}`} disabled={blocked} value={exercise.note ?? ''} {...textErrorProps(`note-${exercise.ordinal}`)} onChange={event => editExercise(index, { ...exercise, note: event.target.value || null })} /></label>
        <PrescriptionGrid key={`${JSON.stringify(baseline.exercises[index])}:${discardVersion}`} exercise={exercise} phase54={phase54} disabled={blocked} defaultUnit={defaultUnit} onNumericDraftChange={setNumericDraftDirty} onChange={value => editExercise(index, value)} />
      </details>
    })}
    {preserved && <p className="readonly-reason">Exercise reorder and removal are unavailable while this day includes preserved exercises.</p>}
    <div className="day-actions">
      {!draft.marked_rest && <button className="button quiet" disabled={blocked || draft.exercises.length >= 12} onClick={() => { if (!hasPendingNumericDraft()) { const ordinal = draft.exercises.length + 1; setExpandedExercises(current => new Set(current).add(`new-${ordinal}`)); change({ ...draft, exercises: [...draft.exercises, { mode: 'replace', identity_token: null, ordinal, name: '', note: null, protocol: null, set_rows: [phase54 ? { ...newSet(1, defaultUnit), reps: { mode: 'exact', value: 8 } } : newSet(1, defaultUnit)] }] }); setNewExerciseFocus(ordinal) } }}>+ Exercise</button>}
      <button className="button quiet" disabled={blocked || !undo} onClick={() => { if (undo && !hasPendingNumericDraft()) { setDraft(undo); setUndo(null); setFailure(null); setInvalidField(null) } }}>Undo day edit</button>
      <button className="button outline" disabled={blocked || saving || !dirty} onClick={() => void save()}>{saving ? 'Saving…' : 'Save day'}</button>
    </div>
  </article>
}
function PrescriptionGrid({ exercise, phase54 = false, disabled, defaultUnit, onChange, onNumericDraftChange }: { exercise: EditableExercise; phase54?: boolean; disabled: boolean; defaultUnit: 'lb' | 'kg'; onChange(exercise: EditableExercise): void; onNumericDraftChange(field: string, draft: PendingNumericDraft | null): void }) {
  const grid = useRef<HTMLDivElement>(null)
  const menuContainer = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState([0, 1])
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({})
  const numericDraftsRef = useRef<Record<string, string>>({})
  const committedRows = useRef<Record<string, EditorSet>>({})
  const [numericErrors, setNumericErrors] = useState<Record<string, string>>({})
  const numericErrorId = useId()
  const [menu, setMenu] = useState<number | null>(null)
  const [undoRows, setUndoRows] = useState<{ rows: EditorSet[]; row: number; col: number } | null>(null)
  const rows = exercise.set_rows
  useEffect(() => {
    if (menu === null) return
    const close = (event: PointerEvent | FocusEvent) => { if (!(event.target instanceof Node) || !menuContainer.current?.contains(event.target)) setMenu(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('focusin', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('focusin', close); document.removeEventListener('keydown', escape) }
  }, [menu])
  const seededZeroes = useRef(new Set(rows.filter(row => row.identity_token === null && row.load_kind === 'exact' && row.load_value === 0).map(row => `${exercise.ordinal}:${row.identity_token ?? `new-${row.ordinal - 1}`}:load`)))
  const deliberateZeroes = useRef(new Set<string>())
  const numericKey = (index: number, kind: 'reps' | 'load') => `${exercise.ordinal}:${rows[index].identity_token ?? `new-${index}`}:${kind}`
  const repsText = (row: EditorSet) => typeof row.reps === 'object' ? row.reps.mode === 'range' ? `${row.reps.min}-${row.reps.max}` : String(row.reps.value) : String(row.reps)
  const setNumericDraft = (key: string, value: string | null) => {
    const next = { ...numericDraftsRef.current }
    if (value === null) delete next[key]; else next[key] = value
    numericDraftsRef.current = next; setNumericDrafts(next)
  }
  const clearNumericError = (key: string) => setNumericErrors(current => current[key] ? Object.fromEntries(Object.entries(current).filter(([item]) => item !== key)) : current)
  const commitNumeric = (index: number, kind: 'reps' | 'load') => {
    const key = numericKey(index, kind); const value = numericDraftsRef.current[key]
    if (value === undefined) return true
    const row = rows[index]; const message = numericValidationMessage(kind, row, value, phase54)
    if (message) {
      setNumericErrors(current => ({ ...current, [key]: message })); return false
    }
    const parsed = kind === 'reps' && phase54 ? value : Number(value)
    setNumericDraft(key, null); onNumericDraftChange(key, null); clearNumericError(key)
    if ((kind === 'reps' ? repsText(row) : row.load_value) !== parsed) update(index, applyNumericValue(row, kind, parsed, phase54))
    return true
  }
  const cancelNumeric = (index: number, kind: 'reps' | 'load') => {
    const key = numericKey(index, kind); const before = committedRows.current[key]
    setNumericDraft(key, null); onNumericDraftChange(key, null); clearNumericError(key)
    if (before) update(index, before)
  }
  const beginNumeric = (index: number, kind: 'reps' | 'load') => {
    const key = numericKey(index, kind)
    committedRows.current[key] = { ...rows[index] }
    setActive([index, kind === 'reps' ? 1 : 3])
  }
  const changeNumeric = (index: number, kind: 'reps' | 'load', value: string, replacedSeed = false) => {
    const key = numericKey(index, kind); const row = rows[index]
    const replaceableSeed = kind === 'load' && !replacedSeed && /^0\d/u.test(value) && (seededZeroes.current.has(key) || row.identity_token === null && row.load_kind === 'exact' && row.load_value === 0 && !deliberateZeroes.current.has(key))
    const nextValue = replaceableSeed ? value.replace(/^0+(?=\d)/u, '') : value
    seededZeroes.current.delete(key)
    if (kind === 'load' && (!replacedSeed || replaceableSeed)) deliberateZeroes.current.add(key)
    const committed = kind === 'reps' ? repsText(row) : String(row.load_value)
    setNumericDraft(key, nextValue); onNumericDraftChange(key, nextValue === committed ? null : { exerciseOrdinal: exercise.ordinal, rowOrdinal: row.ordinal, kind, value: nextValue }); clearNumericError(key)
  }
  const numericProps = (index: number, kind: 'reps' | 'load') => {
    const key = numericKey(index, kind); const message = numericErrors[key]
    return { 'aria-invalid': message ? true : undefined, 'aria-describedby': message ? `${numericErrorId}-${key}` : undefined }
  }
  const focus = (row: number, col: number) => {
    const nextRow = Math.max(0, row)
    setActive([nextRow, col])
    queueMicrotask(() => grid.current?.querySelector<HTMLElement>(`[data-cell="${nextRow}:${col}"]`)?.focus())
  }
  const update = (index: number, row: EditorSet) => onChange({ ...exercise, set_rows: rows.map((item, i) => i === index ? row : item) })
  const replaceMode = (index: number, mode: SaveCoachIndividualSet['load_kind']) => {
    const pendingLoadKey = numericKey(index, 'load')
    seededZeroes.current.delete(pendingLoadKey); deliberateZeroes.current.delete(pendingLoadKey)
    if (numericDraftsRef.current[pendingLoadKey] !== undefined) {
      setNumericDraft(pendingLoadKey, null); onNumericDraftChange(pendingLoadKey, null); clearNumericError(pendingLoadKey)
    }
    const base = { identity_token: rows[index].identity_token, ordinal: rows[index].ordinal, reps: rows[index].reps, note: rows[index].note }
    const row: EditorSet = mode === 'exact' ? { ...base, load_kind: mode, load_value: 0, effective_unit: defaultUnit, unit_override: null }
      : mode === 'rpe' ? { ...base, load_kind: mode, load_value: 7, effective_unit: null, unit_override: null }
      : mode === 'qualitative' ? { ...base, load_kind: mode, load_value: 'M', effective_unit: null, unit_override: null }
      : { ...base, load_kind: mode, load_value: null, effective_unit: null, unit_override: null }
    if (mode === 'exact') seededZeroes.current.add(pendingLoadKey)
    update(index, row)
  }
  const changeMode = (index: number, mode: SaveCoachIndividualSet['load_kind']) => {
    const row = rows[index]
    if (mode === row.load_kind) return
    setUndoRows({ rows, row: index, col: active[1] })
    replaceMode(index, mode)
  }
  const rowAction = (index: number, action: 'up' | 'down' | 'delete') => {
    if (Object.keys(numericDraftsRef.current).length > 0) return
    const col = active[1]; const next = [...rows]
    setUndoRows({ rows, row: index, col })
    let destination = index
    if (action === 'delete') { next.splice(index, 1); destination = Math.min(index, next.length - 1) }
    else { destination += action === 'up' ? -1 : 1; [next[index], next[destination]] = [next[destination], next[index]] }
    const remapped = new Map<string, string>()
    rows.forEach((row, previousIndex) => {
      if (row.identity_token) return
      const nextIndex = next.indexOf(row)
      if (nextIndex >= 0) remapped.set(numericKey(previousIndex, 'load'), `${exercise.ordinal}:new-${nextIndex}:load`)
    })
    deliberateZeroes.current = new Set([...deliberateZeroes.current].flatMap(key => remapped.has(key) ? [remapped.get(key)!] : key.includes(':new-') ? [] : [key]))
    onChange({ ...exercise, set_rows: next.map((row, i) => ({ ...row, ordinal: i + 1 })) }); setMenu(null); focus(destination, col)
  }
  const keyDown = (event: ReactKeyboardEvent<HTMLElement>, row: number, col: number) => {
    if (disabled) return
    const numericKind = col === 1 ? 'reps' : col === 3 && (rows[row].load_kind === 'exact' || rows[row].load_kind === 'rpe') ? 'load' : null
    const numericKeyValue = numericKind ? numericKey(row, numericKind) : null
    const isFreshZero = numericKind === 'load' && rows[row].identity_token === null && rows[row].load_kind === 'exact' && rows[row].load_value === 0 && !deliberateZeroes.current.has(numericKeyValue!)
    if (numericKind === 'load' && /^\d$/u.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey && (seededZeroes.current.has(numericKeyValue!) || isFreshZero)) {
      event.preventDefault(); deliberateZeroes.current.add(numericKeyValue!); changeNumeric(row, 'load', event.key, true); return
    }
    if (numericKind && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelNumeric(row, numericKind); return }
    if (numericKind && event.key === 'Enter') {
      event.preventDefault()
      if (numericDraftsRef.current[numericKey(row, numericKind)] !== undefined && commitNumeric(row, numericKind)) focus(Math.min(rows.length - 1, row + 1), col)
      return
    }
    if (event.key === 'Enter' && col >= 1 && col <= 4) {
      return
    }
    if (event.key === 'Tab') {
      if (menu === row && col === 5 && !event.shiftKey) return
      if (numericKind) commitNumeric(row, numericKind)
      const next = row * 6 + col + (event.shiftKey ? -1 : 1)
      if (next < 0 || next >= rows.length * 6) return
      event.preventDefault(); focus(Math.floor(next / 6), next % 6); return
    }
    if (!(event.currentTarget instanceof HTMLSelectElement) && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); focus(Math.max(0, Math.min(rows.length - 1, row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0))), Math.max(0, Math.min(5, col + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0))))
    }
  }
  const cellProps = (row: number, col: number) => ({
    'data-cell': `${row}:${col}`, tabIndex: active[0] === row && active[1] === col ? 0 : -1,
    onFocus: () => setActive([row, col]), onClick: () => setActive([row, col]),
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => keyDown(event, row, col),
  })
  return <>
    <div className="prescription-grid" role="grid" aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} prescription sets`} aria-rowcount={rows.length + 1} aria-colcount={6} ref={grid}>
      <div className="prescription-grid-row grid-head" role="row" aria-rowindex={1}>{['Set', 'Reps', 'Load mode', 'Value', 'Unit', 'Actions'].map((label, col) => <span role="columnheader" aria-colindex={col + 1} key={label}>{label}</span>)}</div>
      {rows.map((row, index) => <div id={row.identity_token ? `phase4-target-${row.identity_token}` : undefined} tabIndex={row.identity_token ? -1 : undefined} className="prescription-grid-row" role="row" aria-rowindex={index + 2} key={row.identity_token ?? `draft-row-${index}`}>
        <div role="rowheader" aria-colindex={1}><span {...cellProps(index, 0)} aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1}`}>{index + 1}</span></div>
        <div role="gridcell" aria-colindex={2}><input {...cellProps(index, 1)} {...numericProps(index, 'reps')} disabled={disabled} aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1} reps`} type={phase54 ? 'text' : 'number'} inputMode="numeric" min={phase54 ? undefined : 1} max={phase54 ? undefined : 100} pattern={phase54 ? '[0-9]+(?:-[0-9]+)?' : undefined} value={numericDrafts[numericKey(index, 'reps')] ?? repsText(row)} onFocus={() => beginNumeric(index, 'reps')} onBlur={() => { commitNumeric(index, 'reps') }} onChange={event => changeNumeric(index, 'reps', event.target.value)} /></div>
        <div role="gridcell" aria-colindex={3}><select {...cellProps(index, 2)} disabled={disabled} aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1} load mode`} value={row.load_kind} onChange={event => changeMode(index, event.target.value as SaveCoachIndividualSet['load_kind'])}>{[['exact', 'Weight'], ['rpe', 'RPE'], ['qualitative', 'Effort'], ['bodyweight', 'Bodyweight'], ['none', 'None'], ['tbd', 'Decide later']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
        <div role="gridcell" aria-colindex={4}>{row.load_kind === 'exact' || row.load_kind === 'rpe' ? <input {...cellProps(index, 3)} {...numericProps(index, 'load')} disabled={disabled} type="number" aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1} ${row.load_kind === 'rpe' ? 'RPE' : 'load'}`} min={row.load_kind === 'rpe' ? 1 : 0} max={row.load_kind === 'rpe' ? 10 : 2000} step={row.load_kind === 'rpe' ? 0.1 : 0.001} value={numericDrafts[numericKey(index, 'load')] ?? String(row.load_value)} onFocus={() => beginNumeric(index, 'load')} onBlur={() => { commitNumeric(index, 'load') }} onChange={event => changeNumeric(index, 'load', event.target.value)} /> : row.load_kind === 'qualitative' ? <select {...cellProps(index, 3)} disabled={disabled} aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1} effort`} value={row.load_value} onChange={event => update(index, { ...row, load_value: event.target.value as 'L' | 'M' | 'MH' | 'H' })}>{[['L', 'Light'], ['M', 'Moderate'], ['MH', 'Moderately heavy'], ['H', 'Heavy']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <span {...cellProps(index, 3)} aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1} no load value`}>—</span>}</div>
        <div role="gridcell" aria-colindex={5}>{row.load_kind === 'exact' ? <select {...cellProps(index, 4)} disabled={disabled} aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1} unit`} value={row.unit_override ?? 'default'} onChange={event => update(index, { ...row, unit_override: event.target.value === 'default' ? null : event.target.value as 'lb' | 'kg', effective_unit: event.target.value === 'default' ? defaultUnit : event.target.value as 'lb' | 'kg' })}><option value="default">Default ({defaultUnit})</option><option value="lb">Pounds (lb)</option><option value="kg">Kilograms (kg)</option></select> : <span {...cellProps(index, 4)} aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1} no unit`}>—</span>}</div>
        <div ref={menu === index ? menuContainer : undefined} role="gridcell" aria-colindex={6}><button {...cellProps(index, 5)} disabled={disabled} aria-label={`${exercise.name || `Exercise ${exercise.ordinal}`} set ${index + 1} actions`} aria-expanded={menu === index} onClick={() => { if (Object.keys(numericDraftsRef.current).length === 0) { setActive([index, 5]); setMenu(menu === index ? null : index) } }}>•••</button>{menu === index && <div className="set-row-menu" role="group" aria-label={`Set ${index + 1} actions`} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setMenu(null); focus(index, 5) } }}><button disabled={index === 0} onClick={() => rowAction(index, 'up')}>Move up</button><button disabled={index === rows.length - 1} onClick={() => rowAction(index, 'down')}>Move down</button><button disabled={rows.length === 1} onClick={() => rowAction(index, 'delete')}>Delete set</button></div>}</div>
      </div>)}
    </div>
    {Object.entries(numericErrors).map(([key, message]) => <p className="day-error" id={`${numericErrorId}-${key}`} key={key} role="alert">{message}</p>)}
    <div className="set-actions"><button className="grid-action" disabled={disabled || rows.length >= 20} onClick={() => { if (Object.keys(numericDraftsRef.current).length === 0) { const preceding = rows.at(-1)!; onChange({ ...exercise, set_rows: [...rows, { ...preceding, identity_token: null, ordinal: rows.length + 1, note: null }] }); focus(rows.length, 1) } }}>+ Set</button><button className="grid-action" disabled={disabled || rows.length <= 1 || Object.keys(numericDraftsRef.current).length > 0} onClick={() => rowAction(rows.length - 1, 'delete')}>− Set</button><span>{rows.length}/20 sets · Click or Tab to edit</span></div>
  </>
}

function DiscardChangesDialog({ onKeep, onDiscard }: { onKeep(): void; onDiscard(): void }) {
  const keep = useRef<HTMLButtonElement>(null)
  useEffect(() => { keep.current?.focus() }, [])
  return <div className="modal-backdrop" role="presentation" onKeyDown={event => { if (event.key === 'Escape') onKeep(); else trapDialogTab(event) }}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="discard-changes-title" aria-describedby="discard-changes-description">
      <h2 id="discard-changes-title">Discard unsaved changes?</h2>
      <p id="discard-changes-description">This day has edits that have not been saved. Discard them to continue.</p>
      <div className="dialog-actions"><button ref={keep} className="button outline" onClick={onKeep}>Keep editing</button><button className="button primary" onClick={onDiscard}>Discard changes</button></div>
    </section>
  </div>
}

function AddAthlete({ api, gymId, onClose, onComplete, mutation, setMutation }: { api: ConnectedCoachApi; gymId: string; onClose(): void; onComplete(): Promise<void>; mutation: string | null; setMutation(value: 'add' | null): void }) {
  const [error, setError] = useState<string | null>(null)
  const [createdAthlete, setCreatedAthlete] = useState<string | null>(null)
  const profileRequest = useRef({ input: '', id: crypto.randomUUID() })
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (mutation) return
    let profile: AthleteProfileInputV1
    try { profile = profileFromForm(new FormData(event.currentTarget)) } catch (cause) { setError(errorText(cause)); return }
    const requestInput = JSON.stringify(profile)
    if (profileRequest.current.input !== requestInput) profileRequest.current = { input: requestInput, id: crypto.randomUUID() }
    setMutation('add'); setError(null)
    let athleteId = createdAthlete
    try {
      athleteId ??= await api.addRosterAthlete({ target_gym: gymId, new_roster_name: profile.name, existing_athlete: null })
      setCreatedAthlete(athleteId)
      await api.saveAthleteProfileV1({ request_id: profileRequest.current.id, target_gym: gymId, target_athlete: athleteId, expected_version: 0, profile })
      await onComplete()
    } catch (cause) {
      setError(athleteId ? `The athlete was added, but the profile was not saved. ${errorText(cause)}` : errorText(cause))
    } finally { setMutation(null) }
  }
  return <div className="modal-backdrop" role="presentation" onKeyDown={event => { if (event.key === 'Escape') onClose(); else trapDialogTab(event) }}><form autoComplete="off" className="dialog athlete-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="add-athlete-title" onSubmit={submit}><button className="close" aria-label="Close add athlete dialog" type="button" onClick={onClose}>×</button><p className="eyebrow">ATHLETE INTAKE</p><h2 id="add-athlete-title">Add athlete</h2><p>Start their shared profile now. They can fill in or update any missing values from the athlete app.</p><AthleteProfileFields autoFocusName />{error && <p role="alert" className="auth-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button quiet" onClick={onClose}>Cancel</button><button className="button primary" disabled={Boolean(mutation)}>{mutation ? (createdAthlete ? 'Saving profile…' : 'Adding…') : createdAthlete ? 'Retry profile save' : 'Add athlete'}</button></div></form></div>
}
function CreateSkeleton({ api, gymId, athletes, selectedAthlete, onClose, onComplete, mutation, setMutation }: { api: ConnectedCoachApi; gymId: string; athletes: { athlete_id: string; roster_name: string }[]; selectedAthlete: string | null; onClose(): void; onComplete(assignment: string): Promise<void>; mutation: string | null; setMutation(value: 'create' | null): void }) {
  const [error, setError] = useState<string | null>(null)
  const [startOn, setStartOn] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5])
  const retry = useRef({ key: '', requestId: requestId() })
  const input = useRef<HTMLInputElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => { (input.current ?? close.current)?.focus() }, [])
  const range = weekDateRange(startOn)
  const toggleWeekday = (ordinal: number) => setWeekdays(current => current.includes(ordinal) ? current.filter(day => day !== ordinal) : [...current, ordinal].sort((a, b) => a - b))
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mutation) return
    if (!weekdays.length) { setError('Select at least one training weekday.'); return }
    if (!range) { setError('Choose a Monday for the start of Week 1.'); return }
    const data = new FormData(event.currentTarget)
    const fields = { target_gym: gymId, target_athlete: String(data.get('athlete')), program_name: String(data.get('program_name')).trim(), week_count: Number(data.get('weeks')), start_on: startOn, selected_weekdays: weekdays }
    if (!fields.program_name) { setError('Enter a program name.'); return }
    if (!Number.isInteger(fields.week_count) || fields.week_count < 1 || fields.week_count > 12) { setError('Choose 1–12 weeks.'); return }
    const key = JSON.stringify(fields)
    if (retry.current.key && retry.current.key !== key) retry.current.requestId = requestId()
    retry.current.key = key
    setMutation('create'); setError(null)
    try {
      const rows = await api.createCalendarProgram({ request_id: retry.current.requestId, ...fields })
      if (!rows[0]) throw new Error('No program was returned.')
      await onComplete(rows[0].assignment_id)
    } catch (cause) { setError(createErrorText(cause)) } finally { setMutation(null) }
  }
  return <div className="modal-backdrop" role="presentation" onKeyDown={event => { if (event.key === 'Escape' && !mutation) onClose(); else trapDialogTab(event) }}>
    <form className="dialog calendar-onboarding" role="dialog" aria-modal="true" aria-labelledby="create-program-title" onSubmit={submit}>
      <button ref={close} className="close" aria-label="Close create program dialog" type="button" disabled={Boolean(mutation)} onClick={onClose}>×</button>
      <h2 id="create-program-title">Build new program</h2>
      {!athletes.length ? <p>Add an athlete to your roster before building a program.</p> : <fieldset disabled={Boolean(mutation)}>
        <label>Athlete<select required name="athlete" defaultValue={selectedAthlete ?? athletes[0]?.athlete_id}>{athletes.map(athlete => <option key={athlete.athlete_id} value={athlete.athlete_id}>{athlete.roster_name}</option>)}</select></label>
        <label>Program name<input ref={input} required maxLength={120} name="program_name" autoComplete="off" placeholder="e.g. Strength block" /></label>
        <div className="onboarding-dates"><label>Week 1 Monday<input required name="start_on" type="date" value={startOn} onChange={event => setStartOn(event.target.value)} /></label><label>Weeks<input required name="weeks" type="number" min="1" max="12" defaultValue="4" /></label></div>
        <fieldset className="weekday-picker"><legend>Training weekdays · {weekdays.length} selected</legend>{weekdayNames.map((name, index) => <button type="button" key={name} aria-pressed={weekdays.includes(index + 1)} onClick={() => toggleWeekday(index + 1)}>{name}</button>)}</fieldset>
        <p className="calendar-preview" aria-live="polite">{range ? `Week 1: ${range} · ${weekdays.length} training day${weekdays.length === 1 ? '' : 's'}` : 'Choose a Monday to preview Week 1.'}</p>
      </fieldset>}
      {error && <p role="alert" className="auth-error">{error}</p>}
      <div className="dialog-actions"><button className="button primary" disabled={Boolean(mutation) || !athletes.length}>{mutation ? 'Creating…' : 'Create draft'}</button></div>
    </form>
  </div>
}
