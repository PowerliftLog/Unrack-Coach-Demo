import type { AthleteScheduleWorkout } from '../AthleteSchedulePanel'
import type { AppMode } from './config'

export type BootstrapOwnerGymInput = { gym_name: string; coach_display_name: string }
export type BootstrapOwnerGymResult = { gym_id: string; coach_id: string }
export type AddRosterAthleteInput = { target_gym: string; new_roster_name: string; existing_athlete: string | null }
export type AthleteProfileInputV1 = {
  name: string; sex_category: 'male' | 'female' | null
  bodyweight_value: number | null; bodyweight_unit: 'lb' | 'kg' | null
  preferred_weight_unit: 'lb' | 'kg'
  tested_1rm_squat: number | null; tested_1rm_bench: number | null; tested_1rm_deadlift: number | null
  tested_1rm_unit: 'lb' | 'kg'
}
export type AthleteProfileV1 = AthleteProfileInputV1 & {
  contract_version: 1; gym_id: string; athlete_id: string; profile_version: number
  updated_at: string; updated_by: 'coach' | 'athlete' | null
}
export type ProgrammingMaxRecordV1 = {
  id: string; exercise_id: string; max_type: 'tested_1rm' | 'training_max'
  value: number; unit: 'lb' | 'kg'; effective_from: string; same_day_version: number
  source: 'legacy_coach_entry' | 'coach_entry' | 'profile_approval' | 'workout_approval'
  source_profile_version: number | null; source_candidate_id: string | null; created_at: string
}
export type ProgrammingMaxCandidateV1 = {
  id: string; exercise_id: string; value: number; unit: 'lb' | 'kg'; profile_version: number
  workout_session_id: string; exercise_log_id: string; set_log_id: string
  actual_rpe: number | null; state: 'pending' | 'approved' | 'dismissed'; created_at: string
}
export type ProgrammingBasisOptionV1 = {
  exercise_id: string; name: string; default_basis_exercise_id: string | null
  archived_at: string | null
  latest_tested_1rm: ProgrammingMaxRecordV1 | null
  latest_training_max: ProgrammingMaxRecordV1 | null
}
export type ProgrammingMaxesV1 = {
  contract_version: 1; gym_id: string; athlete_id: string
  profile: { profile_version: number; tested_1rm_squat: number | null
    tested_1rm_bench: number | null; tested_1rm_deadlift: number | null
    tested_1rm_unit: 'lb' | 'kg' }
  maxes: ProgrammingMaxRecordV1[]; candidates: ProgrammingMaxCandidateV1[]
  basis_options: ProgrammingBasisOptionV1[]
}
export type SaveProgrammingMaxV1Input = {
  request_id: string; target_gym: string; target_athlete: string; exercise_id: string
  max_type: 'tested_1rm' | 'training_max'; value: number; unit: 'lb' | 'kg'
  effective_from: string; source: 'coach_entry' | 'profile_approval' | 'workout_approval'
  expected_profile_version: number | null; candidate_id: string | null
}
export type CoachMaxReportV1 = {
  report_id: string; source: 'profile' | 'workout_single'; athlete_id: string; athlete_name: string
  lift: 'squat' | 'bench' | 'deadlift' | null; exercise_id: string; exercise_name: string
  value: number; unit: 'lb' | 'kg'; reported_at: string; actual_rpe: number | null; profile_version: number
  workout: null | { workout_session_id: string; exercise_log_id: string; set_log_id: string
    workout_title: string | null; set_number: number; performed_at: string | null; actual_reps: number }
}
export type CoachMaxReportInboxV1 = { contract_version: 1; gym_id: string; total_pending: number
  items: CoachMaxReportV1[]; has_more: boolean; next_cursor: { reported_at: string; report_id: string } | null }
export type CoachMaxReportReviewV1 = { contract_version: 1; report_id: string; state: 'approved' | 'dismissed'; max: ProgrammingMaxRecordV1 | null }
export type ProgramTemplateMetadataItemV1 = ProgramTemplateLibraryItemV1 & { created_at: string; weekly_workout_counts: number[] }
export type ProgramTemplateMetadataLibraryV1 = Omit<ProgramTemplateLibraryV1, 'items'> & { items: ProgramTemplateMetadataItemV1[] }
export type ProgramTemplateMetadataV1 = { contract_version: 1; template_id: string; created_at: string; weekly_workout_counts: number[] }
export type ProgramPublicationMetadataV1 = { program_id: string; created_at: string; first_published_at: string | null
  latest_published_at: string | null; releases: Array<{ release_id: string; published_at: string
    scope_kind: 'legacy_full' | 'day' | 'week' | 'program'; week_ordinals: number[]; day_ordinals: number[] }> }
export interface BacklogRevisionApi {
  getCoachMaxReportInboxV1(input: { target_gym: string; target_athlete: string | null; cursor: CoachMaxReportInboxV1['next_cursor']; page_size: number }): Promise<CoachMaxReportInboxV1>
  reviewCoachMaxReportV1(input: { request_id: string; target_gym: string; target_athlete: string; report_id: string; action: 'approve' | 'dismiss'; effective_from: string | null }): Promise<CoachMaxReportReviewV1>
  getCoachProgramTemplateMetadataLibraryV1(input: { gym: string; week_count: number | null; workouts_per_week: number | 'varies' | null; after_name: string | null; after_template_id: string | null; page_size: number }): Promise<ProgramTemplateMetadataLibraryV1>
  getCoachProgramTemplateMetadataV1(input: { template: string }): Promise<ProgramTemplateMetadataV1>
  getCoachProgramPublicationMetadataV1(input: { target_gym: string; target_athlete: string; program_ids: string[] }): Promise<{ contract_version: 1; items: ProgramPublicationMetadataV1[] }>
}

export type CoachSetupStatusV1 = { contract_version: 1; state: 'workspace' | 'eligible' | 'unavailable'; coach_display_name: string | null }
export type WorkspaceSettingsV1 = { contract_version: 1
  coach: { id: string; display_name: string; name_version: number }
  workspace: { id: string; name: string; name_version: number; can_rename: boolean } }
export interface OwnerOnboardingApi {
  getCoachSetupStatusV1(): Promise<CoachSetupStatusV1>
  getWorkspaceSettingsV1(input: { target_gym: string }): Promise<WorkspaceSettingsV1>
  saveCoachNameV1(input: { target_gym: string; expected_name_version: number; display_name: string }): Promise<WorkspaceSettingsV1>
  saveWorkspaceNameV1(input: { target_gym: string; expected_name_version: number; workspace_name: string }): Promise<WorkspaceSettingsV1>
}

export type TrackedExerciseV1 = { exercise_id: string; name: string }
export type SystemTrackedExerciseV1 = TrackedExerciseV1 & { lift: 'squat' | 'bench' | 'deadlift' }
export type AthleteTrackingV1 = { contract_version: 1; tracking_version: number
  system_required: SystemTrackedExerciseV1[]; coach_required: TrackedExerciseV1[]
  athlete_added: TrackedExerciseV1[]; effective: TrackedExerciseV1[] }
export type CoachAthleteMetricsV1 = { contract_version: 1; gym_id: string; athlete_id: string
  tracking_version: number
  tracked_lifts: Array<{ exercise_id: string; name: string; top_weight: number | null
    top_unit: 'lb' | 'kg' | null; estimated_1rm: number | null
    estimated_1rm_unit: 'lb' | null; latest_at: string | null }>
  recent_sessions: Array<{ workout_session_id: string; assignment_id: string
    completed_at: string | null; state: string
    exercises: Array<{ exercise_id: string | null; name: string
      sets: Array<{ set_log_id: string; reps: number | null; weight: number | null
        unit: 'lb' | 'kg' | null; rpe: number | null; completed: boolean }> }> }> }
export type CoachAthleteNotesV1 = { contract_version: 1; gym_id: string; athlete_id: string; text: string; version: number; updated_at: string | null }
export type CoachAthleteActivityPageV1 = CoachRecentActivityPageV1 & {summary:{completed:number;skipped:number;last_session:{performed_at:string;day_label:string}|null}}
export type CoachOverviewApi = {
  getCoachAthleteNotesV1(input:{target_gym:string;target_athlete:string}):Promise<CoachAthleteNotesV1>
  saveCoachAthleteNotesV1(input:{request_id:string;target_gym:string;target_athlete:string;expected_version:number;note_text:string}):Promise<CoachAthleteNotesV1>
  getCoachAthleteActivityPageV1(input:{gym:string;athlete:string;cursor:CoachRecentActivityCursorV1|null;page_size:number}):Promise<CoachAthleteActivityPageV1>
}
export type TrainingReportV1 = { contract_version: 1; assignment_id: string
  ready: boolean; completed_at: string | null
  summary: null | { sessions: number; completed_sessions: number; logged_sets: number
    total_volume: number; volume_unit: 'lb'; average_rpe: number | null
    top_sets: Array<{ exercise_id: string | null; exercise_name: string
      weight: number; unit: 'lb' | 'kg'; reps: number
      rpe: number | null; performed_at: string }> } }
export type CompleteCoachAssignmentCycleV1 = { contract_version: 1; assignment_id: string
  assignment_status: 'completed'; completed_at: string }
export type ProgramPercentPreviewV1 = { contract_version: 1; program_id: string
  builder_version: number; fingerprint: string
  changes: Array<{ set_identity_token: string; exercise_name: string; percent: number
    basis_exercise_id: string; max_type: 'tested_1rm' | 'training_max'
    old_weight: number | null; new_weight: number | null; unit: 'lb' | 'kg'
    old_max_id: string | null; new_max_id: string | null
    manual_override: number | null
    skip_reason: null | 'locked' | 'performed' | 'missing_max' | 'manual_override' | 'cross_unit' }>
  counts: { eligible: number; skipped: number; changed: number } }
export type ProgramPercentApplyV1 = { contract_version: 1; program_id: string
  builder_version: number; applied_count: number; skipped_count: number }
export type SaveAthleteProfileV1Input = { request_id: string; target_gym: string; target_athlete: string; expected_version: number; profile: AthleteProfileInputV1 }
export type CreateProgramSkeletonInput = {
  request_id: string
  target_gym: string
  target_athlete: string
  program_name: string
  week_count: number
  first_day_name: string
}
export type CreateProgramSkeletonResult = {
  program_id: string
  assignment_id: string
  first_day_identity_token: string
  builder_version: number
}
export type CreateCalendarProgramInput = Omit<CreateProgramSkeletonInput, 'first_day_name'> & {
  start_on: string
  selected_weekdays: number[]
}
export type CreateCalendarProgramV2Result = {
  program_id: string
  assignment_id: string
  first_day_identity_token: string
  builder_version: number
}
export type CoachProgramCalendar = { version: 1; start_on: string; selected_weekdays: number[] }
export type PublishProgramInput = {
  program: string
  assignment: string
  boundary_kind: 'source_token' | 'logical_day_id'
  boundary_id: string
  expected_builder_version: number
}

export type CoachDeliveryStatus = 'draft' | 'awaiting_device' | 'preparing'
  | 'awaiting_download' | 'partially_downloaded' | 'downloaded'
export type CoachDelivery = {
  status: CoachDeliveryStatus
  released_at: string | null
  expected_receipts: number
  issued_receipts: number
  acknowledged_receipts: number
}
export type CoachProgramSummary = {
  program_id: string
  assignment_id: string
  program_name: string
  program_status: 'draft' | 'active' | 'archived'
  builder_version: number
  delivery: CoachDelivery
}
export type CoachRosterAthlete = {
  athlete_id: string
  roster_name: string
  roster_status: 'active' | 'former'
  active_device_count: number
  programs: CoachProgramSummary[]
}
export type CoachGymWorkspace = {
  gym_id: string
  gym_name: string
  role: 'owner' | 'admin' | 'coach'
  roster: CoachRosterAthlete[]
}
export type CoachSetGroup = {
  identity_token: string
  ordinal: number
  sets: number | null
  reps: number | null
  load_kind: 'exact' | 'percent' | 'rpe' | 'qualitative' | 'bodyweight' | 'none' | 'tbd'
  load_value: number | 'L' | 'M' | 'MH' | 'H' | null
  unit_override: 'lb' | 'kg' | null
  effective_unit: 'lb' | 'kg' | null
  rest_seconds: number | null
  note: string | null
}
export type CoachExercise = {
  identity_token: string
  ordinal: number
  name: string
  note: string | null
  protocol: string | null
  set_groups: CoachSetGroup[]
}
export type Phase3UnsupportedReason = 'set_limit' | 'sets_range' | 'dose_shape'
  | 'load_shape' | 'movement_shape' | 'exercise_shape'
export type CoachSetGroupV3 = CoachSetGroup & {
  sets_mode: 'exact' | 'range'
  sets_min: number
  sets_max: number | null
  dose_mode: 'reps' | 'time' | 'steps' | 'distance' | 'amrap'
  reps_mode: 'exact' | 'range' | 'athlete_choice' | null
  dose_min: number | null
  dose_max: number | null
  distance_unit: 'm' | 'km' | 'ft' | 'mi' | null
  laterality: 'bilateral' | 'each_side' | 'alternating'
  load_mode: CoachSetGroup['load_kind']
  load_basis: 'total' | 'added_to_bodyweight' | 'per_hand'
  exact_weight: number | null
  percent: number | null
  of_max_id: string | null
  resolved_weight: number | null
  resolved_max_effective_from: string | null
  resolved_at: string | null
  manual_override: number | null
  rpe_min: number | null
  rpe_max: number | null
  qualitative: 'L' | 'M' | 'MH' | 'H' | null
  percent_basis_exercise_id: string | null
  percent_basis_max_type: 'tested_1rm' | 'training_max' | null
}
export type CoachExerciseV3 = Omit<CoachExercise, 'set_groups'> & {
  edit_mode: 'replace' | 'preserve'
  unsupported_reason: Phase3UnsupportedReason | null
  set_groups: CoachSetGroupV3[]
}
export type CoachProgramDay = {
  planned_date?: string | null
  identity_token: string
  ordinal: number
  label: string | null
  subtitle: string | null
  marked_rest: boolean
  workout_instruction: string | null
  locked: boolean
  locked_any: boolean
  exercises: CoachExercise[]
}
export type CoachProgramDayV3 = Omit<CoachProgramDay, 'exercises'> & {
  day_editable: boolean
  day_unsupported_reason: 'day_shape' | 'movement_groups' | null
  exercises: CoachExerciseV3[]
}
type SaveCoachSetGroupBase = Omit<CoachSetGroup,
  'sets' | 'reps' | 'load_kind' | 'load_value' | 'unit_override' | 'effective_unit'> & {
  sets: number
  reps: number
}
export type SaveCoachSetGroup = SaveCoachSetGroupBase & (
  | { load_kind: 'exact'; load_value: number; unit_override: 'lb' | 'kg' | null; effective_unit: 'lb' | 'kg' }
  | { load_kind: 'rpe'; load_value: number; unit_override: null; effective_unit: null }
  | { load_kind: 'bodyweight' | 'none' | 'tbd'; load_value: null; unit_override: null; effective_unit: null }
)
export type SaveCoachExercise = Omit<CoachExercise, 'set_groups'> & {
  set_groups: SaveCoachSetGroup[]
}
export type SaveCoachIndividualSet = Omit<SaveCoachSetGroupBase, 'identity_token' | 'sets' | 'rest_seconds'> & {
  identity_token: string | null
} & (
  | { load_kind: 'exact'; load_value: number; unit_override: 'lb' | 'kg' | null; effective_unit: 'lb' | 'kg' }
  | { load_kind: 'rpe'; load_value: number; unit_override: null; effective_unit: null }
  | { load_kind: 'qualitative'; load_value: 'L' | 'M' | 'MH' | 'H'; unit_override: null; effective_unit: null }
  | { load_kind: 'bodyweight' | 'none' | 'tbd'; load_value: null; unit_override: null; effective_unit: null }
)
export type SaveCoachExerciseV2 =
  | { mode: 'preserve'; identity_token: string; ordinal: number }
  | {
    mode: 'replace'
    identity_token: string | null
    ordinal: number
    name: string
    note: string | null
    protocol: string | null
    set_rows: SaveCoachIndividualSet[]
  }
export type SaveCoachProgramDay = Omit<CoachProgramDay, 'planned_date' | 'label' | 'locked' | 'locked_any' | 'exercises'> & {
  label: string
  exercises: SaveCoachExercise[]
}
export type SaveCoachProgramDayV2 = Omit<SaveCoachProgramDay, 'exercises'> & {
  exercises: SaveCoachExerciseV2[]
}
export type CoachRepsV3 =
  | { mode: 'exact'; value: number }
  | { mode: 'range'; min: number; max: number }
export type SaveCoachIndividualSetV3 = Omit<SaveCoachIndividualSet, 'reps' | 'note'> & {
  reps: CoachRepsV3
}
export type SaveCoachExerciseV3 =
  | Extract<SaveCoachExerciseV2, { mode: 'preserve' }>
  | (Omit<Extract<SaveCoachExerciseV2, { mode: 'replace' }>, 'set_rows'> & {
    set_rows: SaveCoachIndividualSetV3[]
  })
export type SaveCoachProgramDayV3 = Omit<SaveCoachProgramDayV2, 'exercises'> & {
  exercises: SaveCoachExerciseV3[]
}
export type CoachProgramWeek = {
  identity_token: string
  ordinal: number
  label: string | null
  days: CoachProgramDay[]
}
export type SelectedCoachProgram = {
  calendar?: CoachProgramCalendar | null
  program_id: string
  assignment_id: string
  athlete_id: string
  name: string
  default_unit: 'lb' | 'kg'
  builder_version: number
  v1_supported: boolean
  unsupported_reason: 'day_shape' | 'movement_groups' | 'exercise_shape' | 'set_group_shape' | null
  editable: boolean
  publish_boundary: { kind: 'source_token'; id: string } | null
  empty_unmarked_day_tokens: string[]
  weeks: CoachProgramWeek[]
}
export type SelectedCoachProgramV3 = Omit<SelectedCoachProgram, 'weeks'> & {
  phase3_editable: boolean
  weeks: Array<Omit<CoachProgramWeek, 'days'> & { days: CoachProgramDayV3[] }>
}
export type CoachWorkspace = {
  read_at: string
  gyms: CoachGymWorkspace[]
  selected: SelectedCoachProgram | null
}
export type CoachWorkspaceV3 = Omit<CoachWorkspace, 'selected'> & {
  selected: SelectedCoachProgramV3 | null
}
export type CoachWorkspaceInput = { selected_assignment: string | null }
export type SaveCoachProgramDayInput = {
  program: string
  assignment: string
  expected_builder_version: number
  week_identity_token: string
  day: SaveCoachProgramDay
}
export type SaveCoachProgramDayV2Input = Omit<SaveCoachProgramDayInput, 'day'> & {
  day: SaveCoachProgramDayV2
}
export type SaveCoachProgramDayV3Input = Omit<SaveCoachProgramDayInput, 'day'> & {
  day: SaveCoachProgramDayV3
}
export type SaveCoachProgramDayResult = {
  program_id: string
  assignment_id: string
  day_identity_token: string
  builder_version: number
  unchanged: boolean
}
export type SaveCoachProgramDayV2Result = SaveCoachProgramDayResult & { day: SaveCoachProgramDayV2 }
export type SaveCoachProgramDayV3Result = SaveCoachProgramDayResult & {
  contract_version: 3
  day: SaveCoachProgramDayV3
}
export type WorkoutTemplateLifecycleV1 = 'active' | 'historical'
export type WorkoutTemplateReadTokenV1 = string
export type WorkoutTemplateCursorV1 = { name: string; template_id: string }
export type WorkoutTemplateLibraryItemV1 = {
  template_id: string
  name: string
  builder_version: number
  readiness: 'draft' | 'ready'
  archived_at: string | null
  supported: boolean
}
export type WorkoutTemplateLibraryPageV1 = {
  contract_version: 1
  gym_id: string
  lifecycle: WorkoutTemplateLifecycleV1
  search_text: string | null
  page_size: number
  items: WorkoutTemplateLibraryItemV1[]
  has_more: boolean
  next_cursor: WorkoutTemplateCursorV1 | null
  library_lifecycle_key: string
  library_generation: number
  read_token: WorkoutTemplateReadTokenV1
  next_read_token: WorkoutTemplateReadTokenV1 | null
}
export type WorkoutTemplateLibraryPageV2 = Omit<WorkoutTemplateLibraryPageV1, 'contract_version' | 'items'> & { contract_version: 2; items: Array<WorkoutTemplateLibraryItemV1 & { rich_supported: boolean }> }
export type WorkoutTemplateDetailV1 = {
  contract_version: 1
  template_id: string
  gym_id: string
  name: string
  default_unit: 'lb' | 'kg'
  plate_increment: number
  builder_version: number
  readiness: 'draft' | 'ready'
  archived_at: string | null
  supported: boolean
  read_token: WorkoutTemplateReadTokenV1
}
export type WorkoutTemplateDetailV2 = Omit<WorkoutTemplateDetailV1, 'contract_version'> & { contract_version: 2; rich_supported: boolean }
export type WorkoutTemplateDayV1 = {
  contract_version: 1
  template_id: string
  builder_version: number
  supported: boolean
  day: SaveCoachProgramDayV3 | null
  read_token: WorkoutTemplateReadTokenV1
}
export type WorkoutTemplateCreateV1Result = {
  contract_version: 1
  template_id: string
  day_identity_token: string
  builder_version: number
  readiness: 'draft'
  archived: false
}
export type WorkoutTemplateSaveDayV1Result = {
  contract_version: 1
  template_id: string
  builder_version: number
  readiness: 'draft'
  day: SaveCoachProgramDayV3
}
export type WorkoutTemplateReadinessV1Result = {
  contract_version: 1
  template_id: string
  builder_version: number
  readiness: 'draft' | 'ready'
}
export type WorkoutTemplateReadinessV2Result = Omit<WorkoutTemplateReadinessV1Result, 'contract_version'> & { contract_version: 2; rich_supported: boolean }
export type WorkoutTemplateArchiveV1Result = {
  contract_version: 1
  template_id: string
  builder_version: number
  archived: boolean
  readiness?: 'draft'
}
export type ApplyWorkoutTemplateV1Input = {
  template: string
  expected_template_builder_version: number
  program: string
  assignment: string
  expected_program_builder_version: number
  destination_week_identity_token: string
  destination_day_identity_token: string
}
export type ApplyWorkoutTemplateV1Result = {
  contract_version: 1
  template_id: string
  template_builder_version: number
  program_result: SaveCoachProgramDayV3Result
}
export type ApplyWorkoutTemplateV2Result = Omit<ApplyWorkoutTemplateV1Result, 'contract_version' | 'program_result'> & { contract_version: 2; program_result: SaveCoachProgramDayV4Result }
export type ApplyWorkoutTemplateV3Result = Omit<ApplyWorkoutTemplateV2Result, 'contract_version'> & { contract_version: 3 }
export type ApplyWorkoutTemplateV4Input = Omit<ApplyWorkoutTemplateV1Input, 'destination_day_identity_token'> & { destination_day_ordinal: number; destination_day_label: string; shell_request_id: string; preview_fingerprint: string }
export type ApplyWorkoutTemplateV4Result = Omit<ApplyWorkoutTemplateV3Result, 'contract_version'> & { contract_version: 4; created_day_identity_token: string }
export type TemplatePercentPreviewV1 = { contract_version: 1; template_id: string; template_builder_version: number; program_id: string | null; program_builder_version: number | null; athlete_id: string; calendar_generation: number; cutoff_date: string; ready: boolean; unresolved_count: number; fingerprint: string; rows: Array<{ set_id: string; exercise_name: string; percent: number; basis_exercise_id: string | null; max_type: 'tested_1rm' | 'training_max' | null; status: 'current' | 'missing' | 'future_only' | 'unmapped' | 'archived_exercise' | 'cross_unit'; resolved_weight: number | null; unit: 'lb' | 'kg'; max_id: string | null }> }
export type CoachDaySaveState = 'Unsaved' | 'Saving' | 'Saved' | 'Conflict'

export interface ConnectedCoachApi extends Partial<BacklogRevisionApi> {
  bootstrapOwnerGym(input: BootstrapOwnerGymInput): Promise<BootstrapOwnerGymResult[]>
  addRosterAthlete(input: AddRosterAthleteInput): Promise<string>
  getAthleteProfileV1(input: { target_gym: string; target_athlete: string }): Promise<AthleteProfileV1>
  saveAthleteProfileV1(input: SaveAthleteProfileV1Input): Promise<AthleteProfileV1>
  createProgramSkeleton(input: CreateProgramSkeletonInput): Promise<CreateProgramSkeletonResult[]>
  /** Legacy V1 constructor retained for the flags-off V4 fallback. */
  createCalendarProgram(input: CreateCalendarProgramInput): Promise<CreateProgramSkeletonResult[]>
  /** Call only after freshly reading the program's builder_version and immutable publish boundary. */
  publishProgram(input: PublishProgramInput): Promise<string>
  getCoachWorkspace(input: CoachWorkspaceInput): Promise<CoachWorkspace>
  saveCoachProgramDay(input: SaveCoachProgramDayInput): Promise<SaveCoachProgramDayResult>
}

export interface ConnectedCoachApiV3 extends ConnectedCoachApi {
  getCoachWorkspaceV3(input: CoachWorkspaceInput): Promise<CoachWorkspaceV3>
  saveCoachProgramDayV2(input: SaveCoachProgramDayV2Input): Promise<SaveCoachProgramDayV2Result>
}

export type Phase4Uuid = string
export type SignedBigintDecimal = string
export type NavigationPageKind = 'gyms' | 'roster' | 'assignments'
type NavigationPrincipalToken = {
  principal_id: Phase4Uuid
  principal_lifecycle_key: Phase4Uuid
  principal_generation: SignedBigintDecimal
}
type NavigationGymToken = NavigationPrincipalToken & {
  gym_id: Phase4Uuid
  gym_lifecycle_key: Phase4Uuid
  gym_generation: SignedBigintDecimal
}
export type CoachNavigationGymsReadToken = NavigationPrincipalToken & { page_kind: 'gyms' }
export type CoachNavigationRosterReadToken = NavigationGymToken & { page_kind: 'roster' }
export type CoachNavigationAssignmentsReadToken = NavigationGymToken & {
  page_kind: 'assignments'
  athlete_id: Phase4Uuid
  athlete_lifecycle_key: Phase4Uuid
  athlete_generation: SignedBigintDecimal
}
export type NavigationReadToken = CoachNavigationGymsReadToken | CoachNavigationRosterReadToken | CoachNavigationAssignmentsReadToken
export type CoachNavigationGymsCursor = CoachNavigationGymsReadToken & { gym_id: Phase4Uuid }
export type CoachNavigationRosterCursor = CoachNavigationRosterReadToken & { roster_name: string; athlete_id: Phase4Uuid }
export type CoachNavigationAssignmentsCursor = CoachNavigationAssignmentsReadToken & { assigned_at: string; assignment_id: Phase4Uuid }
export type NavigationCursor = CoachNavigationGymsCursor | CoachNavigationRosterCursor | CoachNavigationAssignmentsCursor
export type CoachNavigationGymItem = { gym_id: Phase4Uuid; gym_name: string; role: 'owner' | 'admin' | 'coach' }
export type CoachNavigationRosterItem = { gym_id: Phase4Uuid; athlete_id: Phase4Uuid; roster_name: string; roster_status: 'active' | 'former'; active_device_count: number }
export type CoachNavigationAssignmentItem = {
  gym_id: Phase4Uuid
  athlete_id: Phase4Uuid
  program_id: Phase4Uuid
  assignment_id: Phase4Uuid
  program_name: string
  program_status: 'draft' | 'active' | 'archived'
  assignment_status: 'active' | 'paused' | 'completed' | 'revoked'
  builder_version: number
  delivery: CoachDelivery
}
export type CoachNavigationGymsPageV4 = { navigation_read_token: CoachNavigationGymsReadToken; items: CoachNavigationGymItem[]; next_cursor: CoachNavigationGymsCursor | null; has_more: boolean }
export type CoachNavigationRosterPageV4 = { navigation_read_token: CoachNavigationRosterReadToken; items: CoachNavigationRosterItem[]; next_cursor: CoachNavigationRosterCursor | null; has_more: boolean }
export type CoachNavigationAssignmentsPageV4 = { navigation_read_token: CoachNavigationAssignmentsReadToken; items: CoachNavigationAssignmentItem[]; next_cursor: CoachNavigationAssignmentsCursor | null; has_more: boolean }
export type CoachNavigationPageV4 = CoachNavigationGymsPageV4 | CoachNavigationRosterPageV4 | CoachNavigationAssignmentsPageV4

export type CoachDashboardRosterGroup = 'needs_programming' | 'current_clients'
export type CoachDashboardLifecycleBucket = 'current_active' | 'unreleased_draft' | 'unreleased_future' | 'historical_released' | 'completed_or_revoked'
type CoachDashboardBaseToken = NavigationGymToken & {
  principal_id: Phase4Uuid
  principal_lifecycle_key: Phase4Uuid
  principal_generation: SignedBigintDecimal
  materialization_generation: SignedBigintDecimal
  materialization_as_of_date: string
  visibility_kind: 'gym' | 'coach'
  page_size: SignedBigintDecimal
}
export type CoachDashboardRosterReadToken = CoachDashboardBaseToken & {
  page_kind: 'coach_dashboard_roster_v1'
  group_kind: 'all' | CoachDashboardRosterGroup
  search_text: string | null
  cursor_roster_name: string | null
  cursor_athlete_id: Phase4Uuid | null
}
export type CoachDashboardRosterReadTokenV2 = Omit<CoachDashboardRosterReadToken, 'page_kind'> & {
  page_kind: 'coach_dashboard_roster_v2'
  programming_snapshot: string
}
export type CoachDashboardAssignmentsReadToken = CoachDashboardBaseToken & {
  page_kind: 'coach_dashboard_assignments_v1'
  athlete_id: Phase4Uuid
  athlete_lifecycle_key: Phase4Uuid
  athlete_generation: SignedBigintDecimal
  lifecycle_filter: 'all' | CoachDashboardLifecycleBucket
  cursor_assigned_at: string | null
  cursor_assignment_id: Phase4Uuid | null
}
export type CoachDashboardArchiveVisibility = 'working' | 'archived'
export type CoachDashboardAssignmentsReadTokenV2 = CoachDashboardBaseToken & {
  page_kind: 'coach_dashboard_assignments_v2'
  athlete_id: Phase4Uuid
  athlete_lifecycle_key: Phase4Uuid
  athlete_generation: SignedBigintDecimal
  lifecycle_filter: 'all' | CoachDashboardLifecycleBucket
  archive_visibility: CoachDashboardArchiveVisibility
  cursor_assigned_at: string | null
  cursor_assignment_id: Phase4Uuid | null
}
export type CoachDashboardRosterCursor = { roster_name: string; athlete_id: Phase4Uuid }
export type CoachDashboardAssignmentsCursor = { assigned_at: string; assignment_id: Phase4Uuid }
export type CoachDashboardCurrentAssignment = {
  assignment_id: Phase4Uuid
  program_id: Phase4Uuid
  program_name: string | null
  program_status: 'draft' | 'active' | 'archived' | null
  assigned_at: string | null
  start_on: string | null
  end_on: string | null
  lifecycle_bucket: 'current_active'
}
export type CoachDashboardRosterItem = {
  athlete_id: Phase4Uuid
  roster_name: string
  roster_status: 'active' | 'former'
  has_active_assignment: boolean
  current_assignment_id: Phase4Uuid | null
  current_assignment_available: boolean
  current_assignment: CoachDashboardCurrentAssignment | null
  lifecycle_counts: Record<CoachDashboardLifecycleBucket, number>
  future_or_draft_plan_count: number
}
export type CoachDashboardRosterItemV2 = CoachDashboardRosterItem & {
  program_readiness: 'draft' | 'ready' | null
  programming_state: 'needs_programming' | 'current'
}
export type CoachDashboardAssignmentItem = {
  assignment_id: Phase4Uuid
  program_id: Phase4Uuid | null
  program_name: string | null
  program_status: 'draft' | 'active' | 'archived' | null
  assignment_status: 'active' | 'paused' | 'completed' | 'revoked'
  assigned_at: string
  start_on: string | null
  end_on: string | null
  has_release: boolean
  lifecycle_bucket: CoachDashboardLifecycleBucket
}
export type CoachDashboardAssignmentItemV2 = Omit<CoachDashboardAssignmentItem, 'program_id' | 'program_name' | 'program_status'> & {
  program_id: Phase4Uuid
  program_name: string
  program_status: 'draft' | 'active' | 'archived'
  archived_at: string | null
  archive_generation: SignedBigintDecimal
  archive_eligible: boolean
  archive_blocker: 'current_program' | 'restore_state_missing' | null
}
export type CoachDashboardRosterPageV1 = { contract_version: 1; visibility_kind: 'gym' | 'coach'; server_as_of_date: string; dashboard_read_token: CoachDashboardRosterReadToken; items: CoachDashboardRosterItem[]; has_more: boolean; next_cursor: CoachDashboardRosterCursor | null; next_read_token: CoachDashboardRosterReadToken | null }
export type CoachDashboardRosterPageV2 = { contract_version: 2; visibility_kind: 'gym' | 'coach'; server_as_of_date: string; dashboard_read_token: CoachDashboardRosterReadTokenV2; items: CoachDashboardRosterItemV2[]; has_more: boolean; next_cursor: CoachDashboardRosterCursor | null; next_read_token: CoachDashboardRosterReadTokenV2 | null }
export type CoachDashboardAssignmentsPageV1 = { contract_version: 1; visibility_kind: 'gym' | 'coach'; server_as_of_date: string; dashboard_read_token: CoachDashboardAssignmentsReadToken; items: CoachDashboardAssignmentItem[]; has_more: boolean; next_cursor: CoachDashboardAssignmentsCursor | null; next_read_token: CoachDashboardAssignmentsReadToken | null }
export type CoachDashboardAssignmentsPageV2 = { contract_version: 2; visibility_kind: 'gym' | 'coach'; server_as_of_date: string; dashboard_read_token: CoachDashboardAssignmentsReadTokenV2; items: CoachDashboardAssignmentItemV2[]; has_more: boolean; next_cursor: CoachDashboardAssignmentsCursor | null; next_read_token: CoachDashboardAssignmentsReadTokenV2 | null }
export type CoachRecentActivityCursorV1 = { recorded_at: string; activity_id: Phase4Uuid }
export type CoachRecentActivityItemV1 = {
  activity_id: Phase4Uuid
  athlete_id: Phase4Uuid
  roster_name: string
  assignment_id: Phase4Uuid
  program_name: string
  day_label: string
  outcome: 'completed' | 'skipped'
  performed_at: string
  recorded_at: string
}
export type CoachRecentActivityPageV1 = { contract_version: 1; items: CoachRecentActivityItemV1[]; has_more: boolean; next_cursor: CoachRecentActivityCursorV1 | null }
export type CoachActivityPlannedSetV1 = {
  revision_set_group_id: Phase4Uuid; ordinal: number; sets_mode: 'exact' | 'range'; sets_min: number; sets_max: number | null
  dose_mode: 'reps' | 'time' | 'steps' | 'distance' | 'amrap'; reps_mode: 'exact' | 'range' | 'athlete_choice' | null
  dose_min: number | null; dose_max: number | null; distance_unit: 'm' | 'km' | 'ft' | 'mi' | null
  laterality: 'bilateral' | 'each_side' | 'alternating'; load_mode: 'exact' | 'percent' | 'rpe' | 'qualitative' | 'bodyweight' | 'none' | 'tbd'
  load_basis: 'total' | 'added_to_bodyweight' | 'per_hand'; exact_weight: number | null; percent: number | null
  percent_basis_exercise_id: Phase4Uuid | null; percent_basis_max_type: 'tested_1rm' | 'training_max' | null
  manual_override: number | null; rpe_min: number | null; rpe_max: number | null; qualitative: 'L' | 'M' | 'MH' | 'H' | null
  unit_override: 'lb' | 'kg' | null; rest_seconds: number | null; note: string | null; of_max_id: Phase4Uuid | null
  resolved_weight: number | null; resolved_max_effective_from: string | null; resolved_at: string | null
}
export type CoachActivityPlannedExerciseV1 = {
  exercise_id?: Phase4Uuid | null; track_in_metrics?: boolean
  revision_exercise_row_id: Phase4Uuid; ordinal: number; group_ordinal: number | null; exercise_name: string
  exercise_instruction: string | null; movement_note: string | null; protocol: string | null; status: string
  set_groups: CoachActivityPlannedSetV1[]
}
export type CoachActivityPlannedDayV1 = {
  revision_day_id: Phase4Uuid
  revision: { program_name: string; cycle_label: string | null; default_unit: 'lb' | 'kg'; plate_increment: number; start_on: string | null; end_on: string | null }
  block: { ordinal: number; label: string | null; planned_weeks: number }
  week: { ordinal: number; ordinal_in_block: number; label: string }
  day: { ordinal: number; label: string; subtitle: string | null; workout_instruction: string | null }
  movement_groups: Array<{ revision_movement_group_id: Phase4Uuid; ordinal: number; group_type: 'superset' | 'circuit' | 'sequence'; title: string | null; rounds_min: number | null; rounds_max: number | null; exercises: CoachActivityPlannedExerciseV1[] }>
  ungrouped_exercises: CoachActivityPlannedExerciseV1[]
}
export type CoachActivityPerformedSetV1 = {
  id: Phase4Uuid; revision_set_group_id: Phase4Uuid; set_number: number; actual_reps: number | null
  actual_seconds: number | null; actual_steps: number | null; actual_distance: number | null
  actual_distance_unit: 'm' | 'km' | 'ft' | 'mi' | null; actual_weight: number | null
  actual_weight_unit: 'lb' | 'kg' | null; actual_rpe: number | null; completed: boolean
  athlete_note: string | null; device_updated_at: string; created_at: string; updated_at: string
}
export type CoachActivityPerformedExerciseV1 = {
  id: Phase4Uuid; revision_exercise_row_id: Phase4Uuid; athlete_note: string | null
  created_at: string; updated_at: string; sets: CoachActivityPerformedSetV1[]
}
export type CoachWorkoutActivityDetailV1 = {
  contract_version: 1; activity_id: Phase4Uuid; athlete_id: Phase4Uuid; roster_name: string
  assignment_id: Phase4Uuid; program_name: string; outcome: 'completed' | 'skipped'
  performed_at: string; recorded_at: string
  session: { id: Phase4Uuid; state: 'not_started' | 'in_progress' | 'completed' | 'skipped'; athlete_note: string | null; started_at: string | null; completed_at: string | null; skipped_at: string | null; skip_reason: string | null; created_at: string; updated_at: string }
  delivery: { receipt_id: Phase4Uuid; acknowledged_at: string | null; opened_at: string | null; consumed_at: string | null }
  planned: CoachActivityPlannedDayV1; performed_exercises: CoachActivityPerformedExerciseV1[]
}
export type CoachProgramArchiveV1Result = {
  contract_version: 1
  program_id: Phase4Uuid
  program_status: 'draft' | 'active' | 'archived'
  archived_at: string | null
  archive_generation: SignedBigintDecimal
  archived: boolean
}

export type CoachPendingUndoV4 = {
  undo_id: Phase4Uuid
  assignment_id: Phase4Uuid
  operation_type: 'copy_day' | 'copy_week' | 'progression'
  target_description: string
  artifact_version_after: number
  expires_at: string
}
export type CoachAssignmentAuthoringV4 = {
  readiness: 'draft' | 'ready'
  ready_builder_version: number | null
  ready_at: string | null
  pending_undo: CoachPendingUndoV4 | null
}
export type CoachAssignmentDaySummaryV4 = {
  day_identity_token: Phase4Uuid | null
  day_ordinal: number
  label: string | null
  planned_date: string
  status: 'unscheduled' | 'authored_empty' | 'workout' | 'rest'
  locked_any: boolean
  exercise_count: number
  set_row_count: number
}
export type CoachAssignmentWeekSummaryV4 = { week_identity_token: Phase4Uuid; week_ordinal: number; days: CoachAssignmentDaySummaryV4[] }
export type CoachAssignmentDetailV4 = {
  detail_read_token: string
  program_id: Phase4Uuid
  assignment_id: Phase4Uuid
  athlete_id: Phase4Uuid
  program_name: string
  program_status: 'draft' | 'active' | 'archived'
  assignment_status: 'active' | 'paused' | 'completed' | 'revoked'
  builder_version: number
  default_unit: 'lb' | 'kg'
  plate_increment: number
  phase4_editable: boolean
  publish_boundary: { kind: 'source_token'; id: Phase4Uuid } | null
  calendar: CoachProgramCalendar
  authoring: CoachAssignmentAuthoringV4
  weeks: CoachAssignmentWeekSummaryV4[]
}
export type CoachAssignmentEditableDayV4 = { mode: 'editable'; content: CoachProgramDayV3 }
export type CoachAssignmentLegacyOversizeDayV4 = {
  mode: 'legacy_oversize'
  day_identity_token: Phase4Uuid
  day_ordinal: number
  label: string | null
  status: 'authored_empty' | 'workout' | 'rest'
  exercise_count: SignedBigintDecimal
  set_row_count: SignedBigintDecimal
  copy_source_eligible: boolean
  copy_block_reason: 'source_too_large' | null
}
export type CoachAssignmentDayV4 = {
  detail_read_token: string
  program_id: Phase4Uuid
  assignment_id: Phase4Uuid
  builder_version: number
  day: CoachAssignmentEditableDayV4 | CoachAssignmentLegacyOversizeDayV4
}
export type CoachAssignmentDaySummaryV5 = CoachAssignmentDaySummaryV4 & {
  system_weekday: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  workout_title: string | null
}
export type CoachAssignmentWeekSummaryV5 = Omit<CoachAssignmentWeekSummaryV4, 'days'> & {
  days: CoachAssignmentDaySummaryV5[]
}
export type CoachAssignmentDetailV5 = Omit<CoachAssignmentDetailV4, 'weeks'> & {
  contract_version: 5
  weeks: CoachAssignmentWeekSummaryV5[]
}
export type CoachSetGroupV5 = Omit<CoachSetGroupV3, 'reps'> & { reps: CoachRepsV3 | null }
export type CoachExerciseV5 = Omit<CoachExerciseV3, 'set_groups'> & { set_groups: CoachSetGroupV5[] }
export type CoachProgramDayV5 = Omit<CoachProgramDayV3, 'exercises'> & {
  system_weekday: CoachAssignmentDaySummaryV5['system_weekday']
  workout_title: string | null
  exercises: CoachExerciseV5[]
}
export type CoachAssignmentEditableDayV5 = { mode: 'editable'; content: CoachProgramDayV5 }
export type CoachAssignmentLegacyOversizeDayV5 = CoachAssignmentLegacyOversizeDayV4 & {
  system_weekday: CoachAssignmentDaySummaryV5['system_weekday']
  workout_title: string | null
}
export type CoachAssignmentDayV5 = Omit<CoachAssignmentDayV4, 'day'> & {
  contract_version: 5
  day: CoachAssignmentEditableDayV5 | CoachAssignmentLegacyOversizeDayV5
}
export type RichSetFields = {
  ordinal: number; sets_mode: 'exact' | 'range'; sets_min: number; sets_max: number | null
  dose_mode: 'reps' | 'time' | 'steps' | 'distance' | 'amrap'; reps_mode: 'exact' | 'range' | 'athlete_choice' | null
  dose_min: number | null; dose_max: number | null; distance_unit: 'm' | 'km' | 'ft' | 'mi' | null
  laterality: 'bilateral' | 'each_side' | 'alternating'; load_mode: 'exact' | 'percent' | 'rpe' | 'qualitative' | 'bodyweight' | 'none' | 'tbd'
  load_basis: 'total' | 'added_to_bodyweight' | 'per_hand'; exact_weight: number | null; percent: number | null
  percent_basis_exercise_id: Phase4Uuid | null; percent_basis_max_type: 'tested_1rm' | 'training_max' | null
  rpe_min: number | null; rpe_max: number | null; qualitative: 'L' | 'M' | 'MH' | 'H' | null
  unit_override: 'lb' | 'kg' | null; rest_seconds: number | null; note: string | null
}
export type RichProgramSet = RichSetFields & { mode: 'replace'; identity_token: Phase4Uuid | null; manual_override: number | null; of_max_id: Phase4Uuid | null; resolved_weight: number | null; resolved_max_effective_from: string | null; resolved_at: string | null }
export type RichTemplateSet = RichSetFields & { mode: 'replace'; id: Phase4Uuid | null }
export type RichProgramSetSave = ({ mode: 'replace'; identity_token: Phase4Uuid | null; manual_override: number | null } & RichSetFields) | { mode: 'preserve'; identity_token: Phase4Uuid; ordinal: number }
export type RichTemplateSetSave = ({ mode: 'replace'; id: Phase4Uuid | null } & RichSetFields) | { mode: 'preserve'; id: Phase4Uuid; ordinal: number }
export type RichExerciseFields = { ordinal: number; group_ordinal: number | null; status: 'programmed' | 'not_programmed'; name: string; instruction: string | null; note: string | null; protocol: string | null }
export type RichProgramExercise = RichExerciseFields & { mode: 'replace'; identity_token: Phase4Uuid | null; set_groups: RichProgramSet[] }
export type RichTemplateExercise = RichExerciseFields & { mode: 'replace'; id: Phase4Uuid | null; set_groups: RichTemplateSet[] }
export type RichProgramExerciseSave = ({ mode: 'replace'; identity_token: Phase4Uuid | null; set_groups: RichProgramSetSave[] } & RichExerciseFields) | { mode: 'preserve'; identity_token: Phase4Uuid; ordinal: number; group_ordinal: number | null }
export type RichTemplateExerciseSave = ({ mode: 'replace'; id: Phase4Uuid | null; set_groups: RichTemplateSetSave[] } & RichExerciseFields) | { mode: 'preserve'; id: Phase4Uuid; ordinal: number; group_ordinal: number | null }
export type RichGroupFields = { ordinal: number; group_type: 'superset' | 'circuit' | 'sequence'; title: string | null; rounds_min: number | null; rounds_max: number | null }
export type RichProgramGroup = RichGroupFields & { mode: 'replace'; identity_token: Phase4Uuid | null; exercises: RichProgramExercise[] }
export type RichTemplateGroup = RichGroupFields & { mode: 'replace'; id: Phase4Uuid | null; exercises: RichTemplateExercise[] }
export type RichProgramGroupSave = ({ mode: 'replace'; identity_token: Phase4Uuid | null; exercises: RichProgramExerciseSave[] } & RichGroupFields) | { mode: 'preserve'; identity_token: Phase4Uuid; ordinal: number }
export type RichTemplateGroupSave = ({ mode: 'replace'; id: Phase4Uuid | null; exercises: RichTemplateExerciseSave[] } & RichGroupFields) | { mode: 'preserve'; id: Phase4Uuid; ordinal: number }
export type RichDayFields = { identity_token: Phase4Uuid; ordinal: number; label: string; subtitle: string | null; marked_rest: boolean; workout_instruction: string | null }
export type RichProgramDay = RichDayFields & { movement_groups: RichProgramGroup[]; ungrouped_exercises: RichProgramExercise[] }
export type RichTemplateDay = RichDayFields & { movement_groups: RichTemplateGroup[]; ungrouped_exercises: RichTemplateExercise[] }
export type RichProgramDaySave = RichDayFields & { movement_groups: RichProgramGroupSave[]; ungrouped_exercises: RichProgramExerciseSave[] }
export type RichTemplateDaySave = RichDayFields & { movement_groups: RichTemplateGroupSave[]; ungrouped_exercises: RichTemplateExerciseSave[] }
export type RichPercentBasisOption = { exercise_id: Phase4Uuid; name: string }
export type RichAssignmentPercentBasisOption = RichPercentBasisOption & { max_type: 'tested_1rm' | 'training_max'; value: number; unit: 'lb' | 'kg'; effective_from: string }
export type CoachAssignmentDayV6 = Omit<CoachAssignmentDayV5, 'contract_version' | 'day'> & { contract_version: 6; percent_basis_options: RichAssignmentPercentBasisOption[]; day: { mode: 'editable'; content: RichProgramDay & Pick<CoachProgramDayV5, 'locked' | 'locked_any' | 'planned_date' | 'system_weekday' | 'workout_title' | 'day_editable' | 'day_unsupported_reason'> } | CoachAssignmentLegacyOversizeDayV5 }
export type SaveCoachProgramDayV4Result = { contract_version: 4; program_id: Phase4Uuid; assignment_id: Phase4Uuid; day_identity_token: Phase4Uuid; builder_version: number; unchanged: boolean; day: RichProgramDay }
export type WorkoutTemplateDayV2 = { contract_version: 2; template_id: Phase4Uuid; builder_version: number; supported: boolean; rich_supported: boolean; day: RichTemplateDay; read_token: string; percent_basis_options: RichPercentBasisOption[] }
export type WorkoutTemplateSaveDayV2Result = { contract_version: 2; template_id: Phase4Uuid; builder_version: number; readiness: 'draft' | 'ready'; day: RichTemplateDay; unchanged?: true }
export type ProgramTemplateDayV2 = { contract_version: 2; template_id: Phase4Uuid; day_id: Phase4Uuid; builder_version: number; percent_basis_options: RichPercentBasisOption[] } & ({ supported: true; day: RichTemplateDay } | { supported: false; day: null })
export type ProgramTemplateSaveDayV2Result = WorkoutTemplateSaveDayV2Result & { day_id: Phase4Uuid }
export type RichExerciseTrackingFields = { exercise_id: Phase4Uuid | null; track_in_metrics: boolean }
export type RichProgramExerciseV2 = RichProgramExercise & RichExerciseTrackingFields
export type RichTemplateExerciseV2 = RichTemplateExercise & RichExerciseTrackingFields
export type RichProgramDayV2 = Omit<RichProgramDay, 'movement_groups' | 'ungrouped_exercises'> & {
  movement_groups: Array<Omit<RichProgramGroup, 'exercises'> & { exercises: RichProgramExerciseV2[] }>
  ungrouped_exercises: RichProgramExerciseV2[]
}
export type RichTemplateDayV2 = Omit<RichTemplateDay, 'movement_groups' | 'ungrouped_exercises'> & {
  movement_groups: Array<Omit<RichTemplateGroup, 'exercises'> & { exercises: RichTemplateExerciseV2[] }>
  ungrouped_exercises: RichTemplateExerciseV2[]
}
export type RichProgramExerciseSaveV2 = (Extract<RichProgramExerciseSave, { mode: 'replace' }> & RichExerciseTrackingFields)
  | Extract<RichProgramExerciseSave, { mode: 'preserve' }>
export type RichTemplateExerciseSaveV2 = (Extract<RichTemplateExerciseSave, { mode: 'replace' }> & RichExerciseTrackingFields)
  | Extract<RichTemplateExerciseSave, { mode: 'preserve' }>
export type RichProgramDaySaveV2 = Omit<RichProgramDaySave, 'movement_groups' | 'ungrouped_exercises'> & {
  movement_groups: Array<(Extract<RichProgramGroupSave, { mode: 'replace' }> & { exercises: RichProgramExerciseSaveV2[] }) | Extract<RichProgramGroupSave, { mode: 'preserve' }>>
  ungrouped_exercises: RichProgramExerciseSaveV2[]
}
export type RichTemplateDaySaveV2 = Omit<RichTemplateDaySave, 'movement_groups' | 'ungrouped_exercises'> & {
  movement_groups: Array<(Extract<RichTemplateGroupSave, { mode: 'replace' }> & { exercises: RichTemplateExerciseSaveV2[] }) | Extract<RichTemplateGroupSave, { mode: 'preserve' }>>
  ungrouped_exercises: RichTemplateExerciseSaveV2[]
}
export type ExerciseOptionV1 = { exercise_id: Phase4Uuid; name: string; default_basis_exercise_id: Phase4Uuid | null }
export type CoachAssignmentDayV7 = Omit<CoachAssignmentDayV6, 'contract_version' | 'day'> & {
  contract_version: 7; exercise_options: ExerciseOptionV1[]
  day: { mode: 'editable'; content: RichProgramDayV2 & Pick<CoachProgramDayV5, 'locked' | 'locked_any' | 'planned_date' | 'system_weekday' | 'workout_title' | 'day_editable' | 'day_unsupported_reason'> }
    | CoachAssignmentLegacyOversizeDayV5
}
export type SaveCoachProgramDayV5Result = Omit<SaveCoachProgramDayV4Result, 'contract_version' | 'day'> & { contract_version: 5; day: RichProgramDayV2 }
export type WorkoutTemplateDayV3 = Omit<WorkoutTemplateDayV2, 'contract_version' | 'day'> & { contract_version: 3; day: RichTemplateDayV2; exercise_options: ExerciseOptionV1[] }
export type WorkoutTemplateSaveDayV3Result = Omit<WorkoutTemplateSaveDayV2Result, 'contract_version' | 'day'> & { contract_version: 3; day: RichTemplateDayV2 }
export type ProgramTemplateDayV3 = Omit<ProgramTemplateDayV2, 'contract_version' | 'day'> & { contract_version: 3; day: RichTemplateDayV2 | null; exercise_options: ExerciseOptionV1[] }
export type ProgramTemplateSaveDayV3Result = WorkoutTemplateSaveDayV3Result & { day_id: Phase4Uuid }
export type CompactProgrammingOperationV1 = {
  contract_version: 1
  request_id: Phase4Uuid
  operation_type: 'move_day' | 'copy_day' | 'copy_week' | 'tracking' | 'undo' | 'append_week'
  root_id: Phase4Uuid
  builder_version_before: number
  builder_version_after: number
  changed_day_tokens: Phase4Uuid[]
  undo: { undo_id: Phase4Uuid; expires_at: string } | null
}
export type MoveCoachProgramDayV1Input = {
  request_id: Phase4Uuid; program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number
  week_identity_token: Phase4Uuid; source_day_identity_token: Phase4Uuid; destination_day_ordinal: number; swap: boolean
}
export type MoveCoachProgramTemplateDayV1Input = {
  request_id: Phase4Uuid; template: Phase4Uuid; expected_builder_version: number
  source_day_id: Phase4Uuid; destination_day_id: Phase4Uuid; swap: boolean
}
export type CopyCoachProgramTemplateV3Input = {
  request_id: Phase4Uuid; template: Phase4Uuid; expected_builder_version: number
  copy_kind: 'day' | 'week'; source_week_id: Phase4Uuid; source_day_id: Phase4Uuid | null
  destination_week_ids: Phase4Uuid[]; replace_reviewed: boolean
}
export type UndoCompactProgrammingOperationV1Input = {
  request_id: Phase4Uuid; root_kind: 'program' | 'template'; root_id: Phase4Uuid
  assignment: Phase4Uuid | null; expected_builder_version: number; undo_id: Phase4Uuid
}
export type SetCoachProgramExerciseTrackingV1Input = {
  request_id: Phase4Uuid; program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number
  exercise_id: Phase4Uuid; tracked: boolean
}
export type SetCoachProgramTemplateExerciseTrackingV1Input = {
  request_id: Phase4Uuid; template: Phase4Uuid; expected_builder_version: number
  exercise_id: Phase4Uuid; tracked: boolean
}
export type AppendCoachProgramWeekV1Input = {
  request_id: Phase4Uuid; program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number
}
export interface PercentageProgrammingApi {
  getCoachAthleteNotesV1?: CoachOverviewApi['getCoachAthleteNotesV1']
  saveCoachAthleteNotesV1?: CoachOverviewApi['saveCoachAthleteNotesV1']
  getCoachAthleteActivityPageV1?: CoachOverviewApi['getCoachAthleteActivityPageV1']
  getCoachAthleteCalendarV1?(input: {target_gym:string;target_athlete:string}): Promise<{contract_version:1;workouts:AthleteScheduleWorkout[]}>

  getProgrammingMaxesV1(input: { target_gym: string; target_athlete: string }): Promise<ProgrammingMaxesV1>
  saveProgrammingMaxV1(input: SaveProgrammingMaxV1Input): Promise<ProgrammingMaxRecordV1>
  dismissProgrammingMaxCandidateV1(input: { target_gym: string; target_athlete: string; candidate_id: string }): Promise<{ candidate_id: string; state: 'dismissed' }>
  getAthleteTrackingV1(input: { target_gym: string; target_athlete: string }): Promise<AthleteTrackingV1>
  setCoachTrackingV1(input: { request_id: string; target_gym: string; target_athlete: string; exercise_id: string; required: boolean; expected_version: number }): Promise<AthleteTrackingV1>
  setGymCompetitionExerciseV1(input: { target_gym: string; target_lift: 'squat' | 'bench' | 'deadlift'; target_exercise: string }): Promise<{ lift: 'squat' | 'bench' | 'deadlift'; exercise_id: string }>
  ensureCoachExerciseV1(input: { target_gym: string; exercise_name: string }): Promise<ExerciseOptionV1>
  getCoachAthleteMetricsV1(input: { target_gym: string; target_athlete: string }): Promise<CoachAthleteMetricsV1>
  getCoachTrainingReportV1(input: { target_gym: string; target_athlete: string; assignment_id: string }): Promise<TrainingReportV1>
  completeCoachAssignmentCycleV1(input: { target_gym: string; target_athlete: string; assignment_id: string }): Promise<CompleteCoachAssignmentCycleV1>
  previewProgramPercentV1(input: { program: string; expected_builder_version: number }): Promise<ProgramPercentPreviewV1>
  applyProgramPercentV1(input: { program: string; expected_builder_version: number; preview_fingerprint: string }): Promise<ProgramPercentApplyV1>
  getCoachAssignmentDayV7(input: { assignment: string; day_identity_token: string; expected_detail_read_token: string }): Promise<CoachAssignmentDayV7>
  saveCoachProgramDayV5(input: { program: string; assignment: string; expected_builder_version: number; week_identity_token: string; day: RichProgramDaySaveV2 }): Promise<SaveCoachProgramDayV5Result>
  getCoachWorkoutTemplateDayV3(input: { template: string; expected_read_token: string | null }): Promise<WorkoutTemplateDayV3>
  saveCoachWorkoutTemplateDayV3(input: { template: string; expected_builder_version: number; day: RichTemplateDaySaveV2 }): Promise<WorkoutTemplateSaveDayV3Result>
  getCoachProgramTemplateDayV3(input: { template: string; day_id: string }): Promise<ProgramTemplateDayV3>
  saveCoachProgramTemplateDayV3(input: { template: string; day_id: string; expected_builder_version: number; day: RichTemplateDaySaveV2 }): Promise<ProgramTemplateSaveDayV3Result>
  moveCoachProgramDayV1(input: MoveCoachProgramDayV1Input): Promise<CompactProgrammingOperationV1>
  moveCoachProgramTemplateDayV1(input: MoveCoachProgramTemplateDayV1Input): Promise<CompactProgrammingOperationV1>
  copyCoachProgramTemplateV3(input: CopyCoachProgramTemplateV3Input): Promise<CompactProgrammingOperationV1>
  undoCompactProgrammingOperationV1(input: UndoCompactProgrammingOperationV1Input): Promise<CompactProgrammingOperationV1>
  setCoachProgramExerciseTrackingV1(input: SetCoachProgramExerciseTrackingV1Input): Promise<CompactProgrammingOperationV1>
  setCoachProgramTemplateExerciseTrackingV1(input: SetCoachProgramTemplateExerciseTrackingV1Input): Promise<CompactProgrammingOperationV1>
  appendCoachProgramWeekV1(input: AppendCoachProgramWeekV1Input): Promise<CompactProgrammingOperationV1>
}
export type SetCoachProgramReadinessV1Input = { program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; target_state: 'draft' | 'ready' }
export type CoachReadinessIssueCode = 'empty_unmarked_day' | 'rest_day_has_content' | 'day_label_missing' | 'exercise_without_prescription' | 'percent_load_unresolved' | 'superset_too_small' | 'superset_duplicate_exercise'
export type CoachReadinessIssueV1 = {
  code: CoachReadinessIssueCode
  week_identity_token: Phase4Uuid
  week_ordinal: number
  day_identity_token: Phase4Uuid | null
  day_ordinal: number
  exercise_identity_token: Phase4Uuid | null
  exercise_ordinal: number | null
  set_identity_token: Phase4Uuid | null
  set_ordinal: number | null
}
export type SetCoachProgramReadinessV1Result = { program_id: Phase4Uuid; assignment_id: Phase4Uuid; builder_version: number; readiness: 'draft' | 'ready'; changed: boolean; ready_at: string | null; issue_count: SignedBigintDecimal; issues_truncated: boolean; issues: CoachReadinessIssueV1[] }
export type CopySource = { week_identity_token: Phase4Uuid } | { week_identity_token: Phase4Uuid; day_identity_token: Phase4Uuid }
export type CopyDestination = { week_identity_token: Phase4Uuid; collision_policy: 'preserve' | 'replace' } | { week_identity_token: Phase4Uuid; day_ordinal: number; collision_policy: 'preserve' | 'replace' }
export type PreviewBuilderCopyV1Input = { program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; copy_kind: 'day' | 'week'; source: CopySource; destinations: CopyDestination[] }
export type ApplyBuilderCopyV1Input = PreviewBuilderCopyV1Input & { request_id: Phase4Uuid }
export type PreviewBuilderCopyV2Input = { program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; copy_kind: 'day'; source: { week_identity_token: Phase4Uuid; day_identity_token: Phase4Uuid }; destinations: Array<{ week_identity_token: Phase4Uuid; day_ordinal: number; collision_policy: 'preserve' | 'replace' }> }
export type ApplyBuilderCopyV2Input = PreviewBuilderCopyV2Input & { request_id: Phase4Uuid; preview_guard: string }
export type ProgressionScope = { kind: 'set_rows'; week_identity_tokens: Phase4Uuid[]; identity_tokens: Phase4Uuid[] } | { kind: 'exercises'; week_identity_tokens: Phase4Uuid[]; identity_tokens: Phase4Uuid[] }
export type ProgressionTransform = { kind: 'exact_load'; direction: 'add' | 'subtract'; amount: number; unit: 'lb' | 'kg' } | { kind: 'percent_points'; direction: 'add' | 'subtract'; amount: number } | { kind: 'reps'; direction: 'add' | 'subtract'; amount: number } | { kind: 'rpe'; direction: 'add' | 'subtract'; amount: number } | { kind: 'sets'; direction: 'add' | 'remove'; amount: number }
export type PreviewBuilderProgressionV1Input = { program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; scope: ProgressionScope; transform: ProgressionTransform }
export type ApplyBuilderProgressionV1Input = PreviewBuilderProgressionV1Input & { request_id: Phase4Uuid; preview_guard: string }
export type ProgressionV2Source = { week_identity_token: Phase4Uuid; day_identity_token: Phase4Uuid }
export type ProgressionV2Scope = { kind: 'entire_workout' } | { kind: 'exercises'; source_exercise_identity_tokens: Phase4Uuid[] }
export type ProgressionV2Rule =
  | { kind: 'exact_load'; direction: 'add' | 'subtract'; amount: number; unit: 'lb' | 'kg' }
  | { kind: 'percent_points'; direction: 'add' | 'subtract'; amount: number }
  | { kind: 'exact_reps' | 'rep_range' | 'rpe'; direction: 'add' | 'subtract'; amount: number }
  | { kind: 'sets'; direction: 'add' | 'remove'; amount: number }
export type ProgressionV2OverrideValue =
  | { kind: 'exact_load'; exact_weight: number }
  | { kind: 'percent_points'; percent: number }
  | { kind: 'exact_reps'; reps: number }
  | { kind: 'rep_range'; min: number; max: number }
  | { kind: 'rpe'; rpe: number }
  | { kind: 'set_count'; set_count: number }
export type ProgressionV2Override = { review_target_id: string; value: ProgressionV2OverrideValue }
export type PreviewBuilderProgressionV2Input = {
  program: Phase4Uuid
  assignment: Phase4Uuid
  expected_builder_version: number
  source: ProgressionV2Source
  scope: ProgressionV2Scope
  destination_week_identity_tokens: Phase4Uuid[]
  rule: ProgressionV2Rule
  overrides: ProgressionV2Override[]
  replace_reviewed_weeks: boolean
}
export type ApplyBuilderProgressionV2Input = PreviewBuilderProgressionV2Input & { request_id: Phase4Uuid; preview_guard: string }
export type UndoBuilderOperationV1Input = { request_id: Phase4Uuid; program: Phase4Uuid; assignment: Phase4Uuid; undo_id: Phase4Uuid; expected_builder_version: number }
export type PublishReadyProgramV1Input = { request_id: Phase4Uuid; program: Phase4Uuid; assignment: Phase4Uuid; boundary_kind: 'source_token' | 'logical_day_id'; boundary_id: Phase4Uuid; expected_builder_version: number }
export type PublishCoachScopeV1Input = { request_id: Phase4Uuid; program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; scope_kind: 'week' | 'program'; scope_token: Phase4Uuid | null }
export type ActivateAndPublishCoachScopeV1Input = { request_id: Phase4Uuid; candidate_assignment: Phase4Uuid; expected_current_assignment: Phase4Uuid | null; expected_builder_version: number; scope_kind: 'week' | 'program'; scope_token: Phase4Uuid | null }
export type AuthorCalendarDayV1Input = {
  request_id: Phase4Uuid
  program: Phase4Uuid
  assignment: Phase4Uuid
  expected_builder_version: number
  week_identity_token: Phase4Uuid
  day_ordinal: number
  authoring_kind: 'rest' | 'workout_shell'
  day_label: string
}
export type AuthorCalendarDayV1Result = {
  request_id: Phase4Uuid
  operation_type: 'author_day'
  program_id: Phase4Uuid
  assignment_id: Phase4Uuid
  week_identity_token: Phase4Uuid
  day_identity_token: Phase4Uuid
  day_ordinal: number
  status: 'rest' | 'authored_empty'
  builder_version_before: number
  builder_version_after: number
  unchanged: false
}
export type ExerciseNameHistoryV1Input = { gym: Phase4Uuid; query: string; result_limit: number }
export type ExerciseNameHistoryItemV1 = { name: string; last_used_at: string; use_count: SignedBigintDecimal }
export type ExerciseNameHistoryV1Result = { items: ExerciseNameHistoryItemV1[] }
export type RecordExerciseNameHistoryV1Input = { program: Phase4Uuid; assignment: Phase4Uuid; names: string[] }
export type RecordExerciseNameHistoryV1Result = { recorded_count: number; retained_count: number }
export type SaveCoachProgramDayV2WithHistoryResult = {
  save: SaveCoachProgramDayV2Result
  history_recorded: boolean
}

export type CoachCopySourceResultV1 = { week_identity_token: Phase4Uuid; week_ordinal: number; day_identity_token: Phase4Uuid | null; day_ordinal: number | null }
export type CoachCopyDestinationDayV1 = { source_day_identity_token: Phase4Uuid; destination_day_identity_token: Phase4Uuid | null; day_ordinal: number; label: string | null; status: 'unscheduled' | 'authored_empty' | 'workout' | 'rest' | 'locked'; proposed_action: 'populate' | 'replace' | 'preserve' | 'locked' | 'already_equal' }
export type CoachCopyCollisionV1 = { destination_day_identity_token: Phase4Uuid; day_ordinal: number; label: string | null; status: 'workout' | 'rest' | 'locked'; proposed_action: 'replace' | 'preserve' | 'locked' | 'already_equal' }
export type CoachCopyDestinationOnlyDayV1 = { destination_day_identity_token: Phase4Uuid; day_ordinal: number; label: string | null; status: 'authored_empty' | 'workout' | 'rest' | 'locked'; proposed_action: 'preserve' | 'delete' | 'locked' }
export type CoachCopyDestinationPlanV1 = {
  week_identity_token: Phase4Uuid
  week_ordinal: number
  day_ordinal: number | null
  existing_day_identity_token: Phase4Uuid | null
  classification: 'empty' | 'populated' | 'locked' | 'same_scope'
  collision_policy: 'preserve' | 'replace'
  proposed_action: 'populate' | 'replace' | 'preserve' | 'locked' | 'unavailable' | 'already_equal'
  workout_count: number
  rest_count: number
  open_count: number
  destination_only_count: number
  destination_days: CoachCopyDestinationDayV1[]
  collisions: CoachCopyCollisionV1[]
  destination_only_days: CoachCopyDestinationOnlyDayV1[]
}
export type CoachCopyDestinationResultV1 = CoachCopyDestinationPlanV1 & { outcome: 'applied' | 'applied_with_preserved' | 'preserved' | 'skipped' | 'locked' }
export type PreviewBuilderCopyV1Result = { program_id: Phase4Uuid; assignment_id: Phase4Uuid; builder_version: number; copy_kind: 'day' | 'week'; source: CoachCopySourceResultV1; destinations: CoachCopyDestinationPlanV1[]; totals: { apply_destinations: number; changed_days: number; preserved_days: number; locked_destinations: number }; can_apply: boolean }
export type PreviewBuilderCopyV2Result = PreviewBuilderCopyV1Result & { contract_version: 2; copy_kind: 'day'; preview_guard: string }
export type CoachOperationUndoV1 = { undo_id: Phase4Uuid; expires_at: string }
export type ApplyBuilderCopyV1Result = {
  request_id: Phase4Uuid
  operation_type: 'copy_day' | 'copy_week'
  program_id: Phase4Uuid
  assignment_id: Phase4Uuid
  builder_version_before: number
  builder_version_after: number
  unchanged: boolean
  destinations: CoachCopyDestinationResultV1[]
  applied: Array<{ week_identity_token: Phase4Uuid; day_ordinal: number | null; changed_day_ordinals: number[] }>
  preserved: Array<{ week_identity_token: Phase4Uuid; day_ordinal: number; day_identity_token: Phase4Uuid; reason: 'collision' }>
  skipped: Array<{ week_identity_token: Phase4Uuid; day_ordinal: number | null; reason: 'already_equal' | 'no_source_content' }>
  locked: Array<{ week_identity_token: Phase4Uuid; day_ordinal: number | null; day_identity_tokens: Phase4Uuid[] }>
  undo: CoachOperationUndoV1 | null
}
export type ApplyBuilderCopyV2Result = ApplyBuilderCopyV1Result & { contract_version: 2; operation_type: 'copy_day'; preview_guard: string }
export type ProgressionValue =
  | { kind: 'exact_load'; exact_weight: number; effective_unit: 'lb' | 'kg' }
  | { kind: 'percent_points'; percent: number; pinned_max_id: Phase4Uuid; pinned_max_value: number; pinned_max_unit: 'lb' | 'kg'; resolved_weight: number; effective_unit: 'lb' | 'kg'; plate_increment: number }
  | { kind: 'reps'; reps: number }
  | { kind: 'sets'; set_count: number }
  | { kind: 'rpe'; rpe: number }
export type ProgressionChangeV1 = { week_identity_token: Phase4Uuid; day_identity_token: Phase4Uuid; exercise_identity_token: Phase4Uuid; set_identity_token: Phase4Uuid | null; target_kind: 'set_row' | 'exercise'; target_identity_token: Phase4Uuid; before: ProgressionValue; after: ProgressionValue }
export type ProgressionSkippedRowV1 = { target_kind: 'set_row' | 'exercise'; target_identity_token: Phase4Uuid; week_identity_token: Phase4Uuid; day_identity_token: Phase4Uuid; reason: 'load_mode' | 'dose_shape' | 'not_individualized' | 'movement_shape' | 'manual_override' | 'exercise_shape' }
export type ProgressionLockedDayV1 = { week_identity_token: Phase4Uuid; day_identity_token: Phase4Uuid }
export type ProgressionBlockingIssueCode = 'result_out_of_range' | 'result_scale_invalid' | 'mixed_effective_units' | 'set_count_out_of_range' | 'pinned_max_missing' | 'pinned_max_changed' | 'plate_increment_invalid' | 'preview_state_changed'
export type ProgressionBlockingIssueV1 = { code: ProgressionBlockingIssueCode; target_kind: 'set_row' | 'exercise'; target_identity_token: Phase4Uuid; related_identity_token: Phase4Uuid | null; week_identity_token: Phase4Uuid; day_identity_token: Phase4Uuid; field: 'exact_weight' | 'percent' | 'reps' | 'sets' | 'rpe' | 'effective_unit' | 'pinned_max' | 'plate_increment' | 'preview_state'; current_value: string | null; proposed_value: string | null; unit: 'lb' | 'kg' | null; message_key: ProgressionBlockingIssueCode }
export type PreviewBuilderProgressionV1Result = { program_id: Phase4Uuid; assignment_id: Phase4Uuid; builder_version: number; outcome: 'preview'; preview_guard: string; scope_kind: 'set_rows' | 'exercises'; transform: ProgressionTransform; eligible_count: number; representative_changes: ProgressionChangeV1[]; skipped_rows: ProgressionSkippedRowV1[]; locked: ProgressionLockedDayV1[]; blocking_issues: ProgressionBlockingIssueV1[]; can_apply: boolean }
export type ApplyBuilderProgressionV1Result = { request_id: Phase4Uuid; operation_type: 'progression'; program_id: Phase4Uuid; assignment_id: Phase4Uuid; preview_guard: string; builder_version_before: number; builder_version_after: number; outcome: 'applied' | 'no_op' | 'refused'; unchanged: boolean; changes: ProgressionChangeV1[]; applied_identity_tokens: Phase4Uuid[]; created_set_identity_tokens: Phase4Uuid[]; retired_set_identity_tokens: Phase4Uuid[]; skipped_rows: ProgressionSkippedRowV1[]; locked: ProgressionLockedDayV1[]; blocking_issues: ProgressionBlockingIssueV1[]; undo: CoachOperationUndoV1 | null }
export type ProgressionV2BeforeValue =
  | { kind: 'exact_load'; exact_weight: number; unit: 'lb' | 'kg' }
  | { kind: 'percent_points'; percent: number; resolved_weight: number; unit: 'lb' | 'kg' }
  | { kind: 'exact_reps'; reps: number }
  | { kind: 'rep_range'; min: number; max: number }
  | { kind: 'rpe'; rpe: number }
  | { kind: 'set_count'; set_count: number }
export type ProgressionV2ResolvedAfterValue =
  | ProgressionV2OverrideValue
  | { kind: 'percent_points'; percent: number; resolved_weight: number; unit: 'lb' | 'kg' }
// Generated values may exceed the editable result range by at most twelve
// bounded cumulative rule steps. They remain review-only candidates until an
// in-range override is re-previewed.
export type ProgressionV2GeneratedCandidate =
  | { kind: 'exact_load'; exact_weight: number }
  | { kind: 'percent_points'; percent: number }
  | { kind: 'exact_reps'; reps: number }
  | { kind: 'rep_range'; min: number; max: number }
  | { kind: 'rpe'; rpe: number }
  | { kind: 'set_count'; set_count: number }
export type ProgressionV2AfterValue = ProgressionV2ResolvedAfterValue | ProgressionV2GeneratedCandidate
export type ProgressionV2ReviewTarget = {
  review_target_id: string
  source_exercise_identity_token: Phase4Uuid
  source_set_identity_token: Phase4Uuid | null
  exercise_name: string
  set_ordinal: number | null
  kind: ProgressionV2OverrideValue['kind']
  before: ProgressionV2BeforeValue
  after: ProgressionV2AfterValue
}
export type ProgressionV2WeekReview = {
  week_identity_token: Phase4Uuid
  week_ordinal: number
  weekday: CoachAssignmentDaySummaryV5['system_weekday']
  workout_title: string | null
  collision: boolean
  locked: boolean
  unchanged_count: number
  review_targets: ProgressionV2ReviewTarget[]
}
export type ProgressionV2BlockingIssueCode = 'destination_locked' | 'no_eligible_targets'
  | 'override_kind_invalid' | 'override_target_invalid' | 'result_out_of_range'
  | 'mixed_effective_units' | 'pinned_max_missing'
export type ProgressionV2BlockingIssue = {
  code: ProgressionV2BlockingIssueCode
  week_identity_token: Phase4Uuid | null
  review_target_id: string | null
  message_key: ProgressionV2BlockingIssueCode
}
export type PreviewBuilderProgressionV2Result = {
  contract_version: 2
  operation_type: 'progression'
  program_id: Phase4Uuid
  assignment_id: Phase4Uuid
  builder_version: number
  source: ProgressionV2Source & {
    week_ordinal: number
    day_ordinal: number
    weekday: CoachAssignmentDaySummaryV5['system_weekday']
    workout_title: string | null
  }
  rule: ProgressionV2Rule
  weeks: ProgressionV2WeekReview[]
  collision_week_identity_tokens: Phase4Uuid[]
  blocking_issues: ProgressionV2BlockingIssue[]
  can_apply: boolean
  preview_guard: string
}
export type ApplyBuilderProgressionV2Result = {
  contract_version: 2
  request_id: Phase4Uuid
  operation_type: 'progression'
  program_id: Phase4Uuid
  assignment_id: Phase4Uuid
  preview_guard: string
  builder_version_before: number
  builder_version_after: number
} & ({
  unchanged: false
  applied_week_identity_tokens: Phase4Uuid[]
  undo: CoachOperationUndoV1
} | {
  unchanged: true
  applied_week_identity_tokens: []
  undo: null
})
export type UndoBuilderOperationV1Result = { request_id: Phase4Uuid; operation_type: 'undo'; undo_id: Phase4Uuid; undone_operation_type: 'copy_day' | 'copy_week' | 'progression'; program_id: Phase4Uuid; assignment_id: Phase4Uuid; builder_version_before: number; builder_version_after: number; restored_week_identity_tokens: Phase4Uuid[]; readiness: 'draft'; undone_at: string }
export type PublishReadyProgramV1Result = { request_id: Phase4Uuid; operation_type: 'publish_ready'; program_id: Phase4Uuid; assignment_id: Phase4Uuid; builder_version: number; release_id: Phase4Uuid; readiness: 'ready'; published_at: string }
export type PublishCoachScopeV1Result = { request_id: Phase4Uuid; operation_type: 'publish_scope'; program_id: Phase4Uuid; assignment_id: Phase4Uuid; builder_version: number; release_id: Phase4Uuid; scope_kind: 'day' | 'week' | 'program'; scope_token: Phase4Uuid | null; visible_day_tokens: Phase4Uuid[]; published_at: string }
export type ActivateAndPublishCoachScopeV1Result = Omit<PublishCoachScopeV1Result, 'operation_type'> & { operation_type: 'activate_scope'; previous_assignment_id: Phase4Uuid | null; retired_instance_count: number }
export type ActivateAndPublishCoachAssignmentV1Input = {
  request_id: Phase4Uuid
  candidate_assignment: Phase4Uuid
  expected_current_assignment: Phase4Uuid | null
  boundary_kind: 'source_token' | 'logical_day_id'
  boundary_id: Phase4Uuid
  expected_builder_version: number
}
export type ActivateAndPublishCoachAssignmentV1Result = {
  request_id: Phase4Uuid
  operation_type: 'activate_assignment'
  program_id: Phase4Uuid
  assignment_id: Phase4Uuid
  previous_assignment_id: Phase4Uuid | null
  builder_version: number
  release_id: Phase4Uuid
  published_at: string
  retired_instance_count: number
}
export type CoachBuilderOperationResult = ApplyBuilderCopyV1Result | ApplyBuilderProgressionV1Result | UndoBuilderOperationV1Result | PublishReadyProgramV1Result | ActivateAndPublishCoachAssignmentV1Result

export interface ConnectedCoachApiV4 extends ConnectedCoachApiV3 {
  getCoachNavigationGymsV4(input: { cursor: CoachNavigationGymsCursor | null; page_size: number; expected_read_token: CoachNavigationGymsReadToken | null }): Promise<CoachNavigationGymsPageV4>
  getCoachNavigationRosterV4(input: { gym: Phase4Uuid; cursor: CoachNavigationRosterCursor | null; page_size: number; expected_read_token: CoachNavigationRosterReadToken | null }): Promise<CoachNavigationRosterPageV4>
  getCoachNavigationAssignmentsV4(input: { gym: Phase4Uuid; athlete: Phase4Uuid; cursor: CoachNavigationAssignmentsCursor | null; page_size: number; expected_read_token: CoachNavigationAssignmentsReadToken | null }): Promise<CoachNavigationAssignmentsPageV4>
  getCoachAssignmentDetailV4(input: { assignment: Phase4Uuid }): Promise<CoachAssignmentDetailV4>
  getCoachAssignmentDayV4(input: { assignment: Phase4Uuid; day_identity_token: Phase4Uuid; expected_detail_read_token: string }): Promise<CoachAssignmentDayV4>
  setCoachProgramReadinessV1(input: SetCoachProgramReadinessV1Input): Promise<SetCoachProgramReadinessV1Result>
  previewBuilderCopyV1(input: PreviewBuilderCopyV1Input): Promise<PreviewBuilderCopyV1Result>
  applyBuilderCopyV1(input: ApplyBuilderCopyV1Input): Promise<ApplyBuilderCopyV1Result>
  previewBuilderProgressionV1(input: PreviewBuilderProgressionV1Input): Promise<PreviewBuilderProgressionV1Result>
  applyBuilderProgressionV1(input: ApplyBuilderProgressionV1Input): Promise<ApplyBuilderProgressionV1Result>
  undoBuilderOperationV1(input: UndoBuilderOperationV1Input): Promise<UndoBuilderOperationV1Result>
  publishReadyProgramV1(input: PublishReadyProgramV1Input): Promise<PublishReadyProgramV1Result>
  publishCoachScopeV1?(input: PublishCoachScopeV1Input): Promise<PublishCoachScopeV1Result>
  activateAndPublishCoachScopeV1?(input: ActivateAndPublishCoachScopeV1Input): Promise<ActivateAndPublishCoachScopeV1Result>
}

export interface Phase55DashboardReadsApi {
  getCoachDashboardRosterPageV1(input: { gym: Phase4Uuid; group_kind: CoachDashboardRosterGroup; search_text: string | null; cursor: CoachDashboardRosterCursor | null; page_size: number; expected_read_token: CoachDashboardRosterReadToken | null }): Promise<CoachDashboardRosterPageV1>
  getCoachDashboardRosterPageV2?(input: { gym: Phase4Uuid; group_kind: CoachDashboardRosterGroup; search_text: string | null; cursor: CoachDashboardRosterCursor | null; page_size: number; expected_read_token: CoachDashboardRosterReadTokenV2 | null }): Promise<CoachDashboardRosterPageV2>
  getCoachDashboardAssignmentsPageV1(input: { gym: Phase4Uuid; athlete: Phase4Uuid; lifecycle_filter: 'all' | CoachDashboardLifecycleBucket; cursor: CoachDashboardAssignmentsCursor | null; page_size: number; expected_read_token: CoachDashboardAssignmentsReadToken | null }): Promise<CoachDashboardAssignmentsPageV1>
}

export interface Phase9ActivityApi {
  getCoachRecentActivityPageV1(input: { gym: Phase4Uuid; cursor: CoachRecentActivityCursorV1 | null; page_size: number }): Promise<CoachRecentActivityPageV1>
  getCoachWorkoutActivityDetailV1?(input: { gym: Phase4Uuid; activity_id: Phase4Uuid }): Promise<CoachWorkoutActivityDetailV1>
}

export type ProgramTemplateLibraryItemV1 = {
  template_id: Phase4Uuid; name: string; builder_version: number
  archived_at: string | null; week_count: number
}
export type ProgramTemplateLibraryV1 = {
  contract_version: 1; items: ProgramTemplateLibraryItemV1[]
  has_more: boolean; next_cursor: { name: string; template_id: Phase4Uuid } | null
}
export type ProgramTemplateDaySummaryV1 = {
  day_id: Phase4Uuid; day_ordinal: number; label: string | null; subtitle: string | null
  marked_rest: boolean; supported: boolean; exercise_count: number; set_count: number
}
export type ProgramTemplateDetailV1 = {
  contract_version: 1; template_id: Phase4Uuid; gym_id: Phase4Uuid; name: string
  default_unit: 'lb' | 'kg'; builder_version: number; archived_at: string | null
  weeks: { week_id: Phase4Uuid; week_ordinal: number; days: ProgramTemplateDaySummaryV1[] }[]
}
export type ProgramTemplateAdvancedExerciseV1 = {
  name: string; ordinal: number; status: string
  group_type: string | null; group_title: string | null
  sets: { ordinal: number; sets_mode: string; sets_min: number; sets_max: number | null
    dose_mode: string; reps_mode: string | null; dose_min: number | null; dose_max: number | null
    load_mode: string; exact_weight: number | null; percent: number | null
    rpe_min: number | null; rpe_max: number | null; qualitative: string | null; note: string | null }[]
}
export type ProgramTemplateDayV1 = {
  contract_version: 1; template_id: Phase4Uuid; builder_version: number
} & ({ supported: true; day: SaveCoachProgramDayV3; advanced: null }
  | { supported: false; day: null; advanced: ProgramTemplateAdvancedExerciseV1[] })
export type ProgramTemplateCreateV1 = {
  contract_version: 1; template_id: Phase4Uuid; builder_version: number; week_count: number
}
export type ProgramTemplateSaveDayV1 = {
  contract_version: 1; template_id: Phase4Uuid; builder_version: number; day: SaveCoachProgramDayV3
}
export type ProgramTemplateAppendWeekV1 = {
  contract_version: 1; template_id: Phase4Uuid; week_id: Phase4Uuid
  week_ordinal: number; builder_version: number
}
export type ProgramTemplateCopyWeekV1 = {
  contract_version: 1; request_id: Phase4Uuid; template_id: Phase4Uuid
  source_week_id: Phase4Uuid; destination_week_id: Phase4Uuid
  builder_version_before: number; builder_version: number; copied_day_count: 7
}
export type ProgramTemplateCopyWeekV2 = Omit<ProgramTemplateCopyWeekV1, 'contract_version'> & { contract_version: 2 }
export type ProgramTemplateSnapshotV1 = {
  contract_version: 1; request_id: Phase4Uuid; template_id: Phase4Uuid
  builder_version: number; week_count: number; source_program_id: Phase4Uuid
  source_builder_version: number
}
export type ProgramTemplateApplyV1 = {
  contract_version: 1; request_id: Phase4Uuid; template_id: Phase4Uuid
  template_builder_version: number; program_id: Phase4Uuid; assignment_id: Phase4Uuid
  builder_version: number; assignment_status: 'paused'; week_count: number
}
export type ProgramTemplateSnapshotV2 = Omit<ProgramTemplateSnapshotV1, 'contract_version'> & { contract_version: 2 }
export type ProgramTemplateApplyV2 = Omit<ProgramTemplateApplyV1, 'contract_version'> & { contract_version: 2 }
export type ProgramTemplateArchiveV1 = {
  contract_version: 1; template_id: Phase4Uuid; builder_version: number; archived: boolean
}
export interface Phase9ProgramTemplateApi {
  getCoachProgramTemplateLibraryV1(input: { gym: Phase4Uuid; after_name: string | null; after_template_id: Phase4Uuid | null; page_size: number }): Promise<ProgramTemplateLibraryV1>
  createCoachProgramTemplateV1(input: { gym: Phase4Uuid; template_name: string; week_count: number }): Promise<ProgramTemplateCreateV1>
  getCoachProgramTemplateDetailV1(input: { template: Phase4Uuid }): Promise<ProgramTemplateDetailV1>
  getCoachProgramTemplateDayV1(input: { template: Phase4Uuid; day_id: Phase4Uuid }): Promise<ProgramTemplateDayV1>
  getCoachProgramTemplateDayV2?(input: { template: Phase4Uuid; day_id: Phase4Uuid }): Promise<ProgramTemplateDayV2>
  saveCoachProgramTemplateDayV1(input: { template: Phase4Uuid; expected_builder_version: number; day: SaveCoachProgramDayV3 }): Promise<ProgramTemplateSaveDayV1>
  saveCoachProgramTemplateDayV2?(input: { template: Phase4Uuid; day_id: Phase4Uuid; expected_builder_version: number; day: RichTemplateDaySave }): Promise<ProgramTemplateSaveDayV2Result>
  appendCoachProgramTemplateWeekV1(input: { template: Phase4Uuid; expected_builder_version: number }): Promise<ProgramTemplateAppendWeekV1>
  copyCoachProgramTemplateWeekV1(input: { request_id: Phase4Uuid; template: Phase4Uuid; source_week_id: Phase4Uuid; destination_week_id: Phase4Uuid; expected_builder_version: number }): Promise<ProgramTemplateCopyWeekV1>
  copyCoachProgramTemplateWeekV2(input: { request_id: Phase4Uuid; template: Phase4Uuid; source_week_id: Phase4Uuid; destination_week_id: Phase4Uuid; expected_builder_version: number }): Promise<ProgramTemplateCopyWeekV2>
  saveCoachProgramAsTemplateV1(input: { request_id: Phase4Uuid; program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; template_name: string }): Promise<ProgramTemplateSnapshotV1>
  saveCoachProgramAsTemplateV2(input: { request_id: Phase4Uuid; program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; template_name: string }): Promise<ProgramTemplateSnapshotV2>
  applyCoachProgramTemplateV1(input: { request_id: Phase4Uuid; template: Phase4Uuid; expected_template_builder_version: number; athlete: Phase4Uuid; program_name: string; start_on: string }): Promise<ProgramTemplateApplyV1>
  applyCoachProgramTemplateV2(input: { request_id: Phase4Uuid; template: Phase4Uuid; expected_template_builder_version: number; athlete: Phase4Uuid; program_name: string; start_on: string; preview_fingerprint: string }): Promise<ProgramTemplateApplyV2>
  setCoachProgramTemplateArchivedV1(input: { template: Phase4Uuid; expected_builder_version: number; archived: boolean }): Promise<ProgramTemplateArchiveV1>
}

// Phase 6 program lifecycle is separately capability-gated so an incomplete
// Worker/RPC rollout cannot alter the established Phase 5.5 Plans view.
export interface Phase6ProgramArchiveApi {
  getCoachDashboardAssignmentsPageV2(input: { gym: Phase4Uuid; athlete: Phase4Uuid; lifecycle_filter: 'all' | CoachDashboardLifecycleBucket; archive_visibility: CoachDashboardArchiveVisibility; cursor: CoachDashboardAssignmentsCursor | null; page_size: number; expected_read_token: CoachDashboardAssignmentsReadTokenV2 | null }): Promise<CoachDashboardAssignmentsPageV2>
  archiveCoachProgramV1(input: { program: Phase4Uuid; expected_program_status: 'draft' | 'active'; expected_archive_generation: SignedBigintDecimal }): Promise<CoachProgramArchiveV1Result>
  restoreCoachProgramV1(input: { program: Phase4Uuid; expected_archive_generation: SignedBigintDecimal }): Promise<CoachProgramArchiveV1Result>
}

export interface Phase55AssignmentLifecycleApi {
  createCalendarProgramV2(input: CreateCalendarProgramInput): Promise<CreateCalendarProgramV2Result[]>
  activateAndPublishCoachAssignmentV1(input: ActivateAndPublishCoachAssignmentV1Input): Promise<ActivateAndPublishCoachAssignmentV1Result>
}

export interface Phase55WorkoutTemplateLibraryApi {
  getCoachWorkoutTemplateLibraryPageV1(input: { gym: string; lifecycle: WorkoutTemplateLifecycleV1; search_text: string | null; cursor: WorkoutTemplateCursorV1 | null; page_size: number; expected_read_token: WorkoutTemplateReadTokenV1 | null }): Promise<WorkoutTemplateLibraryPageV1>
  getCoachWorkoutTemplateLibraryPageV2?(input: { gym: string; lifecycle: WorkoutTemplateLifecycleV1; search_text: string | null; cursor: WorkoutTemplateCursorV1 | null; page_size: number; expected_read_token: WorkoutTemplateReadTokenV1 | null }): Promise<WorkoutTemplateLibraryPageV2>
  createCoachWorkoutTemplateV1(input: { gym: string; template_name: string }): Promise<WorkoutTemplateCreateV1Result>
  getCoachWorkoutTemplateDetailV1(input: { template: string; expected_read_token: WorkoutTemplateReadTokenV1 | null }): Promise<WorkoutTemplateDetailV1>
  getCoachWorkoutTemplateDetailV2?(input: { template: string; expected_read_token: WorkoutTemplateReadTokenV1 | null }): Promise<WorkoutTemplateDetailV2>
  getCoachWorkoutTemplateDayV1(input: { template: string; expected_read_token: WorkoutTemplateReadTokenV1 | null }): Promise<WorkoutTemplateDayV1>
  saveCoachWorkoutTemplateDayV1(input: { template: string; expected_builder_version: number; day: SaveCoachProgramDayV3 }): Promise<WorkoutTemplateSaveDayV1Result>
  getCoachWorkoutTemplateDayV2?(input: { template: Phase4Uuid; expected_read_token: string | null }): Promise<WorkoutTemplateDayV2>
  saveCoachWorkoutTemplateDayV2?(input: { template: Phase4Uuid; expected_builder_version: number; day: RichTemplateDaySave }): Promise<WorkoutTemplateSaveDayV2Result>
  setCoachWorkoutTemplateReadinessV1(input: { template: string; expected_builder_version: number; target_readiness: 'draft' | 'ready' }): Promise<WorkoutTemplateReadinessV1Result>
  setCoachWorkoutTemplateReadinessV2?(input: { template: string; expected_builder_version: number; target_readiness: 'draft' | 'ready' }): Promise<WorkoutTemplateReadinessV2Result>
  archiveCoachWorkoutTemplateV1(input: { template: string; expected_builder_version: number }): Promise<WorkoutTemplateArchiveV1Result>
  restoreCoachWorkoutTemplateV1(input: { template: string; expected_builder_version: number }): Promise<WorkoutTemplateArchiveV1Result>
  applyCoachWorkoutTemplateV1(input: ApplyWorkoutTemplateV1Input): Promise<ApplyWorkoutTemplateV1Result>
  applyCoachWorkoutTemplateV2?(input: ApplyWorkoutTemplateV1Input): Promise<ApplyWorkoutTemplateV2Result>
  previewCoachTemplatePercentV1?(input: { template: string; athlete: string; expected_template_builder_version: number; program: string | null; expected_program_builder_version: number | null }): Promise<TemplatePercentPreviewV1>
  applyCoachWorkoutTemplateV3?(input: ApplyWorkoutTemplateV1Input & { preview_fingerprint: string }): Promise<ApplyWorkoutTemplateV3Result>
  applyCoachWorkoutTemplateV4?(input: ApplyWorkoutTemplateV4Input): Promise<ApplyWorkoutTemplateV4Result>
}

// Phase 5 remains an explicit opt-in capability surface until its Worker and
// migration are deployed. Keeping it separate avoids silently requiring
// existing ConnectedCoachApiV4 consumers to enable undeployed routes.
export interface Phase5CorrectionApi {
  authorCalendarDayV1(input: AuthorCalendarDayV1Input): Promise<AuthorCalendarDayV1Result>
  listExerciseNameHistoryV1(input: ExerciseNameHistoryV1Input): Promise<ExerciseNameHistoryV1Result>
  recordExerciseNameHistoryV1(input: RecordExerciseNameHistoryV1Input): Promise<RecordExerciseNameHistoryV1Result>
  saveCoachProgramDayV2AndRecordHistory(input: SaveCoachProgramDayV2Input): Promise<SaveCoachProgramDayV2WithHistoryResult>
  getCoachAssignmentDetailV5(input: { assignment: Phase4Uuid }): Promise<CoachAssignmentDetailV5>
  getCoachAssignmentDayV5(input: { assignment: Phase4Uuid; day_identity_token: Phase4Uuid; expected_detail_read_token: string }): Promise<CoachAssignmentDayV5>
  saveCoachProgramDayV3(input: SaveCoachProgramDayV3Input): Promise<SaveCoachProgramDayV3Result>
  getCoachAssignmentDayV6?(input: { assignment: Phase4Uuid; day_identity_token: Phase4Uuid; expected_detail_read_token: string }): Promise<CoachAssignmentDayV6>
  saveCoachProgramDayV4?(input: { program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; week_identity_token: Phase4Uuid; day: RichProgramDaySave }): Promise<SaveCoachProgramDayV4Result>
  previewBuilderCopyV2(input: PreviewBuilderCopyV2Input): Promise<PreviewBuilderCopyV2Result>
  applyBuilderCopyV2(input: ApplyBuilderCopyV2Input): Promise<ApplyBuilderCopyV2Result>
  previewBuilderProgressionV2(input: PreviewBuilderProgressionV2Input): Promise<PreviewBuilderProgressionV2Result>
  applyBuilderProgressionV2(input: ApplyBuilderProgressionV2Input): Promise<ApplyBuilderProgressionV2Result>
}

type ApiOptions = {
  mode: AppMode
  baseUrl?: string
  getAccessToken(): Promise<string | null>
  onSessionExpired?(failedAccessToken: string | null): void
  request?: typeof fetch
}

export type CoachDashboardRosterReadTokenV4 = Omit<CoachDashboardRosterReadTokenV2, 'page_kind'> & { page_kind: 'coach_dashboard_roster_v4' }
export type CoachDashboardRosterItemV4 = CoachDashboardRosterItemV2 & { resumable_plan_count: number; resumable_plan: (Omit<CoachDashboardCurrentAssignment, 'lifecycle_bucket'> & { lifecycle_bucket: 'unreleased_draft' }) | null }
export type CoachDashboardRosterPageV4 = Omit<CoachDashboardRosterPageV2, 'contract_version' | 'items' | 'dashboard_read_token' | 'next_read_token'> & { contract_version: 4; items: CoachDashboardRosterItemV4[]; dashboard_read_token: CoachDashboardRosterReadTokenV4; next_read_token: CoachDashboardRosterReadTokenV4 | null }
export type CoachTemplateTotalsV2 = { contract_version: 2; template_id: string; builder_version: number; days: Array<{ week_id: string; week_ordinal: number; day_id: string; day_ordinal: number; sets_min: number; sets_max: number }> }
export type CoachTemplateReadinessV1 = { contract_version: 1; program_id: string; assignment_id: string; ready: boolean; issues: Array<{ week_identity_token: string; week_ordinal: number; day_identity_token: string; day_ordinal: number; label: string | null; code: 'workout_incomplete' }> }
export type CoachClientRemovalContextV1 = { contract_version: 1; athlete_id: string; membership_state: 'active' | 'former'; pairing_epoch: string; removed: boolean }
export type CoachClientRemovalInputV1 = { request_id: string; gym: string; athlete: string; expected_membership_state: 'active' | 'former'; expected_pairing_epoch: string; removed: boolean }
export type CoachRemovedClientsV1 = { contract_version: 1; items: Array<{ athlete_id: string; name: string; membership_state: 'former'; pairing_epoch: string; removed_at: string | null }>; next_cursor: string | null }
export type CoachPersonalTrackingRequestV2 = { request_id: string; athlete_id: string; athlete_name: string; assignment_id: string; logical_exercise_id: string; exercise_name: string; status: 'pending' | 'resolved' | 'dismissed'; exercise_id: string | null; review_version: number; created_at: string }
export type CoachPersonalTrackingRequestsV2 = { contract_version: 2; items: CoachPersonalTrackingRequestV2[]; next_cursor: string | null }
export type CoachPersonalTrackingReviewInputV2 = { request_id: string; gym: string; mapping_request_id: string; expected_review_version: number; expected_tracking_version: number; action: 'resolve' | 'dismiss'; exercise_id: string | null }
export type CoachPersonalTrackingReviewV2 = { contract_version: 2; request_id: string; status: 'resolved' | 'dismissed'; exercise_id: string | null; review_version: number; tracking_version: number }
export type PreviewBuilderWeekCopyV3Input = PreviewBuilderCopyV1Input & { copy_kind: 'week'; source: { week_identity_token: string }; destinations: Array<{ week_identity_token: string; collision_policy: 'preserve' | 'replace' }> }
export type PreviewBuilderWeekCopyV3Result = PreviewBuilderCopyV1Result & { contract_version: 3; preview_guard: string }
export type ApplyBuilderWeekCopyV3Input = PreviewBuilderWeekCopyV3Input & { request_id: string; preview_guard: string }
export type ApplyBuilderWeekCopyV3Result = ApplyBuilderCopyV1Result & { contract_version: 3; preview_guard: string }
export interface October18CoachApi {
  previewBuilderWeekCopyV3(input: PreviewBuilderWeekCopyV3Input): Promise<PreviewBuilderWeekCopyV3Result>
  applyBuilderWeekCopyV3(input: ApplyBuilderWeekCopyV3Input): Promise<ApplyBuilderWeekCopyV3Result>
  getCoachDashboardRosterPageV4(input: { gym: string; group_kind: CoachDashboardRosterGroup; search_text: string | null; cursor: CoachDashboardRosterCursor | null; page_size: number; expected_read_token: CoachDashboardRosterReadTokenV4 | null }): Promise<CoachDashboardRosterPageV4>
  getCoachProgramTemplateTotalsV2(input: { template: string }): Promise<CoachTemplateTotalsV2>
  getCoachProgramTemplateReadinessV1(input: { program: string; assignment: string }): Promise<CoachTemplateReadinessV1>
  getCoachClientRemovalContextV1(input: { gym: string; athlete: string }): Promise<CoachClientRemovalContextV1>
  setCoachClientRemovedV1(input: CoachClientRemovalInputV1): Promise<CoachClientRemovalContextV1>
  getCoachRemovedClientsV1(input: { gym: string; cursor: string | null; page_size: number }): Promise<CoachRemovedClientsV1>
  getCoachPersonalTrackingRequestsV2(input: { gym: string; athlete: string | null; cursor: string | null; page_size: number }): Promise<CoachPersonalTrackingRequestsV2>
  reviewCoachPersonalTrackingRequestV2(input: CoachPersonalTrackingReviewInputV2): Promise<CoachPersonalTrackingReviewV2>
}

export type CoachApiErrorCode = 'session_expired' | 'stale_builder_version' | 'day_locked'
  | 'serialization_retry' | 'program_archived' | 'access_denied' | 'unsupported_shape'
  | 'individual_set_limit' | 'day_payload_too_large' | 'invalid_day' | 'identity_conflict'
  | 'request_body_too_large' | 'request_id_drift' | 'copy_source_empty' | 'copy_same_scope'
  | 'copy_preview_changed' | 'copy_collision_review_required' | 'tracking_required'
  | 'progression_scope_invalid' | 'progression_preview_changed' | 'program_not_ready' | 'undo_already_published' | 'undo_expired'
  | 'undo_historical' | 'undo_already_used' | 'navigation_read_changed' | 'assignment_read_changed'
  | 'builder_operation_too_large' | 'builder_result_too_large' | 'navigation_result_too_large'
  | 'assignment_detail_too_large' | 'assignment_day_too_large' | 'navigation_generation_invariant'
  | 'invalid_builder_operation' | 'request_rejected' | 'network_unavailable' | 'invalid_response'
  | 'day_slot_already_authored' | 'calendar_structure_invalid' | 'dashboard_read_changed' | 'dashboard_result_too_large'
  | 'contract_upgrade_required' | 'current_assignment_drift' | 'assignment_not_active'
  | 'assignment_not_activatable' | 'active_assignment_conflict'
  | 'workout_template_stale' | 'workout_template_ineligible' | 'workout_template_unsupported'
  | 'workout_template_destination_not_empty' | 'workout_template_name_reserved'
  | 'workout_template_incomplete' | 'workout_template_query_invalid' | 'program_archive_stale' | 'program_archive_ineligible'
  | 'invalid_superset' | 'publish_scope_not_ready' | 'publish_day_scope_disabled' | 'publish_scope_changed' | 'publish_scope_already_released'
  | 'publish_scope_deleted_day' | 'publish_scope_position_changed'
  | 'program_template_stale' | 'program_template_ineligible' | 'program_template_unsupported'
  | 'program_template_name_reserved' | 'program_template_week_limit' | 'program_template_source_incomplete'
  | 'max_report_changed' | 'max_report_mapping_changed'
  | 'profile_changed' | 'candidate_evidence_changed' | 'percentage_preview_changed'
  | 'cycle_not_active' | 'cycle_workouts_incomplete'
  | 'settings_changed' | 'feature_unavailable' | 'client_membership_changed' | 'personal_review_changed' | 'personal_row_changed' | 'personal_snapshot_changed'

const coachApiErrorMessages: Record<CoachApiErrorCode, string> = {
  feature_unavailable: 'This update is not available yet. Retry shortly; your saved data is unchanged.',
  client_membership_changed: 'This client’s membership changed. Refresh and review before trying again.',
  personal_review_changed: 'This tracking request changed. Refresh and review it again.',
  personal_row_changed: 'Tracking changed. Refresh before reviewing this request.',
  personal_snapshot_changed: 'The tracking list changed. Refresh the list.',
  settings_changed: 'These details changed in another session. Review the latest details before saving again.',
  session_expired: 'A signed-in owner session is required. Sign in again.',
  stale_builder_version: 'This program changed in another session. Refresh before saving again.',
  day_locked: 'This training day is locked because the athlete has already started it; reload to review the current plan.',
  serialization_retry: 'The program changed while saving. Refresh and try again.',
  max_report_changed: 'This report has already been reviewed or replaced. Refresh the pending reports.',
  max_report_mapping_changed: 'The competition lift preset changed. Review the report before approving it.',
  profile_changed: 'The athlete’s reported max changed. Refresh before reviewing this result.',
  candidate_evidence_changed: 'The logged lift changed or was removed. Review the workout before approving this max.',
  percentage_preview_changed: 'The percentage preview changed. Review the current loads before applying.',
  cycle_not_active: 'This program is no longer the athlete’s active cycle. Refresh the program list.',
  cycle_workouts_incomplete: 'Finish or skip every workout in this cycle before closing it.',
  program_archived: 'This program is archived and cannot be edited.',
  access_denied: 'You no longer have access to edit this program.',
  unsupported_shape: 'This training day contains a prescription shape that cannot be edited here.',
  individual_set_limit: 'This exercise has more than 20 individual sets and cannot be edited here.',
  day_payload_too_large: 'This training day is too large to save.',
  invalid_day: 'This training day contains invalid values and was not saved.',
  identity_conflict: 'This training day changed while you were editing. Reload before saving again.',
  request_body_too_large: 'This save request is too large to send.',
  request_id_drift: 'This request ID was already used for different input. Start the operation again.',
  copy_source_empty: 'The selected source has no Workout or Rest content to copy.',
  copy_same_scope: 'The copy destination cannot be the source scope.',
  copy_preview_changed: 'The selected workouts changed before copying. Review the current plan and try again.',
  copy_collision_review_required: 'Review and confirm replacement before copying over an existing workout.',
  progression_scope_invalid: 'The selected progression rows changed. Refresh and select them again.',
  progression_preview_changed: 'The workouts changed while progression was being reviewed. Review the current plan and try again.',
  program_not_ready: 'This program must be marked Ready before publishing.',
  undo_already_published: 'This operation was published and can no longer be undone.',
  undo_expired: 'The undo window has expired.',
  undo_historical: 'The program changed after this operation and cannot be undone.',
  undo_already_used: 'This operation has already been undone.',
  navigation_read_changed: 'Navigation changed. Refresh the list before continuing.',
  assignment_read_changed: 'This assignment changed. Refresh before continuing.',
  builder_operation_too_large: 'The selected operation is too large.',
  builder_result_too_large: 'The coach service returned an oversized operation result.',
  navigation_result_too_large: 'The coach service returned an oversized navigation page.',
  assignment_detail_too_large: 'The coach service returned an oversized assignment detail.',
  assignment_day_too_large: 'The coach service returned an oversized assignment day.',
  navigation_generation_invariant: 'The navigation state is inconsistent. Refresh before continuing.',
  invalid_builder_operation: 'This builder operation contains invalid values.',
  tracking_required: 'Competition lifts are always tracked in Metrics.',
  day_slot_already_authored: 'This calendar slot was already authored. Refresh before continuing.',
  calendar_structure_invalid: 'This program calendar cannot safely author that day. Refresh and review the program.',
  dashboard_read_changed: 'Dashboard data changed. Refresh the list before continuing.',
  dashboard_result_too_large: 'The coach service returned an oversized dashboard page.',
  contract_upgrade_required: 'This coach app needs the current calendar update before creating a program.',
  current_assignment_drift: 'The client’s current plan changed. Refresh the current plan before activating this draft.',
  assignment_not_active: 'This assignment is no longer active for publication. Refresh the current plan.',
  assignment_not_activatable: 'This draft can no longer be activated. Refresh the current plan.',
  active_assignment_conflict: 'Another current plan was selected. Refresh the current plan before trying again.',
  workout_template_stale: 'This workout template changed. Refresh it before trying again.',
  workout_template_ineligible: 'This workout template is not ready or is no longer available.',
  workout_template_incomplete: 'Open this workout template and add a prescription to each programmed exercise before marking it Ready or adding it to a program.',
  workout_template_unsupported: 'This workout template contains a prescription shape that cannot be used here.',
  workout_template_destination_not_empty: 'This calendar day is no longer empty. Refresh before adding a workout template.',
  workout_template_name_reserved: 'That workout template name is already reserved in this gym.',
  workout_template_query_invalid: 'The workout template search could not be processed.',
  program_template_stale: 'This program template changed. Refresh it before trying again.',
  program_template_ineligible: 'This program or template is no longer available for this action. Refresh and try again.',
  program_template_source_incomplete: 'Review the listed workouts and complete their prescriptions before saving this template.',
  program_template_unsupported: 'This day has advanced prescriptions that are view-only here; the template copy remains intact.',
  program_template_name_reserved: 'That template name is already used in this gym.',
  program_template_week_limit: 'This template already has the maximum 12 weeks.',
  program_archive_stale: 'This program archive state changed. Refresh the Plans list and try again.',
  program_archive_ineligible: 'This program can no longer be archived or restored.',
  invalid_superset: 'Each superset needs at least 2 unique exercises. Add a different exercise or move the exercise out of the superset; remove repeated exercises before publishing.',
  publish_scope_not_ready: 'Finish the selected week or full program before publishing it.',
  publish_day_scope_disabled: 'Publishing one day is no longer supported. Choose a full week or the full program.',
  publish_scope_changed: 'This release selection changed. Refresh the plan and review it again.',
  publish_scope_already_released: 'This version of the selected work was already published.',
  publish_scope_deleted_day: 'A previously released day was removed. Restore that day before publishing again.',
  publish_scope_position_changed: 'The calendar order changed around a released or started workout. Restore that order before publishing again.',
  request_rejected: 'The coach request was rejected.',
  network_unavailable: 'The coach service could not be reached.',
  invalid_response: 'The coach service returned an invalid response.',
}

export class CoachApiError extends Error {
  readonly code: CoachApiErrorCode
  readonly status: number | null
  readonly requestId?: string

  constructor(code: CoachApiErrorCode, status: number | null = null, requestId?: string) {
    super(coachApiErrorMessages[code])
    this.name = 'CoachApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

const workerRequestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const phase4UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const phase4NilUuid = '00000000-0000-0000-0000-000000000000'
export const phase4OperationMaxBytes = 512 * 1024
export const phase4NavigationMaxBytes = 256 * 1024
export const phase4DetailMaxBytes = 512 * 1024
export const phase4DayMaxBytes = 1024 * 1024
const phase4ErrorMaxBytes = 16 * 1024
export const phase4DefaultRequestMaxBytes = 16 * 1024
export const phase4BuilderRequestMaxBytes = 128 * 1024
export const phase5ProgressionRequestMaxBytes = 576 * 1024
export const phase5ProgressionPreviewMaxBytes = 2 * 1024 * 1024
export const phase5SmallResultMaxBytes = 64 * 1024
export const phase5DaySaveMaxBytes = 656 * 1024

type UnknownRecord = Record<string, unknown>
type Phase4Validator<T> = (value: unknown) => value is T
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: unknown, keys: string[]): value is UnknownRecord => isRecord(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
const phase4Uuid = (value: unknown): value is string => typeof value === 'string' && value !== phase4NilUuid && phase4UuidPattern.test(value)
const phase4Hex = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const phase4Enum = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && values.some((candidate) => candidate === value)
const phase4Array = <T>(value: unknown, maximum: number, item: Phase4Validator<T>, minimum = 0): value is T[] =>
  Array.isArray(value) && value.length >= minimum && value.length <= maximum && value.every(item)
const phase4Nullable = <T>(value: unknown, item: Phase4Validator<T>): value is T | null => value === null || item(value)
const phase4Integer = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && typeof value === 'number' && value >= minimum && value <= maximum
const phase4BuilderVersion = (value: unknown): value is number => phase4Integer(value)
const phase4Int32 = (value: unknown, minimum = -2_147_483_648): value is number => phase4Integer(value, minimum, 2_147_483_647)

function phase4ScalarString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}

const phase4Text = (value: unknown, maximum: number): value is string =>
  phase4ScalarString(value) && Array.from(value).length <= maximum
const phase4NonemptyText = (value: unknown, maximum?: number): value is string =>
  phase4ScalarString(value) && value.replace(/^ +| +$/g, '').length > 0
  && (maximum === undefined || Array.from(value).length <= maximum)
const phase4AuthoredText = (value: unknown, maximum: number): value is string =>
  phase4NonemptyText(value, maximum) && /[^ \t\r\n]/u.test(value)
  && !/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
const phase4NullableText = (value: unknown, maximum: number): value is string | null =>
  value === null || phase4Text(value, maximum)
const phase4NullableAuthoredText = (value: unknown, maximum: number): value is string | null =>
  value === null || phase4AuthoredText(value, maximum)
const phase4NullableNonemptyText = (value: unknown, maximum: number): value is string | null =>
  value === null || phase4NonemptyText(value, maximum)

const signedBigintMaximum = '9223372036854775807'
function phase4CanonicalBigint(value: unknown, positive: boolean, maximumDigits = 19): value is SignedBigintDecimal {
  if (typeof value !== 'string' || !(positive ? /^[1-9][0-9]*$/ : /^(?:0|[1-9][0-9]*)$/).test(value)
    || value.length > maximumDigits) return false
  return value.length < signedBigintMaximum.length
    || (value.length === signedBigintMaximum.length && value <= signedBigintMaximum)
}
const phase4Generation = (value: unknown): value is SignedBigintDecimal => phase4CanonicalBigint(value, true)
const phase4NonnegativeBigint = (value: unknown): value is SignedBigintDecimal => phase4CanonicalBigint(value, false)

function phase4Decimal(value: unknown, minimum: number, maximum: number, scale: number): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) return false
  const rendered = Math.abs(value).toString()
  if (/[eE]/.test(rendered)) return false
  const decimal = rendered.indexOf('.')
  return decimal < 0 || rendered.length - decimal - 1 <= scale
}

function phase4Date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function phase4Timestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && phase4Date(value.slice(0, 10))
    && Number.isFinite(Date.parse(value))
}

const uniqueStrings = (values: string[]): boolean => new Set(values).size === values.length

function phase4Delivery(value: unknown): value is CoachDelivery {
  if (!exactKeys(value, ['status', 'released_at', 'expected_receipts', 'issued_receipts', 'acknowledged_receipts'])
    || !phase4Enum(value.status, ['draft', 'awaiting_device', 'preparing', 'awaiting_download', 'partially_downloaded', 'downloaded'])
    || !phase4Nullable(value.released_at, phase4Timestamp)
    || !phase4Integer(value.expected_receipts) || !phase4Integer(value.issued_receipts)
    || !phase4Integer(value.acknowledged_receipts)) return false
  return value.issued_receipts <= value.expected_receipts
    && value.acknowledged_receipts <= value.issued_receipts
}

function phase4GymsReadToken(value: unknown): value is CoachNavigationGymsReadToken {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation'])
    && value.page_kind === 'gyms' && phase4Uuid(value.principal_id)
    && phase4Uuid(value.principal_lifecycle_key) && phase4Generation(value.principal_generation)
}

function phase4RosterReadToken(value: unknown): value is CoachNavigationRosterReadToken {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id', 'gym_lifecycle_key', 'gym_generation'])
    && value.page_kind === 'roster' && phase4Uuid(value.principal_id)
    && phase4Uuid(value.principal_lifecycle_key) && phase4Generation(value.principal_generation)
    && phase4Uuid(value.gym_id) && phase4Uuid(value.gym_lifecycle_key) && phase4Generation(value.gym_generation)
}

function phase4AssignmentsReadToken(value: unknown): value is CoachNavigationAssignmentsReadToken {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id', 'gym_lifecycle_key', 'gym_generation', 'athlete_id', 'athlete_lifecycle_key', 'athlete_generation'])
    && value.page_kind === 'assignments' && phase4Uuid(value.principal_id)
    && phase4Uuid(value.principal_lifecycle_key) && phase4Generation(value.principal_generation)
    && phase4Uuid(value.gym_id) && phase4Uuid(value.gym_lifecycle_key) && phase4Generation(value.gym_generation)
    && phase4Uuid(value.athlete_id) && phase4Uuid(value.athlete_lifecycle_key) && phase4Generation(value.athlete_generation)
}

function phase4GymsCursor(value: unknown): value is CoachNavigationGymsCursor {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id'])
    && value.page_kind === 'gyms' && phase4Uuid(value.principal_id)
    && phase4Uuid(value.principal_lifecycle_key) && phase4Generation(value.principal_generation)
    && phase4Uuid(value.gym_id)
}

function phase4RosterCursor(value: unknown): value is CoachNavigationRosterCursor {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id', 'gym_lifecycle_key', 'gym_generation', 'roster_name', 'athlete_id'])
    && value.page_kind === 'roster' && phase4Uuid(value.principal_id)
    && phase4Uuid(value.principal_lifecycle_key) && phase4Generation(value.principal_generation)
    && phase4Uuid(value.gym_id) && phase4Uuid(value.gym_lifecycle_key) && phase4Generation(value.gym_generation)
    && phase4NonemptyText(value.roster_name) && phase4Uuid(value.athlete_id)
}

function phase4AssignmentsCursor(value: unknown): value is CoachNavigationAssignmentsCursor {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id', 'gym_lifecycle_key', 'gym_generation', 'athlete_id', 'athlete_lifecycle_key', 'athlete_generation', 'assigned_at', 'assignment_id'])
    && value.page_kind === 'assignments' && phase4Uuid(value.principal_id)
    && phase4Uuid(value.principal_lifecycle_key) && phase4Generation(value.principal_generation)
    && phase4Uuid(value.gym_id) && phase4Uuid(value.gym_lifecycle_key) && phase4Generation(value.gym_generation)
    && phase4Uuid(value.athlete_id) && phase4Uuid(value.athlete_lifecycle_key) && phase4Generation(value.athlete_generation)
    && phase4Timestamp(value.assigned_at) && phase4Uuid(value.assignment_id)
}

const phase4GymItem: Phase4Validator<CoachNavigationGymItem> = (value): value is CoachNavigationGymItem =>
  exactKeys(value, ['gym_id', 'gym_name', 'role']) && phase4Uuid(value.gym_id)
  && phase4NonemptyText(value.gym_name, 120) && phase4Enum(value.role, ['owner', 'admin', 'coach'])

const phase4RosterItem: Phase4Validator<CoachNavigationRosterItem> = (value): value is CoachNavigationRosterItem =>
  exactKeys(value, ['gym_id', 'athlete_id', 'roster_name', 'roster_status', 'active_device_count'])
  && phase4Uuid(value.gym_id) && phase4Uuid(value.athlete_id) && phase4NonemptyText(value.roster_name)
  && phase4Enum(value.roster_status, ['active', 'former']) && phase4Integer(value.active_device_count)

const phase4AssignmentItem: Phase4Validator<CoachNavigationAssignmentItem> = (value): value is CoachNavigationAssignmentItem =>
  exactKeys(value, ['gym_id', 'athlete_id', 'program_id', 'assignment_id', 'program_name', 'program_status', 'assignment_status', 'builder_version', 'delivery'])
  && phase4Uuid(value.gym_id) && phase4Uuid(value.athlete_id) && phase4Uuid(value.program_id)
  && phase4Uuid(value.assignment_id) && phase4NonemptyText(value.program_name, 120)
  && phase4Enum(value.program_status, ['draft', 'active', 'archived'])
  && phase4Enum(value.assignment_status, ['active', 'paused', 'completed', 'revoked'])
  && phase4BuilderVersion(value.builder_version) && phase4Delivery(value.delivery)

function phase4NavigationGymsPage(value: unknown): value is CoachNavigationGymsPageV4 {
  if (!(exactKeys(value, ['navigation_read_token', 'items', 'next_cursor', 'has_more'])
    && phase4GymsReadToken(value.navigation_read_token) && phase4Array(value.items, 20, phase4GymItem)
    && phase4Nullable(value.next_cursor, phase4GymsCursor) && typeof value.has_more === 'boolean'
    && value.has_more === (value.next_cursor !== null))) return false
  return value.next_cursor === null || (value.items.length > 0
    && value.next_cursor.page_kind === value.navigation_read_token.page_kind
    && value.next_cursor.principal_id === value.navigation_read_token.principal_id
    && value.next_cursor.principal_lifecycle_key === value.navigation_read_token.principal_lifecycle_key
    && value.next_cursor.principal_generation === value.navigation_read_token.principal_generation
    && value.next_cursor.gym_id === value.items[value.items.length - 1].gym_id)
}

function phase4NavigationRosterPage(value: unknown, gym: Phase4Uuid): value is CoachNavigationRosterPageV4 {
  if (!(exactKeys(value, ['navigation_read_token', 'items', 'next_cursor', 'has_more'])
    && phase4RosterReadToken(value.navigation_read_token) && phase4Array(value.items, 50, phase4RosterItem)
    && phase4Nullable(value.next_cursor, phase4RosterCursor) && typeof value.has_more === 'boolean'
    && value.has_more === (value.next_cursor !== null) && value.navigation_read_token.gym_id === gym
    && value.items.every((item) => item.gym_id === gym))) return false
  return value.next_cursor === null || (value.items.length > 0
    && value.next_cursor.page_kind === value.navigation_read_token.page_kind
    && value.next_cursor.principal_id === value.navigation_read_token.principal_id
    && value.next_cursor.principal_lifecycle_key === value.navigation_read_token.principal_lifecycle_key
    && value.next_cursor.principal_generation === value.navigation_read_token.principal_generation
    && value.next_cursor.gym_id === value.navigation_read_token.gym_id
    && value.next_cursor.gym_lifecycle_key === value.navigation_read_token.gym_lifecycle_key
    && value.next_cursor.gym_generation === value.navigation_read_token.gym_generation
    && value.next_cursor.roster_name === value.items[value.items.length - 1].roster_name
    && value.next_cursor.athlete_id === value.items[value.items.length - 1].athlete_id)
}

function phase4NavigationAssignmentsPage(value: unknown, gym: Phase4Uuid, athlete: Phase4Uuid): value is CoachNavigationAssignmentsPageV4 {
  if (!(exactKeys(value, ['navigation_read_token', 'items', 'next_cursor', 'has_more'])
    && phase4AssignmentsReadToken(value.navigation_read_token) && phase4Array(value.items, 50, phase4AssignmentItem)
    && phase4Nullable(value.next_cursor, phase4AssignmentsCursor) && typeof value.has_more === 'boolean'
    && value.has_more === (value.next_cursor !== null) && value.navigation_read_token.gym_id === gym
    && value.navigation_read_token.athlete_id === athlete
    && value.items.every((item) => item.gym_id === gym && item.athlete_id === athlete))) return false
  return value.next_cursor === null || (value.items.length > 0
    && value.next_cursor.page_kind === value.navigation_read_token.page_kind
    && value.next_cursor.principal_id === value.navigation_read_token.principal_id
    && value.next_cursor.principal_lifecycle_key === value.navigation_read_token.principal_lifecycle_key
    && value.next_cursor.principal_generation === value.navigation_read_token.principal_generation
    && value.next_cursor.gym_id === value.navigation_read_token.gym_id
    && value.next_cursor.gym_lifecycle_key === value.navigation_read_token.gym_lifecycle_key
    && value.next_cursor.gym_generation === value.navigation_read_token.gym_generation
    && value.next_cursor.athlete_id === value.navigation_read_token.athlete_id
    && value.next_cursor.athlete_lifecycle_key === value.navigation_read_token.athlete_lifecycle_key
    && value.next_cursor.athlete_generation === value.navigation_read_token.athlete_generation
    && value.next_cursor.assignment_id === value.items[value.items.length - 1].assignment_id)
}

const phase55DashboardTokenBase = (value: unknown, pageKind: 'coach_dashboard_roster_v1' | 'coach_dashboard_roster_v2' | 'coach_dashboard_assignments_v1' | 'coach_dashboard_assignments_v2'): value is UnknownRecord =>
  isRecord(value) && value.page_kind === pageKind && phase4Uuid(value.principal_id)
  && phase4Uuid(value.principal_lifecycle_key) && phase4Generation(value.principal_generation)
  && phase4Uuid(value.gym_id) && phase4Uuid(value.gym_lifecycle_key) && phase4Generation(value.gym_generation)
  && phase4Generation(value.materialization_generation) && phase4Date(value.materialization_as_of_date)
  && phase4Enum(value.visibility_kind, ['gym', 'coach']) && phase4Generation(value.page_size) && Number(value.page_size) >= 1 && Number(value.page_size) <= 50

function phase55RosterToken(value: unknown): value is CoachDashboardRosterReadToken {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id', 'gym_lifecycle_key', 'gym_generation', 'materialization_generation', 'materialization_as_of_date', 'visibility_kind', 'group_kind', 'search_text', 'page_size', 'cursor_roster_name', 'cursor_athlete_id'])
    && phase55DashboardTokenBase(value, 'coach_dashboard_roster_v1')
    && phase4Enum(value.group_kind, ['all', 'needs_programming', 'current_clients'])
    && phase4Nullable(value.search_text, value => phase4Text(value, 80))
    && phase4Nullable(value.cursor_roster_name, value => phase4NonemptyText(value, 120))
    && phase4Nullable(value.cursor_athlete_id, phase4Uuid)
    && (value.cursor_roster_name === null) === (value.cursor_athlete_id === null)
}
function phase7RosterToken(value: unknown): value is CoachDashboardRosterReadTokenV2 {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id', 'gym_lifecycle_key', 'gym_generation', 'materialization_generation', 'materialization_as_of_date', 'programming_snapshot', 'visibility_kind', 'group_kind', 'search_text', 'page_size', 'cursor_roster_name', 'cursor_athlete_id'])
    && phase55DashboardTokenBase(value, 'coach_dashboard_roster_v2')
    && typeof value.programming_snapshot === 'string' && /^[0-9a-f]{32}$/u.test(value.programming_snapshot)
    && phase4Enum(value.group_kind, ['all', 'needs_programming', 'current_clients'])
    && phase4Nullable(value.search_text, value => phase4Text(value, 80))
    && phase4Nullable(value.cursor_roster_name, value => phase4NonemptyText(value, 120))
    && phase4Nullable(value.cursor_athlete_id, phase4Uuid)
    && (value.cursor_roster_name === null) === (value.cursor_athlete_id === null)
}

function phase55AssignmentsToken(value: unknown): value is CoachDashboardAssignmentsReadToken {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id', 'gym_lifecycle_key', 'gym_generation', 'athlete_id', 'athlete_lifecycle_key', 'athlete_generation', 'materialization_generation', 'materialization_as_of_date', 'visibility_kind', 'lifecycle_filter', 'page_size', 'cursor_assigned_at', 'cursor_assignment_id'])
    && phase55DashboardTokenBase(value, 'coach_dashboard_assignments_v1')
    && phase4Uuid(value.athlete_id) && phase4Uuid(value.athlete_lifecycle_key) && phase4Generation(value.athlete_generation)
    && phase4Enum(value.lifecycle_filter, ['all', 'current_active', 'unreleased_draft', 'unreleased_future', 'historical_released', 'completed_or_revoked'])
    && phase4Nullable(value.cursor_assigned_at, phase4Timestamp) && phase4Nullable(value.cursor_assignment_id, phase4Uuid)
    && (value.cursor_assigned_at === null) === (value.cursor_assignment_id === null)
}

function phase6AssignmentsToken(value: unknown): value is CoachDashboardAssignmentsReadTokenV2 {
  return exactKeys(value, ['page_kind', 'principal_id', 'principal_lifecycle_key', 'principal_generation', 'gym_id', 'gym_lifecycle_key', 'gym_generation', 'athlete_id', 'athlete_lifecycle_key', 'athlete_generation', 'materialization_generation', 'materialization_as_of_date', 'visibility_kind', 'lifecycle_filter', 'archive_visibility', 'page_size', 'cursor_assigned_at', 'cursor_assignment_id'])
    && phase55DashboardTokenBase(value, 'coach_dashboard_assignments_v2')
    && phase4Uuid(value.athlete_id) && phase4Uuid(value.athlete_lifecycle_key) && phase4Generation(value.athlete_generation)
    && phase4Enum(value.lifecycle_filter, ['all', 'current_active', 'unreleased_draft', 'unreleased_future', 'historical_released', 'completed_or_revoked'])
    && phase4Enum(value.archive_visibility, ['working', 'archived'])
    && phase4Nullable(value.cursor_assigned_at, phase4Timestamp) && phase4Nullable(value.cursor_assignment_id, phase4Uuid)
    && (value.cursor_assigned_at === null) === (value.cursor_assignment_id === null)
}

const phase55RosterCursor: Phase4Validator<CoachDashboardRosterCursor> = (value): value is CoachDashboardRosterCursor =>
  exactKeys(value, ['roster_name', 'athlete_id']) && phase4NonemptyText(value.roster_name, 120) && phase4Uuid(value.athlete_id)
const phase55AssignmentsCursor: Phase4Validator<CoachDashboardAssignmentsCursor> = (value): value is CoachDashboardAssignmentsCursor =>
  exactKeys(value, ['assigned_at', 'assignment_id']) && phase4Timestamp(value.assigned_at) && phase4Uuid(value.assignment_id)
const phase55LifecycleCounts: Phase4Validator<Record<CoachDashboardLifecycleBucket, number>> = (value): value is Record<CoachDashboardLifecycleBucket, number> =>
  exactKeys(value, ['current_active', 'unreleased_draft', 'unreleased_future', 'historical_released', 'completed_or_revoked'])
  && Object.values(value).every(item => phase4Integer(item))
const phase55CurrentAssignment: Phase4Validator<CoachDashboardCurrentAssignment> = (value): value is CoachDashboardCurrentAssignment =>
  exactKeys(value, ['assignment_id', 'program_id', 'program_name', 'program_status', 'assigned_at', 'start_on', 'end_on', 'lifecycle_bucket'])
  && phase4Uuid(value.assignment_id) && phase4Uuid(value.program_id) && phase4Nullable(value.program_name, value => phase4Text(value, 120))
  && phase4Nullable(value.program_status, value => phase4Enum(value, ['draft', 'active', 'archived']))
  && phase4Nullable(value.assigned_at, phase4Timestamp) && phase4Nullable(value.start_on, phase4Date) && phase4Nullable(value.end_on, phase4Date)
  && value.lifecycle_bucket === 'current_active'
const phase55RosterItem: Phase4Validator<CoachDashboardRosterItem> = (value): value is CoachDashboardRosterItem =>
  exactKeys(value, ['athlete_id', 'roster_name', 'roster_status', 'has_active_assignment', 'current_assignment_id', 'current_assignment_available', 'current_assignment', 'lifecycle_counts', 'future_or_draft_plan_count'])
  && phase4Uuid(value.athlete_id) && phase4NonemptyText(value.roster_name, 120) && phase4Enum(value.roster_status, ['active', 'former'])
  && typeof value.has_active_assignment === 'boolean' && phase4Nullable(value.current_assignment_id, phase4Uuid) && typeof value.current_assignment_available === 'boolean'
  && phase4Nullable(value.current_assignment, phase55CurrentAssignment) && phase55LifecycleCounts(value.lifecycle_counts)
  && phase4Integer(value.future_or_draft_plan_count) && value.has_active_assignment === (value.lifecycle_counts.current_active > 0) && (value.current_assignment_id !== null) === (value.lifecycle_counts.current_active === 1)
  && value.current_assignment_available === (value.current_assignment !== null)
  && value.future_or_draft_plan_count === value.lifecycle_counts.unreleased_draft + value.lifecycle_counts.unreleased_future
  && (value.current_assignment === null || (value.lifecycle_counts.current_active === 1 && value.current_assignment_id === value.current_assignment.assignment_id))
const phase7RosterItem: Phase4Validator<CoachDashboardRosterItemV2> = (value): value is CoachDashboardRosterItemV2 => {
  if (!isRecord(value) || !exactKeys(value, ['athlete_id', 'roster_name', 'roster_status', 'has_active_assignment', 'current_assignment_id', 'current_assignment_available', 'current_assignment', 'lifecycle_counts', 'future_or_draft_plan_count', 'program_readiness', 'programming_state'])) return false
  const base = { ...value }
  delete base.program_readiness
  delete base.programming_state
  if (!phase55RosterItem(base)
    || !phase4Nullable(value.program_readiness, readiness => phase4Enum(readiness, ['draft', 'ready']))
    || !phase4Enum(value.programming_state, ['needs_programming', 'current'])) return false
  const currentCount = base.lifecycle_counts.current_active
  return (value.program_readiness !== null) === (currentCount === 1)
    // Publication can keep an assignment current while its editable draft is not ready.
    && (value.programming_state !== 'current' || currentCount === 1 && base.current_assignment_available)
    && (currentCount !== 1 || value.program_readiness !== 'ready' || value.programming_state === 'current')
}
const phase55AssignmentItem: Phase4Validator<CoachDashboardAssignmentItem> = (value): value is CoachDashboardAssignmentItem =>
  exactKeys(value, ['assignment_id', 'program_id', 'program_name', 'program_status', 'assignment_status', 'assigned_at', 'start_on', 'end_on', 'has_release', 'lifecycle_bucket'])
  && phase4Uuid(value.assignment_id) && phase4Nullable(value.program_id, phase4Uuid) && phase4Nullable(value.program_name, value => phase4Text(value, 120))
  && phase4Nullable(value.program_status, value => phase4Enum(value, ['draft', 'active', 'archived']))
  && phase4Enum(value.assignment_status, ['active', 'paused', 'completed', 'revoked']) && phase4Timestamp(value.assigned_at)
  && phase4Nullable(value.start_on, phase4Date) && phase4Nullable(value.end_on, phase4Date) && typeof value.has_release === 'boolean'
  && phase4Enum(value.lifecycle_bucket, ['current_active', 'unreleased_draft', 'unreleased_future', 'historical_released', 'completed_or_revoked'])
function phase6AssignmentItem(value: unknown): value is CoachDashboardAssignmentItemV2 {
  if (!exactKeys(value, ['assignment_id', 'program_id', 'program_name', 'program_status', 'assignment_status', 'assigned_at', 'start_on', 'end_on', 'has_release', 'lifecycle_bucket', 'archived_at', 'archive_generation', 'archive_eligible', 'archive_blocker'])
    || !phase4Nullable(value.archived_at, phase4Timestamp) || !phase4NonnegativeBigint(value.archive_generation)
    || typeof value.archive_eligible !== 'boolean'
    || !phase4Nullable(value.archive_blocker, value => phase4Enum(value, ['current_program', 'restore_state_missing']))
    || !phase4Uuid(value.program_id) || !phase4NonemptyText(value.program_name, 120)
    || !phase4Enum(value.program_status, ['draft', 'active', 'archived'])) return false
  const base = { ...value }
  delete base.archived_at; delete base.archive_generation; delete base.archive_eligible; delete base.archive_blocker
  return phase55AssignmentItem(base) && (value.program_status === 'archived') === (value.archived_at !== null)
}

const phase55AssignmentLifecycle = (item: CoachDashboardAssignmentItem, asOf: string) =>
  (item.lifecycle_bucket === 'current_active') === (item.assignment_status === 'active')
  && (item.lifecycle_bucket === 'completed_or_revoked') === (item.assignment_status === 'completed' || item.assignment_status === 'revoked')
  && (item.lifecycle_bucket !== 'historical_released' || (item.assignment_status === 'paused' && item.has_release))
  && (!['unreleased_draft', 'unreleased_future'].includes(item.lifecycle_bucket) || (item.assignment_status === 'paused' && !item.has_release))
  && (item.lifecycle_bucket !== 'unreleased_future' || (item.start_on !== null && item.start_on > asOf))
  && (item.lifecycle_bucket !== 'unreleased_draft' || item.start_on === null || item.start_on <= asOf)

const uniqueBy = <T>(items: T[], key: (item: T) => string) => new Set(items.map(key)).size === items.length
const utf8COrder = (left: string, right: string) => {
  const leftBytes = new TextEncoder().encode(left), rightBytes = new TextEncoder().encode(right)
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index]
  return leftBytes.length - rightBytes.length
}
const rosterOrder = (items: CoachDashboardRosterItem[]) => items.every((item, index) => index === 0 || utf8COrder(items[index - 1].roster_name, item.roster_name) < 0 || (items[index - 1].roster_name === item.roster_name && items[index - 1].athlete_id < item.athlete_id))
const assignmentOrder = (items: CoachDashboardAssignmentItem[]) => items.every((item, index) => index === 0 || items[index - 1].assigned_at > item.assigned_at || (items[index - 1].assigned_at === item.assigned_at && items[index - 1].assignment_id > item.assignment_id))
const recentActivityOrder = (items: CoachRecentActivityItemV1[]) => items.every((item, index) => index === 0 || items[index - 1].recorded_at > item.recorded_at || (items[index - 1].recorded_at === item.recorded_at && items[index - 1].activity_id > item.activity_id))

const sameTokenExcept = (left: UnknownRecord, right: UnknownRecord, excluded: string[]) => Object.keys(left).length === Object.keys(right).length
  && Object.keys(left).every(key => excluded.includes(key) || JSON.stringify(left[key]) === JSON.stringify(right[key]))

function phase55RosterPage(value: unknown, input: Parameters<Phase55DashboardReadsApi['getCoachDashboardRosterPageV1']>[0]): value is CoachDashboardRosterPageV1 {
  return exactKeys(value, ['contract_version', 'visibility_kind', 'server_as_of_date', 'dashboard_read_token', 'items', 'has_more', 'next_cursor', 'next_read_token'])
    && value.contract_version === 1 && phase4Enum(value.visibility_kind, ['gym', 'coach']) && phase4Date(value.server_as_of_date)
    && phase55RosterToken(value.dashboard_read_token) && value.dashboard_read_token.gym_id === input.gym
    && value.dashboard_read_token.group_kind === input.group_kind && value.dashboard_read_token.search_text === input.search_text
    && Number(value.dashboard_read_token.page_size) === input.page_size && value.visibility_kind === value.dashboard_read_token.visibility_kind
    && value.server_as_of_date === value.dashboard_read_token.materialization_as_of_date
    && (input.expected_read_token === null ? value.dashboard_read_token.cursor_roster_name === null && value.dashboard_read_token.cursor_athlete_id === null : JSON.stringify(value.dashboard_read_token) === JSON.stringify(input.expected_read_token))
    && phase4Array(value.items, 50, phase55RosterItem) && uniqueBy(value.items, item => item.athlete_id) && rosterOrder(value.items)
    && value.items.every(item => input.group_kind === 'needs_programming' ? item.lifecycle_counts.current_active === 0 : item.lifecycle_counts.current_active > 0) && typeof value.has_more === 'boolean' && (!value.has_more || value.items.length === input.page_size)
    && phase4Nullable(value.next_cursor, phase55RosterCursor) && phase4Nullable(value.next_read_token, phase55RosterToken)
    && value.has_more === (value.next_cursor !== null) && value.has_more === (value.next_read_token !== null)
    && (value.next_cursor === null || (value.items.length > 0 && value.next_cursor.roster_name === value.items[value.items.length - 1].roster_name && value.next_cursor.athlete_id === value.items[value.items.length - 1].athlete_id && value.next_read_token !== null && sameTokenExcept(value.dashboard_read_token, value.next_read_token, ['cursor_roster_name', 'cursor_athlete_id']) && value.next_read_token.cursor_roster_name === value.next_cursor.roster_name && value.next_read_token.cursor_athlete_id === value.next_cursor.athlete_id))
}
function phase7RosterPage(value: unknown, input: Parameters<NonNullable<Phase55DashboardReadsApi['getCoachDashboardRosterPageV2']>>[0]): value is CoachDashboardRosterPageV2 {
  return exactKeys(value, ['contract_version', 'visibility_kind', 'server_as_of_date', 'dashboard_read_token', 'items', 'has_more', 'next_cursor', 'next_read_token'])
    && value.contract_version === 2 && phase4Enum(value.visibility_kind, ['gym', 'coach']) && phase4Date(value.server_as_of_date)
    && phase7RosterToken(value.dashboard_read_token) && value.dashboard_read_token.gym_id === input.gym
    && value.dashboard_read_token.group_kind === input.group_kind && value.dashboard_read_token.search_text === input.search_text
    && Number(value.dashboard_read_token.page_size) === input.page_size && value.visibility_kind === value.dashboard_read_token.visibility_kind
    && value.server_as_of_date === value.dashboard_read_token.materialization_as_of_date
    && (input.expected_read_token === null ? value.dashboard_read_token.cursor_roster_name === null && value.dashboard_read_token.cursor_athlete_id === null : JSON.stringify(value.dashboard_read_token) === JSON.stringify(input.expected_read_token))
    && phase4Array(value.items, 50, phase7RosterItem) && uniqueBy(value.items, item => item.athlete_id) && rosterOrder(value.items)
    && value.items.every(item => item.programming_state === (input.group_kind === 'needs_programming' ? 'needs_programming' : 'current'))
    && typeof value.has_more === 'boolean' && (!value.has_more || value.items.length === input.page_size)
    && phase4Nullable(value.next_cursor, phase55RosterCursor) && phase4Nullable(value.next_read_token, phase7RosterToken)
    && value.has_more === (value.next_cursor !== null) && value.has_more === (value.next_read_token !== null)
    && (value.next_cursor === null || (value.items.length > 0 && value.next_cursor.roster_name === value.items[value.items.length - 1].roster_name && value.next_cursor.athlete_id === value.items[value.items.length - 1].athlete_id && value.next_read_token !== null && sameTokenExcept(value.dashboard_read_token, value.next_read_token, ['cursor_roster_name', 'cursor_athlete_id']) && value.next_read_token.cursor_roster_name === value.next_cursor.roster_name && value.next_read_token.cursor_athlete_id === value.next_cursor.athlete_id))
}
function phase55AssignmentsPage(value: unknown, input: Parameters<Phase55DashboardReadsApi['getCoachDashboardAssignmentsPageV1']>[0]): value is CoachDashboardAssignmentsPageV1 {
  return exactKeys(value, ['contract_version', 'visibility_kind', 'server_as_of_date', 'dashboard_read_token', 'items', 'has_more', 'next_cursor', 'next_read_token'])
    && value.contract_version === 1 && phase4Enum(value.visibility_kind, ['gym', 'coach']) && phase4Date(value.server_as_of_date)
    && phase55AssignmentsToken(value.dashboard_read_token) && value.dashboard_read_token.gym_id === input.gym && value.dashboard_read_token.athlete_id === input.athlete
    && value.dashboard_read_token.lifecycle_filter === input.lifecycle_filter && Number(value.dashboard_read_token.page_size) === input.page_size
    && value.visibility_kind === value.dashboard_read_token.visibility_kind && value.server_as_of_date === value.dashboard_read_token.materialization_as_of_date
    && (input.expected_read_token === null ? value.dashboard_read_token.cursor_assigned_at === null && value.dashboard_read_token.cursor_assignment_id === null : JSON.stringify(value.dashboard_read_token) === JSON.stringify(input.expected_read_token))
    && phase4Array(value.items, 50, phase55AssignmentItem) && uniqueBy(value.items, item => item.assignment_id) && assignmentOrder(value.items)
    && value.items.every(item => phase55AssignmentLifecycle(item, String(value.server_as_of_date))) && typeof value.has_more === 'boolean' && (!value.has_more || value.items.length === input.page_size)
    && phase4Nullable(value.next_cursor, phase55AssignmentsCursor) && phase4Nullable(value.next_read_token, phase55AssignmentsToken)
    && value.has_more === (value.next_cursor !== null) && value.has_more === (value.next_read_token !== null)
    && (value.next_cursor === null || (value.items.length > 0 && value.next_cursor.assigned_at === value.items[value.items.length - 1].assigned_at && value.next_cursor.assignment_id === value.items[value.items.length - 1].assignment_id && value.next_read_token !== null && sameTokenExcept(value.dashboard_read_token, value.next_read_token, ['cursor_assigned_at', 'cursor_assignment_id']) && value.next_read_token.cursor_assigned_at === value.next_cursor.assigned_at && value.next_read_token.cursor_assignment_id === value.next_cursor.assignment_id))
}
function phase6AssignmentsPage(value: unknown, input: Parameters<Phase6ProgramArchiveApi['getCoachDashboardAssignmentsPageV2']>[0]): value is CoachDashboardAssignmentsPageV2 {
  return exactKeys(value, ['contract_version', 'visibility_kind', 'server_as_of_date', 'dashboard_read_token', 'items', 'has_more', 'next_cursor', 'next_read_token'])
    && value.contract_version === 2 && phase4Enum(value.visibility_kind, ['gym', 'coach']) && phase4Date(value.server_as_of_date)
    && phase6AssignmentsToken(value.dashboard_read_token) && value.dashboard_read_token.gym_id === input.gym && value.dashboard_read_token.athlete_id === input.athlete
    && value.dashboard_read_token.lifecycle_filter === input.lifecycle_filter && value.dashboard_read_token.archive_visibility === input.archive_visibility
    && Number(value.dashboard_read_token.page_size) === input.page_size && value.visibility_kind === value.dashboard_read_token.visibility_kind
    && value.server_as_of_date === value.dashboard_read_token.materialization_as_of_date
    && (input.expected_read_token === null ? value.dashboard_read_token.cursor_assigned_at === null && value.dashboard_read_token.cursor_assignment_id === null : JSON.stringify(value.dashboard_read_token) === JSON.stringify(input.expected_read_token))
    && phase4Array(value.items, 50, phase6AssignmentItem) && uniqueBy(value.items, item => item.assignment_id) && assignmentOrder(value.items)
    && value.items.every(item => phase55AssignmentLifecycle(item, String(value.server_as_of_date))
      && (input.archive_visibility === 'archived' ? item.program_status === 'archived' : item.program_status !== 'archived'))
    && typeof value.has_more === 'boolean' && (!value.has_more || value.items.length === input.page_size)
    && phase4Nullable(value.next_cursor, phase55AssignmentsCursor) && phase4Nullable(value.next_read_token, phase6AssignmentsToken)
    && value.has_more === (value.next_cursor !== null) && value.has_more === (value.next_read_token !== null)
    && (value.next_cursor === null || (value.items.length > 0 && value.next_cursor.assigned_at === value.items[value.items.length - 1].assigned_at && value.next_cursor.assignment_id === value.items[value.items.length - 1].assignment_id && value.next_read_token !== null && sameTokenExcept(value.dashboard_read_token, value.next_read_token, ['cursor_assigned_at', 'cursor_assignment_id']) && value.next_read_token.cursor_assigned_at === value.next_cursor.assigned_at && value.next_read_token.cursor_assignment_id === value.next_cursor.assignment_id))
}

function phase9ActivityItem(value: unknown): value is CoachRecentActivityItemV1 {
  return exactKeys(value, ['activity_id', 'athlete_id', 'roster_name', 'assignment_id', 'program_name', 'day_label', 'outcome', 'performed_at', 'recorded_at'])
    && phase4Uuid(value.activity_id) && phase4Uuid(value.athlete_id) && phase4AuthoredText(value.roster_name, 120)
    && phase4Uuid(value.assignment_id) && phase4AuthoredText(value.program_name, 120)
    && phase4AuthoredText(value.day_label, 120) && phase4Enum(value.outcome, ['completed', 'skipped'])
    && phase4Timestamp(value.performed_at) && phase4Timestamp(value.recorded_at)
}

function phase9ActivityCursor(value: unknown): value is CoachRecentActivityCursorV1 {
  return exactKeys(value, ['recorded_at', 'activity_id'])
    && phase4Timestamp(value.recorded_at) && phase4Uuid(value.activity_id)
}

function phase9ActivityPage(value: unknown, input: Parameters<Phase9ActivityApi['getCoachRecentActivityPageV1']>[0]): value is CoachRecentActivityPageV1 {
  return exactKeys(value, ['contract_version', 'items', 'has_more', 'next_cursor'])
    && value.contract_version === 1 && phase4Array(value.items, 20, phase9ActivityItem)
    && uniqueBy(value.items, item => item.activity_id) && recentActivityOrder(value.items)
    && typeof value.has_more === 'boolean' && (!value.has_more || value.items.length === input.page_size)
    && phase4Nullable(value.next_cursor, phase9ActivityCursor)
    && value.has_more === (value.next_cursor !== null)
    && (value.next_cursor === null || (value.items.length > 0
      && value.next_cursor.recorded_at === value.items[value.items.length - 1].recorded_at
      && value.next_cursor.activity_id === value.items[value.items.length - 1].activity_id))
}

const activityOptionalNumber = (value: unknown): value is number | null => value === null || typeof value === 'number' && Number.isFinite(value)
const activityOptionalInteger = (value: unknown): value is number | null => value === null || phase4Integer(value)
const activityOptionalTimestamp = (value: unknown): value is string | null => phase4Nullable(value, phase4Timestamp)
const activityOptionalUuid = (value: unknown): value is string | null => phase4Nullable(value, phase4Uuid)
function activityPlannedSet(value: unknown): value is CoachActivityPlannedSetV1 {
  if (!exactKeys(value, ['revision_set_group_id', 'ordinal', 'sets_mode', 'sets_min', 'sets_max', 'dose_mode', 'reps_mode', 'dose_min', 'dose_max', 'distance_unit', 'laterality', 'load_mode', 'load_basis', 'exact_weight', 'percent', 'percent_basis_exercise_id', 'percent_basis_max_type', 'manual_override', 'rpe_min', 'rpe_max', 'qualitative', 'unit_override', 'rest_seconds', 'note', 'of_max_id', 'resolved_weight', 'resolved_max_effective_from', 'resolved_at'])) return false
  if (!phase4Uuid(value.revision_set_group_id) || !phase4Integer(value.ordinal, 1, 1200)
    || !phase4Enum(value.sets_mode, ['exact', 'range']) || !phase4Integer(value.sets_min, 1, 1200)
    || !activityOptionalInteger(value.sets_max) || (value.sets_mode === 'exact' ? value.sets_max !== null : value.sets_max === null || value.sets_max < value.sets_min)
    || !phase4Enum(value.dose_mode, ['reps', 'time', 'steps', 'distance', 'amrap'])
    || !(value.reps_mode === null || phase4Enum(value.reps_mode, ['exact', 'range', 'athlete_choice']))
    || !activityOptionalNumber(value.dose_min) || !activityOptionalNumber(value.dose_max)
    || !(value.distance_unit === null || phase4Enum(value.distance_unit, ['m', 'km', 'ft', 'mi']))
    || !phase4Enum(value.laterality, ['bilateral', 'each_side', 'alternating'])
    || !phase4Enum(value.load_mode, ['exact', 'percent', 'rpe', 'qualitative', 'bodyweight', 'none', 'tbd'])
    || !phase4Enum(value.load_basis, ['total', 'added_to_bodyweight', 'per_hand'])
    || ![value.exact_weight, value.percent, value.manual_override, value.rpe_min, value.rpe_max, value.resolved_weight].every(activityOptionalNumber)
    || !activityOptionalUuid(value.percent_basis_exercise_id) || !(value.percent_basis_max_type === null || phase4Enum(value.percent_basis_max_type, ['tested_1rm', 'training_max']))
    || !(value.qualitative === null || phase4Enum(value.qualitative, ['L', 'M', 'MH', 'H']))
    || !(value.unit_override === null || phase4Enum(value.unit_override, ['lb', 'kg']))
    || !activityOptionalInteger(value.rest_seconds) || !phase4NullableText(value.note, 500)
    || !activityOptionalUuid(value.of_max_id) || !phase4Nullable(value.resolved_max_effective_from, phase4Date)
    || !activityOptionalTimestamp(value.resolved_at)) return false
  return value.dose_mode === 'reps' ? value.reps_mode !== null : value.reps_mode === null
}
function activityPlannedExercise(value: unknown): value is CoachActivityPlannedExerciseV1 {
  // Newer day payloads include the paired metrics mapping. Validate that
  // extension before applying the original activity-detail contract.
  if (isRecord(value) && ('exercise_id' in value || 'track_in_metrics' in value)) {
    if (!phase4Nullable(value.exercise_id, phase4Uuid) || typeof value.track_in_metrics !== 'boolean'
      || (value.track_in_metrics && value.exercise_id === null)) return false
    const { exercise_id: _exerciseId, track_in_metrics: _tracked, ...legacy } = value
    return activityPlannedExercise(legacy)
  }
  return exactKeys(value, ['revision_exercise_row_id', 'ordinal', 'group_ordinal', 'exercise_name', 'exercise_instruction', 'movement_note', 'protocol', 'status', 'set_groups'])
    && phase4Uuid(value.revision_exercise_row_id) && phase4Integer(value.ordinal, 1, 1200)
    && activityOptionalInteger(value.group_ordinal) && phase4Text(value.exercise_name, 120)
    && phase4NullableText(value.exercise_instruction, 1000) && phase4NullableText(value.movement_note, 500)
    && phase4NullableText(value.protocol, 1000) && phase4Text(value.status, 32)
    && phase4Array(value.set_groups, 1200, activityPlannedSet)
    && uniqueBy(value.set_groups, row => row.revision_set_group_id)
}
function activityPlannedDay(value: unknown): value is CoachActivityPlannedDayV1 {
  if (!exactKeys(value, ['revision_day_id', 'revision', 'block', 'week', 'day', 'movement_groups', 'ungrouped_exercises'])
    || !phase4Uuid(value.revision_day_id)
    || !exactKeys(value.revision, ['program_name', 'cycle_label', 'default_unit', 'plate_increment', 'start_on', 'end_on'])
    || !phase4Text(value.revision.program_name, 120) || !phase4NullableText(value.revision.cycle_label, 120)
    || !phase4Enum(value.revision.default_unit, ['lb', 'kg']) || !activityOptionalNumber(value.revision.plate_increment) || value.revision.plate_increment === null || value.revision.plate_increment < 0
    || !phase4Nullable(value.revision.start_on, phase4Date) || !phase4Nullable(value.revision.end_on, phase4Date)
    || !exactKeys(value.block, ['ordinal', 'label', 'planned_weeks'])
    || !phase4Integer(value.block.ordinal, 1, 100) || !phase4NullableText(value.block.label, 120) || !phase4Integer(value.block.planned_weeks, 1, 100)
    || !exactKeys(value.week, ['ordinal', 'ordinal_in_block', 'label'])
    || !phase4Integer(value.week.ordinal, 1, 100) || !phase4Integer(value.week.ordinal_in_block, 1, 100) || !phase4Text(value.week.label, 120)
    || !exactKeys(value.day, ['ordinal', 'label', 'subtitle', 'workout_instruction'])
    || !phase4Integer(value.day.ordinal, 1, 14) || !phase4Text(value.day.label, 120)
    || !phase4NullableText(value.day.subtitle, 500) || !phase4NullableText(value.day.workout_instruction, 1000)
    || !phase4Array(value.ungrouped_exercises, 1200, activityPlannedExercise)
    || !phase4Array(value.movement_groups, 1200, (group): group is CoachActivityPlannedDayV1['movement_groups'][number] =>
      exactKeys(group, ['revision_movement_group_id', 'ordinal', 'group_type', 'title', 'rounds_min', 'rounds_max', 'exercises'])
      && phase4Uuid(group.revision_movement_group_id) && phase4Integer(group.ordinal, 1, 1200)
      && phase4Enum(group.group_type, ['superset', 'circuit', 'sequence']) && phase4NullableText(group.title, 120)
      && activityOptionalInteger(group.rounds_min) && activityOptionalInteger(group.rounds_max)
      && phase4Array(group.exercises, 1200, activityPlannedExercise))) return false
  const exercises = [...value.ungrouped_exercises, ...value.movement_groups.flatMap(group => group.exercises)]
  return uniqueBy(exercises, exercise => exercise.revision_exercise_row_id)
}
function activityPerformedSet(value: unknown): value is CoachActivityPerformedSetV1 {
  return exactKeys(value, ['id', 'revision_set_group_id', 'set_number', 'actual_reps', 'actual_seconds', 'actual_steps', 'actual_distance', 'actual_distance_unit', 'actual_weight', 'actual_weight_unit', 'actual_rpe', 'completed', 'athlete_note', 'device_updated_at', 'created_at', 'updated_at'])
    && phase4Uuid(value.id) && phase4Uuid(value.revision_set_group_id) && phase4Integer(value.set_number, 1, 1200)
    && activityOptionalInteger(value.actual_reps) && activityOptionalInteger(value.actual_seconds) && activityOptionalInteger(value.actual_steps)
    && activityOptionalNumber(value.actual_distance) && activityOptionalNumber(value.actual_weight) && activityOptionalNumber(value.actual_rpe)
    && (value.actual_distance === null) === (value.actual_distance_unit === null)
    && (value.actual_weight === null) === (value.actual_weight_unit === null)
    && (value.actual_distance_unit === null || phase4Enum(value.actual_distance_unit, ['m', 'km', 'ft', 'mi']))
    && (value.actual_weight_unit === null || phase4Enum(value.actual_weight_unit, ['lb', 'kg']))
    && typeof value.completed === 'boolean' && phase4NullableText(value.athlete_note, 500)
    && phase4Timestamp(value.device_updated_at) && phase4Timestamp(value.created_at) && phase4Timestamp(value.updated_at)
}
function activityPerformedExercise(value: unknown): value is CoachActivityPerformedExerciseV1 {
  return exactKeys(value, ['id', 'revision_exercise_row_id', 'athlete_note', 'created_at', 'updated_at', 'sets'])
    && phase4Uuid(value.id) && phase4Uuid(value.revision_exercise_row_id)
    && phase4NullableText(value.athlete_note, 500) && phase4Timestamp(value.created_at) && phase4Timestamp(value.updated_at)
    && phase4Array(value.sets, 1200, activityPerformedSet)
    && uniqueBy(value.sets, set => `${set.revision_set_group_id}:${set.set_number}`)
}
function phase9ActivityDetail(value: unknown, input: { gym: Phase4Uuid; activity_id: Phase4Uuid }): value is CoachWorkoutActivityDetailV1 {
  if (!exactKeys(value, ['contract_version', 'activity_id', 'athlete_id', 'roster_name', 'assignment_id', 'program_name', 'outcome', 'performed_at', 'recorded_at', 'session', 'delivery', 'planned', 'performed_exercises'])
    || value.contract_version !== 1 || value.activity_id !== input.activity_id || !phase4Uuid(value.athlete_id)
    || !phase4Text(value.roster_name, 120) || !phase4Uuid(value.assignment_id) || !phase4Text(value.program_name, 120)
    || !phase4Enum(value.outcome, ['completed', 'skipped']) || !phase4Timestamp(value.performed_at) || !phase4Timestamp(value.recorded_at)
    || !exactKeys(value.session, ['id', 'state', 'athlete_note', 'started_at', 'completed_at', 'skipped_at', 'skip_reason', 'created_at', 'updated_at'])
    || !phase4Uuid(value.session.id) || !phase4Enum(value.session.state, ['not_started', 'in_progress', 'completed', 'skipped'])
    || !phase4NullableText(value.session.athlete_note, 1000)
    || !activityOptionalTimestamp(value.session.started_at) || !activityOptionalTimestamp(value.session.completed_at)
    || !activityOptionalTimestamp(value.session.skipped_at) || !phase4NullableText(value.session.skip_reason, 500)
    || !phase4Timestamp(value.session.created_at) || !phase4Timestamp(value.session.updated_at)
    || !exactKeys(value.delivery, ['receipt_id', 'acknowledged_at', 'opened_at', 'consumed_at'])
    || !phase4Uuid(value.delivery.receipt_id) || !activityOptionalTimestamp(value.delivery.acknowledged_at)
    || !activityOptionalTimestamp(value.delivery.opened_at) || !activityOptionalTimestamp(value.delivery.consumed_at)
    || !activityPlannedDay(value.planned) || !phase4Array(value.performed_exercises, 1200, activityPerformedExercise)) return false
  const planned = [...value.planned.ungrouped_exercises, ...value.planned.movement_groups.flatMap(group => group.exercises)]
  const validIds = new Map(planned.map(exercise => [exercise.revision_exercise_row_id, new Set(exercise.set_groups.map(set => set.revision_set_group_id))]))
  return value.performed_exercises.every(exercise => validIds.has(exercise.revision_exercise_row_id)
    && exercise.sets.every(set => validIds.get(exercise.revision_exercise_row_id)!.has(set.revision_set_group_id)))
    && uniqueBy(value.performed_exercises, exercise => exercise.revision_exercise_row_id)
}

function phase6ProgramArchive(value: unknown, input: { program: string; expected_archive_generation: SignedBigintDecimal }, restore: boolean): value is CoachProgramArchiveV1Result {
  return exactKeys(value, ['contract_version', 'program_id', 'program_status', 'archived_at', 'archive_generation', 'archived'])
    && value.contract_version === 1 && value.program_id === input.program && phase4Uuid(value.program_id)
    && phase4Enum(value.program_status, ['draft', 'active', 'archived']) && phase4Nullable(value.archived_at, phase4Timestamp)
    && phase4NonnegativeBigint(value.archive_generation) && typeof value.archived === 'boolean'
    && value.archived === !restore && (value.program_status === 'archived') === value.archived
    && (value.archived ? value.archived_at !== null : value.archived_at === null)
    && (restore ? value.archive_generation === input.expected_archive_generation : BigInt(value.archive_generation) > BigInt(input.expected_archive_generation))
}

function phase4Calendar(value: unknown): value is CoachProgramCalendar {
  if (!exactKeys(value, ['version', 'start_on', 'selected_weekdays']) || value.version !== 1
    || !phase4Date(value.start_on)
    || !phase4Array(value.selected_weekdays, 7, (day): day is number => phase4Integer(day, 1, 7), 1)) return false
  return uniqueStrings(value.selected_weekdays.map(String))
    && new Date(`${value.start_on}T00:00:00.000Z`).getUTCDay() === 1
}

function phase4PendingUndo(value: unknown): value is CoachPendingUndoV4 {
  return exactKeys(value, ['undo_id', 'assignment_id', 'operation_type', 'target_description', 'artifact_version_after', 'expires_at'])
    && phase4Uuid(value.undo_id) && phase4Uuid(value.assignment_id)
    && phase4Enum(value.operation_type, ['copy_day', 'copy_week', 'progression'])
    && phase4NonemptyText(value.target_description, 240)
    && phase4BuilderVersion(value.artifact_version_after) && phase4Timestamp(value.expires_at)
}

function phase4Authoring(value: unknown): value is CoachAssignmentAuthoringV4 {
  if (!exactKeys(value, ['readiness', 'ready_builder_version', 'ready_at', 'pending_undo'])
    || !phase4Enum(value.readiness, ['draft', 'ready'])
    || !(value.ready_builder_version === null || phase4BuilderVersion(value.ready_builder_version))
    || !phase4Nullable(value.ready_at, phase4Timestamp)
    || !phase4Nullable(value.pending_undo, phase4PendingUndo)) return false
  return value.readiness === 'draft'
    ? value.ready_builder_version === null && value.ready_at === null
    : value.ready_builder_version !== null && value.ready_at !== null
}

function phase4DaySummary(value: unknown): value is CoachAssignmentDaySummaryV4 {
  return exactKeys(value, ['day_identity_token', 'day_ordinal', 'label', 'planned_date', 'status', 'locked_any', 'exercise_count', 'set_row_count'])
    && phase4Nullable(value.day_identity_token, phase4Uuid) && phase4Integer(value.day_ordinal, 1, 7)
    && phase4NullableNonemptyText(value.label, 120) && phase4Date(value.planned_date)
    && phase4Enum(value.status, ['unscheduled', 'authored_empty', 'workout', 'rest'])
    && typeof value.locked_any === 'boolean' && phase4Integer(value.exercise_count)
    && phase4Integer(value.set_row_count)
    && (value.status === 'unscheduled' ? value.day_identity_token === null : value.day_identity_token !== null)
}

function phase4WeekSummary(value: unknown): value is CoachAssignmentWeekSummaryV4 {
  return exactKeys(value, ['week_identity_token', 'week_ordinal', 'days'])
    && phase4Uuid(value.week_identity_token) && phase4Integer(value.week_ordinal, 1, 12)
    && phase4Array(value.days, 7, phase4DaySummary, 7)
}

function phase4PublishBoundary(value: unknown): value is { kind: 'source_token'; id: Phase4Uuid } {
  return exactKeys(value, ['kind', 'id']) && value.kind === 'source_token' && phase4Uuid(value.id)
}

function phase4Detail(value: unknown, assignment: Phase4Uuid): value is CoachAssignmentDetailV4 {
  if (!(exactKeys(value, ['detail_read_token', 'program_id', 'assignment_id', 'athlete_id', 'program_name', 'program_status', 'assignment_status', 'builder_version', 'default_unit', 'plate_increment', 'phase4_editable', 'publish_boundary', 'calendar', 'authoring', 'weeks'])
    && phase4Hex(value.detail_read_token) && phase4Uuid(value.program_id) && phase4Uuid(value.assignment_id)
    && value.assignment_id === assignment
    && phase4Uuid(value.athlete_id) && phase4NonemptyText(value.program_name, 120)
    && phase4Enum(value.program_status, ['draft', 'active', 'archived'])
    && phase4Enum(value.assignment_status, ['active', 'paused', 'completed', 'revoked'])
    && phase4BuilderVersion(value.builder_version) && phase4Enum(value.default_unit, ['lb', 'kg'])
    && phase4Decimal(value.plate_increment, Number.MIN_VALUE, 99_999.999, 3)
    && typeof value.phase4_editable === 'boolean'
    && phase4Nullable(value.publish_boundary, phase4PublishBoundary) && phase4Calendar(value.calendar)
    && phase4Authoring(value.authoring) && phase4Array(value.weeks, 12, phase4WeekSummary, 1))) return false
  return value.weeks.every((week, index) => week.week_ordinal === index + 1)
    && (value.authoring.readiness !== 'ready' || value.authoring.ready_builder_version === value.builder_version)
    && (value.authoring.pending_undo === null || value.authoring.pending_undo.assignment_id === value.assignment_id)
}

const phase5Weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
function phase5DaySummary(value: unknown): value is CoachAssignmentDaySummaryV5 {
  return exactKeys(value, ['day_identity_token', 'day_ordinal', 'label', 'planned_date', 'status', 'locked_any', 'exercise_count', 'set_row_count', 'system_weekday', 'workout_title'])
    && phase4Nullable(value.day_identity_token, phase4Uuid) && phase4Integer(value.day_ordinal, 1, 7)
    && phase4NullableNonemptyText(value.label, 120) && phase4Date(value.planned_date)
    && phase4Enum(value.status, ['unscheduled', 'authored_empty', 'workout', 'rest'])
    && typeof value.locked_any === 'boolean' && phase4Integer(value.exercise_count)
    && phase4Integer(value.set_row_count)
    && value.system_weekday === phase5Weekdays[value.day_ordinal - 1]
    && phase4NullableAuthoredText(value.workout_title, 500)
    && (value.status === 'unscheduled'
      ? value.day_identity_token === null && value.workout_title === null
      : value.day_identity_token !== null)
}
function phase5WeekSummary(value: unknown): value is CoachAssignmentWeekSummaryV5 {
  return exactKeys(value, ['week_identity_token', 'week_ordinal', 'days'])
    && phase4Uuid(value.week_identity_token) && phase4Integer(value.week_ordinal, 1, 12)
    && phase4Array(value.days, 7, phase5DaySummary, 7)
}
function phase5Detail(value: unknown, assignment: Phase4Uuid): value is CoachAssignmentDetailV5 {
  if (!(exactKeys(value, ['contract_version', 'detail_read_token', 'program_id', 'assignment_id', 'athlete_id', 'program_name', 'program_status', 'assignment_status', 'builder_version', 'default_unit', 'plate_increment', 'phase4_editable', 'publish_boundary', 'calendar', 'authoring', 'weeks'])
    && value.contract_version === 5 && phase4Hex(value.detail_read_token)
    && phase4Uuid(value.program_id) && phase4Uuid(value.assignment_id) && value.assignment_id === assignment
    && phase4Uuid(value.athlete_id) && phase4NonemptyText(value.program_name, 120)
    && phase4Enum(value.program_status, ['draft', 'active', 'archived'])
    && phase4Enum(value.assignment_status, ['active', 'paused', 'completed', 'revoked'])
    && phase4BuilderVersion(value.builder_version) && phase4Enum(value.default_unit, ['lb', 'kg'])
    && phase4Decimal(value.plate_increment, Number.MIN_VALUE, 99_999.999, 3)
    && typeof value.phase4_editable === 'boolean'
    && phase4Nullable(value.publish_boundary, phase4PublishBoundary) && phase4Calendar(value.calendar)
    && phase4Authoring(value.authoring) && phase4Array(value.weeks, 12, phase5WeekSummary, 1))) return false
  return value.weeks.every((week, index) => week.week_ordinal === index + 1)
    && (value.authoring.readiness !== 'ready' || value.authoring.ready_builder_version === value.builder_version)
    && (value.authoring.pending_undo === null || value.authoring.pending_undo.assignment_id === value.assignment_id)
}

function phase4SetGroup(value: unknown): value is CoachSetGroupV3 {
  const keys = ['identity_token', 'ordinal', 'sets', 'reps', 'load_kind', 'load_value', 'unit_override', 'effective_unit', 'rest_seconds', 'note', 'sets_mode', 'sets_min', 'sets_max', 'dose_mode', 'reps_mode', 'dose_min', 'dose_max', 'distance_unit', 'laterality', 'load_mode', 'load_basis', 'exact_weight', 'percent', 'of_max_id', 'resolved_weight', 'resolved_max_effective_from', 'resolved_at', 'manual_override', 'rpe_min', 'rpe_max', 'qualitative', 'percent_basis_exercise_id', 'percent_basis_max_type']
  if (!exactKeys(value, keys) || !phase4Uuid(value.identity_token) || !phase4Int32(value.ordinal, 1)
    || !phase4Enum(value.sets_mode, ['exact', 'range']) || !phase4Int32(value.sets_min, 1)
    || !(value.sets_max === null || phase4Int32(value.sets_max, 1))
    || !phase4Enum(value.dose_mode, ['reps', 'time', 'steps', 'distance', 'amrap'])
    || !phase4Enum(value.laterality, ['bilateral', 'each_side', 'alternating'])
    || !phase4Enum(value.load_mode, ['exact', 'percent', 'rpe', 'qualitative', 'bodyweight', 'none', 'tbd'])
    || value.load_kind !== value.load_mode || !phase4Enum(value.load_basis, ['total', 'added_to_bodyweight', 'per_hand'])
    || !(value.rest_seconds === null || phase4Int32(value.rest_seconds))
    || !phase4NullableAuthoredText(value.note, 500)) return false

  const setsValid = value.sets_mode === 'exact'
    ? value.sets_max === null && value.sets === value.sets_min
    : value.sets_max !== null && value.sets_max >= value.sets_min && value.sets === null
  if (!setsValid) return false

  let doseValid = false
  if (value.dose_mode === 'reps') {
    if (value.reps_mode === 'exact') doseValid = phase4Integer(value.dose_min, 1, 9_999_999) && value.dose_max === null && value.distance_unit === null && value.reps === value.dose_min
    else if (value.reps_mode === 'range') doseValid = phase4Integer(value.dose_min, 1, 9_999_999) && phase4Integer(value.dose_max, value.dose_min, 9_999_999) && value.distance_unit === null && value.reps === null
    else doseValid = value.reps_mode === 'athlete_choice' && value.dose_min === null && value.dose_max === null && value.distance_unit === null && value.reps === null
  } else if (value.dose_mode === 'time' || value.dose_mode === 'steps') {
    doseValid = value.reps_mode === null && phase4Integer(value.dose_min, 1, 9_999_999) && value.dose_max === null && value.distance_unit === null && value.reps === null
  } else if (value.dose_mode === 'distance') {
    doseValid = value.reps_mode === null && phase4Decimal(value.dose_min, Number.MIN_VALUE, 9_999_999.999, 3)
      && value.dose_max === null && phase4Enum(value.distance_unit, ['m', 'km', 'ft', 'mi']) && value.reps === null
  } else doseValid = value.reps_mode === null && value.dose_min === null && value.dose_max === null && value.distance_unit === null && value.reps === null
  if (!doseValid) return false

  const weightedUnit = (value.unit_override === null || phase4Enum(value.unit_override, ['lb', 'kg']))
    && phase4Enum(value.effective_unit, ['lb', 'kg'])
    && (value.unit_override === null || value.unit_override === value.effective_unit)
  const selectors = phase4Uuid(value.percent_basis_exercise_id)
    && phase4Enum(value.percent_basis_max_type, ['tested_1rm', 'training_max'])
  if (value.load_mode === 'exact') {
    return phase4Decimal(value.exact_weight, 0, 9_999_999.999, 3) && value.load_value === value.exact_weight
      && weightedUnit && value.percent === null && value.of_max_id === null && value.resolved_weight === null
      && value.resolved_max_effective_from === null && value.resolved_at === null && value.manual_override === null
      && value.rpe_min === null && value.rpe_max === null && value.qualitative === null
      && value.percent_basis_exercise_id === null && value.percent_basis_max_type === null
  }
  if (value.load_mode === 'percent') {
    return value.exact_weight === null && phase4Decimal(value.percent, Number.MIN_VALUE, 200, 3)
      && value.load_value === value.percent && phase4Uuid(value.of_max_id)
      && phase4Decimal(value.resolved_weight, 0, 9_999_999.999, 3)
      && phase4Date(value.resolved_max_effective_from) && phase4Timestamp(value.resolved_at)
      && (value.manual_override === null || phase4Decimal(value.manual_override, 0, 9_999_999.999, 3))
      && value.rpe_min === null && value.rpe_max === null && value.qualitative === null && weightedUnit && selectors
  }
  if (value.load_mode === 'rpe') {
    return value.exact_weight === null && value.percent === null && value.of_max_id === null && value.resolved_weight === null
      && value.resolved_max_effective_from === null && value.resolved_at === null && value.manual_override === null
      && phase4Decimal(value.rpe_min, 1, 10, 1) && (value.rpe_max === null || (phase4Decimal(value.rpe_max, value.rpe_min, 10, 1)))
      && value.load_value === value.rpe_min && value.qualitative === null && value.unit_override === null && value.effective_unit === null
      && value.percent_basis_exercise_id === null && value.percent_basis_max_type === null
  }
  if (value.load_mode === 'qualitative') {
    return value.exact_weight === null && value.percent === null && value.of_max_id === null && value.resolved_weight === null
      && value.resolved_max_effective_from === null && value.resolved_at === null && value.manual_override === null
      && value.rpe_min === null && value.rpe_max === null && phase4Enum(value.qualitative, ['L', 'M', 'MH', 'H'])
      && value.load_value === value.qualitative && value.unit_override === null && value.effective_unit === null
      && value.percent_basis_exercise_id === null && value.percent_basis_max_type === null
  }
  const emptyLoad = value.percent === null && value.of_max_id === null && value.resolved_weight === null
    && value.resolved_max_effective_from === null && value.resolved_at === null && value.manual_override === null
    && value.rpe_min === null && value.rpe_max === null && value.qualitative === null && value.load_value === null
    && value.unit_override === null && value.effective_unit === null && value.percent_basis_exercise_id === null
    && value.percent_basis_max_type === null
  return emptyLoad && (value.load_mode === 'bodyweight' ? value.exact_weight === 0 : value.exact_weight === null)
}

function phase4Exercise(value: unknown): value is CoachExerciseV3 {
  if (!exactKeys(value, ['identity_token', 'ordinal', 'name', 'note', 'protocol', 'set_groups', 'edit_mode', 'unsupported_reason'])
    || !phase4Uuid(value.identity_token) || !phase4Int32(value.ordinal, 1)
    || !phase4AuthoredText(value.name, 120) || !phase4NullableAuthoredText(value.note, 500)
    || !phase4NullableAuthoredText(value.protocol, 1000)
    || !phase4Enum(value.edit_mode, ['replace', 'preserve'])
    || !(value.unsupported_reason === null || phase4Enum(value.unsupported_reason, ['set_limit', 'sets_range', 'dose_shape', 'load_shape', 'movement_shape', 'exercise_shape']))
    || !phase4Array(value.set_groups, 20, phase4SetGroup)) return false
  return (value.unsupported_reason === null) === (value.edit_mode === 'replace')
    && value.set_groups.reduce((total, group) => total + group.sets_min, 0) <= 20
}

function phase4EditableDayContent(value: unknown): value is CoachProgramDayV3 {
  if (!exactKeys(value, ['identity_token', 'ordinal', 'label', 'subtitle', 'marked_rest', 'workout_instruction', 'locked', 'locked_any', 'exercises', 'planned_date', 'day_unsupported_reason', 'day_editable'])
    || !phase4Uuid(value.identity_token) || !phase4Integer(value.ordinal, 1, 7)
    || !phase4NullableAuthoredText(value.label, 120) || !phase4NullableAuthoredText(value.subtitle, 500)
    || typeof value.marked_rest !== 'boolean' || !phase4NullableAuthoredText(value.workout_instruction, 1000)
    || typeof value.locked !== 'boolean' || typeof value.locked_any !== 'boolean'
    || !phase4Array(value.exercises, 12, phase4Exercise) || !phase4Date(value.planned_date)
    || !(value.day_unsupported_reason === null || phase4Enum(value.day_unsupported_reason, ['day_shape', 'movement_groups']))
    || typeof value.day_editable !== 'boolean') return false
  return (!value.locked || value.locked_any)
    && (!value.day_editable || (!value.locked_any && value.day_unsupported_reason === null))
}

function phase4LegacyDay(value: unknown): value is CoachAssignmentLegacyOversizeDayV4 {
  if (!exactKeys(value, ['mode', 'day_identity_token', 'day_ordinal', 'label', 'status', 'exercise_count', 'set_row_count', 'copy_source_eligible', 'copy_block_reason'])
    || value.mode !== 'legacy_oversize' || !phase4Uuid(value.day_identity_token)
    || !phase4Integer(value.day_ordinal, 1, 7) || !phase4NullableNonemptyText(value.label, 120)
    || !phase4Enum(value.status, ['authored_empty', 'workout', 'rest'])
    || !phase4CanonicalBigint(value.exercise_count, false, 18) || !phase4CanonicalBigint(value.set_row_count, false, 18)
    || typeof value.copy_source_eligible !== 'boolean'
    || !(value.copy_block_reason === null || value.copy_block_reason === 'source_too_large')) return false
  if (value.copy_block_reason !== null) return !value.copy_source_eligible
  return value.status === 'workout' ? value.copy_source_eligible : !value.copy_source_eligible
}

function phase4Day(value: unknown, input: { assignment: Phase4Uuid; day_identity_token: Phase4Uuid; expected_detail_read_token: string }): value is CoachAssignmentDayV4 {
  if (!exactKeys(value, ['detail_read_token', 'program_id', 'assignment_id', 'builder_version', 'day'])
    || !phase4Hex(value.detail_read_token) || !phase4Uuid(value.program_id)
    || value.detail_read_token !== input.expected_detail_read_token
    || !phase4Uuid(value.assignment_id) || value.assignment_id !== input.assignment
    || !phase4BuilderVersion(value.builder_version)) return false
  return (exactKeys(value.day, ['mode', 'content']) && value.day.mode === 'editable'
      && phase4EditableDayContent(value.day.content) && value.day.content.identity_token === input.day_identity_token)
    || (phase4LegacyDay(value.day) && value.day.day_identity_token === input.day_identity_token)
}

function phase5Reps(value: unknown): value is CoachRepsV3 {
  return (exactKeys(value, ['mode', 'value']) && value.mode === 'exact' && phase4Integer(value.value, 1, 100))
    || (exactKeys(value, ['mode', 'min', 'max']) && value.mode === 'range'
      && phase4Integer(value.min, 1, 100) && phase4Integer(value.max, value.min, 100))
}
function phase5SetGroup(value: unknown, allowLegacyDoseShape = false): value is CoachSetGroupV5 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const setGroup = value as UnknownRecord
  if (!(setGroup.reps === null || phase5Reps(setGroup.reps))) return false
  const legacy = { ...setGroup, reps: setGroup.reps && setGroup.reps.mode === 'exact'
    ? setGroup.reps.value : setGroup.reps === null && setGroup.reps_mode === 'exact' ? setGroup.dose_min : null }
  if (!phase4SetGroup(legacy)) return false
  if (setGroup.reps === null) {
    if (!allowLegacyDoseShape) return false
    if (setGroup.dose_mode === 'reps'
      && (setGroup.reps_mode === 'exact' || setGroup.reps_mode === 'range')) {
      return (typeof setGroup.dose_min === 'number' && setGroup.dose_min > 100)
        || (typeof setGroup.dose_max === 'number' && setGroup.dose_max > 100)
    }
    return true
  }
  if (setGroup.dose_mode === 'reps' && setGroup.reps_mode === 'exact') return !!setGroup.reps
    && setGroup.reps.mode === 'exact' && setGroup.reps.value === setGroup.dose_min && setGroup.dose_max === null
  if (setGroup.dose_mode === 'reps' && setGroup.reps_mode === 'range') return !!setGroup.reps
    && setGroup.reps.mode === 'range' && setGroup.reps.min === setGroup.dose_min && setGroup.reps.max === setGroup.dose_max
  return setGroup.reps === null
}
function phase5Exercise(value: unknown): value is CoachExerciseV5 {
  if (!exactKeys(value, ['identity_token', 'ordinal', 'name', 'note', 'protocol', 'set_groups', 'edit_mode', 'unsupported_reason'])
    || !phase4Enum(value.edit_mode, ['replace', 'preserve'])
    || !phase4Nullable(value.unsupported_reason, (item): item is Phase3UnsupportedReason => phase4Enum(item, ['set_limit', 'sets_range', 'dose_shape', 'load_shape', 'movement_shape', 'exercise_shape']))) return false
  return phase4Uuid(value.identity_token) && phase4Int32(value.ordinal, 1)
    && phase4NonemptyText(value.name, 120) && phase4NullableAuthoredText(value.note, 500)
    && phase4NullableAuthoredText(value.protocol, 1000)
    && phase4Array(value.set_groups, 20, (setGroup): setGroup is CoachSetGroupV5 =>
      phase5SetGroup(setGroup, value.edit_mode === 'preserve' && value.unsupported_reason === 'dose_shape'))
    && (value.edit_mode === 'replace' ? value.unsupported_reason === null : value.unsupported_reason !== null)
}
function phase5EditableDayContent(value: unknown): value is CoachProgramDayV5 {
  if (!exactKeys(value, ['identity_token', 'ordinal', 'label', 'subtitle', 'marked_rest', 'workout_instruction', 'locked', 'locked_any', 'exercises', 'planned_date', 'day_unsupported_reason', 'day_editable', 'system_weekday', 'workout_title'])
    || !phase4Integer(value.ordinal, 1, 7) || value.system_weekday !== phase5Weekdays[value.ordinal - 1]
    || !phase4NullableAuthoredText(value.workout_title, 500) || !phase4Array(value.exercises, 12, phase5Exercise)) return false
  const legacy: UnknownRecord = { ...value, exercises: value.exercises.map((exercise) => ({ ...exercise,
    set_groups: exercise.set_groups.map((setGroup) => ({ ...setGroup,
      reps: setGroup.reps?.mode === 'exact' ? setGroup.reps.value
        : setGroup.reps === null && setGroup.reps_mode === 'exact' ? setGroup.dose_min : null })) })) }
  delete legacy.system_weekday
  delete legacy.workout_title
  return phase4EditableDayContent(legacy)
}
function phase5LegacyDay(value: unknown): value is CoachAssignmentLegacyOversizeDayV5 {
  if (!exactKeys(value, ['mode', 'day_identity_token', 'day_ordinal', 'label', 'status', 'exercise_count', 'set_row_count', 'copy_source_eligible', 'copy_block_reason', 'system_weekday', 'workout_title'])
    || !phase4Integer(value.day_ordinal, 1, 7) || value.system_weekday !== phase5Weekdays[value.day_ordinal - 1]
    || !phase4NullableAuthoredText(value.workout_title, 500)) return false
  const legacy: UnknownRecord = { ...value }
  delete legacy.system_weekday
  delete legacy.workout_title
  return phase4LegacyDay(legacy)
}
function phase5Day(value: unknown, input: { assignment: Phase4Uuid; day_identity_token: Phase4Uuid; expected_detail_read_token: string }): value is CoachAssignmentDayV5 {
  if (!exactKeys(value, ['contract_version', 'detail_read_token', 'program_id', 'assignment_id', 'builder_version', 'day'])
    || value.contract_version !== 5 || !phase4Hex(value.detail_read_token) || value.detail_read_token !== input.expected_detail_read_token
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id) || value.assignment_id !== input.assignment
    || !phase4BuilderVersion(value.builder_version)) return false
  return (exactKeys(value.day, ['mode', 'content']) && value.day.mode === 'editable'
      && phase5EditableDayContent(value.day.content) && value.day.content.identity_token === input.day_identity_token)
    || (phase5LegacyDay(value.day) && value.day.day_identity_token === input.day_identity_token)
}
const richId = (value: unknown) => value === null || phase4Uuid(value)
const richNullableNumber = (value: unknown) => value === null || typeof value === 'number' && Number.isFinite(value)
const richPercentBasisOption = (value: unknown): value is RichPercentBasisOption => exactKeys(value, ['exercise_id', 'name'])
  && phase4Uuid(value.exercise_id) && phase4AuthoredText(value.name, 120)
const richAssignmentPercentBasisOption = (value: unknown): value is RichAssignmentPercentBasisOption => exactKeys(value, ['exercise_id', 'name', 'max_type', 'value', 'unit', 'effective_from'])
  && phase4Uuid(value.exercise_id) && phase4AuthoredText(value.name, 120)
  && phase4Enum(value.max_type, ['tested_1rm', 'training_max']) && typeof value.value === 'number' && Number.isFinite(value.value)
  && phase4Enum(value.unit, ['lb', 'kg']) && phase4Date(value.effective_from)
function richReadSet(value: unknown, template: boolean): value is RichProgramSet | RichTemplateSet {
  const key = template ? 'id' : 'identity_token'
  const fields = ['mode', key, 'ordinal', 'sets_mode', 'sets_min', 'sets_max', 'dose_mode', 'reps_mode', 'dose_min', 'dose_max', 'distance_unit', 'laterality', 'load_mode', 'load_basis', 'exact_weight', 'percent', 'percent_basis_exercise_id', 'percent_basis_max_type', 'rpe_min', 'rpe_max', 'qualitative', 'unit_override', 'rest_seconds', 'note']
  if (!template) fields.push('manual_override', 'of_max_id', 'resolved_weight', 'resolved_max_effective_from', 'resolved_at')
  if (!exactKeys(value, fields) || value.mode !== 'replace' || !richId(value[key]) || !phase4Integer(value.ordinal, 1, 20)
    || !phase4Enum(value.sets_mode, ['exact', 'range']) || !phase4Integer(value.sets_min, 1, 20)
    || !richNullableNumber(value.sets_max) || !phase4Enum(value.dose_mode, ['reps', 'time', 'steps', 'distance', 'amrap'])
    || !(value.reps_mode === null || phase4Enum(value.reps_mode, ['exact', 'range', 'athlete_choice']))
    || !richNullableNumber(value.dose_min) || !richNullableNumber(value.dose_max)
    || !(value.distance_unit === null || phase4Enum(value.distance_unit, ['m', 'km', 'ft', 'mi']))
    || !phase4Enum(value.laterality, ['bilateral', 'each_side', 'alternating'])
    || !phase4Enum(value.load_mode, ['exact', 'percent', 'rpe', 'qualitative', 'bodyweight', 'none', 'tbd'])
    || !phase4Enum(value.load_basis, ['total', 'added_to_bodyweight', 'per_hand'])
    || ![value.exact_weight, value.percent, value.rpe_min, value.rpe_max, value.rest_seconds].every(richNullableNumber)
    || !richId(value.percent_basis_exercise_id)
    || !(value.percent_basis_max_type === null || phase4Enum(value.percent_basis_max_type, ['tested_1rm', 'training_max']))
    || !(value.qualitative === null || phase4Enum(value.qualitative, ['L', 'M', 'MH', 'H']))
    || !(value.unit_override === null || phase4Enum(value.unit_override, ['lb', 'kg']))
    || !phase4NullableAuthoredText(value.note, 500)) return false
  if (value.rpe_min !== null && !phase4Decimal(value.rpe_min, 1, 10, 1)) return false
  if (value.rpe_max !== null && (value.rpe_min === null || !phase4Decimal(value.rpe_max, Number(value.rpe_min), 10, 1))) return false
  if (value.load_mode === 'rpe' && value.rpe_min === null) return false
  if (template) return true
  return richNullableNumber(value.manual_override) && richId(value.of_max_id)
    && richNullableNumber(value.resolved_weight) && phase4Nullable(value.resolved_max_effective_from, phase4Date)
    && phase4Nullable(value.resolved_at, phase4Timestamp)
}
function richReadExercise(value: unknown, template: boolean): value is RichProgramExercise | RichTemplateExercise {
  const key = template ? 'id' : 'identity_token'
  return exactKeys(value, ['mode', key, 'ordinal', 'group_ordinal', 'status', 'name', 'instruction', 'note', 'protocol', 'set_groups'])
    && value.mode === 'replace' && richId(value[key]) && phase4Integer(value.ordinal, 1, 12)
    && (value.group_ordinal === null || phase4Integer(value.group_ordinal, 1, 12))
    && phase4Enum(value.status, ['programmed', 'not_programmed']) && phase4AuthoredText(value.name, 120)
    && phase4NullableAuthoredText(value.instruction, 1000) && phase4NullableAuthoredText(value.note, 500)
    && phase4NullableAuthoredText(value.protocol, 1000) && phase4Array(value.set_groups, 20, (set): set is RichProgramSet | RichTemplateSet => richReadSet(set, template))
}
function richReadGroup(value: unknown, template: boolean): value is RichProgramGroup | RichTemplateGroup {
  const key = template ? 'id' : 'identity_token'
  return exactKeys(value, ['mode', key, 'ordinal', 'group_type', 'title', 'rounds_min', 'rounds_max', 'exercises'])
    && value.mode === 'replace' && richId(value[key]) && phase4Integer(value.ordinal, 1, 12)
    && phase4Enum(value.group_type, ['superset', 'circuit', 'sequence']) && phase4NullableAuthoredText(value.title, 120)
    && (value.group_type !== 'sequence' || (phase4AuthoredText(value.title, 120) && value.rounds_min === null && value.rounds_max === null))
    && (value.rounds_min === null || phase4Integer(value.rounds_min, 1, 100))
    && (value.rounds_max === null || phase4Integer(value.rounds_max, 1, 100))
    && phase4Array(value.exercises, 12, (exercise): exercise is RichProgramExercise | RichTemplateExercise => richReadExercise(exercise, template))
}
function richReadDay(value: unknown, template: boolean): value is RichProgramDay | RichTemplateDay {
  return exactKeys(value, ['identity_token', 'ordinal', 'label', 'subtitle', 'marked_rest', 'workout_instruction', 'movement_groups', 'ungrouped_exercises'])
    && phase4Uuid(value.identity_token) && phase4Integer(value.ordinal, 1, 14)
    && phase4AuthoredText(value.label, 120) && phase4NullableAuthoredText(value.subtitle, 500)
    && typeof value.marked_rest === 'boolean' && phase4NullableAuthoredText(value.workout_instruction, 1000)
    && phase4Array(value.movement_groups, 12, (group): group is RichProgramGroup | RichTemplateGroup => richReadGroup(group, template))
    && phase4Array(value.ungrouped_exercises, 12, (exercise): exercise is RichProgramExercise | RichTemplateExercise => richReadExercise(exercise, template))
}
function richAssignmentDay(value: unknown, input: { assignment: Phase4Uuid; day_identity_token: Phase4Uuid; expected_detail_read_token: string }): value is CoachAssignmentDayV6 {
  if (!exactKeys(value, ['contract_version', 'detail_read_token', 'program_id', 'assignment_id', 'builder_version', 'day', 'percent_basis_options'])
    || value.contract_version !== 6 || value.detail_read_token !== input.expected_detail_read_token
    || !phase4Uuid(value.program_id) || value.assignment_id !== input.assignment || !phase4BuilderVersion(value.builder_version)
    || !phase4Array(value.percent_basis_options, 100, richAssignmentPercentBasisOption)) return false
  if (phase5LegacyDay(value.day)) return value.day.day_identity_token === input.day_identity_token && value.percent_basis_options.length === 0
  if (!exactKeys(value.day, ['mode', 'content']) || value.day.mode !== 'editable') return false
  const content = value.day.content
  if (!exactKeys(content, ['identity_token', 'ordinal', 'label', 'subtitle', 'marked_rest', 'workout_instruction', 'movement_groups', 'ungrouped_exercises', 'locked', 'locked_any', 'planned_date', 'system_weekday', 'workout_title', 'day_editable', 'day_unsupported_reason'])) return false
  const authored = { ...content }; for (const field of ['locked', 'locked_any', 'planned_date', 'system_weekday', 'workout_title', 'day_editable', 'day_unsupported_reason']) delete authored[field]
  return richReadDay(authored, false) && authored.identity_token === input.day_identity_token
    && typeof content.locked === 'boolean' && typeof content.locked_any === 'boolean' && typeof content.day_editable === 'boolean'
    && phase4Date(content.planned_date) && phase4Enum(content.system_weekday, phase5Weekdays)
    && phase4NullableAuthoredText(content.workout_title, 500)
    && (content.day_unsupported_reason === null || phase4Enum(content.day_unsupported_reason, ['day_shape', 'movement_groups']))
}
function richTemplateDay(value: unknown, input: { template: string; expected_read_token: string | null }): value is WorkoutTemplateDayV2 {
  return exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'supported', 'rich_supported', 'day', 'read_token', 'percent_basis_options'])
    && value.contract_version === 2 && value.template_id === input.template && phase4BuilderVersion(value.builder_version)
    && typeof value.supported === 'boolean' && typeof value.rich_supported === 'boolean' && richReadDay(value.day, true) && value.day.ordinal === 1
    && phase4Array(value.percent_basis_options, 100, richPercentBasisOption)
    && phase4Hex(value.read_token) && (input.expected_read_token === null || value.read_token === input.expected_read_token)
}
function richSaveResult(value: unknown, input: { program: Phase4Uuid; assignment: Phase4Uuid; expected_builder_version: number; day: RichProgramDaySave }): value is SaveCoachProgramDayV4Result {
  return exactKeys(value, ['contract_version', 'program_id', 'assignment_id', 'day_identity_token', 'builder_version', 'unchanged', 'day'])
    && value.contract_version === 4 && value.program_id === input.program && value.assignment_id === input.assignment
    && value.day_identity_token === input.day.identity_token && phase4BuilderVersion(value.builder_version)
    && (value.unchanged === true ? value.builder_version === input.expected_builder_version
      : value.unchanged === false && value.builder_version > input.expected_builder_version)
    && richReadDay(value.day, false) && value.day.identity_token === input.day.identity_token
}
function richTemplateSaveResult(value: unknown, input: { template: Phase4Uuid; day: RichTemplateDaySave }): value is WorkoutTemplateSaveDayV2Result {
  return (exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'readiness', 'day'])
      || exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'readiness', 'unchanged', 'day']) && value.unchanged === true)
    && value.contract_version === 2 && value.template_id === input.template && phase4BuilderVersion(value.builder_version)
    && phase4Enum(value.readiness, ['draft', 'ready']) && (value.unchanged === undefined ? value.readiness === 'draft' : value.unchanged === true)
    && richReadDay(value.day, true)
    && value.day.identity_token === input.day.identity_token
}
function richProgramTemplateDay(value: unknown, input: { template: Phase4Uuid; day_id: Phase4Uuid }): value is ProgramTemplateDayV2 {
  return exactKeys(value, ['contract_version', 'template_id', 'day_id', 'builder_version', 'supported', 'day', 'percent_basis_options'])
    && value.contract_version === 2 && value.template_id === input.template && value.day_id === input.day_id
    && phase4BuilderVersion(value.builder_version)
    && (value.supported === false ? value.day === null : value.supported === true && richReadDay(value.day, true) && value.day.identity_token === input.day_id)
    && phase4Array(value.percent_basis_options, 100, richPercentBasisOption)
}
function richProgramTemplateSaveResult(value: unknown, input: { template: Phase4Uuid; day_id: Phase4Uuid; day: RichTemplateDaySave }): value is ProgramTemplateSaveDayV2Result {
  if (!exactKeys(value, ['contract_version', 'template_id', 'day_id', 'builder_version', 'readiness', 'day'])
    && !exactKeys(value, ['contract_version', 'template_id', 'day_id', 'builder_version', 'readiness', 'unchanged', 'day'])) return false
  const { day_id: _dayId, ...workoutResult } = value
  return value.day_id === input.day_id && richTemplateSaveResult(workoutResult, input)
}
function phase5SaveSet(value: unknown): value is SaveCoachIndividualSetV3 {
  if (!exactKeys(value, ['identity_token', 'ordinal', 'reps', 'load_kind', 'load_value', 'unit_override', 'effective_unit'])
    || !(value.identity_token === null || phase4Uuid(value.identity_token)) || !phase4Integer(value.ordinal, 1, 20)
    || !phase5Reps(value.reps) || !phase4Enum(value.load_kind, ['exact', 'rpe', 'qualitative', 'bodyweight', 'none', 'tbd'])) return false
  if (value.load_kind === 'exact') return phase4Decimal(value.load_value, 0, 2000, 3)
    && (value.unit_override === null || phase4Enum(value.unit_override, ['lb', 'kg']))
    && phase4Enum(value.effective_unit, ['lb', 'kg']) && (value.unit_override === null || value.unit_override === value.effective_unit)
  if (value.load_kind === 'rpe') return phase4Decimal(value.load_value, 1, 10, 1) && value.unit_override === null && value.effective_unit === null
  if (value.load_kind === 'qualitative') return phase4Enum(value.load_value, ['L', 'M', 'MH', 'H']) && value.unit_override === null && value.effective_unit === null
  return value.load_value === null && value.unit_override === null && value.effective_unit === null
}
function phase5SaveExercise(value: unknown): value is SaveCoachExerciseV3 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as UnknownRecord
  if (item.mode === 'preserve') return exactKeys(item, ['mode', 'identity_token', 'ordinal']) && phase4Uuid(item.identity_token) && phase4Integer(item.ordinal, 1, 12)
  if (!exactKeys(item, ['mode', 'identity_token', 'ordinal', 'name', 'note', 'protocol', 'set_rows'])
    || item.mode !== 'replace' || !(item.identity_token === null || phase4Uuid(item.identity_token))
    || !phase4Integer(item.ordinal, 1, 12) || !phase4AuthoredText(item.name, 120)
    || !phase4NullableAuthoredText(item.note, 500) || !phase4NullableAuthoredText(item.protocol, 1000)
    || !phase4Array(item.set_rows, 20, phase5SaveSet, 1)) return false
  return item.set_rows.every((row, index) => row.ordinal === index + 1)
    && uniqueStrings(item.set_rows.flatMap((row) => row.identity_token === null ? [] : [row.identity_token]))
}
function phase5SaveDay(value: unknown): value is SaveCoachProgramDayV3 {
  if (!exactKeys(value, ['identity_token', 'ordinal', 'label', 'subtitle', 'marked_rest', 'workout_instruction', 'exercises'])
    || !phase4Uuid(value.identity_token) || !phase4Integer(value.ordinal, 1, 14) || !phase4AuthoredText(value.label, 120)
    || !phase4NullableAuthoredText(value.subtitle, 500) || typeof value.marked_rest !== 'boolean'
    || !phase4NullableAuthoredText(value.workout_instruction, 1000) || !phase4Array(value.exercises, 12, phase5SaveExercise)) return false
  const exerciseTokens = value.exercises.flatMap((exercise) => exercise.identity_token === null ? [] : [exercise.identity_token])
  const setTokens = value.exercises.flatMap((exercise) => exercise.mode === 'replace'
    ? exercise.set_rows.flatMap((row) => row.identity_token === null ? [] : [row.identity_token]) : [])
  return value.exercises.every((exercise, index) => exercise.ordinal === index + 1) && (!value.marked_rest || value.exercises.length === 0)
    && uniqueStrings(exerciseTokens) && uniqueStrings(setTokens) && !exerciseTokens.includes(value.identity_token)
    && !setTokens.includes(value.identity_token) && exerciseTokens.every((token) => !setTokens.includes(token))
}
function phase5SaveResult(value: unknown, input: SaveCoachProgramDayV3Input): value is SaveCoachProgramDayV3Result {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const returnedDay = (value as UnknownRecord).day
  if (!(exactKeys(value, ['contract_version', 'program_id', 'assignment_id', 'day_identity_token', 'builder_version', 'unchanged', 'day'])
    && value.contract_version === 3 && value.program_id === input.program && value.assignment_id === input.assignment
    && value.day_identity_token === input.day.identity_token && phase4Uuid(value.program_id) && phase4Uuid(value.assignment_id)
    && phase4Uuid(value.day_identity_token) && phase4BuilderVersion(value.builder_version) && typeof value.unchanged === 'boolean'
    && phase5SaveDay(returnedDay) && returnedDay.identity_token === value.day_identity_token
    && returnedDay.ordinal === input.day.ordinal
    && (value.unchanged ? value.builder_version === input.expected_builder_version
      : value.builder_version > input.expected_builder_version))) return false
  if (returnedDay.exercises.length !== input.day.exercises.length) return false
  return input.day.exercises.every((submitted, index) => {
    const returned = returnedDay.exercises[index]
    if (!returned || returned.mode !== submitted.mode || returned.ordinal !== submitted.ordinal) return false
    if (submitted.identity_token === null ? !phase4Uuid(returned.identity_token)
      : returned.identity_token !== submitted.identity_token) return false
    if (submitted.mode === 'preserve') return returned.mode === 'preserve'
      && returned.identity_token === submitted.identity_token
    if (returned.mode !== 'replace' || returned.set_rows.length !== submitted.set_rows.length) return false
    return submitted.set_rows.every((setRow, setIndex) => {
      const returnedSet = returned.set_rows[setIndex]
      return !!returnedSet && returnedSet.ordinal === setRow.ordinal
        && (setRow.identity_token === null ? phase4Uuid(returnedSet.identity_token)
          : returnedSet.identity_token === setRow.identity_token)
    })
  })
}

const workoutTemplateToken = (value: unknown): value is WorkoutTemplateReadTokenV1 => phase4Hex(value)
const workoutTemplateItem = (value: unknown): value is WorkoutTemplateLibraryItemV1 => exactKeys(value, ['template_id', 'name', 'builder_version', 'readiness', 'archived_at', 'supported'])
  && phase4Uuid(value.template_id) && phase4NonemptyText(value.name, 120) && phase4BuilderVersion(value.builder_version)
  && phase4Enum(value.readiness, ['draft', 'ready']) && phase4Nullable(value.archived_at, phase4Timestamp)
  && typeof value.supported === 'boolean'
const workoutTemplateCursor = (value: unknown): value is WorkoutTemplateCursorV1 => exactKeys(value, ['name', 'template_id'])
  && phase4NonemptyText(value.name, 120) && phase4Uuid(value.template_id)
function workoutTemplateDayShape(value: unknown): value is SaveCoachProgramDayV3 {
  if (!phase5SaveDay(value) || value.ordinal !== 1 || value.marked_rest || value.exercises.length < 1) return false
  let physicalSets = 0
  return value.exercises.every((exercise, exerciseIndex) => {
    if (exercise.mode !== 'replace' || exercise.ordinal !== exerciseIndex + 1 || exercise.set_rows.length < 1) return false
    physicalSets += exercise.set_rows.length
    return exercise.set_rows.every((set, setIndex) => set.ordinal === setIndex + 1)
  }) && physicalSets >= 1 && physicalSets <= 20
}
function workoutTemplateDayCorrelates(returned: SaveCoachProgramDayV3, submitted: SaveCoachProgramDayV3): boolean {
  if (returned.identity_token !== submitted.identity_token || returned.ordinal !== 1 || returned.exercises.length !== submitted.exercises.length) return false
  return submitted.exercises.every((exercise, exerciseIndex) => {
    const next = returned.exercises[exerciseIndex]
    if (!next || exercise.mode !== 'replace' || next.mode !== 'replace' || next.ordinal !== exercise.ordinal || next.set_rows.length !== exercise.set_rows.length) return false
    if (exercise.identity_token === null ? !phase4Uuid(next.identity_token) : next.identity_token !== exercise.identity_token) return false
    return exercise.set_rows.every((set, setIndex) => {
      const nextSet = next.set_rows[setIndex]
      return !!nextSet && nextSet.ordinal === set.ordinal
        && (set.identity_token === null ? phase4Uuid(nextSet.identity_token) : nextSet.identity_token === set.identity_token)
    })
  })
}
function workoutTemplateLibraryPage(value: unknown, input: { gym: string; lifecycle: WorkoutTemplateLifecycleV1; search_text: string | null; cursor: WorkoutTemplateCursorV1 | null; page_size: number; expected_read_token: WorkoutTemplateReadTokenV1 | null }): value is WorkoutTemplateLibraryPageV1 {
  if (!exactKeys(value, ['contract_version', 'gym_id', 'lifecycle', 'search_text', 'page_size', 'items', 'has_more', 'next_cursor', 'library_lifecycle_key', 'library_generation', 'read_token', 'next_read_token'])
    || value.contract_version !== 1 || value.gym_id !== input.gym || value.lifecycle !== input.lifecycle
    || value.search_text !== normalizeDashboardSearch(input.search_text) || value.page_size !== input.page_size
    || !phase4Array(value.items, input.page_size, workoutTemplateItem) || typeof value.has_more !== 'boolean'
    || !phase4Nullable(value.next_cursor, workoutTemplateCursor) || !phase4Uuid(value.library_lifecycle_key)
    || !phase4BuilderVersion(value.library_generation) || !workoutTemplateToken(value.read_token)
    || !phase4Nullable(value.next_read_token, workoutTemplateToken)) return false
  if (value.has_more !== (value.next_cursor !== null && value.next_read_token !== null)) return false
  if (input.expected_read_token !== null && value.read_token !== input.expected_read_token) return false
  const items = value.items as WorkoutTemplateLibraryItemV1[]
  if (!uniqueStrings(items.map(item => item.template_id))) return false
  if (items.some(item => input.lifecycle === 'active' ? item.archived_at !== null : item.archived_at === null)) return false
  // PostgreSQL owns the name collation. Do not attempt to reproduce it with
  // ICU in the browser. The cursor's UUID tie-breaker is stable, however, so
  // reject a repeated/backwards item when its name is the cursor name.
  const first = items[0]
  if (input.cursor && first && first.name === input.cursor.name && first.template_id <= input.cursor.template_id) return false
  if (value.next_cursor !== null) {
    const last = items.at(-1)
    if (!last || value.next_cursor.name !== last.name || value.next_cursor.template_id !== last.template_id) return false
  }
  return true
}
function workoutTemplateLibraryPageV2(value: unknown, input: Parameters<typeof workoutTemplateLibraryPage>[1]): value is WorkoutTemplateLibraryPageV2 {
  if (!exactKeys(value, ['contract_version', 'gym_id', 'lifecycle', 'search_text', 'page_size', 'items', 'has_more', 'next_cursor', 'library_lifecycle_key', 'library_generation', 'read_token', 'next_read_token'])
    || value.contract_version !== 2 || !Array.isArray(value.items)) return false
  const items = value.items.map(item => {
    if (!exactKeys(item, ['template_id', 'name', 'builder_version', 'readiness', 'archived_at', 'supported', 'rich_supported']) || typeof item.rich_supported !== 'boolean') return null
    const { rich_supported: _rich, ...legacy } = item
    return legacy
  })
  return !items.includes(null) && workoutTemplateLibraryPage({ ...value, contract_version: 1, items }, input)
}
function workoutTemplateDetail(value: unknown, input: { template: string; expected_read_token: WorkoutTemplateReadTokenV1 | null }): value is WorkoutTemplateDetailV1 {
  return exactKeys(value, ['contract_version', 'template_id', 'gym_id', 'name', 'default_unit', 'plate_increment', 'builder_version', 'readiness', 'archived_at', 'supported', 'read_token'])
    && value.contract_version === 1 && value.template_id === input.template && phase4Uuid(value.template_id)
    && phase4Uuid(value.gym_id) && phase4NonemptyText(value.name, 120) && phase4Enum(value.default_unit, ['lb', 'kg'])
    && phase4Decimal(value.plate_increment, Number.MIN_VALUE, 99_999.999, 3) && phase4BuilderVersion(value.builder_version)
    && phase4Enum(value.readiness, ['draft', 'ready']) && phase4Nullable(value.archived_at, phase4Timestamp)
    && typeof value.supported === 'boolean' && workoutTemplateToken(value.read_token)
    && (input.expected_read_token === null || value.read_token === input.expected_read_token)
}
function workoutTemplateDetailV2(value: unknown, input: Parameters<typeof workoutTemplateDetail>[1]): value is WorkoutTemplateDetailV2 {
  if (!exactKeys(value, ['contract_version', 'template_id', 'gym_id', 'name', 'default_unit', 'plate_increment', 'builder_version', 'readiness', 'archived_at', 'supported', 'rich_supported', 'read_token'])
    || value.contract_version !== 2 || typeof value.rich_supported !== 'boolean') return false
  const { rich_supported: _rich, ...legacy } = value
  return workoutTemplateDetail({ ...legacy, contract_version: 1 }, input)
}
function workoutTemplateDay(value: unknown, input: { template: string; expected_read_token: WorkoutTemplateReadTokenV1 | null }): value is WorkoutTemplateDayV1 {
  return exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'supported', 'day', 'read_token'])
    && value.contract_version === 1 && value.template_id === input.template && phase4Uuid(value.template_id)
    && phase4BuilderVersion(value.builder_version) && typeof value.supported === 'boolean'
    && phase4Nullable(value.day, workoutTemplateDayShape) && workoutTemplateToken(value.read_token)
    && (value.supported ? value.day !== null : value.day === null)
    && (input.expected_read_token === null || value.read_token === input.expected_read_token)
}
function workoutTemplateCreate(value: unknown, input: { gym: string }): value is WorkoutTemplateCreateV1Result {
  return exactKeys(value, ['contract_version', 'template_id', 'day_identity_token', 'builder_version', 'readiness', 'archived'])
    && value.contract_version === 1 && phase4Uuid(value.template_id) && phase4Uuid(value.day_identity_token)
    && phase4BuilderVersion(value.builder_version) && value.readiness === 'draft' && value.archived === false && Boolean(input.gym)
}
function workoutTemplateSave(value: unknown, input: { template: string; expected_builder_version: number; day: SaveCoachProgramDayV3 }): value is WorkoutTemplateSaveDayV1Result {
  return exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'readiness', 'day'])
    && value.contract_version === 1 && value.template_id === input.template && phase4Uuid(value.template_id)
    && phase4BuilderVersion(value.builder_version) && value.builder_version > input.expected_builder_version
    && value.readiness === 'draft' && workoutTemplateDayShape(value.day)
    && workoutTemplateDayCorrelates(value.day, input.day)
}
function workoutTemplateReadiness(value: unknown, input: { template: string; expected_builder_version: number; target_readiness: 'draft' | 'ready' }): value is WorkoutTemplateReadinessV1Result {
  return exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'readiness'])
    && value.contract_version === 1 && value.template_id === input.template && phase4Uuid(value.template_id)
    && value.builder_version === input.expected_builder_version && value.readiness === input.target_readiness
}
function workoutTemplateReadinessV2(value: unknown, input: Parameters<typeof workoutTemplateReadiness>[1]): value is WorkoutTemplateReadinessV2Result {
  if (!exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'readiness', 'rich_supported']) || value.contract_version !== 2 || typeof value.rich_supported !== 'boolean') return false
  const { rich_supported: _rich, ...legacy } = value
  return workoutTemplateReadiness({ ...legacy, contract_version: 1 }, input)
}
function workoutTemplateArchive(value: unknown, input: { template: string; expected_builder_version: number }, restore: boolean): value is WorkoutTemplateArchiveV1Result {
  const keys = restore ? ['contract_version', 'template_id', 'builder_version', 'archived', 'readiness'] : ['contract_version', 'template_id', 'builder_version', 'archived']
  return exactKeys(value, keys) && value.contract_version === 1 && value.template_id === input.template
    && phase4Uuid(value.template_id) && phase4BuilderVersion(value.builder_version) && value.builder_version > input.expected_builder_version
    && value.archived === !restore && (!restore || value.readiness === 'draft')
}
function workoutTemplateApply(value: unknown, input: ApplyWorkoutTemplateV1Input): value is ApplyWorkoutTemplateV1Result {
  if (!exactKeys(value, ['contract_version', 'template_id', 'template_builder_version', 'program_result'])
    || value.contract_version !== 1 || value.template_id !== input.template || value.template_builder_version !== input.expected_template_builder_version
    || !phase4Uuid(value.template_id) || !phase4BuilderVersion(value.template_builder_version)) return false
  const result = value.program_result as UnknownRecord
  return exactKeys(result, ['contract_version', 'program_id', 'assignment_id', 'day_identity_token', 'builder_version', 'unchanged', 'day'])
    && result.contract_version === 3 && result.program_id === input.program && result.assignment_id === input.assignment
    && result.day_identity_token === input.destination_day_identity_token && phase4Uuid(result.program_id)
    && phase4Uuid(result.assignment_id) && phase4Uuid(result.day_identity_token)
    && phase4BuilderVersion(result.builder_version) && result.builder_version > input.expected_program_builder_version
    && result.unchanged === false && workoutTemplateDayShape(result.day)
    && result.day.identity_token === input.destination_day_identity_token
}
function workoutTemplateApplyV2(value: unknown, input: ApplyWorkoutTemplateV1Input): value is ApplyWorkoutTemplateV2Result {
  return exactKeys(value, ['contract_version', 'template_id', 'template_builder_version', 'program_result'])
    && value.contract_version === 2 && value.template_id === input.template
    && value.template_builder_version === input.expected_template_builder_version
    && exactKeys(value.program_result, ['contract_version', 'program_id', 'assignment_id', 'day_identity_token', 'builder_version', 'unchanged', 'day'])
    && value.program_result.contract_version === 4 && value.program_result.program_id === input.program
    && value.program_result.assignment_id === input.assignment
    && value.program_result.day_identity_token === input.destination_day_identity_token
    && phase4BuilderVersion(value.program_result.builder_version) && value.program_result.builder_version > input.expected_program_builder_version
    && value.program_result.unchanged === false && richReadDay(value.program_result.day, false)
    && value.program_result.day.identity_token === input.destination_day_identity_token
}
function workoutTemplateApplyV3(value: unknown, input: ApplyWorkoutTemplateV1Input): value is ApplyWorkoutTemplateV3Result {
  return exactKeys(value, ['contract_version', 'template_id', 'template_builder_version', 'program_result'])
    && value.contract_version === 3
    && workoutTemplateApplyV2({ ...value, contract_version: 2 }, input)
}
function workoutTemplateApplyV4(value: unknown, input: ApplyWorkoutTemplateV4Input): value is ApplyWorkoutTemplateV4Result {
  return exactKeys(value, ['contract_version', 'template_id', 'template_builder_version', 'program_result', 'created_day_identity_token'])
    && value.contract_version === 4 && phase4Uuid(value.created_day_identity_token)
    && workoutTemplateApplyV3({ contract_version: 3, template_id: value.template_id,
      template_builder_version: value.template_builder_version, program_result: value.program_result },
      { ...input, destination_day_identity_token: value.created_day_identity_token })
}

const programTemplateItem = (value: unknown): value is ProgramTemplateLibraryItemV1 =>
  exactKeys(value, ['template_id', 'name', 'builder_version', 'archived_at', 'week_count'])
  && phase4Uuid(value.template_id) && phase4AuthoredText(value.name, 120)
  && phase4BuilderVersion(value.builder_version)
  && phase4Nullable(value.archived_at, phase4Timestamp)
  && phase4Integer(value.week_count, 1, 12)
const programTemplateCursor = (value: unknown): value is NonNullable<ProgramTemplateLibraryV1['next_cursor']> =>
  exactKeys(value, ['name', 'template_id']) && phase4AuthoredText(value.name, 120)
  && phase4Uuid(value.template_id)
function programTemplateLibrary(value: unknown): value is ProgramTemplateLibraryV1 {
  if (!exactKeys(value, ['contract_version', 'items', 'has_more', 'next_cursor'])
    || value.contract_version !== 1 || !phase4Array(value.items, 50, programTemplateItem)
    || typeof value.has_more !== 'boolean'
    || !phase4Nullable(value.next_cursor, programTemplateCursor)) return false
  return value.next_cursor === null ? value.items.length === 0
    : value.items.length > 0 && value.next_cursor.template_id === value.items[value.items.length - 1].template_id
}
const programTemplateDaySummary = (value: unknown): value is ProgramTemplateDaySummaryV1 =>
  exactKeys(value, ['day_id', 'day_ordinal', 'label', 'subtitle', 'marked_rest', 'supported', 'exercise_count', 'set_count'])
  && phase4Uuid(value.day_id) && phase4Integer(value.day_ordinal, 1, 7)
  && phase4NullableAuthoredText(value.label, 120) && phase4NullableAuthoredText(value.subtitle, 500)
  && typeof value.marked_rest === 'boolean' && typeof value.supported === 'boolean'
  && phase4Integer(value.exercise_count, 0, 12) && phase4Integer(value.set_count, 0, 240)
function programTemplateDetail(value: unknown, input: { template: Phase4Uuid }): value is ProgramTemplateDetailV1 {
  if (!exactKeys(value, ['contract_version', 'template_id', 'gym_id', 'name', 'default_unit', 'builder_version', 'archived_at', 'weeks'])
    || value.contract_version !== 1 || value.template_id !== input.template || !phase4Uuid(value.gym_id)
    || !phase4AuthoredText(value.name, 120) || !phase4Enum(value.default_unit, ['lb', 'kg'])
    || !phase4BuilderVersion(value.builder_version) || !phase4Nullable(value.archived_at, phase4Timestamp)
    || !phase4Array(value.weeks, 12, (week): week is ProgramTemplateDetailV1['weeks'][number] =>
      exactKeys(week, ['week_id', 'week_ordinal', 'days']) && phase4Uuid(week.week_id)
      && phase4Integer(week.week_ordinal, 1, 12)
      && phase4Array(week.days, 7, programTemplateDaySummary, 7)
      && week.days.every((day, index) => day.day_ordinal === index + 1), 1)) return false
  return value.weeks.every((week, index) => week.week_ordinal === index + 1)
}
const programTemplateAdvancedSet = (value: unknown): value is ProgramTemplateAdvancedExerciseV1['sets'][number] =>
  exactKeys(value, ['ordinal', 'sets_mode', 'sets_min', 'sets_max', 'dose_mode', 'reps_mode', 'dose_min', 'dose_max', 'load_mode', 'exact_weight', 'percent', 'rpe_min', 'rpe_max', 'qualitative', 'note'])
  && phase4Integer(value.ordinal, 1, 50) && phase4NonemptyText(value.sets_mode, 40)
  && phase4Integer(value.sets_min, 1, 100) && (value.sets_max === null || phase4Integer(value.sets_max, 1, 100))
  && phase4NonemptyText(value.dose_mode, 40) && phase4NullableNonemptyText(value.reps_mode, 40)
  && (value.dose_min === null || phase4Decimal(value.dose_min, 0, 10000, 3))
  && (value.dose_max === null || phase4Decimal(value.dose_max, 0, 10000, 3))
  && phase4NonemptyText(value.load_mode, 40)
  && (value.exact_weight === null || phase4Decimal(value.exact_weight, 0, 2000, 3))
  && (value.percent === null || phase4Decimal(value.percent, 0, 1000, 3))
  && (value.rpe_min === null || phase4Decimal(value.rpe_min, 0, 10, 1))
  && (value.rpe_max === null || phase4Decimal(value.rpe_max, 0, 10, 1))
  && phase4NullableText(value.qualitative, 120) && phase4NullableText(value.note, 1000)
const programTemplateAdvancedExercise = (value: unknown): value is ProgramTemplateAdvancedExerciseV1 =>
  exactKeys(value, ['name', 'ordinal', 'status', 'group_type', 'group_title', 'sets'])
  && phase4AuthoredText(value.name, 120) && phase4Integer(value.ordinal, 1, 100)
  && phase4NonemptyText(value.status, 40) && phase4NullableNonemptyText(value.group_type, 40)
  && phase4NullableAuthoredText(value.group_title, 120)
  && phase4Array(value.sets, 100, programTemplateAdvancedSet)
function programTemplateDay(value: unknown, input: { template: Phase4Uuid; day_id: Phase4Uuid }): value is ProgramTemplateDayV1 {
  if (!exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'supported', 'day', 'advanced'])
    || value.contract_version !== 1 || value.template_id !== input.template
    || !phase4BuilderVersion(value.builder_version) || typeof value.supported !== 'boolean') return false
  return value.supported
    ? value.advanced === null && phase5SaveDay(value.day) && value.day.identity_token === input.day_id
      && value.day.ordinal <= 7 && value.day.exercises.every((exercise) => exercise.mode === 'replace')
    : value.day === null && phase4Array(value.advanced, 100, programTemplateAdvancedExercise)
}
function programTemplateCreate(value: unknown, input: { week_count: number }): value is ProgramTemplateCreateV1 {
  return exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'week_count'])
    && value.contract_version === 1 && phase4Uuid(value.template_id)
    && phase4BuilderVersion(value.builder_version) && phase4Integer(value.week_count, 1, 12)
    && value.week_count === input.week_count
}
function programTemplateSave(value: unknown, input: { template: Phase4Uuid; expected_builder_version: number; day: SaveCoachProgramDayV3 }): value is ProgramTemplateSaveDayV1 {
  return exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'day'])
    && value.contract_version === 1 && value.template_id === input.template
    && phase4BuilderVersion(value.builder_version) && value.builder_version > input.expected_builder_version
    && phase5SaveDay(value.day) && value.day.identity_token === input.day.identity_token
    && value.day.ordinal === input.day.ordinal
}
function programTemplateAppend(value: unknown, input: { template: Phase4Uuid; expected_builder_version: number }): value is ProgramTemplateAppendWeekV1 {
  return exactKeys(value, ['contract_version', 'template_id', 'week_id', 'week_ordinal', 'builder_version'])
    && value.contract_version === 1 && value.template_id === input.template && phase4Uuid(value.week_id)
    && phase4Integer(value.week_ordinal, 2, 12) && phase4BuilderVersion(value.builder_version)
    && value.builder_version > input.expected_builder_version
}
function programTemplateCopyWeek(value: unknown, input: { request_id: Phase4Uuid; template: Phase4Uuid; source_week_id: Phase4Uuid; destination_week_id: Phase4Uuid; expected_builder_version: number }): value is ProgramTemplateCopyWeekV1 {
  return exactKeys(value, ['contract_version', 'request_id', 'template_id', 'source_week_id', 'destination_week_id', 'builder_version_before', 'builder_version', 'copied_day_count'])
    && value.contract_version === 1 && value.request_id === input.request_id
    && value.template_id === input.template && value.source_week_id === input.source_week_id
    && value.destination_week_id === input.destination_week_id
    && value.builder_version_before === input.expected_builder_version
    && phase4BuilderVersion(value.builder_version) && value.builder_version > input.expected_builder_version
    && value.copied_day_count === 7
}
function programTemplateCopyWeekV2(value: unknown, input: Parameters<typeof programTemplateCopyWeek>[1]): value is ProgramTemplateCopyWeekV2 {
  return exactKeys(value, ['contract_version', 'request_id', 'template_id', 'source_week_id', 'destination_week_id', 'builder_version_before', 'builder_version', 'copied_day_count'])
    && value.contract_version === 2 && programTemplateCopyWeek({ ...value, contract_version: 1 }, input)
}
function programTemplateSnapshot(value: unknown, input: { request_id: Phase4Uuid; program: Phase4Uuid; expected_builder_version: number }): value is ProgramTemplateSnapshotV1 {
  return exactKeys(value, ['contract_version', 'request_id', 'template_id', 'builder_version', 'week_count', 'source_program_id', 'source_builder_version'])
    && value.contract_version === 1 && value.request_id === input.request_id && phase4Uuid(value.template_id)
    && phase4BuilderVersion(value.builder_version) && phase4Integer(value.week_count, 1, 12)
    && value.source_program_id === input.program && value.source_builder_version === input.expected_builder_version
}
function programTemplateSnapshotV2(value: unknown, input: Parameters<typeof programTemplateSnapshot>[1]): value is ProgramTemplateSnapshotV2 {
  return exactKeys(value, ['contract_version', 'request_id', 'template_id', 'builder_version', 'week_count', 'source_program_id', 'source_builder_version'])
    && value.contract_version === 2 && programTemplateSnapshot({ ...value, contract_version: 1 }, input)
}
function programTemplateApply(value: unknown, input: { request_id: Phase4Uuid; template: Phase4Uuid; expected_template_builder_version: number }): value is ProgramTemplateApplyV1 {
  return exactKeys(value, ['contract_version', 'request_id', 'template_id', 'template_builder_version', 'program_id', 'assignment_id', 'builder_version', 'assignment_status', 'week_count'])
    && value.contract_version === 1 && value.request_id === input.request_id && value.template_id === input.template
    && value.template_builder_version === input.expected_template_builder_version
    && phase4Uuid(value.program_id) && phase4Uuid(value.assignment_id)
    && phase4BuilderVersion(value.builder_version) && value.assignment_status === 'paused'
    && phase4Integer(value.week_count, 1, 12)
}
function programTemplateApplyV2(value: unknown, input: Parameters<typeof programTemplateApply>[1]): value is ProgramTemplateApplyV2 {
  return exactKeys(value, ['contract_version', 'request_id', 'template_id', 'template_builder_version', 'program_id', 'assignment_id', 'builder_version', 'assignment_status', 'week_count'])
    && value.contract_version === 2 && programTemplateApply({ ...value, contract_version: 1 }, input)
}
function programTemplateArchive(value: unknown, input: { template: Phase4Uuid; expected_builder_version: number; archived: boolean }): value is ProgramTemplateArchiveV1 {
  return exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'archived'])
    && value.contract_version === 1 && value.template_id === input.template
    && phase4BuilderVersion(value.builder_version) && value.builder_version > input.expected_builder_version
    && value.archived === input.archived
}

const readinessIssueCodes = ['empty_unmarked_day', 'rest_day_has_content', 'day_label_missing', 'exercise_without_prescription', 'percent_load_unresolved', 'superset_too_small', 'superset_duplicate_exercise'] as const
function phase4ReadinessIssue(value: unknown): value is CoachReadinessIssueV1 {
  if (!exactKeys(value, ['code', 'week_identity_token', 'week_ordinal', 'day_identity_token', 'day_ordinal', 'exercise_identity_token', 'exercise_ordinal', 'set_identity_token', 'set_ordinal'])
    || !phase4Enum(value.code, readinessIssueCodes) || !phase4Uuid(value.week_identity_token)
    || !phase4Integer(value.week_ordinal, 1, 12) || !phase4Nullable(value.day_identity_token, phase4Uuid)
    || !phase4Integer(value.day_ordinal, 1, 7) || !phase4Nullable(value.exercise_identity_token, phase4Uuid)
    || !(value.exercise_ordinal === null || phase4Int32(value.exercise_ordinal, 1))
    || !phase4Nullable(value.set_identity_token, phase4Uuid)
    || !(value.set_ordinal === null || phase4Int32(value.set_ordinal, 1))) return false
  return (value.exercise_identity_token === null) === (value.exercise_ordinal === null)
    && (value.set_identity_token === null) === (value.set_ordinal === null)
    && (value.set_identity_token === null || value.exercise_identity_token !== null)
}

function phase4Readiness(value: unknown, input: SetCoachProgramReadinessV1Input): value is SetCoachProgramReadinessV1Result {
  if (!exactKeys(value, ['program_id', 'assignment_id', 'builder_version', 'readiness', 'changed', 'ready_at', 'issue_count', 'issues_truncated', 'issues'])
    || value.program_id !== input.program || value.assignment_id !== input.assignment
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || !phase4BuilderVersion(value.builder_version)
    || (input.target_state === 'ready'
      ? value.builder_version < input.expected_builder_version
      : value.builder_version !== input.expected_builder_version)
    || !phase4Enum(value.readiness, ['draft', 'ready']) || typeof value.changed !== 'boolean'
    || !phase4Nullable(value.ready_at, phase4Timestamp) || !phase4NonnegativeBigint(value.issue_count)
    || typeof value.issues_truncated !== 'boolean' || !phase4Array(value.issues, 256, phase4ReadinessIssue)) return false
  const issueCount = BigInt(value.issue_count)
  return (value.readiness === 'ready') === (value.ready_at !== null)
    && (value.issues_truncated ? issueCount > BigInt(value.issues.length) : issueCount === BigInt(value.issues.length))
    && (value.readiness === 'ready' ? value.issues.length === 0 : true)
}

function phase4CopySource(value: unknown, kind: 'day' | 'week'): value is CoachCopySourceResultV1 {
  return exactKeys(value, ['week_identity_token', 'week_ordinal', 'day_identity_token', 'day_ordinal'])
    && phase4Uuid(value.week_identity_token) && phase4Integer(value.week_ordinal, 1, 12)
    && (kind === 'day'
      ? phase4Uuid(value.day_identity_token) && phase4Integer(value.day_ordinal, 1, 7)
      : value.day_identity_token === null && value.day_ordinal === null)
}

function phase4CopyDestinationDay(value: unknown): value is CoachCopyDestinationDayV1 {
  return exactKeys(value, ['source_day_identity_token', 'destination_day_identity_token', 'day_ordinal', 'label', 'status', 'proposed_action'])
    && phase4Uuid(value.source_day_identity_token) && phase4Nullable(value.destination_day_identity_token, phase4Uuid)
    && phase4Integer(value.day_ordinal, 1, 7) && phase4NullableNonemptyText(value.label, 120)
    && phase4Enum(value.status, ['unscheduled', 'authored_empty', 'workout', 'rest', 'locked'])
    && phase4Enum(value.proposed_action, ['populate', 'replace', 'preserve', 'locked', 'already_equal'])
}

function phase4CopyCollision(value: unknown): value is CoachCopyCollisionV1 {
  return exactKeys(value, ['destination_day_identity_token', 'day_ordinal', 'label', 'status', 'proposed_action'])
    && phase4Uuid(value.destination_day_identity_token) && phase4Integer(value.day_ordinal, 1, 7)
    && phase4NullableNonemptyText(value.label, 120) && phase4Enum(value.status, ['workout', 'rest', 'locked'])
    && phase4Enum(value.proposed_action, ['replace', 'preserve', 'locked', 'already_equal'])
}

function phase4CopyDestinationOnlyDay(value: unknown): value is CoachCopyDestinationOnlyDayV1 {
  return exactKeys(value, ['destination_day_identity_token', 'day_ordinal', 'label', 'status', 'proposed_action'])
    && phase4Uuid(value.destination_day_identity_token) && phase4Integer(value.day_ordinal, 1, 7)
    && phase4NullableNonemptyText(value.label, 120) && phase4Enum(value.status, ['authored_empty', 'workout', 'rest', 'locked'])
    && phase4Enum(value.proposed_action, ['preserve', 'delete', 'locked'])
}

function phase4CopyDestinationPlan(value: unknown, kind: 'day' | 'week'): value is CoachCopyDestinationPlanV1 {
  if (!exactKeys(value, ['week_identity_token', 'week_ordinal', 'day_ordinal', 'existing_day_identity_token', 'classification', 'collision_policy', 'proposed_action', 'workout_count', 'rest_count', 'open_count', 'destination_only_count', 'destination_days', 'collisions', 'destination_only_days'])
    || !phase4Uuid(value.week_identity_token) || !phase4Integer(value.week_ordinal, 1, 12)
    || !phase4Nullable(value.existing_day_identity_token, phase4Uuid)
    || !phase4Enum(value.classification, ['empty', 'populated', 'locked', 'same_scope'])
    || !phase4Enum(value.collision_policy, ['preserve', 'replace'])
    || !phase4Enum(value.proposed_action, ['populate', 'replace', 'preserve', 'locked', 'unavailable', 'already_equal'])
    || !phase4Integer(value.workout_count, 0, 7) || !phase4Integer(value.rest_count, 0, 7)
    || !phase4Integer(value.open_count, 0, 7) || !phase4Integer(value.destination_only_count, 0, 7)
    || !phase4Array(value.destination_days, 7, phase4CopyDestinationDay)
    || !phase4Array(value.collisions, 7, phase4CopyCollision)
    || !phase4Array(value.destination_only_days, 7, phase4CopyDestinationOnlyDay)) return false
  return kind === 'day'
    ? phase4Integer(value.day_ordinal, 1, 7) && value.destination_days.length === 1
      && value.destination_only_days.length === 0 && value.destination_only_count === 0
    : value.day_ordinal === null && value.existing_day_identity_token === null
      && value.destination_only_count === value.destination_only_days.length
}

function phase4CopyDestinationResult(value: unknown, kind: 'day' | 'week'): value is CoachCopyDestinationResultV1 {
  if (!exactKeys(value, ['week_identity_token', 'week_ordinal', 'day_ordinal', 'existing_day_identity_token', 'classification', 'collision_policy', 'proposed_action', 'workout_count', 'rest_count', 'open_count', 'destination_only_count', 'destination_days', 'collisions', 'destination_only_days', 'outcome'])
    || !phase4Enum(value.outcome, ['applied', 'applied_with_preserved', 'preserved', 'skipped', 'locked'])
    || !phase4Uuid(value.week_identity_token) || !phase4Integer(value.week_ordinal, 1, 12)
    || !phase4Nullable(value.existing_day_identity_token, phase4Uuid)
    || !phase4Enum(value.classification, ['empty', 'populated', 'locked', 'same_scope'])
    || !phase4Enum(value.collision_policy, ['preserve', 'replace'])
    || !phase4Enum(value.proposed_action, ['populate', 'replace', 'preserve', 'locked', 'unavailable', 'already_equal'])
    || !phase4Integer(value.workout_count, 0, 7) || !phase4Integer(value.rest_count, 0, 7)
    || !phase4Integer(value.open_count, 0, 7) || !phase4Integer(value.destination_only_count, 0, 7)
    || !phase4Array(value.destination_days, 7, phase4CopyDestinationDay)
    || !phase4Array(value.collisions, 7, phase4CopyCollision)
    || !phase4Array(value.destination_only_days, 7, phase4CopyDestinationOnlyDay)) return false
  return kind === 'day'
    ? phase4Integer(value.day_ordinal, 1, 7) && value.destination_days.length === 1
      && value.destination_only_days.length === 0 && value.destination_only_count === 0
    : value.day_ordinal === null && value.existing_day_identity_token === null
      && value.destination_only_count === value.destination_only_days.length
}

function phase4Undo(value: unknown): value is CoachOperationUndoV1 {
  return exactKeys(value, ['undo_id', 'expires_at']) && phase4Uuid(value.undo_id) && phase4Timestamp(value.expires_at)
}

function phase4PreviewCopy(value: unknown, input: PreviewBuilderCopyV1Input): value is PreviewBuilderCopyV1Result {
  if (!exactKeys(value, ['program_id', 'assignment_id', 'builder_version', 'copy_kind', 'source', 'destinations', 'totals', 'can_apply'])
    || value.program_id !== input.program || value.assignment_id !== input.assignment
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || !phase4BuilderVersion(value.builder_version) || value.builder_version !== input.expected_builder_version
    || value.copy_kind !== input.copy_kind || !phase4Enum(value.copy_kind, ['day', 'week'])) return false
  const copyKind = value.copy_kind
  if (!phase4CopySource(value.source, copyKind)
    || !phase4Array(value.destinations, copyKind === 'day' ? 1 : 11,
      (destination): destination is CoachCopyDestinationPlanV1 => phase4CopyDestinationPlan(destination, copyKind), 1)
    || !exactKeys(value.totals, ['apply_destinations', 'changed_days', 'preserved_days', 'locked_destinations'])
    || !phase4Integer(value.totals.apply_destinations, 0, copyKind === 'day' ? 1 : 11)
    || !phase4Integer(value.totals.changed_days, 0, copyKind === 'day' ? 1 : 77)
    || !phase4Integer(value.totals.preserved_days, 0, copyKind === 'day' ? 1 : 77)
    || !phase4Integer(value.totals.locked_destinations, 0, copyKind === 'day' ? 1 : 11)
    || typeof value.can_apply !== 'boolean') return false
  return copyKind === 'week' || value.destinations.length === 1
}

function phase4ApplyCopy(value: unknown, input: ApplyBuilderCopyV1Input): value is ApplyBuilderCopyV1Result {
  const expectedKind = input.copy_kind
  const destinationMaximum = expectedKind === 'day' ? 1 : 11
  if (!exactKeys(value, ['request_id', 'operation_type', 'program_id', 'assignment_id', 'builder_version_before', 'builder_version_after', 'unchanged', 'destinations', 'applied', 'preserved', 'skipped', 'locked', 'undo'])
    || value.operation_type !== `copy_${expectedKind}` || value.request_id !== input.request_id || !phase4Uuid(value.request_id)
    || value.program_id !== input.program || value.assignment_id !== input.assignment
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || !phase4BuilderVersion(value.builder_version_before) || value.builder_version_before !== input.expected_builder_version
    || !phase4BuilderVersion(value.builder_version_after)
    || typeof value.unchanged !== 'boolean'
    || !phase4Array(value.destinations, destinationMaximum,
      (destination): destination is CoachCopyDestinationResultV1 => phase4CopyDestinationResult(destination, expectedKind), 1)
    || !phase4Array(value.applied, destinationMaximum, (entry): entry is ApplyBuilderCopyV1Result['applied'][number] =>
      exactKeys(entry, ['week_identity_token', 'day_ordinal', 'changed_day_ordinals']) && phase4Uuid(entry.week_identity_token)
      && (expectedKind === 'day' ? phase4Integer(entry.day_ordinal, 1, 7) : entry.day_ordinal === null)
      && phase4Array(entry.changed_day_ordinals, 7, (ordinal): ordinal is number => phase4Integer(ordinal, 1, 7)))
    || !phase4Array(value.preserved, expectedKind === 'day' ? 1 : 77, (entry): entry is ApplyBuilderCopyV1Result['preserved'][number] =>
      exactKeys(entry, ['week_identity_token', 'day_ordinal', 'day_identity_token', 'reason'])
      && phase4Uuid(entry.week_identity_token) && phase4Integer(entry.day_ordinal, 1, 7)
      && phase4Uuid(entry.day_identity_token) && entry.reason === 'collision')
    || !phase4Array(value.skipped, destinationMaximum, (entry): entry is ApplyBuilderCopyV1Result['skipped'][number] =>
      exactKeys(entry, ['week_identity_token', 'day_ordinal', 'reason']) && phase4Uuid(entry.week_identity_token)
      && (expectedKind === 'day' ? phase4Integer(entry.day_ordinal, 1, 7) : entry.day_ordinal === null)
      && phase4Enum(entry.reason, ['already_equal', 'no_source_content']))
    || !phase4Array(value.locked, destinationMaximum, (entry): entry is ApplyBuilderCopyV1Result['locked'][number] =>
      exactKeys(entry, ['week_identity_token', 'day_ordinal', 'day_identity_tokens']) && phase4Uuid(entry.week_identity_token)
      && (expectedKind === 'day' ? phase4Integer(entry.day_ordinal, 1, 7) : entry.day_ordinal === null)
      && phase4Array(entry.day_identity_tokens, 7, phase4Uuid, 1))
    || !phase4Nullable(value.undo, phase4Undo)) return false
  if (value.destinations.length !== input.destinations.length) return false
  return value.unchanged
    ? value.builder_version_after === value.builder_version_before && value.undo === null
    : value.builder_version_after > value.builder_version_before && value.undo !== null
}

function phase5PreviewCopy(value: unknown, input: PreviewBuilderCopyV2Input): value is PreviewBuilderCopyV2Result {
  const requestedWeeks = input.destinations.map(destination => destination.week_identity_token)
  if (new Set(requestedWeeks).size !== requestedWeeks.length) return false
  if (!exactKeys(value, ['contract_version', 'preview_guard', 'program_id', 'assignment_id', 'builder_version', 'copy_kind', 'source', 'destinations', 'totals', 'can_apply'])
    || value.contract_version !== 2 || !phase4Hex(value.preview_guard)
    || value.program_id !== input.program || value.assignment_id !== input.assignment
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || !phase4BuilderVersion(value.builder_version) || value.builder_version !== input.expected_builder_version
    || value.copy_kind !== 'day' || !phase4CopySource(value.source, 'day')
    || value.source.week_identity_token !== input.source.week_identity_token
    || value.source.day_identity_token !== input.source.day_identity_token
    || !phase4Array(value.destinations, 11,
      (destination): destination is CoachCopyDestinationPlanV1 => phase4CopyDestinationPlan(destination, 'day'), 1)
    || value.destinations.length !== input.destinations.length
    || !exactKeys(value.totals, ['apply_destinations', 'changed_days', 'preserved_days', 'locked_destinations'])
    || !phase4Integer(value.totals.apply_destinations, 0, 11)
    || !phase4Integer(value.totals.changed_days, 0, 11)
    || !phase4Integer(value.totals.preserved_days, 0, 11)
    || !phase4Integer(value.totals.locked_destinations, 0, 11)
    || typeof value.can_apply !== 'boolean') return false
  if (!value.destinations.every((destination, index) => {
    const requested = input.destinations[index]
    return destination.week_identity_token === requested.week_identity_token
      && destination.day_ordinal === requested.day_ordinal
      && destination.collision_policy === requested.collision_policy
      && destination.destination_days.every(day => day.source_day_identity_token === input.source.day_identity_token)
  })) return false
  const applyDestinations = value.destinations.filter(destination =>
    destination.proposed_action === 'populate' || destination.proposed_action === 'replace').length
  const preservedDays = value.destinations.filter(destination => destination.proposed_action === 'preserve').length
  const lockedDestinations = value.destinations.filter(destination => destination.classification === 'locked').length
  const expectedCanApply = value.destinations.some(destination => destination.classification !== 'same_scope')
    && value.destinations.every(destination =>
    destination.classification !== 'locked' && destination.classification !== 'same_scope'
      && destination.collisions.every(collision => collision.proposed_action !== 'preserve'))
  return value.totals.apply_destinations === applyDestinations
    && value.totals.changed_days === applyDestinations
    && value.totals.preserved_days === preservedDays
    && value.totals.locked_destinations === lockedDestinations
    && value.can_apply === expectedCanApply
}

function phase5ApplyCopy(value: unknown, input: ApplyBuilderCopyV2Input): value is ApplyBuilderCopyV2Result {
  const requestedWeeks = input.destinations.map(destination => destination.week_identity_token)
  if (new Set(requestedWeeks).size !== requestedWeeks.length) return false
  if (!exactKeys(value, ['contract_version', 'preview_guard', 'request_id', 'operation_type', 'program_id', 'assignment_id', 'builder_version_before', 'builder_version_after', 'unchanged', 'destinations', 'applied', 'preserved', 'skipped', 'locked', 'undo'])
    || value.contract_version !== 2 || value.preview_guard !== input.preview_guard || !phase4Hex(value.preview_guard)
    || value.operation_type !== 'copy_day' || value.request_id !== input.request_id || !phase4Uuid(value.request_id)
    || value.program_id !== input.program || value.assignment_id !== input.assignment
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || !phase4BuilderVersion(value.builder_version_before) || value.builder_version_before !== input.expected_builder_version
    || !phase4BuilderVersion(value.builder_version_after) || typeof value.unchanged !== 'boolean'
    || !phase4Array(value.destinations, 11,
      (destination): destination is CoachCopyDestinationResultV1 => phase4CopyDestinationResult(destination, 'day'), 1)
    || value.destinations.length !== input.destinations.length
    || !phase4Array(value.applied, 11, (entry): entry is ApplyBuilderCopyV1Result['applied'][number] =>
      exactKeys(entry, ['week_identity_token', 'day_ordinal', 'changed_day_ordinals'])
      && phase4Uuid(entry.week_identity_token) && phase4Integer(entry.day_ordinal, 1, 7)
      && phase4Array(entry.changed_day_ordinals, 1, (ordinal): ordinal is number => phase4Integer(ordinal, 1, 7), 1))
    || !phase4Array(value.preserved, 11, (entry): entry is ApplyBuilderCopyV1Result['preserved'][number] =>
      exactKeys(entry, ['week_identity_token', 'day_ordinal', 'day_identity_token', 'reason'])
      && phase4Uuid(entry.week_identity_token) && phase4Integer(entry.day_ordinal, 1, 7)
      && phase4Uuid(entry.day_identity_token) && entry.reason === 'collision')
    || !phase4Array(value.skipped, 11, (entry): entry is ApplyBuilderCopyV1Result['skipped'][number] =>
      exactKeys(entry, ['week_identity_token', 'day_ordinal', 'reason'])
      && phase4Uuid(entry.week_identity_token) && phase4Integer(entry.day_ordinal, 1, 7)
      && phase4Enum(entry.reason, ['already_equal', 'no_source_content']))
    || !Array.isArray(value.locked) || value.locked.length !== 0 || value.preserved.length !== 0
    || !phase4Nullable(value.undo, phase4Undo)) return false
  if (!value.destinations.every((destination, index) => {
    const requested = input.destinations[index]
    return destination.week_identity_token === requested.week_identity_token
      && destination.day_ordinal === requested.day_ordinal
      && destination.collision_policy === requested.collision_policy
      && destination.destination_days.every(day => day.source_day_identity_token === input.source.day_identity_token)
  })) return false
  const applied = value.applied as ApplyBuilderCopyV1Result['applied']
  const skipped = value.skipped as ApplyBuilderCopyV1Result['skipped']
  const partitionKey = (entry: { week_identity_token: string; day_ordinal: number | null }) => `${entry.week_identity_token}:${entry.day_ordinal ?? ''}`
  const appliedKeys = applied.map(partitionKey)
  const skippedKeys = skipped.map(partitionKey)
  if (new Set(appliedKeys).size !== appliedKeys.length || new Set(skippedKeys).size !== skippedKeys.length
    || appliedKeys.length + skippedKeys.length !== input.destinations.length) return false
  if (!value.destinations.every((destination, index) => {
    const requested = input.destinations[index]
    const key = `${requested.week_identity_token}:${requested.day_ordinal}`
    const appliedCount = appliedKeys.filter(candidate => candidate === key).length
    const skippedCount = skippedKeys.filter(candidate => candidate === key).length
    return destination.outcome === 'applied'
      ? appliedCount === 1 && skippedCount === 0
        && applied.some(entry => partitionKey(entry) === key
          && entry.changed_day_ordinals.length === 1 && entry.changed_day_ordinals[0] === requested.day_ordinal)
      : destination.outcome === 'skipped' && skippedCount === 1 && appliedCount === 0
  })) return false
  return value.unchanged
    ? applied.length === 0 && value.destinations.every(destination => destination.outcome === 'skipped')
      && value.builder_version_after === value.builder_version_before && value.undo === null
    : applied.length >= 1 && value.builder_version_after > value.builder_version_before && value.undo !== null
}

function phase4Transform(value: unknown): value is ProgressionTransform {
  if (!isRecord(value)) return false
  if (value.kind === 'exact_load') return exactKeys(value, ['kind', 'direction', 'amount', 'unit'])
    && phase4Enum(value.direction, ['add', 'subtract']) && phase4Decimal(value.amount, Number.MIN_VALUE, 2000, 3)
    && phase4Enum(value.unit, ['lb', 'kg'])
  if (value.kind === 'percent_points') return exactKeys(value, ['kind', 'direction', 'amount'])
    && phase4Enum(value.direction, ['add', 'subtract']) && phase4Decimal(value.amount, Number.MIN_VALUE, 200, 3)
  if (value.kind === 'reps') return exactKeys(value, ['kind', 'direction', 'amount'])
    && phase4Enum(value.direction, ['add', 'subtract']) && phase4Integer(value.amount, 1, 99)
  if (value.kind === 'rpe') return exactKeys(value, ['kind', 'direction', 'amount'])
    && phase4Enum(value.direction, ['add', 'subtract']) && phase4Decimal(value.amount, Number.MIN_VALUE, 9, 1)
  return value.kind === 'sets' && exactKeys(value, ['kind', 'direction', 'amount'])
    && phase4Enum(value.direction, ['add', 'remove']) && phase4Integer(value.amount, 1, 19)
}

function sameTransform(left: ProgressionTransform, right: ProgressionTransform): boolean {
  if (left.kind !== right.kind || left.direction !== right.direction || left.amount !== right.amount) return false
  return left.kind !== 'exact_load' || (right.kind === 'exact_load' && left.unit === right.unit)
}

function phase4ProgressionValue(value: unknown, kind: ProgressionTransform['kind'], after: boolean): value is ProgressionValue {
  if (!isRecord(value) || value.kind !== kind) return false
  if (kind === 'exact_load') return exactKeys(value, ['kind', 'exact_weight', 'effective_unit'])
    && phase4Decimal(value.exact_weight, 0, after ? 2000 : 9_999_999.999, 3)
    && phase4Enum(value.effective_unit, ['lb', 'kg'])
  if (kind === 'percent_points') return exactKeys(value, ['kind', 'percent', 'pinned_max_id', 'pinned_max_value', 'pinned_max_unit', 'resolved_weight', 'effective_unit', 'plate_increment'])
    && phase4Decimal(value.percent, Number.MIN_VALUE, 200, 3) && phase4Uuid(value.pinned_max_id)
    && phase4Decimal(value.pinned_max_value, Number.MIN_VALUE, 9_999_999.999, 3)
    && phase4Enum(value.pinned_max_unit, ['lb', 'kg']) && phase4Decimal(value.resolved_weight, 0, 9_999_999.999, 3)
    && phase4Enum(value.effective_unit, ['lb', 'kg']) && phase4Decimal(value.plate_increment, Number.MIN_VALUE, 99_999.999, 3)
  if (kind === 'reps') return exactKeys(value, ['kind', 'reps'])
    && phase4Integer(value.reps, 1, after ? 100 : 9_999_999)
  if (kind === 'sets') return exactKeys(value, ['kind', 'set_count']) && phase4Integer(value.set_count, 1, 20)
  return exactKeys(value, ['kind', 'rpe']) && phase4Decimal(value.rpe, 1, 10, 1)
}

function phase4ProgressionChange(value: unknown, kind: ProgressionTransform['kind']): value is ProgressionChangeV1 {
  if (!exactKeys(value, ['week_identity_token', 'day_identity_token', 'exercise_identity_token', 'set_identity_token', 'target_kind', 'target_identity_token', 'before', 'after'])
    || !phase4Uuid(value.week_identity_token) || !phase4Uuid(value.day_identity_token)
    || !phase4Uuid(value.exercise_identity_token) || !phase4Uuid(value.target_identity_token)
    || !phase4ProgressionValue(value.before, kind, false) || !phase4ProgressionValue(value.after, kind, true)) return false
  return kind === 'sets'
    ? value.target_kind === 'exercise' && value.set_identity_token === null && value.target_identity_token === value.exercise_identity_token
    : value.target_kind === 'set_row' && phase4Uuid(value.set_identity_token) && value.target_identity_token === value.set_identity_token
}

function phase4ProgressionSkip(value: unknown, targetKind: 'set_row' | 'exercise'): value is ProgressionSkippedRowV1 {
  return exactKeys(value, ['target_kind', 'target_identity_token', 'week_identity_token', 'day_identity_token', 'reason'])
    && value.target_kind === targetKind && phase4Uuid(value.target_identity_token)
    && phase4Uuid(value.week_identity_token) && phase4Uuid(value.day_identity_token)
    && phase4Enum(value.reason, ['load_mode', 'dose_shape', 'not_individualized', 'movement_shape', 'manual_override', 'exercise_shape'])
}

function phase4ProgressionLock(value: unknown): value is ProgressionLockedDayV1 {
  return exactKeys(value, ['week_identity_token', 'day_identity_token'])
    && phase4Uuid(value.week_identity_token) && phase4Uuid(value.day_identity_token)
}

const progressionIssueCodes = ['result_out_of_range', 'result_scale_invalid', 'mixed_effective_units', 'set_count_out_of_range', 'pinned_max_missing', 'pinned_max_changed', 'plate_increment_invalid', 'preview_state_changed'] as const
function phase4ProgressionIssue(value: unknown, targetKind: 'set_row' | 'exercise'): value is ProgressionBlockingIssueV1 {
  return exactKeys(value, ['code', 'target_kind', 'target_identity_token', 'related_identity_token', 'week_identity_token', 'day_identity_token', 'field', 'current_value', 'proposed_value', 'unit', 'message_key'])
    && phase4Enum(value.code, progressionIssueCodes) && value.target_kind === targetKind
    && phase4Uuid(value.target_identity_token) && phase4Nullable(value.related_identity_token, phase4Uuid)
    && phase4Uuid(value.week_identity_token) && phase4Uuid(value.day_identity_token)
    && phase4Enum(value.field, ['exact_weight', 'percent', 'reps', 'sets', 'rpe', 'effective_unit', 'pinned_max', 'plate_increment', 'preview_state'])
    && phase4NullableText(value.current_value, 32) && phase4NullableText(value.proposed_value, 32)
    && (value.unit === null || phase4Enum(value.unit, ['lb', 'kg'])) && value.message_key === value.code
}

type ValidatedProgressionLists = {
  changes: ProgressionChangeV1[]
  skipped: ProgressionSkippedRowV1[]
  locked: ProgressionLockedDayV1[]
  issues: ProgressionBlockingIssueV1[]
}

function progressionLists(value: UnknownRecord, kind: ProgressionTransform['kind'], scope: ProgressionScope['kind'], preview: boolean): ValidatedProgressionLists | null {
  const targetKind = scope === 'exercises' ? 'exercise' : 'set_row'
  const maximum = scope === 'exercises' ? 128 : 512
  const changesKey = preview ? 'representative_changes' : 'changes'
  const changesValue = value[changesKey]
  const skippedValue = value.skipped_rows
  const lockedValue = value.locked
  const issuesValue = value.blocking_issues
  if (!phase4Array(changesValue, preview ? 20 : maximum,
    (entry): entry is ProgressionChangeV1 => phase4ProgressionChange(entry, kind))
    || !phase4Array(skippedValue, maximum,
      (entry): entry is ProgressionSkippedRowV1 => phase4ProgressionSkip(entry, targetKind))
    || !phase4Array(lockedValue, 84, phase4ProgressionLock)
    || !phase4Array(issuesValue, maximum,
      (entry): entry is ProgressionBlockingIssueV1 => phase4ProgressionIssue(entry, targetKind))) return null
  const changeTokens = changesValue.map((entry) => entry.target_identity_token)
  const issueTokens = issuesValue.map((entry) => entry.target_identity_token)
  if (!uniqueStrings(changeTokens) || !uniqueStrings(issueTokens)
    || changeTokens.some((token) => issueTokens.includes(token))) return null
  return { changes: changesValue, skipped: skippedValue, locked: lockedValue, issues: issuesValue }
}

function phase4PreviewProgression(value: unknown, input: PreviewBuilderProgressionV1Input): value is PreviewBuilderProgressionV1Result {
  if ((input.transform.kind === 'sets') !== (input.scope.kind === 'exercises')) return false
  if (!exactKeys(value, ['program_id', 'assignment_id', 'builder_version', 'outcome', 'preview_guard', 'scope_kind', 'transform', 'eligible_count', 'representative_changes', 'skipped_rows', 'locked', 'blocking_issues', 'can_apply'])
    || value.program_id !== input.program || value.assignment_id !== input.assignment
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || !phase4BuilderVersion(value.builder_version) || value.builder_version !== input.expected_builder_version
    || value.outcome !== 'preview' || !phase4Hex(value.preview_guard) || value.scope_kind !== input.scope.kind
    || !phase4Transform(value.transform) || !sameTransform(value.transform, input.transform)
    || !phase4Integer(value.eligible_count, 0, input.scope.identity_tokens.length)
    || typeof value.can_apply !== 'boolean') return false
  const lists = progressionLists(value, input.transform.kind, input.scope.kind, true)
  if (!lists) return false
  return value.can_apply === (lists.issues.length === 0)
    && value.eligible_count >= lists.issues.length
    && lists.changes.length === Math.min(20, value.eligible_count - lists.issues.length)
}

function phase4ApplyProgression(value: unknown, input: ApplyBuilderProgressionV1Input): value is ApplyBuilderProgressionV1Result {
  if ((input.transform.kind === 'sets') !== (input.scope.kind === 'exercises')) return false
  const maximum = input.scope.kind === 'exercises' ? 128 : 512
  if (!exactKeys(value, ['request_id', 'operation_type', 'program_id', 'assignment_id', 'preview_guard', 'builder_version_before', 'builder_version_after', 'outcome', 'unchanged', 'changes', 'applied_identity_tokens', 'created_set_identity_tokens', 'retired_set_identity_tokens', 'skipped_rows', 'locked', 'blocking_issues', 'undo'])
    || value.request_id !== input.request_id || !phase4Uuid(value.request_id) || value.operation_type !== 'progression'
    || value.program_id !== input.program || value.assignment_id !== input.assignment
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || value.preview_guard !== input.preview_guard || !phase4Hex(value.preview_guard)
    || !phase4BuilderVersion(value.builder_version_before) || value.builder_version_before !== input.expected_builder_version
    || !phase4BuilderVersion(value.builder_version_after)
    || !phase4Enum(value.outcome, ['applied', 'no_op', 'refused']) || typeof value.unchanged !== 'boolean'
    || !phase4Array(value.applied_identity_tokens, maximum, phase4Uuid)
    || !phase4Array(value.created_set_identity_tokens, 2432, phase4Uuid)
    || !phase4Array(value.retired_set_identity_tokens, 2432, phase4Uuid)
    || !phase4Nullable(value.undo, phase4Undo)) return false
  const lists = progressionLists(value, input.transform.kind, input.scope.kind, false)
  if (!lists) return false
  const appliedTokens = value.applied_identity_tokens
  const createdTokens = value.created_set_identity_tokens
  const retiredTokens = value.retired_set_identity_tokens
  if (!uniqueStrings(appliedTokens) || !uniqueStrings(createdTokens) || !uniqueStrings(retiredTokens)) return false
  if (appliedTokens.length !== lists.changes.length
    || lists.changes.some((change) => !appliedTokens.includes(change.target_identity_token))) return false
  if (input.transform.kind !== 'sets'
    && (createdTokens.length !== 0 || retiredTokens.length !== 0)) return false
  if (createdTokens.length > 0 && retiredTokens.length > 0) return false
  if (lists.changes.length + lists.skipped.length > input.scope.identity_tokens.length) return false
  if (value.outcome === 'refused') return value.unchanged && value.builder_version_after === value.builder_version_before
    && lists.issues.length > 0 && lists.changes.length === 0 && value.applied_identity_tokens.length === 0
    && value.created_set_identity_tokens.length === 0 && value.retired_set_identity_tokens.length === 0 && value.undo === null
  if (value.outcome === 'no_op') return value.unchanged && value.builder_version_after === value.builder_version_before
    && lists.issues.length === 0 && lists.changes.length === 0 && value.applied_identity_tokens.length === 0
    && value.created_set_identity_tokens.length === 0 && value.retired_set_identity_tokens.length === 0 && value.undo === null
  return !value.unchanged && value.builder_version_after > value.builder_version_before
    && lists.issues.length === 0 && lists.changes.length > 0 && value.undo !== null
}

function phase5ProgressionV2Rule(value: unknown): value is ProgressionV2Rule {
  if (!isRecord(value)) return false
  const deltaDirection = (direction: unknown): direction is 'add' | 'subtract' =>
    phase4Enum(direction, ['add', 'subtract'])
  if (value.kind === 'exact_load') return exactKeys(value, ['kind', 'direction', 'amount', 'unit'])
    && deltaDirection(value.direction) && phase4Decimal(value.amount, 0.001, 2000, 3)
    && phase4Enum(value.unit, ['lb', 'kg'])
  if (value.kind === 'percent_points') return exactKeys(value, ['kind', 'direction', 'amount'])
    && deltaDirection(value.direction) && phase4Decimal(value.amount, 0.001, 200, 3)
  if (value.kind === 'exact_reps' || value.kind === 'rep_range') {
    return exactKeys(value, ['kind', 'direction', 'amount']) && deltaDirection(value.direction)
      && phase4Integer(value.amount, 1, 99)
  }
  if (value.kind === 'rpe') return exactKeys(value, ['kind', 'direction', 'amount'])
    && deltaDirection(value.direction) && phase4Decimal(value.amount, 0.1, 9, 1)
  return value.kind === 'sets' && exactKeys(value, ['kind', 'direction', 'amount'])
    && phase4Enum(value.direction, ['add', 'remove']) && phase4Integer(value.amount, 1, 19)
}

function sameProgressionV2Rule(left: ProgressionV2Rule, right: ProgressionV2Rule): boolean {
  return left.kind === right.kind && left.direction === right.direction && left.amount === right.amount
    && (left.kind !== 'exact_load' || (right.kind === 'exact_load' && left.unit === right.unit))
}

function phase5ProgressionV2Value(value: unknown, kind: ProgressionV2OverrideValue['kind'], before: boolean): value is ProgressionV2BeforeValue | ProgressionV2ResolvedAfterValue {
  if (!isRecord(value) || value.kind !== kind) return false
  if (kind === 'exact_load') {
    const keys = before ? ['kind', 'exact_weight', 'unit'] : ['kind', 'exact_weight']
    return exactKeys(value, keys) && phase4Decimal(value.exact_weight, 0, 2000, 3)
      && (!before || phase4Enum(value.unit, ['lb', 'kg']))
  }
  if (kind === 'percent_points') {
    return exactKeys(value, ['kind', 'percent', 'resolved_weight', 'unit'])
      && phase4Decimal(value.percent, 0.001, 200, 3)
      && phase4Decimal(value.resolved_weight, 0, 9_999_999.999, 3)
      && phase4Enum(value.unit, ['lb', 'kg'])
  }
  if (kind === 'exact_reps') return exactKeys(value, ['kind', 'reps'])
    && phase4Integer(value.reps, 1, 100)
  if (kind === 'rep_range') return exactKeys(value, ['kind', 'min', 'max'])
    && phase4Integer(value.min, 1, 100) && phase4Integer(value.max, value.min, 100)
  if (kind === 'rpe') return exactKeys(value, ['kind', 'rpe'])
    && phase4Decimal(value.rpe, 1, 10, 1)
  return exactKeys(value, ['kind', 'set_count']) && phase4Integer(value.set_count, 1, 20)
}

function phase5ProgressionV2GeneratedCandidate(value: unknown, kind: ProgressionV2OverrideValue['kind']): value is ProgressionV2GeneratedCandidate {
  if (!isRecord(value) || value.kind !== kind) return false
  if (kind === 'exact_load') return exactKeys(value, ['kind', 'exact_weight'])
    && phase4Decimal(value.exact_weight, -24_000, 26_000, 3)
  if (kind === 'percent_points') return exactKeys(value, ['kind', 'percent'])
    && phase4Decimal(value.percent, -2_400, 2_600, 3)
  if (kind === 'exact_reps') return exactKeys(value, ['kind', 'reps'])
    && phase4Integer(value.reps, -1_187, 1_288)
  if (kind === 'rep_range') return exactKeys(value, ['kind', 'min', 'max'])
    && phase4Integer(value.min, -1_187, 1_288)
    && phase4Integer(value.max, value.min, 1_288)
  if (kind === 'rpe') return exactKeys(value, ['kind', 'rpe'])
    && phase4Decimal(value.rpe, -107, 118, 1)
  return exactKeys(value, ['kind', 'set_count'])
    && phase4Integer(value.set_count, -227, 248)
}

function phase5ProgressionV2CandidateIsOutOfRange(value: ProgressionV2GeneratedCandidate): boolean {
  if (value.kind === 'exact_load') return !phase4Decimal(value.exact_weight, 0, 2_000, 3)
  if (value.kind === 'percent_points') return !phase4Decimal(value.percent, 0.001, 200, 3)
  if (value.kind === 'exact_reps') return !phase4Integer(value.reps, 1, 100)
  if (value.kind === 'rep_range') return !phase4Integer(value.min, 1, 100)
    || !phase4Integer(value.max, value.min, 100)
  if (value.kind === 'rpe') return !phase4Decimal(value.rpe, 1, 10, 1)
  return !phase4Integer(value.set_count, 1, 20)
}

function phase5ProgressionV2Target(value: unknown, kind: ProgressionV2OverrideValue['kind']): value is ProgressionV2ReviewTarget {
  if (!exactKeys(value, ['review_target_id', 'source_exercise_identity_token', 'source_set_identity_token', 'exercise_name', 'set_ordinal', 'kind', 'before', 'after'])
    || !phase4Hex(value.review_target_id) || !phase4Uuid(value.source_exercise_identity_token)
    || !phase4AuthoredText(value.exercise_name, 120) || value.kind !== kind
    || !phase5ProgressionV2Value(value.before, kind, true)
    || (!phase5ProgressionV2Value(value.after, kind, false)
      && !phase5ProgressionV2GeneratedCandidate(value.after, kind))) return false
  return kind === 'set_count'
    ? value.source_set_identity_token === null && value.set_ordinal === null
    : phase4Uuid(value.source_set_identity_token) && phase4Integer(value.set_ordinal, 1, 20)
}

function phase5ProgressionV2Issue(value: unknown): value is ProgressionV2BlockingIssue {
  const codes = ['destination_locked', 'no_eligible_targets', 'override_kind_invalid', 'override_target_invalid', 'result_out_of_range', 'mixed_effective_units', 'pinned_max_missing'] as const
  if (!(exactKeys(value, ['code', 'week_identity_token', 'review_target_id', 'message_key'])
    && phase4Enum(value.code, codes) && value.message_key === value.code
    && phase4Nullable(value.week_identity_token, phase4Uuid)
    && phase4Nullable(value.review_target_id, phase4Hex))) return false
  if (value.code === 'destination_locked') {
    return phase4Uuid(value.week_identity_token) && value.review_target_id === null
  }
  if (value.code === 'no_eligible_targets' || value.code === 'override_target_invalid') {
    return value.week_identity_token === null && value.review_target_id === null
  }
  return phase4Uuid(value.week_identity_token) && phase4Hex(value.review_target_id)
}

function phase5ProgressionV2OverrideMatches(target: ProgressionV2ReviewTarget, override: ProgressionV2Override): boolean {
  if (target.kind !== override.value.kind || target.after.kind !== override.value.kind) return false
  const after = target.after
  const value = override.value
  if (value.kind === 'exact_load') return after.kind === value.kind && after.exact_weight === value.exact_weight
  if (value.kind === 'percent_points') return after.kind === value.kind && after.percent === value.percent
  if (value.kind === 'exact_reps') return after.kind === value.kind && after.reps === value.reps
  if (value.kind === 'rep_range') return after.kind === value.kind && after.min === value.min && after.max === value.max
  if (value.kind === 'rpe') return after.kind === value.kind && after.rpe === value.rpe
  return after.kind === value.kind && after.set_count === value.set_count
}

function phase5PreviewProgressionV2(value: unknown, input: PreviewBuilderProgressionV2Input): value is PreviewBuilderProgressionV2Result {
  const expectedKind: ProgressionV2OverrideValue['kind'] = input.rule.kind === 'sets' ? 'set_count' : input.rule.kind
  const requestedWeeks = input.destination_week_identity_tokens
  const requestedExercises = input.scope.kind === 'exercises' ? input.scope.source_exercise_identity_tokens : null
  if (!isRecord(value) || !isRecord(value.source)
    || !uniqueStrings(requestedWeeks) || requestedWeeks.length < 1 || requestedWeeks.length > 12
    || (requestedExercises !== null && (!uniqueStrings(requestedExercises) || requestedExercises.length < 1 || requestedExercises.length > 12))
    || !uniqueStrings(input.overrides.map(item => item.review_target_id))) return false
  const source = value.source
  if (!exactKeys(value, ['contract_version', 'operation_type', 'program_id', 'assignment_id', 'builder_version', 'source', 'rule', 'weeks', 'collision_week_identity_tokens', 'blocking_issues', 'can_apply', 'preview_guard'])
    || value.contract_version !== 2 || value.operation_type !== 'progression'
    || value.program_id !== input.program || value.assignment_id !== input.assignment
    || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || value.builder_version !== input.expected_builder_version || !phase4BuilderVersion(value.builder_version)
    || !exactKeys(source, ['week_identity_token', 'week_ordinal', 'day_identity_token', 'day_ordinal', 'weekday', 'workout_title'])
    || source.week_identity_token !== input.source.week_identity_token
    || source.day_identity_token !== input.source.day_identity_token
    || !phase4Uuid(source.week_identity_token) || !phase4Uuid(source.day_identity_token)
    || !phase4Integer(source.week_ordinal, 1, 12) || !phase4Integer(source.day_ordinal, 1, 7)
    || !phase4Enum(source.weekday, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    || !phase4NullableAuthoredText(source.workout_title, 500)
    || !phase5ProgressionV2Rule(value.rule) || !sameProgressionV2Rule(value.rule, input.rule)
    || !phase4Array(value.weeks, 12, (week): week is ProgressionV2WeekReview => {
      if (!exactKeys(week, ['week_identity_token', 'week_ordinal', 'weekday', 'workout_title', 'collision', 'locked', 'unchanged_count', 'review_targets'])
        || !phase4Uuid(week.week_identity_token) || !phase4Integer(week.week_ordinal, 1, 12)
        || week.week_ordinal < Number(source.week_ordinal)
        || (week.week_identity_token === source.week_identity_token)
          !== (week.week_ordinal === Number(source.week_ordinal))
        || week.weekday !== source.weekday
        || !phase4NullableAuthoredText(week.workout_title, 500)
        || typeof week.collision !== 'boolean' || typeof week.locked !== 'boolean'
        || !phase4Integer(week.unchanged_count, 0, 240)
        || !phase4Array(week.review_targets, expectedKind === 'set_count' ? 12 : 240,
          (target): target is ProgressionV2ReviewTarget => phase5ProgressionV2Target(target, expectedKind))) return false
      return requestedExercises === null || week.review_targets.every(target =>
        requestedExercises.includes(target.source_exercise_identity_token))
    }, 1)
    || !phase4Array(value.collision_week_identity_tokens, 12, phase4Uuid)
    || !phase4Array(value.blocking_issues, 18, phase5ProgressionV2Issue)
    || typeof value.can_apply !== 'boolean' || !phase4Hex(value.preview_guard)) return false
  const weeks = value.weeks
  const weekTokens = weeks.map(week => week.week_identity_token)
  const targetIds = weeks.flatMap(week => week.review_targets.map(target => target.review_target_id))
  const collisions = weeks.filter(week => week.collision).map(week => week.week_identity_token)
  const lockedWeeks = weeks.filter(week => week.locked).map(week => week.week_identity_token)
  const lockedIssues = value.blocking_issues.filter(issue => issue.code === 'destination_locked')
  const noEligibleIssues = value.blocking_issues.filter(issue => issue.code === 'no_eligible_targets')
  const resultOutOfRangeIssues = value.blocking_issues.filter(issue => issue.code === 'result_out_of_range')
  const pinnedMaxMissingIssues = value.blocking_issues.filter(issue => issue.code === 'pinned_max_missing')
  const issueKeys = value.blocking_issues.map(issue => issue.code === 'destination_locked'
    ? `${issue.code}:${issue.week_identity_token}` : issue.code)
  const generatedCandidates = weeks.flatMap(week => week.review_targets.flatMap(target =>
    phase5ProgressionV2Value(target.after, target.kind, false) ? []
      : [{ weekIdentityToken: week.week_identity_token, target,
        outOfRange: phase5ProgressionV2CandidateIsOutOfRange(target.after) }]))
  const outOfRangeCandidates = generatedCandidates.filter(candidate => candidate.outOfRange)
  const unresolvedPercentCandidates = generatedCandidates.filter(candidate => !candidate.outOfRange
    && candidate.target.after.kind === 'percent_points')
  if (!uniqueStrings(weekTokens) || !uniqueStrings(targetIds)
    || source.weekday !== (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const)[Number(source.day_ordinal) - 1]
    || weeks.some((week, index) => index > 0 && week.week_ordinal <= weeks[index - 1].week_ordinal)
    || weeks.some(week => week.week_identity_token === source.week_identity_token && week.collision)
    || weeks.some(week => week.locked && !week.collision
      && week.week_identity_token !== source.week_identity_token)
    || weekTokens.length !== requestedWeeks.length || requestedWeeks.some(token => !weekTokens.includes(token))
    || value.collision_week_identity_tokens.length !== collisions.length
    || value.collision_week_identity_tokens.some((token, index) => token !== collisions[index])
    || !uniqueStrings(issueKeys)
    || lockedIssues.length !== lockedWeeks.length
    || lockedWeeks.some(token => !lockedIssues.some(issue => issue.week_identity_token === token))
    || noEligibleIssues.length !== (targetIds.length === 0 ? 1 : 0)
    || generatedCandidates.length !== outOfRangeCandidates.length + unresolvedPercentCandidates.length
    || resultOutOfRangeIssues.length !== (outOfRangeCandidates.length > 0 ? 1 : 0)
    || resultOutOfRangeIssues.some(issue => !outOfRangeCandidates.some(candidate =>
      candidate.weekIdentityToken === issue.week_identity_token
        && candidate.target.review_target_id === issue.review_target_id))
    || pinnedMaxMissingIssues.length !== (unresolvedPercentCandidates.length > 0 ? 1 : 0)
    || pinnedMaxMissingIssues.some(issue => !unresolvedPercentCandidates.some(candidate =>
      candidate.weekIdentityToken === issue.week_identity_token
        && candidate.target.review_target_id === issue.review_target_id))
    || weeks.some(week => {
      const locators = week.review_targets.map(target => `${target.source_exercise_identity_token}:${target.source_set_identity_token ?? ''}`)
      const sourceSets = week.review_targets.flatMap(target => target.source_set_identity_token === null ? [] : [target.source_set_identity_token])
      return !uniqueStrings(locators) || !uniqueStrings(sourceSets)
    })
    || input.overrides.some(override => {
      const target = weeks.flatMap(week => week.review_targets).find(candidate => candidate.review_target_id === override.review_target_id)
      return !target || !phase5ProgressionV2OverrideMatches(target, override)
    })) return false
  const targetSet = new Set(targetIds)
  const baseline = new Map(weeks[0].review_targets.map(target => [
    `${target.source_exercise_identity_token}:${target.source_set_identity_token ?? ''}`,
    JSON.stringify({ exercise_name: target.exercise_name, set_ordinal: target.set_ordinal,
      kind: target.kind, before: target.before }),
  ]))
  if (weeks.some(week => week.review_targets.length !== baseline.size
      || week.review_targets.some(target => baseline.get(
        `${target.source_exercise_identity_token}:${target.source_set_identity_token ?? ''}`)
        !== JSON.stringify({ exercise_name: target.exercise_name, set_ordinal: target.set_ordinal,
          kind: target.kind, before: target.before })))
    || value.blocking_issues.some(issue => issue.week_identity_token !== null && !weekTokens.includes(issue.week_identity_token)
      || issue.review_target_id !== null && (!targetSet.has(issue.review_target_id)
        || !weeks.some(week => week.week_identity_token === issue.week_identity_token
          && week.review_targets.some(target => target.review_target_id === issue.review_target_id))))) return false
  return value.can_apply === (value.blocking_issues.length === 0
    && (collisions.length === 0 || input.replace_reviewed_weeks))
}

function phase5ApplyProgressionV2(value: unknown, input: ApplyBuilderProgressionV2Input): value is ApplyBuilderProgressionV2Result {
  if (!exactKeys(value, ['contract_version', 'request_id', 'operation_type', 'program_id', 'assignment_id', 'preview_guard', 'builder_version_before', 'builder_version_after', 'unchanged', 'applied_week_identity_tokens', 'undo'])
    || value.contract_version !== 2 || value.request_id !== input.request_id || !phase4Uuid(value.request_id)
    || value.operation_type !== 'progression' || value.program_id !== input.program
    || value.assignment_id !== input.assignment || !phase4Uuid(value.program_id) || !phase4Uuid(value.assignment_id)
    || value.preview_guard !== input.preview_guard || !phase4Hex(value.preview_guard)
    || value.builder_version_before !== input.expected_builder_version || !phase4BuilderVersion(value.builder_version_before)
    || !phase4BuilderVersion(value.builder_version_after)
    || typeof value.unchanged !== 'boolean'
    || !phase4Array(value.applied_week_identity_tokens, 12, phase4Uuid)) return false
  const appliedWeekTokens = value.applied_week_identity_tokens as string[]
  if (!uniqueStrings(appliedWeekTokens)) return false
  if (value.unchanged) return value.builder_version_after === value.builder_version_before
    && appliedWeekTokens.length === 0 && value.undo === null
  return value.builder_version_after > value.builder_version_before && phase4Undo(value.undo)
    && appliedWeekTokens.length === input.destination_week_identity_tokens.length
    && input.destination_week_identity_tokens.every(token => appliedWeekTokens.includes(token))
}

function phase4UndoResult(value: unknown, input: UndoBuilderOperationV1Input): value is UndoBuilderOperationV1Result {
  return exactKeys(value, ['request_id', 'operation_type', 'undo_id', 'undone_operation_type', 'program_id', 'assignment_id', 'builder_version_before', 'builder_version_after', 'restored_week_identity_tokens', 'readiness', 'undone_at'])
    && value.request_id === input.request_id && phase4Uuid(value.request_id) && value.operation_type === 'undo'
    && value.undo_id === input.undo_id && phase4Uuid(value.undo_id)
    && phase4Enum(value.undone_operation_type, ['copy_day', 'copy_week', 'progression'])
    && value.program_id === input.program && value.assignment_id === input.assignment
    && phase4Uuid(value.program_id) && phase4Uuid(value.assignment_id)
    && phase4BuilderVersion(value.builder_version_before) && value.builder_version_before === input.expected_builder_version
    && phase4BuilderVersion(value.builder_version_after)
    && value.builder_version_after > value.builder_version_before
    && phase4Array(value.restored_week_identity_tokens, 12, phase4Uuid, 1)
    && uniqueStrings(value.restored_week_identity_tokens) && value.readiness === 'draft'
    && phase4Timestamp(value.undone_at)
}

function phase4PublishResult(value: unknown, input: PublishReadyProgramV1Input): value is PublishReadyProgramV1Result {
  return exactKeys(value, ['request_id', 'operation_type', 'program_id', 'assignment_id', 'builder_version', 'release_id', 'readiness', 'published_at'])
    && value.request_id === input.request_id && phase4Uuid(value.request_id) && value.operation_type === 'publish_ready'
    && value.program_id === input.program && value.assignment_id === input.assignment
    && phase4Uuid(value.program_id) && phase4Uuid(value.assignment_id)
    && phase4BuilderVersion(value.builder_version) && value.builder_version === input.expected_builder_version
    && phase4Uuid(value.release_id)
    && value.readiness === 'ready' && phase4Timestamp(value.published_at)
}

function phase9ScopedPublishResult(value: unknown, input: PublishCoachScopeV1Input): value is PublishCoachScopeV1Result {
  return exactKeys(value, ['request_id', 'operation_type', 'program_id', 'assignment_id', 'builder_version', 'release_id', 'scope_kind', 'scope_token', 'visible_day_tokens', 'published_at'])
    && value.request_id === input.request_id && phase4Uuid(value.request_id) && value.operation_type === 'publish_scope'
    && value.program_id === input.program && value.assignment_id === input.assignment
    && phase4Uuid(value.program_id) && phase4Uuid(value.assignment_id)
    && phase4BuilderVersion(value.builder_version) && value.builder_version >= input.expected_builder_version
    && phase4Uuid(value.release_id) && value.scope_kind === input.scope_kind && value.scope_token === input.scope_token
    && phase4Array(value.visible_day_tokens, 84, phase4Uuid, 1) && uniqueStrings(value.visible_day_tokens)
    && phase4Timestamp(value.published_at)
}

function phase9ActivateScopedPublishResult(value: unknown, input: ActivateAndPublishCoachScopeV1Input): value is ActivateAndPublishCoachScopeV1Result {
  return exactKeys(value, ['request_id', 'operation_type', 'program_id', 'assignment_id', 'previous_assignment_id', 'builder_version', 'release_id', 'scope_kind', 'scope_token', 'visible_day_tokens', 'published_at', 'retired_instance_count'])
    && value.request_id === input.request_id && phase4Uuid(value.request_id) && value.operation_type === 'activate_scope'
    && phase4Uuid(value.program_id) && value.assignment_id === input.candidate_assignment
    && phase4Uuid(value.assignment_id) && value.previous_assignment_id === input.expected_current_assignment
    && (value.previous_assignment_id === null || phase4Uuid(value.previous_assignment_id))
    && phase4BuilderVersion(value.builder_version) && value.builder_version >= input.expected_builder_version
    && phase4Uuid(value.release_id) && value.scope_kind === input.scope_kind && value.scope_token === input.scope_token
    && phase4Array(value.visible_day_tokens, 84, phase4Uuid, 1) && uniqueStrings(value.visible_day_tokens)
    && phase4Timestamp(value.published_at) && typeof value.retired_instance_count === 'number'
    && Number.isSafeInteger(value.retired_instance_count) && value.retired_instance_count >= 0
}

function phase5AuthorCalendarDayResult(value: unknown, input: AuthorCalendarDayV1Input): value is AuthorCalendarDayV1Result {
  return exactKeys(value, ['request_id', 'operation_type', 'program_id', 'assignment_id', 'week_identity_token', 'day_identity_token', 'day_ordinal', 'status', 'builder_version_before', 'builder_version_after', 'unchanged'])
    && value.request_id === input.request_id && phase4Uuid(value.request_id)
    && value.operation_type === 'author_day'
    && value.program_id === input.program && phase4Uuid(value.program_id)
    && value.assignment_id === input.assignment && phase4Uuid(value.assignment_id)
    && value.week_identity_token === input.week_identity_token && phase4Uuid(value.week_identity_token)
    && phase4Uuid(value.day_identity_token)
    && value.day_ordinal === input.day_ordinal && phase4Integer(value.day_ordinal, 1, 7)
    && value.status === (input.authoring_kind === 'rest' ? 'rest' : 'authored_empty')
    && value.builder_version_before === input.expected_builder_version
    && phase4BuilderVersion(value.builder_version_before)
    && value.builder_version_after === value.builder_version_before + 1
    && value.unchanged === false
}

function phase5ExerciseHistoryResult(value: unknown, input: ExerciseNameHistoryV1Input): value is ExerciseNameHistoryV1Result {
  if (!exactKeys(value, ['items']) || !phase4Array(value.items, input.result_limit, (item): item is ExerciseNameHistoryItemV1 =>
    exactKeys(item, ['name', 'last_used_at', 'use_count'])
      && phase4AuthoredText(item.name, 120)
      && phase4Timestamp(item.last_used_at)
      && phase4CanonicalBigint(item.use_count, true))) return false
  const normalized = value.items.map((item) => item.name.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US'))
  return uniqueStrings(normalized)
}

function phase5RecordExerciseHistoryResult(value: unknown, input: RecordExerciseNameHistoryV1Input): value is RecordExerciseNameHistoryV1Result {
  return exactKeys(value, ['recorded_count', 'retained_count'])
    && phase4Integer(value.recorded_count, 0, input.names.length)
    && phase4Integer(value.retained_count, 0, 500)
}

function phase5DayCopyInputIsSingleDestination(input: PreviewBuilderCopyV1Input): boolean {
  if (input.copy_kind !== 'day') return true
  return 'day_identity_token' in input.source
    && input.destinations.length === 1
    && 'day_ordinal' in input.destinations[0]
}

type Phase4Chunks = { chunks: Uint8Array[]; byteLength: number }

async function readPhase4Chunks(body: ReadableStream<Uint8Array> | null, maximum: number): Promise<Phase4Chunks> {
  if (!body) throw new CoachApiError('invalid_response')
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) return { chunks, byteLength }
      byteLength += next.value.byteLength
      if (byteLength > maximum) {
        await reader.cancel()
        throw new CoachApiError('invalid_response')
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
}

function phase4JsonUsesExponent(text: string): boolean {
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character !== '-' && !(character >= '0' && character <= '9')) continue
    let cursor = character === '-' ? index + 1 : index
    while (cursor < text.length && text[cursor] >= '0' && text[cursor] <= '9') cursor += 1
    if (text[cursor] === '.') {
      cursor += 1
      while (cursor < text.length && text[cursor] >= '0' && text[cursor] <= '9') cursor += 1
    }
    if (text[cursor] === 'e' || text[cursor] === 'E') return true
    index = cursor - 1
  }
  return false
}

function decodePhase4Chunks(chunks: Uint8Array[]): string {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let text = ''
  for (let index = 0; index < chunks.length; index += 1) {
    text += decoder.decode(chunks[index], { stream: true })
    chunks[index] = new Uint8Array()
  }
  return text + decoder.decode()
}

async function readPhase4Json(response: Response, maximum: number): Promise<unknown> {
  const declared = response.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new CoachApiError('invalid_response', response.status)
  let read: Phase4Chunks | null = await readPhase4Chunks(response.body, maximum)
  let text: string
  try {
    text = decodePhase4Chunks(read.chunks)
  } catch {
    throw new CoachApiError('invalid_response', response.status)
  } finally {
    read = null
  }
  if (phase4JsonUsesExponent(text)) throw new CoachApiError('invalid_response', response.status)
  try {
    const value: unknown = JSON.parse(text)
    text = ''
    return value
  } catch {
    throw new CoachApiError('invalid_response', response.status)
  }
}

function safeWorkerRequestId(response: Response): string | undefined {
  const requestId = response.headers.get('x-request-id')
  return requestId !== null && workerRequestIdPattern.test(requestId) ? requestId : undefined
}

type Phase4ErrorMap = Partial<Record<number, readonly CoachApiErrorCode[]>>
function oct18RosterPage(value: unknown, input: Parameters<October18CoachApi['getCoachDashboardRosterPageV4']>[0]): value is CoachDashboardRosterPageV4 {
  if (!isRecord(value) || value.contract_version !== 4 || !isRecord(value.dashboard_read_token) || value.dashboard_read_token.page_kind !== 'coach_dashboard_roster_v4' || value.next_read_token !== null && (!isRecord(value.next_read_token) || value.next_read_token.page_kind !== 'coach_dashboard_roster_v4') || !Array.isArray(value.items) || value.items.length > input.page_size) return false
  const converted = (token: unknown) => isRecord(token) && token.page_kind === 'coach_dashboard_roster_v4' ? { ...token, page_kind: 'coach_dashboard_roster_v2' } : token
  if (!value.items.every(item => {
    if (!isRecord(item) || !phase4Integer(item.resumable_plan_count, 0, Number.MAX_SAFE_INTEGER)) return false
    const plan = item.resumable_plan
    if ((plan !== null) !== (item.resumable_plan_count === 1)) return false
    if (plan !== null && (!isRecord(plan) || plan.lifecycle_bucket !== 'unreleased_draft' || !phase55CurrentAssignment({ ...plan, lifecycle_bucket: 'current_active' }) || !phase4Enum(plan.program_status, ['draft', 'active']))) return false
    return true
  })) return false
  const legacyItems = value.items.map(item => { const { resumable_plan_count: _count, resumable_plan: _plan, ...base } = item; return base })
  return phase7RosterPage({ ...value, contract_version: 2, items: legacyItems, dashboard_read_token: converted(value.dashboard_read_token), next_read_token: value.next_read_token === null ? null : converted(value.next_read_token) }, { ...input, expected_read_token: input.expected_read_token === null ? null : { ...input.expected_read_token, page_kind: 'coach_dashboard_roster_v2' } })
}
function oct18RemovalContext(value: unknown, athlete: string): value is CoachClientRemovalContextV1 {
  return exactKeys(value, ['contract_version', 'athlete_id', 'membership_state', 'pairing_epoch', 'removed']) && value.contract_version === 1 && value.athlete_id === athlete && phase4Uuid(value.pairing_epoch) && phase4Enum(value.membership_state, ['active', 'former']) && value.removed === (value.membership_state === 'former')
}
const oct18PersonalRequest: Phase4Validator<CoachPersonalTrackingRequestV2> = (value): value is CoachPersonalTrackingRequestV2 =>
  exactKeys(value, ['request_id', 'athlete_id', 'athlete_name', 'assignment_id', 'logical_exercise_id', 'exercise_name', 'status', 'exercise_id', 'review_version', 'created_at']) && [value.request_id, value.athlete_id, value.assignment_id, value.logical_exercise_id].every(phase4Uuid) && phase4NonemptyText(value.athlete_name, 120) && phase4NonemptyText(value.exercise_name, 120) && phase4Enum(value.status, ['pending', 'resolved', 'dismissed']) && phase4Nullable(value.exercise_id, phase4Uuid) && (value.status === 'resolved') === (value.exercise_id !== null) && phase4Integer(value.review_version, 0, Number.MAX_SAFE_INTEGER) && phase4Timestamp(value.created_at)

type Phase4Route<Result> = {
  requestMaximum: number
  resultMaximum: number
  decode: Phase4Validator<Result>
  trustedErrors: Phase4ErrorMap
}

const phase4NavigationErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['navigation_read_changed'],
  413: ['request_body_too_large'],
  422: ['invalid_builder_operation'],
  500: ['navigation_generation_invariant'],
  502: ['navigation_result_too_large'],
}
const phase55DashboardErrors: Phase4ErrorMap = {
  401: ['session_expired'],
  403: ['access_denied'],
  409: ['serialization_retry', 'dashboard_read_changed', 'profile_changed', 'candidate_evidence_changed', 'percentage_preview_changed'],
  422: ['invalid_builder_operation'],
  502: ['dashboard_result_too_large'],
}
const cycleClosureErrors: Phase4ErrorMap = {
  ...phase55DashboardErrors,
  409: ['serialization_retry', 'cycle_not_active', 'cycle_workouts_incomplete'],
}
const phase6ProgramArchiveErrors: Phase4ErrorMap = {
  401: ['session_expired'],
  403: ['access_denied'],
  409: ['serialization_retry', 'program_archive_stale', 'program_archive_ineligible'],
  413: ['request_body_too_large'],
  422: ['invalid_builder_operation'],
  502: ['builder_result_too_large'],
}
const phase55AssignmentErrors: Phase4ErrorMap = {
  401: ['session_expired'],
  403: ['access_denied'],
  409: ['serialization_retry', 'stale_builder_version', 'request_id_drift', 'current_assignment_drift', 'assignment_not_active', 'assignment_not_activatable', 'active_assignment_conflict', 'invalid_superset'],
  413: ['request_body_too_large'],
  422: ['invalid_builder_operation'],
  502: ['builder_result_too_large'],
}
const phase4DetailErrors: Phase4ErrorMap = {
  403: ['access_denied'], 413: ['request_body_too_large'], 422: ['invalid_builder_operation'],
  502: ['assignment_detail_too_large'],
}
const phase4DayErrors: Phase4ErrorMap = {
  403: ['access_denied'], 409: ['assignment_read_changed'], 413: ['request_body_too_large'],
  422: ['invalid_builder_operation'], 502: ['assignment_day_too_large', 'builder_result_too_large'],
}
const phase4ReadinessErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'serialization_retry', 'program_archived', 'identity_conflict'],
  413: ['request_body_too_large'], 422: ['invalid_builder_operation'], 502: ['builder_result_too_large'],
}
const phase4CopyPreviewErrors: Phase4ErrorMap = {
  403: ['access_denied'], 409: ['stale_builder_version', 'program_archived', 'identity_conflict'],
  413: ['request_body_too_large', 'builder_operation_too_large'],
  422: ['copy_source_empty', 'invalid_builder_operation'], 502: ['builder_result_too_large'],
}
const phase4CopyApplyErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'copy_preview_changed', 'serialization_retry', 'day_locked', 'program_archived', 'identity_conflict', 'request_id_drift'],
  413: ['request_body_too_large', 'builder_operation_too_large'],
  422: ['copy_source_empty', 'copy_same_scope', 'copy_collision_review_required', 'invalid_builder_operation'], 502: ['builder_result_too_large'],
}
const compactProgrammingErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'serialization_retry', 'day_locked', 'program_archived',
    'identity_conflict', 'request_id_drift', 'undo_already_published', 'tracking_required'],
  413: ['request_body_too_large', 'builder_operation_too_large'],
  422: ['copy_source_empty', 'copy_same_scope', 'copy_collision_review_required',
    'invalid_builder_operation', 'unsupported_shape', 'calendar_structure_invalid'],
  502: ['builder_result_too_large'],
}
const phase4ProgressionPreviewErrors: Phase4ErrorMap = {
  403: ['access_denied'], 409: ['stale_builder_version', 'program_archived', 'identity_conflict'],
  413: ['request_body_too_large', 'builder_operation_too_large'],
  422: ['progression_scope_invalid', 'invalid_builder_operation'], 502: ['builder_result_too_large'],
}
const phase4ProgressionApplyErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'serialization_retry', 'day_locked', 'program_archived', 'identity_conflict', 'request_id_drift'],
  413: ['request_body_too_large', 'builder_operation_too_large'],
  422: ['progression_scope_invalid', 'invalid_builder_operation'], 502: ['builder_result_too_large'],
}
const phase5ProgressionPreviewErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'program_archived', 'identity_conflict', 'day_locked'],
  413: ['request_body_too_large', 'builder_operation_too_large'],
  422: ['progression_scope_invalid', 'unsupported_shape', 'invalid_builder_operation'],
  502: ['builder_result_too_large'],
}
const phase5ProgressionApplyErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'progression_preview_changed', 'serialization_retry', 'day_locked',
    'program_archived', 'identity_conflict', 'request_id_drift'],
  413: ['request_body_too_large', 'builder_operation_too_large'],
  422: ['progression_scope_invalid', 'copy_collision_review_required', 'unsupported_shape', 'invalid_builder_operation'],
  502: ['builder_result_too_large'],
}
const phase4UndoErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'serialization_retry', 'day_locked', 'program_archived', 'identity_conflict', 'request_id_drift', 'undo_already_published', 'undo_expired', 'undo_historical', 'undo_already_used'],
  413: ['request_body_too_large'], 422: ['invalid_builder_operation'], 502: ['builder_result_too_large'],
}
const phase4PublishErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'serialization_retry', 'program_archived', 'identity_conflict', 'request_id_drift', 'program_not_ready', 'invalid_superset'],
  413: ['request_body_too_large'], 422: ['invalid_builder_operation'], 502: ['builder_result_too_large'],
}
const phase9ScopedPublishErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'serialization_retry', 'program_archived', 'identity_conflict', 'request_id_drift', 'day_locked',
    'invalid_superset', 'publish_scope_not_ready', 'publish_scope_changed', 'publish_scope_already_released', 'publish_scope_deleted_day',
    'publish_scope_position_changed', 'current_assignment_drift',
    'assignment_not_active', 'assignment_not_activatable', 'active_assignment_conflict'],
  413: ['request_body_too_large'], 422: ['invalid_builder_operation', 'publish_day_scope_disabled'], 502: ['builder_result_too_large'],
}
const phase5AuthorDayErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'serialization_retry', 'program_archived', 'identity_conflict', 'request_id_drift', 'day_slot_already_authored'],
  413: ['request_body_too_large'],
  422: ['invalid_builder_operation', 'calendar_structure_invalid'],
  502: ['builder_result_too_large'],
}
const phase5ExerciseHistoryErrors: Phase4ErrorMap = {
  403: ['access_denied'], 413: ['request_body_too_large'],
  422: ['invalid_builder_operation'], 502: ['builder_result_too_large'],
}
const phase5DaySaveErrors: Phase4ErrorMap = {
  403: ['access_denied'],
  409: ['stale_builder_version', 'serialization_retry', 'day_locked', 'program_archived', 'identity_conflict'],
  413: ['request_body_too_large', 'day_payload_too_large', 'builder_operation_too_large'],
  422: ['invalid_builder_operation', 'unsupported_shape', 'individual_set_limit'],
  502: ['assignment_day_too_large', 'builder_result_too_large'],
}
const phase55WorkoutTemplateErrors: Phase4ErrorMap = {
  401: ['session_expired'], 403: ['access_denied'],
  409: ['invalid_superset', 'workout_template_stale', 'workout_template_ineligible', 'workout_template_destination_not_empty', 'workout_template_name_reserved', 'stale_builder_version', 'serialization_retry', 'percentage_preview_changed', 'day_locked', 'program_archived', 'identity_conflict'],
  413: ['request_body_too_large', 'day_payload_too_large', 'builder_operation_too_large'],
  422: ['workout_template_incomplete', 'workout_template_unsupported', 'workout_template_query_invalid', 'calendar_structure_invalid', 'invalid_builder_operation', 'unsupported_shape'],
  502: ['builder_result_too_large'],
}
const phase9ProgramTemplateErrors: Phase4ErrorMap = {
  401: ['session_expired'], 403: ['access_denied'],
  409: ['program_template_stale', 'program_template_ineligible',
    'program_template_name_reserved', 'program_template_week_limit',
    'request_id_drift', 'identity_conflict', 'serialization_retry', 'percentage_preview_changed'],
  413: ['request_body_too_large', 'builder_operation_too_large'],
  422: ['program_template_unsupported', 'program_template_source_incomplete', 'invalid_builder_operation'],
  502: ['builder_result_too_large'],
}

const backlogRevisionErrors: Phase4ErrorMap = {
  401: ['session_expired'], 403: ['access_denied'],
  409: ['max_report_changed', 'max_report_mapping_changed', 'request_id_drift', 'candidate_evidence_changed', 'serialization_retry'],
  413: ['request_body_too_large'], 422: ['invalid_builder_operation'], 502: ['builder_result_too_large'],
}

function trustedPhase4Error(value: unknown, status: number, errors: Phase4ErrorMap): value is CoachApiErrorCode {
  return typeof value === 'string' && !!errors[status]?.some((code) => code === value)
}

const normalizeDashboardSearch = (value: string | null) => value === null ? null : value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US') || null

const oct18Errors: Phase4ErrorMap = { ...phase55DashboardErrors, 403: ['access_denied', 'feature_unavailable'], 409: ['client_membership_changed', 'personal_review_changed', 'personal_row_changed', 'personal_snapshot_changed', 'serialization_retry', 'request_id_drift', 'dashboard_read_changed'] }

export function createConnectedCoachApi(options: ApiOptions): ConnectedCoachApiV4 & Phase5CorrectionApi & Phase55DashboardReadsApi & Phase55AssignmentLifecycleApi & Phase55WorkoutTemplateLibraryApi & Phase6ProgramArchiveApi & Phase9ActivityApi & Phase9ProgramTemplateApi & PercentageProgrammingApi & BacklogRevisionApi & OwnerOnboardingApi & October18CoachApi {
  if (options.mode !== 'connected') throw new Error('Connected coach API cannot be created in demo mode.')
  const request = options.request ?? fetch
  const baseUrl = options.baseUrl?.replace(/\/$/, '') ?? ''
  let reportedFailedAccessToken: string | null | undefined
  const expireSession = (failedAccessToken: string | null) => {
    if (reportedFailedAccessToken === failedAccessToken) return
    reportedFailedAccessToken = failedAccessToken
    options.onSessionExpired?.(failedAccessToken)
  }

  async function post<Result>(path: string, body: object, phase4?: Phase4Route<Result>): Promise<Result> {
    const token = await options.getAccessToken()
    if (!token) {
      expireSession(null)
      throw new CoachApiError('session_expired', 401)
    }
    let requestBody: string
    try {
      requestBody = JSON.stringify(body)
    } catch {
      throw new CoachApiError('request_rejected')
    }
    if (phase4 && new TextEncoder().encode(requestBody).byteLength > phase4.requestMaximum) {
      requestBody = ''
      throw new CoachApiError('request_body_too_large', 413)
    }
    let response: Response
    try {
      response = await request(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: requestBody,
        credentials: 'omit',
      })
      requestBody = ''
    } catch {
      requestBody = ''
      throw new CoachApiError('network_unavailable')
    }
    if (!response.ok) {
      const requestId = safeWorkerRequestId(response)
      let error: unknown
      try {
        if (phase4) {
          const errorBody = await readPhase4Json(response, phase4ErrorMaxBytes)
          if (exactKeys(errorBody, ['error'])) error = errorBody.error
        } else error = (await response.clone().json() as { error?: unknown }).error
      } catch {
        // An untrusted or malformed response is intentionally collapsed below.
      }
      const trustedCodes: Partial<Record<number, CoachApiErrorCode[]>> = {
        403: ['access_denied'],
        409: ['stale_builder_version', 'day_locked', 'serialization_retry', 'program_archived', 'identity_conflict'],
        413: ['day_payload_too_large', 'request_body_too_large'],
        422: ['unsupported_shape', 'individual_set_limit', 'invalid_day'],
      }
      let code: CoachApiErrorCode = 'request_rejected'
      if (response.status === 401) {
        code = 'session_expired'
        expireSession(token)
      }
      else if (phase4) {
        if (trustedPhase4Error(error, response.status, phase4.trustedErrors)) code = error
      } else if (typeof error === 'string') {
        const trusted = trustedCodes[response.status]?.find((candidate) => candidate === error)
        if (trusted) code = trusted
      }
      throw new CoachApiError(code, response.status, requestId)
    }
    try {
      if (phase4) {
        const decoded = await readPhase4Json(response, phase4.resultMaximum)
        if (!phase4.decode(decoded)) throw new CoachApiError('invalid_response', response.status)
        return decoded
      }
      return await response.json() as Result
    } catch {
      throw new CoachApiError('invalid_response', response.status)
    }
  }

const phase55CalendarCreate = (value: unknown, input: CreateCalendarProgramInput): value is CreateCalendarProgramV2Result[] => Array.isArray(value)
    && value.length === 1 && exactKeys(value[0], ['program_id', 'assignment_id', 'first_day_identity_token', 'builder_version'])
    && phase4Uuid(value[0].program_id) && phase4Uuid(value[0].assignment_id)
    && phase4Uuid(value[0].first_day_identity_token) && phase4BuilderVersion(value[0].builder_version)

  const profileBodyweight = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1500
  const profileUnit = (value: unknown): value is 'lb' | 'kg' => phase4Enum(value, ['lb', 'kg'])
  const profileSex = (value: unknown): value is 'male' | 'female' => phase4Enum(value, ['male', 'female'])
  const profileActor = (value: unknown): value is 'coach' | 'athlete' => phase4Enum(value, ['coach', 'athlete'])
  const athleteProfile = (value: unknown, gym: string, athlete: string): value is AthleteProfileV1 => exactKeys(value, [
    'contract_version', 'gym_id', 'athlete_id', 'name', 'sex_category', 'bodyweight_value', 'bodyweight_unit',
    'preferred_weight_unit', 'tested_1rm_squat', 'tested_1rm_bench', 'tested_1rm_deadlift', 'tested_1rm_unit',
    'profile_version', 'updated_at', 'updated_by',
  ]) && value.contract_version === 1 && value.gym_id === gym && value.athlete_id === athlete
    && phase4NonemptyText(value.name, 120) && phase4Nullable(value.sex_category, profileSex)
    && phase4Nullable(value.bodyweight_value, profileBodyweight)
    && phase4Nullable(value.bodyweight_unit, profileUnit)
    && (value.bodyweight_value === null) === (value.bodyweight_unit === null)
    && phase4Enum(value.preferred_weight_unit, ['lb', 'kg'])
    && [value.tested_1rm_squat, value.tested_1rm_bench, value.tested_1rm_deadlift].every(item => item === null || typeof item === 'number' && item > 0 && item <= 3000)
    && phase4Enum(value.tested_1rm_unit, ['lb', 'kg']) && phase4BuilderVersion(value.profile_version)
    && phase4Timestamp(value.updated_at) && phase4Nullable(value.updated_by, profileActor)

  const p36MaxRecord = (value: unknown): value is ProgrammingMaxRecordV1 => exactKeys(value, [
    'id', 'exercise_id', 'max_type', 'value', 'unit', 'effective_from', 'same_day_version',
    'source', 'source_profile_version', 'source_candidate_id', 'created_at',
  ]) && phase4Uuid(value.id) && phase4Uuid(value.exercise_id)
    && phase4Enum(value.max_type, ['tested_1rm', 'training_max'])
    && typeof value.value === 'number' && Number.isFinite(value.value) && value.value > 0 && value.value <= 3000
    && profileUnit(value.unit) && phase4Date(value.effective_from)
    && phase4Integer(value.same_day_version, 1, 1000000)
    && phase4Enum(value.source, ['legacy_coach_entry', 'coach_entry', 'profile_approval', 'workout_approval'])
    && phase4Nullable(value.source_profile_version, phase4BuilderVersion)
    && phase4Nullable(value.source_candidate_id, phase4Uuid)
    && phase4Timestamp(value.created_at)
  const reportWorkout = (value: unknown): value is NonNullable<CoachMaxReportV1['workout']> => exactKeys(value,
    ['workout_session_id', 'exercise_log_id', 'set_log_id', 'workout_title', 'set_number', 'performed_at', 'actual_reps'])
    && phase4Uuid(value.workout_session_id) && phase4Uuid(value.exercise_log_id) && phase4Uuid(value.set_log_id)
    && phase4Nullable(value.workout_title, item => phase4NonemptyText(item, 500)) && phase4Integer(value.set_number, 1, 100000)
    && phase4Nullable(value.performed_at, phase4Timestamp) && value.actual_reps === 1
  const maxReport = (value: unknown): value is CoachMaxReportV1 => exactKeys(value,
    ['report_id', 'source', 'athlete_id', 'athlete_name', 'lift', 'exercise_id', 'exercise_name', 'value', 'unit', 'reported_at', 'actual_rpe', 'profile_version', 'workout'])
    && phase4Uuid(value.report_id) && phase4Enum(value.source, ['profile', 'workout_single']) && phase4Uuid(value.athlete_id)
    && phase4NonemptyText(value.athlete_name, 120) && phase4Nullable(value.lift, item => phase4Enum(item, ['squat', 'bench', 'deadlift']))
    && phase4Uuid(value.exercise_id) && phase4NonemptyText(value.exercise_name, 120)
    && typeof value.value === 'number' && Number.isFinite(value.value) && value.value > 0 && value.value <= 3000
    && profileUnit(value.unit) && phase4Timestamp(value.reported_at) && phase4BuilderVersion(value.profile_version)
    && (value.actual_rpe === null || typeof value.actual_rpe === 'number' && Number.isFinite(value.actual_rpe) && value.actual_rpe >= 1 && value.actual_rpe <= 10)
    && (value.source === 'profile' ? value.lift !== null && value.workout === null && value.actual_rpe === null : reportWorkout(value.workout))
  const reportInbox = (value: unknown, input: Parameters<BacklogRevisionApi['getCoachMaxReportInboxV1']>[0]): value is CoachMaxReportInboxV1 => {
    if (!exactKeys(value, ['contract_version', 'gym_id', 'total_pending', 'items', 'has_more', 'next_cursor'])
      || value.contract_version !== 1 || value.gym_id !== input.target_gym || !phase4Integer(value.total_pending, 0, Number.MAX_SAFE_INTEGER)
      || !phase4Array(value.items, input.page_size, maxReport) || typeof value.has_more !== 'boolean'
      || !phase4Nullable(value.next_cursor, (item): item is NonNullable<CoachMaxReportInboxV1['next_cursor']> => exactKeys(item, ['reported_at', 'report_id']) && phase4Timestamp(item.reported_at) && phase4Uuid(item.report_id))
      || value.has_more !== (value.next_cursor !== null) || value.total_pending < value.items.length
      || new Set(value.items.map(item => item.report_id)).size !== value.items.length
      || value.items.some(item => input.target_athlete !== null && item.athlete_id !== input.target_athlete)) return false
    const last = value.items.at(-1)
    return value.next_cursor === null || Boolean(last && value.next_cursor.report_id === last.report_id && value.next_cursor.reported_at === last.reported_at)
  }
  const workoutCounts = (value: unknown): value is number[] => phase4Array(value, 12, (item): item is number => phase4Integer(item, 0, 7))
  const templateMetadataItem = (value: unknown): value is ProgramTemplateMetadataItemV1 => exactKeys(value,
    ['template_id', 'name', 'builder_version', 'archived_at', 'week_count', 'created_at', 'weekly_workout_counts'])
    && phase4Uuid(value.template_id) && phase4NonemptyText(value.name, 120) && phase4BuilderVersion(value.builder_version)
    && phase4Nullable(value.archived_at, phase4Timestamp) && phase4Integer(value.week_count, 1, 12)
    && phase4Timestamp(value.created_at) && workoutCounts(value.weekly_workout_counts) && value.weekly_workout_counts.length === value.week_count
  const templateMetadataLibrary = (value: unknown, input: Parameters<BacklogRevisionApi['getCoachProgramTemplateMetadataLibraryV1']>[0]): value is ProgramTemplateMetadataLibraryV1 => {
    if (!exactKeys(value, ['contract_version', 'items', 'has_more', 'next_cursor']) || value.contract_version !== 1
      || !phase4Array(value.items, input.page_size, templateMetadataItem) || typeof value.has_more !== 'boolean'
      || !phase4Nullable(value.next_cursor, (item): item is NonNullable<ProgramTemplateMetadataLibraryV1['next_cursor']> => exactKeys(item, ['name', 'template_id']) && phase4NonemptyText(item.name, 120) && phase4Uuid(item.template_id))
      || value.has_more !== (value.next_cursor !== null)
      || new Set(value.items.map(item => item.template_id)).size !== value.items.length
      || value.items.some(item => (input.week_count !== null && item.week_count !== input.week_count)
        || (input.workouts_per_week === 'varies' ? new Set(item.weekly_workout_counts).size <= 1 : input.workouts_per_week !== null && item.weekly_workout_counts.some(count => count !== input.workouts_per_week)))) return false
    const last = value.items.at(-1)
    return value.next_cursor === null || Boolean(last && value.next_cursor.template_id === last.template_id && value.next_cursor.name === last.name)
  }
  const publicationMetadataItem = (value: unknown): value is ProgramPublicationMetadataV1 => exactKeys(value,
    ['program_id', 'created_at', 'first_published_at', 'latest_published_at', 'releases'])
    && phase4Uuid(value.program_id) && phase4Timestamp(value.created_at)
    && phase4Nullable(value.first_published_at, phase4Timestamp) && phase4Nullable(value.latest_published_at, phase4Timestamp)
    && phase4Array(value.releases, 10000, (item): item is ProgramPublicationMetadataV1['releases'][number] => exactKeys(item,
      ['release_id', 'published_at', 'scope_kind', 'week_ordinals', 'day_ordinals']) && phase4Uuid(item.release_id) && phase4Timestamp(item.published_at)
      && phase4Enum(item.scope_kind, ['legacy_full', 'day', 'week', 'program'])
      && phase4Array(item.week_ordinals, 4096, (ordinal): ordinal is number => phase4Integer(ordinal, 1, 4096))
      && phase4Array(item.day_ordinals, 4096, (ordinal): ordinal is number => phase4Integer(ordinal, 1, 4096)))
    && (value.releases.length === 0 ? value.first_published_at === null && value.latest_published_at === null
      : value.first_published_at === value.releases[0].published_at && value.latest_published_at === value.releases.at(-1)?.published_at)

  const p36Candidate = (value: unknown): value is ProgrammingMaxCandidateV1 => exactKeys(value, [
    'id', 'exercise_id', 'value', 'unit', 'profile_version', 'workout_session_id',
    'exercise_log_id', 'set_log_id', 'actual_rpe', 'state', 'created_at',
  ]) && phase4Uuid(value.id) && phase4Uuid(value.exercise_id)
    && typeof value.value === 'number' && Number.isFinite(value.value) && value.value > 0 && value.value <= 3000
    && profileUnit(value.unit) && phase4BuilderVersion(value.profile_version)
    && phase4Uuid(value.workout_session_id) && phase4Uuid(value.exercise_log_id)
    && phase4Uuid(value.set_log_id)
    && (value.actual_rpe === null || typeof value.actual_rpe === 'number' && value.actual_rpe >= 1 && value.actual_rpe <= 10)
    && phase4Enum(value.state, ['pending', 'approved', 'dismissed']) && phase4Timestamp(value.created_at)
  const p36Maxes = (value: unknown, gym: string, athlete: string): value is ProgrammingMaxesV1 => exactKeys(value, [
    'contract_version', 'gym_id', 'athlete_id', 'profile', 'maxes', 'candidates', 'basis_options',
  ]) && value.contract_version === 1 && value.gym_id === gym && value.athlete_id === athlete
    && exactKeys(value.profile, ['profile_version', 'tested_1rm_squat', 'tested_1rm_bench',
      'tested_1rm_deadlift', 'tested_1rm_unit'])
    && phase4BuilderVersion(value.profile.profile_version)
    && [value.profile.tested_1rm_squat, value.profile.tested_1rm_bench,
      value.profile.tested_1rm_deadlift].every(item => item === null || typeof item === 'number'
        && Number.isFinite(item) && item > 0 && item <= 3000)
    && profileUnit(value.profile.tested_1rm_unit)
    && phase4Array(value.maxes, 500, p36MaxRecord)
    && phase4Array(value.candidates, 100, p36Candidate)
    && phase4Array(value.basis_options, 500, (item): item is ProgrammingBasisOptionV1 =>
      exactKeys(item, ['exercise_id', 'name', 'default_basis_exercise_id', 'archived_at',
        'latest_tested_1rm', 'latest_training_max'])
      && phase4Uuid(item.exercise_id) && phase4NonemptyText(item.name, 120)
      && phase4Nullable(item.default_basis_exercise_id, phase4Uuid)
      && phase4Nullable(item.archived_at, phase4Timestamp)
      && phase4Nullable(item.latest_tested_1rm, p36MaxRecord)
      && phase4Nullable(item.latest_training_max, p36MaxRecord))
  const p36TrackedRow = (value: unknown, system: boolean): value is TrackedExerciseV1 =>
    exactKeys(value, system ? ['exercise_id', 'name', 'lift'] : ['exercise_id', 'name'])
      && phase4Uuid(value.exercise_id) && phase4NonemptyText(value.name, 120)
      && (!system || phase4Enum(value.lift, ['squat', 'bench', 'deadlift']))
  const p36Tracking = (value: unknown): value is AthleteTrackingV1 => exactKeys(value, [
    'contract_version', 'tracking_version', 'system_required', 'coach_required',
    'athlete_added', 'effective',
  ]) && value.contract_version === 1 && phase4BuilderVersion(value.tracking_version)
    && phase4Array(value.system_required, 3, (item): item is SystemTrackedExerciseV1 => p36TrackedRow(item, true))
    && phase4Array(value.coach_required, 500, (item): item is TrackedExerciseV1 => p36TrackedRow(item, false))
    && phase4Array(value.athlete_added, 500, (item): item is TrackedExerciseV1 => p36TrackedRow(item, false))
    && phase4Array(value.effective, 500, (item): item is TrackedExerciseV1 => p36TrackedRow(item, false))
  const p36ExerciseOptions = (value: unknown): value is ExerciseOptionV1[] =>
    phase4Array(value, 500, (item): item is ExerciseOptionV1 => exactKeys(item,
      ['exercise_id', 'name', 'default_basis_exercise_id'])
      && phase4Uuid(item.exercise_id) && phase4NonemptyText(item.name, 120)
      && phase4Nullable(item.default_basis_exercise_id, phase4Uuid))
  const p36StripReadDay = (value: unknown, template: boolean): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const day = value as Record<string, unknown>
    if (!Array.isArray(day.movement_groups) || !Array.isArray(day.ungrouped_exercises)) return null
    const stripExercise = (exercise: unknown): unknown => {
      if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) return null
      const row = exercise as Record<string, unknown>
      if (!phase4Nullable(row.exercise_id, phase4Uuid) || typeof row.track_in_metrics !== 'boolean'
        || (row.track_in_metrics && row.exercise_id === null)) return null
      const { exercise_id: _exerciseId, track_in_metrics: _tracked, ...legacy } = row
      return legacy
    }
    return { ...day,
      movement_groups: day.movement_groups.map(group => {
        if (!group || typeof group !== 'object' || Array.isArray(group)) return null
        const typed = group as Record<string, unknown>
        return Array.isArray(typed.exercises) ? { ...typed,
          exercises: typed.exercises.map(stripExercise) } : null
      }),
      ungrouped_exercises: day.ungrouped_exercises.map(stripExercise),
    }
  }
  const p36AssignmentDay = (value: unknown, input: { assignment: string; day_identity_token: string; expected_detail_read_token: string }): value is CoachAssignmentDayV7 => {
    if (!exactKeys(value, ['contract_version', 'detail_read_token', 'program_id', 'assignment_id',
      'builder_version', 'day', 'percent_basis_options', 'exercise_options'])
      || value.contract_version !== 7 || !p36ExerciseOptions(value.exercise_options)) return false
    const day = value.day
    const legacyDay = exactKeys(day, ['mode', 'content']) && day.mode === 'editable'
      ? { ...day, content: p36StripReadDay(day.content, false) } : day
    const { exercise_options: _options, ...legacy } = value
    return richAssignmentDay({ ...legacy, contract_version: 6, day: legacyDay }, input)
  }
  const p36WorkoutTemplateDay = (value: unknown, input: { template: string; expected_read_token: string | null }): value is WorkoutTemplateDayV3 => {
    if (!exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'supported',
      'rich_supported', 'day', 'read_token', 'percent_basis_options', 'exercise_options'])
      || value.contract_version !== 3 || !p36ExerciseOptions(value.exercise_options)) return false
    const { exercise_options: _options, ...legacy } = value
    return richTemplateDay({ ...legacy, contract_version: 2,
      day: p36StripReadDay(value.day, true) }, input)
  }
  const p36ProgramTemplateDay = (value: unknown, input: { template: string; day_id: string }): value is ProgramTemplateDayV3 => {
    if (!exactKeys(value, ['contract_version', 'template_id', 'day_id', 'builder_version',
      'supported', 'day', 'percent_basis_options', 'exercise_options'])
      || value.contract_version !== 3 || !p36ExerciseOptions(value.exercise_options)) return false
    const { exercise_options: _options, ...legacy } = value
    return richProgramTemplateDay({ ...legacy, contract_version: 2,
      day: value.day === null ? null : p36StripReadDay(value.day, true) }, input)
  }
  const p36ProgramSave = (value: unknown, input: { program: string; assignment: string;
    expected_builder_version: number; day: RichProgramDaySaveV2 }): value is SaveCoachProgramDayV5Result => {
    if (!exactKeys(value, ['contract_version', 'program_id', 'assignment_id',
      'day_identity_token', 'builder_version', 'unchanged', 'day'])
      || value.contract_version !== 5) return false
    return richSaveResult({ ...value, contract_version: 4,
      day: p36StripReadDay(value.day, false) }, input)
  }
  const p36TemplateSave = (value: unknown, input: { template: string; day: RichTemplateDaySaveV2 },
    program: boolean): boolean => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const row = value as Record<string, unknown>
    if (row.contract_version !== 3) return false
    const stripped = { ...row, contract_version: 2,
      day: p36StripReadDay(row.day, true) }
    return program
      ? richProgramTemplateSaveResult(stripped, input as { template: Phase4Uuid; day_id: Phase4Uuid; day: RichTemplateDaySave })
      : richTemplateSaveResult(stripped, input)
  }
  const p36Number = (value: unknown): value is number => typeof value === 'number'
    && Number.isFinite(value) && value >= 0
  const p36Metrics = (value: unknown, gym: string, athlete: string): value is CoachAthleteMetricsV1 =>
    exactKeys(value, ['contract_version', 'gym_id', 'athlete_id', 'tracking_version',
      'tracked_lifts', 'recent_sessions'])
    && value.contract_version === 1 && value.gym_id === gym && value.athlete_id === athlete
    && phase4BuilderVersion(value.tracking_version)
    && phase4Array(value.tracked_lifts, 500, (row): row is Record<string, unknown> => exactKeys(row, [
      'exercise_id', 'name', 'top_weight', 'top_unit', 'estimated_1rm',
      'estimated_1rm_unit', 'latest_at'])
      && phase4Uuid(row.exercise_id) && phase4NonemptyText(row.name, 120)
      && phase4Nullable(row.top_weight, p36Number)
      && phase4Nullable(row.top_unit, profileUnit)
      && phase4Nullable(row.estimated_1rm, p36Number)
      && phase4Nullable(row.estimated_1rm_unit, item => item === 'lb')
      && phase4Nullable(row.latest_at, phase4Timestamp))
    && phase4Array(value.recent_sessions, 30, (session): session is Record<string, unknown> => exactKeys(session,
      ['workout_session_id', 'assignment_id', 'completed_at', 'state', 'exercises'])
      && phase4Uuid(session.workout_session_id) && phase4Uuid(session.assignment_id)
      && phase4Nullable(session.completed_at, phase4Timestamp)
      && phase4Enum(session.state, ['not_started', 'in_progress', 'completed', 'skipped'])
      && phase4Array(session.exercises, 10, (exercise): exercise is Record<string, unknown> => exactKeys(exercise,
        ['exercise_id', 'name', 'sets'])
        && phase4Nullable(exercise.exercise_id, phase4Uuid)
        && phase4NonemptyText(exercise.name, 120)
        && phase4Array(exercise.sets, 20, (set): set is Record<string, unknown> => exactKeys(set,
          ['set_log_id', 'reps', 'weight', 'unit', 'rpe', 'completed'])
          && phase4Uuid(set.set_log_id)
          && phase4Nullable(set.reps, item => phase4Integer(item, 0, 100000))
          && phase4Nullable(set.weight, p36Number)
          && phase4Nullable(set.unit, profileUnit)
          && phase4Nullable(set.rpe, p36Number)
          && typeof set.completed === 'boolean')))
  const notesResult = (value:unknown,input:{target_gym:string;target_athlete:string}):value is CoachAthleteNotesV1 => exactKeys(value,['contract_version','gym_id','athlete_id','text','version','updated_at']) && value.contract_version===1 && value.gym_id===input.target_gym && value.athlete_id===input.target_athlete && typeof value.text==='string' && [...value.text].length<=5000 && phase4Integer(value.version,0,Number.MAX_SAFE_INTEGER) && phase4Nullable(value.updated_at,phase4Timestamp)
  const p36Report = (value: unknown, assignment: string): value is TrainingReportV1 =>
    exactKeys(value, ['contract_version', 'assignment_id', 'ready', 'completed_at', 'summary'])
    && value.contract_version === 1 && value.assignment_id === assignment
    && typeof value.ready === 'boolean'
    && (value.ready ? phase4Timestamp(value.completed_at) : value.completed_at === null)
    && (value.ready ? exactKeys(value.summary, ['sessions', 'completed_sessions',
      'logged_sets', 'total_volume', 'average_rpe', 'volume_unit', 'top_sets'])
      && phase4Integer(value.summary.sessions, 0, 100000)
      && phase4Integer(value.summary.completed_sessions, 0, 100000)
      && phase4Integer(value.summary.logged_sets, 0, 1000000)
      && p36Number(value.summary.total_volume) && value.summary.volume_unit === 'lb'
      && phase4Nullable(value.summary.average_rpe, p36Number)
      && phase4Array(value.summary.top_sets, 100, (row): row is Record<string, unknown> => exactKeys(row,
        ['exercise_id', 'exercise_name', 'weight', 'unit', 'reps', 'rpe', 'performed_at'])
        && phase4Nullable(row.exercise_id, phase4Uuid)
        && phase4NonemptyText(row.exercise_name, 120)
        && p36Number(row.weight) && profileUnit(row.unit)
        && phase4Integer(row.reps, 0, 100000)
        && phase4Nullable(row.rpe, p36Number)
        && phase4Timestamp(row.performed_at)) : value.summary === null)
  const cycleClosure = (value: unknown, assignment: string): value is CompleteCoachAssignmentCycleV1 =>
    exactKeys(value, ['contract_version', 'assignment_id', 'assignment_status', 'completed_at'])
    && value.contract_version === 1 && value.assignment_id === assignment
    && value.assignment_status === 'completed' && phase4Timestamp(value.completed_at)
  const p36PercentPreview = (value: unknown, input: { program: string; expected_builder_version: number }): value is ProgramPercentPreviewV1 =>
    exactKeys(value, ['contract_version', 'program_id', 'builder_version', 'fingerprint', 'changes', 'counts'])
    && value.contract_version === 1 && value.program_id === input.program
    && value.builder_version === input.expected_builder_version && phase4Hex(value.fingerprint)
    && phase4Array(value.changes, 2000, (row): row is Record<string, unknown> => exactKeys(row,
      ['set_identity_token', 'exercise_name', 'percent', 'basis_exercise_id', 'max_type',
        'old_weight', 'new_weight', 'unit', 'old_max_id', 'new_max_id', 'manual_override', 'skip_reason'])
      && phase4Uuid(row.set_identity_token) && phase4NonemptyText(row.exercise_name, 120)
      && p36Number(row.percent) && phase4Uuid(row.basis_exercise_id)
      && phase4Enum(row.max_type, ['tested_1rm', 'training_max'])
      && phase4Nullable(row.old_weight, p36Number) && phase4Nullable(row.new_weight, p36Number)
      && profileUnit(row.unit) && phase4Nullable(row.old_max_id, phase4Uuid)
      && phase4Nullable(row.new_max_id, phase4Uuid)
      && phase4Nullable(row.manual_override, p36Number)
      && phase4Nullable(row.skip_reason, item => phase4Enum(item,
        ['locked', 'performed', 'missing_max', 'manual_override', 'cross_unit'])))
    && exactKeys(value.counts, ['eligible', 'skipped', 'changed'])
    && phase4Integer(value.counts.eligible, 0, 2000)
    && phase4Integer(value.counts.skipped, 0, 2000)
    && phase4Integer(value.counts.changed, 0, 2000)
  const p36TemplatePercentPreview = (value: unknown, input: { template: string; athlete: string; expected_template_builder_version: number; program: string | null; expected_program_builder_version: number | null }): value is TemplatePercentPreviewV1 =>
    exactKeys(value, ['contract_version', 'template_id', 'template_builder_version', 'program_id', 'program_builder_version', 'athlete_id', 'calendar_generation', 'cutoff_date', 'ready', 'unresolved_count', 'rows', 'fingerprint'])
    && value.contract_version === 1 && value.template_id === input.template
    && value.athlete_id === input.athlete
    && value.template_builder_version === input.expected_template_builder_version
    && value.program_id === input.program
    && value.program_builder_version === input.expected_program_builder_version
    && phase4Integer(value.calendar_generation, 0, Number.MAX_SAFE_INTEGER)
    && phase4Date(value.cutoff_date) && typeof value.ready === 'boolean'
    && phase4Integer(value.unresolved_count, 0, 2400) && phase4Hex(value.fingerprint)
    && phase4Array(value.rows, 2400, (row): row is Record<string, unknown> => exactKeys(row,
      ['set_id', 'exercise_name', 'percent', 'basis_exercise_id', 'max_type', 'status', 'resolved_weight', 'unit', 'max_id'])
      && phase4Uuid(row.set_id) && phase4NonemptyText(row.exercise_name, 120)
      && p36Number(row.percent) && phase4Nullable(row.basis_exercise_id, phase4Uuid)
      && phase4Nullable(row.max_type, item => phase4Enum(item, ['tested_1rm', 'training_max']))
      && phase4Enum(row.status, ['current', 'missing', 'future_only', 'unmapped', 'archived_exercise', 'cross_unit'])
      && phase4Nullable(row.resolved_weight, p36Number)
      && profileUnit(row.unit) && phase4Nullable(row.max_id, phase4Uuid))
  const p36PercentApply = (value: unknown, input: { program: string; expected_builder_version: number }): value is ProgramPercentApplyV1 =>
    exactKeys(value, ['contract_version', 'program_id', 'builder_version', 'applied_count', 'skipped_count'])
    && value.contract_version === 1 && value.program_id === input.program
    && phase4BuilderVersion(value.builder_version)
    && value.builder_version >= input.expected_builder_version
    && phase4Integer(value.applied_count, 0, 2000)
    && phase4Integer(value.skipped_count, 0, 2000)
  const compactOperation = (value: unknown, input: { request_id: string; expected_builder_version: number },
    root: string, operation: CompactProgrammingOperationV1['operation_type']): value is CompactProgrammingOperationV1 =>
    exactKeys(value, ['contract_version', 'request_id', 'operation_type', 'root_id',
      'builder_version_before', 'builder_version_after', 'changed_day_tokens', 'undo'])
    && value.contract_version === 1 && phase4Uuid(value.request_id) && value.request_id === input.request_id
    && value.operation_type === operation && phase4Uuid(value.root_id) && value.root_id === root
    && value.builder_version_before === input.expected_builder_version
    && phase4BuilderVersion(value.builder_version_after)
    && value.builder_version_after >= input.expected_builder_version
    && phase4Array(value.changed_day_tokens, 84, phase4Uuid)
    && new Set(value.changed_day_tokens).size === value.changed_day_tokens.length
    && (value.undo === null || (exactKeys(value.undo, ['undo_id', 'expires_at'])
      && phase4Uuid(value.undo.undo_id) && phase4Timestamp(value.undo.expires_at)))

  const phase55ActivateAssignment = (value: unknown, input: ActivateAndPublishCoachAssignmentV1Input): value is ActivateAndPublishCoachAssignmentV1Result => exactKeys(value, [
    'request_id', 'operation_type', 'program_id', 'assignment_id', 'previous_assignment_id',
    'builder_version', 'release_id', 'published_at', 'retired_instance_count',
  ]) && value.request_id === input.request_id && value.operation_type === 'activate_assignment'
    && phase4Uuid(value.program_id) && phase4Uuid(value.assignment_id)
    && value.assignment_id === input.candidate_assignment && phase4Nullable(value.previous_assignment_id, phase4Uuid) && value.previous_assignment_id === input.expected_current_assignment
    && phase4BuilderVersion(value.builder_version) && value.builder_version === input.expected_builder_version
    && phase4Uuid(value.release_id) && phase4Timestamp(value.published_at)
    && phase4Integer(value.retired_instance_count, 0, 100000)

  const onboardingErrors: Phase4ErrorMap = { 403: ['access_denied'], 409: ['settings_changed', 'serialization_retry'], 422: ['invalid_builder_operation'], 502: ['builder_result_too_large'] }
  const settingsShape = (value: unknown): value is WorkspaceSettingsV1 => exactKeys(value, ['contract_version','coach','workspace']) && value.contract_version === 1
    && exactKeys(value.coach, ['id','display_name','name_version']) && phase4Uuid(value.coach.id) && phase4NonemptyText(value.coach.display_name,120) && phase4Integer(value.coach.name_version,0,2147483647)
    && exactKeys(value.workspace, ['id','name','name_version','can_rename']) && phase4Uuid(value.workspace.id) && phase4NonemptyText(value.workspace.name,120) && phase4Integer(value.workspace.name_version,0,2147483647) && typeof value.workspace.can_rename === 'boolean'
  const settingsRoute = (gym: string): Phase4Route<WorkspaceSettingsV1> => ({ requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, trustedErrors: onboardingErrors, decode: (value): value is WorkspaceSettingsV1 => settingsShape(value) && value.workspace.id === gym })
  return {
    previewBuilderWeekCopyV3: input => post<PreviewBuilderWeekCopyV3Result>('/api/preview-builder-week-copy-v3', input, { requestMaximum: phase4BuilderRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, trustedErrors: phase4CopyPreviewErrors, decode: (value): value is PreviewBuilderWeekCopyV3Result => { if (!isRecord(value) || value.contract_version !== 3 || typeof value.preview_guard !== 'string' || !/^[0-9a-f]{64}$/.test(value.preview_guard)) return false; const { contract_version: _v, preview_guard: _guard, ...base } = value; return phase4PreviewCopy(base, input) } }),
    applyBuilderWeekCopyV3: input => post<ApplyBuilderWeekCopyV3Result>('/api/apply-builder-week-copy-v3', input, { requestMaximum: phase4BuilderRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, trustedErrors: phase4CopyApplyErrors, decode: (value): value is ApplyBuilderWeekCopyV3Result => { if (!isRecord(value) || value.contract_version !== 3 || value.preview_guard !== input.preview_guard) return false; const { contract_version: _v, preview_guard: _guard, ...base } = value; return phase4ApplyCopy(base, input) } }),
    getCoachDashboardRosterPageV4: input => { const normalized = { ...input, search_text: normalizeDashboardSearch(input.search_text) }; return post<CoachDashboardRosterPageV4>('/api/coach-dashboard-roster-page-v4', normalized, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, trustedErrors: oct18Errors, decode: (value): value is CoachDashboardRosterPageV4 => oct18RosterPage(value, normalized) }) },
    getCoachProgramTemplateTotalsV2: input => post<CoachTemplateTotalsV2>('/api/coach-program-template-totals-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, trustedErrors: oct18Errors, decode: (value): value is CoachTemplateTotalsV2 => exactKeys(value, ['contract_version', 'template_id', 'builder_version', 'days']) && value.contract_version === 2 && value.template_id === input.template && phase4Integer(value.builder_version, 0, Number.MAX_SAFE_INTEGER) && phase4Array(value.days, 84, (day): day is CoachTemplateTotalsV2['days'][number] => exactKeys(day, ['week_id', 'week_ordinal', 'day_id', 'day_ordinal', 'sets_min', 'sets_max']) && phase4Uuid(day.week_id) && phase4Uuid(day.day_id) && phase4Integer(day.week_ordinal, 1, 12) && phase4Integer(day.day_ordinal, 1, 7) && phase4Integer(day.sets_min, 0, 240) && phase4Integer(day.sets_max, Number(day.sets_min), 240)) && uniqueBy(value.days, day => day.day_id) }),
    getCoachProgramTemplateReadinessV1: input => post<CoachTemplateReadinessV1>('/api/coach-program-template-readiness-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, trustedErrors: oct18Errors, decode: (value): value is CoachTemplateReadinessV1 => exactKeys(value, ['contract_version', 'program_id', 'assignment_id', 'ready', 'issues']) && value.contract_version === 1 && value.program_id === input.program && value.assignment_id === input.assignment && typeof value.ready === 'boolean' && phase4Array(value.issues, 84, (issue): issue is CoachTemplateReadinessV1['issues'][number] => exactKeys(issue, ['week_identity_token', 'week_ordinal', 'day_identity_token', 'day_ordinal', 'label', 'code']) && phase4Uuid(issue.week_identity_token) && phase4Uuid(issue.day_identity_token) && phase4Integer(issue.week_ordinal, 1, 12) && phase4Integer(issue.day_ordinal, 1, 7) && phase4Nullable(issue.label, text => phase4Text(text, 120)) && issue.code === 'workout_incomplete') && uniqueBy(value.issues, issue => issue.day_identity_token) && (!value.ready || value.issues.length === 0) }),
    getCoachClientRemovalContextV1: input => post<CoachClientRemovalContextV1>('/api/coach-client-removal-context-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, trustedErrors: oct18Errors, decode: (value): value is CoachClientRemovalContextV1 => oct18RemovalContext(value, input.athlete) }),
    setCoachClientRemovedV1: input => post<CoachClientRemovalContextV1>('/api/set-coach-client-removed-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, trustedErrors: oct18Errors, decode: (value): value is CoachClientRemovalContextV1 => oct18RemovalContext(value, input.athlete) && value.removed === input.removed }),
    getCoachRemovedClientsV1: input => post<CoachRemovedClientsV1>('/api/coach-removed-clients-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, trustedErrors: oct18Errors, decode: (value): value is CoachRemovedClientsV1 => exactKeys(value, ['contract_version', 'items', 'next_cursor']) && value.contract_version === 1 && phase4Array(value.items, Math.min(50, input.page_size), (row): row is CoachRemovedClientsV1['items'][number] => exactKeys(row, ['athlete_id', 'name', 'membership_state', 'pairing_epoch', 'removed_at']) && phase4Uuid(row.athlete_id) && phase4NonemptyText(row.name, 120) && row.membership_state === 'former' && phase4Uuid(row.pairing_epoch) && phase4Nullable(row.removed_at, phase4Timestamp)) && uniqueBy(value.items, row => row.athlete_id) && phase4Nullable(value.next_cursor, phase4Uuid) && (value.next_cursor === null || value.items.length === input.page_size && value.next_cursor === value.items.at(-1)?.athlete_id) }),
    getCoachPersonalTrackingRequestsV2: input => post<CoachPersonalTrackingRequestsV2>('/api/coach-personal-tracking-requests-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, trustedErrors: oct18Errors, decode: (value): value is CoachPersonalTrackingRequestsV2 => exactKeys(value, ['contract_version', 'items', 'next_cursor']) && value.contract_version === 2 && phase4Array(value.items, Math.min(50, input.page_size), oct18PersonalRequest) && uniqueBy(value.items, row => row.request_id) && value.items.every(row => input.athlete === null || row.athlete_id === input.athlete) && phase4Nullable(value.next_cursor, phase4Uuid) && (value.next_cursor === null || value.items.length === input.page_size && value.next_cursor === value.items.at(-1)?.request_id) }),
    reviewCoachPersonalTrackingRequestV2: input => post<CoachPersonalTrackingReviewV2>('/api/review-coach-personal-tracking-request-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, trustedErrors: oct18Errors, decode: (value): value is CoachPersonalTrackingReviewV2 => exactKeys(value, ['contract_version', 'request_id', 'status', 'exercise_id', 'review_version', 'tracking_version']) && value.contract_version === 2 && value.request_id === input.mapping_request_id && value.status === (input.action === 'resolve' ? 'resolved' : 'dismissed') && value.exercise_id === input.exercise_id && value.review_version === input.expected_review_version + 1 && phase4Integer(value.tracking_version, input.expected_tracking_version, Number.MAX_SAFE_INTEGER) }),
    getCoachSetupStatusV1: () => post<CoachSetupStatusV1>('/api/coach-setup-status-v1', {}, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, trustedErrors: onboardingErrors,
      decode: (value): value is CoachSetupStatusV1 => exactKeys(value,['contract_version','state','coach_display_name']) && value.contract_version === 1 && phase4Enum(value.state,['workspace','eligible','unavailable']) && (value.state === 'workspace' ? phase4NonemptyText(value.coach_display_name,120) : value.coach_display_name === null) }),
    getWorkspaceSettingsV1: input => post<WorkspaceSettingsV1>('/api/coach-workspace-settings-v1',input,settingsRoute(input.target_gym)),
    saveCoachNameV1: input => post<WorkspaceSettingsV1>('/api/save-coach-name-v1',input,settingsRoute(input.target_gym)),
    saveWorkspaceNameV1: input => post<WorkspaceSettingsV1>('/api/save-workspace-name-v1',input,settingsRoute(input.target_gym)),
    getCoachMaxReportInboxV1: (input: Parameters<BacklogRevisionApi['getCoachMaxReportInboxV1']>[0]) => post<CoachMaxReportInboxV1>('/api/coach-max-report-inbox-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, trustedErrors: backlogRevisionErrors, decode: (value): value is CoachMaxReportInboxV1 => reportInbox(value, input) }),
    reviewCoachMaxReportV1: (input: Parameters<BacklogRevisionApi['reviewCoachMaxReportV1']>[0]) => post<CoachMaxReportReviewV1>('/api/review-coach-max-report-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, trustedErrors: backlogRevisionErrors, decode: (value): value is CoachMaxReportReviewV1 => exactKeys(value, ['contract_version', 'report_id', 'state', 'max']) && value.contract_version === 1 && value.report_id === input.report_id && value.state === (input.action === 'approve' ? 'approved' : 'dismissed') && (input.action === 'dismiss' ? value.max === null : p36MaxRecord(value.max) && value.max.max_type === 'tested_1rm' && value.max.effective_from === input.effective_from && ['profile_approval', 'workout_approval'].includes(value.max.source)) }),
    getCoachProgramTemplateMetadataLibraryV1: (input: Parameters<BacklogRevisionApi['getCoachProgramTemplateMetadataLibraryV1']>[0]) => post<ProgramTemplateMetadataLibraryV1>('/api/coach-program-template-metadata-library-v1', { ...input, workouts_per_week: input.workouts_per_week === null ? null : String(input.workouts_per_week) }, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, trustedErrors: backlogRevisionErrors, decode: (value): value is ProgramTemplateMetadataLibraryV1 => templateMetadataLibrary(value, input) }),
    getCoachProgramTemplateMetadataV1: (input: { template: string }) => post<ProgramTemplateMetadataV1>('/api/coach-program-template-metadata-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, trustedErrors: backlogRevisionErrors, decode: (value): value is ProgramTemplateMetadataV1 => exactKeys(value, ['contract_version', 'template_id', 'created_at', 'weekly_workout_counts']) && value.contract_version === 1 && value.template_id === input.template && phase4Timestamp(value.created_at) && workoutCounts(value.weekly_workout_counts) }),
    getCoachProgramPublicationMetadataV1: (input: Parameters<BacklogRevisionApi['getCoachProgramPublicationMetadataV1']>[0]) => post<{ contract_version: 1; items: ProgramPublicationMetadataV1[] }>('/api/coach-program-publication-metadata-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, trustedErrors: backlogRevisionErrors, decode: (value): value is { contract_version: 1; items: ProgramPublicationMetadataV1[] } => exactKeys(value, ['contract_version', 'items']) && value.contract_version === 1 && phase4Array(value.items, 50, publicationMetadataItem) && value.items.length === input.program_ids.length && new Set(value.items.map(item => item.program_id)).size === value.items.length && value.items.every(item => input.program_ids.includes(item.program_id)) }),
    bootstrapOwnerGym: (input) => post('/api/bootstrap-owner-gym', input),
    addRosterAthlete: (input) => post('/api/add-roster-athlete', input),
    getCoachAthleteNotesV1: (input:{target_gym:string;target_athlete:string}) => post<CoachAthleteNotesV1>('/api/coach-athlete-notes-v1',input,{requestMaximum:phase4DefaultRequestMaxBytes,resultMaximum:phase5SmallResultMaxBytes,trustedErrors:phase55DashboardErrors,decode:(value):value is CoachAthleteNotesV1 => notesResult(value,input)}),
    saveCoachAthleteNotesV1: (input:{request_id:string;target_gym:string;target_athlete:string;expected_version:number;note_text:string}) => post<CoachAthleteNotesV1>('/api/save-coach-athlete-notes-v1',input,{requestMaximum:65536,resultMaximum:phase5SmallResultMaxBytes,trustedErrors:phase55DashboardErrors,decode:(value):value is CoachAthleteNotesV1 => notesResult(value,input)}),
    getCoachAthleteActivityPageV1: (input:Parameters<CoachOverviewApi['getCoachAthleteActivityPageV1']>[0]) => post<CoachAthleteActivityPageV1>('/api/coach-athlete-activity-page-v1',input,{requestMaximum:phase4DefaultRequestMaxBytes,resultMaximum:phase5SmallResultMaxBytes,trustedErrors:phase55DashboardErrors,decode:(value):value is CoachAthleteActivityPageV1 => {
      if(!exactKeys(value,['contract_version','items','has_more','next_cursor','summary']))return false
      return exactKeys(value.summary,['completed','skipped','last_session']) && phase4Nullable(value.summary.last_session,(item):item is {performed_at:string;day_label:string}=>exactKeys(item,['performed_at','day_label'])&&phase4Timestamp(item.performed_at)&&phase4NonemptyText(item.day_label,120)) && phase4Integer(value.summary.completed,0,Number.MAX_SAFE_INTEGER) && phase4Integer(value.summary.skipped,0,Number.MAX_SAFE_INTEGER) && phase9ActivityPage({contract_version:value.contract_version,items:value.items,has_more:value.has_more,next_cursor:value.next_cursor},input) && (value.items as CoachRecentActivityItemV1[]).every(item=>item.athlete_id===input.athlete)
    }}),
    getCoachAthleteCalendarV1: (input) => post<{contract_version:1;workouts:AthleteScheduleWorkout[]}>('/api/coach-athlete-calendar-v1',input,{requestMaximum:phase4DefaultRequestMaxBytes,resultMaximum:1024*1024,trustedErrors:phase55DashboardErrors,decode:(value):value is {contract_version:1;workouts:AthleteScheduleWorkout[]}=>exactKeys(value,['contract_version','workouts'])&&value.contract_version===1&&phase4Array(value.workouts,2000,(row):row is AthleteScheduleWorkout=>exactKeys(row,['workout_instance_id','assignment_id','logical_day_id','receipt_id','title','program_name','week_ordinal','day_ordinal','original_date','scheduled_date','version','state','updated_at','note'])&&[row.workout_instance_id,row.assignment_id,row.logical_day_id].every(phase4Uuid)&&phase4Nullable(row.receipt_id,phase4Uuid)&&phase4NonemptyText(row.title,120)&&phase4NonemptyText(row.program_name,120)&&phase4Integer(row.week_ordinal,1,1000)&&phase4Integer(row.day_ordinal,1,7)&&phase4Nullable(row.original_date,phase4Date)&&phase4Nullable(row.scheduled_date,phase4Date)&&phase4Integer(row.version,0,Number.MAX_SAFE_INTEGER)&&phase4Enum(row.state,['not_started','in_progress','completed','skipped'])&&phase4Nullable(row.updated_at,phase4Timestamp)&&phase4Nullable(row.note,(item):item is string=>typeof item==='string'&&[...item].length<=500))}),
    getAthleteProfileV1: (input) => post<AthleteProfileV1>('/api/coach-athlete-profile-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => athleteProfile(value, input.target_gym, input.target_athlete), trustedErrors: phase55DashboardErrors }),
    saveAthleteProfileV1: (input) => post<AthleteProfileV1>('/api/save-coach-athlete-profile-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => athleteProfile(value, input.target_gym, input.target_athlete), trustedErrors: phase55DashboardErrors }),
    getProgrammingMaxesV1: (input: { target_gym: string; target_athlete: string }) => post<ProgrammingMaxesV1>('/api/coach-programming-maxes-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, decode: (value): value is ProgrammingMaxesV1 => p36Maxes(value, input.target_gym, input.target_athlete), trustedErrors: phase55DashboardErrors }),
    saveProgrammingMaxV1: (input: SaveProgrammingMaxV1Input) => post<ProgrammingMaxRecordV1>('/api/save-coach-programming-max-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: p36MaxRecord, trustedErrors: phase55DashboardErrors }),
    dismissProgrammingMaxCandidateV1: (input: { target_gym: string; target_athlete: string; candidate_id: string }) => post<{ candidate_id: string; state: 'dismissed' }>('/api/dismiss-coach-max-candidate-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is { candidate_id: string; state: 'dismissed' } => exactKeys(value, ['candidate_id', 'state']) && value.candidate_id === input.candidate_id && value.state === 'dismissed', trustedErrors: phase55DashboardErrors }),
    getAthleteTrackingV1: (input: { target_gym: string; target_athlete: string }) => post<AthleteTrackingV1>('/api/coach-athlete-tracking-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: p36Tracking, trustedErrors: phase55DashboardErrors }),
    setCoachTrackingV1: (input: { request_id: string; target_gym: string; target_athlete: string; exercise_id: string; required: boolean; expected_version: number }) => post<AthleteTrackingV1>('/api/save-coach-athlete-tracking-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: p36Tracking, trustedErrors: phase55DashboardErrors }),
    setGymCompetitionExerciseV1: (input: { target_gym: string; target_lift: 'squat' | 'bench' | 'deadlift'; target_exercise: string }) => post<{ lift: 'squat' | 'bench' | 'deadlift'; exercise_id: string }>('/api/set-gym-competition-exercise-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is { lift: 'squat' | 'bench' | 'deadlift'; exercise_id: string } => exactKeys(value, ['lift', 'exercise_id']) && value.lift === input.target_lift && value.exercise_id === input.target_exercise, trustedErrors: phase55DashboardErrors }),
    ensureCoachExerciseV1: (input: { target_gym: string; exercise_name: string }) => post<ExerciseOptionV1>('/api/ensure-coach-exercise-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ExerciseOptionV1 => exactKeys(value, ['exercise_id', 'name', 'default_basis_exercise_id']) && phase4Uuid(value.exercise_id) && phase4NonemptyText(value.name, 120) && phase4Nullable(value.default_basis_exercise_id, phase4Uuid), trustedErrors: phase55DashboardErrors }),
    getCoachAthleteMetricsV1: (input: { target_gym: string; target_athlete: string }) => post<CoachAthleteMetricsV1>('/api/coach-athlete-metrics-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, decode: (value): value is CoachAthleteMetricsV1 => p36Metrics(value, input.target_gym, input.target_athlete), trustedErrors: phase55DashboardErrors }),
    getCoachTrainingReportV1: (input: { target_gym: string; target_athlete: string; assignment_id: string }) => post<TrainingReportV1>('/api/coach-training-report-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is TrainingReportV1 => p36Report(value, input.assignment_id), trustedErrors: phase55DashboardErrors }),
    completeCoachAssignmentCycleV1: (input: { target_gym: string; target_athlete: string; assignment_id: string }) => post<CompleteCoachAssignmentCycleV1>('/api/complete-coach-assignment-cycle-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is CompleteCoachAssignmentCycleV1 => cycleClosure(value, input.assignment_id), trustedErrors: cycleClosureErrors }),
    previewProgramPercentV1: (input: { program: string; expected_builder_version: number }) => post<ProgramPercentPreviewV1>('/api/preview-coach-program-percent-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ProgramPercentPreviewV1 => p36PercentPreview(value, input), trustedErrors: phase55DashboardErrors }),
    applyProgramPercentV1: (input: { program: string; expected_builder_version: number; preview_fingerprint: string }) => post<ProgramPercentApplyV1>('/api/apply-coach-program-percent-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramPercentApplyV1 => p36PercentApply(value, input), trustedErrors: phase55DashboardErrors }),
    getCoachAssignmentDayV7: (input: { assignment: string; day_identity_token: string; expected_detail_read_token: string }) => post<CoachAssignmentDayV7>('/api/coach-assignment-day-v7', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is CoachAssignmentDayV7 => p36AssignmentDay(value, input), trustedErrors: phase4DayErrors }),
    saveCoachProgramDayV5: (input: { program: string; assignment: string; expected_builder_version: number; week_identity_token: string; day: RichProgramDaySaveV2 }) => post<SaveCoachProgramDayV5Result>('/api/save-program-day-v5', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is SaveCoachProgramDayV5Result => p36ProgramSave(value, input), trustedErrors: phase5DaySaveErrors }),
    getCoachWorkoutTemplateDayV3: (input: { template: string; expected_read_token: string | null }) => post<WorkoutTemplateDayV3>('/api/coach-workout-template-day-v3', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is WorkoutTemplateDayV3 => p36WorkoutTemplateDay(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    saveCoachWorkoutTemplateDayV3: (input: { template: string; expected_builder_version: number; day: RichTemplateDaySaveV2 }) => post<WorkoutTemplateSaveDayV3Result>('/api/save-coach-workout-template-day-v3', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is WorkoutTemplateSaveDayV3Result => p36TemplateSave(value, input, false), trustedErrors: phase55WorkoutTemplateErrors }),
    getCoachProgramTemplateDayV3: (input: { template: string; day_id: string }) => post<ProgramTemplateDayV3>('/api/coach-program-template-day-v3', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ProgramTemplateDayV3 => p36ProgramTemplateDay(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    saveCoachProgramTemplateDayV3: (input: { template: string; day_id: string; expected_builder_version: number; day: RichTemplateDaySaveV2 }) => post<ProgramTemplateSaveDayV3Result>('/api/save-coach-program-template-day-v3', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ProgramTemplateSaveDayV3Result => p36TemplateSave(value, input, true), trustedErrors: phase9ProgramTemplateErrors }),
    moveCoachProgramDayV1: (input: MoveCoachProgramDayV1Input) => post<CompactProgrammingOperationV1>('/api/move-coach-program-day-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => compactOperation(value, input, input.program, 'move_day'), trustedErrors: compactProgrammingErrors }),
    moveCoachProgramTemplateDayV1: (input: MoveCoachProgramTemplateDayV1Input) => post<CompactProgrammingOperationV1>('/api/move-coach-program-template-day-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => compactOperation(value, input, input.template, 'move_day'), trustedErrors: compactProgrammingErrors }),
    copyCoachProgramTemplateV3: (input: CopyCoachProgramTemplateV3Input) => post<CompactProgrammingOperationV1>('/api/copy-coach-program-template-v3', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => compactOperation(value, input, input.template, input.copy_kind === 'day' ? 'copy_day' : 'copy_week'), trustedErrors: compactProgrammingErrors }),
    undoCompactProgrammingOperationV1: (input: UndoCompactProgrammingOperationV1Input) => post<CompactProgrammingOperationV1>('/api/undo-compact-programming-operation-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => compactOperation(value, input, input.root_id, 'undo'), trustedErrors: compactProgrammingErrors }),
    setCoachProgramExerciseTrackingV1: (input: SetCoachProgramExerciseTrackingV1Input) => post<CompactProgrammingOperationV1>('/api/set-coach-program-exercise-tracking-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => compactOperation(value, input, input.program, 'tracking'), trustedErrors: compactProgrammingErrors }),
    setCoachProgramTemplateExerciseTrackingV1: (input: SetCoachProgramTemplateExerciseTrackingV1Input) => post<CompactProgrammingOperationV1>('/api/set-coach-program-template-exercise-tracking-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => compactOperation(value, input, input.template, 'tracking'), trustedErrors: compactProgrammingErrors }),
    appendCoachProgramWeekV1: (input: AppendCoachProgramWeekV1Input) => post<CompactProgrammingOperationV1>('/api/append-coach-program-week-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: value => compactOperation(value, input, input.program, 'append_week'), trustedErrors: compactProgrammingErrors }),
    createProgramSkeleton: (input) => post('/api/create-program-skeleton', input),
    createCalendarProgram: (input) => post<CreateProgramSkeletonResult[]>('/api/create-calendar-program-v1', input),
    createCalendarProgramV2: (input: CreateCalendarProgramInput) => post<CreateCalendarProgramV2Result[]>('/api/create-calendar-program-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is CreateCalendarProgramV2Result[] => phase55CalendarCreate(value, input), trustedErrors: phase55AssignmentErrors }),
    publishProgram: (input) => post('/api/publish-program', input),
    getCoachWorkspace: (input) => post('/api/coach-workspace-v2', input),
    saveCoachProgramDay: (input) => post('/api/save-program-day', input),
    getCoachWorkspaceV3: (input) => post('/api/coach-workspace-v3', input),
    saveCoachProgramDayV2: (input) => post('/api/save-program-day-v2', input),
    getCoachNavigationGymsV4: (input) => post<CoachNavigationGymsPageV4>('/api/coach-navigation-gyms-v4', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: phase4NavigationGymsPage, trustedErrors: phase4NavigationErrors }),
    getCoachNavigationRosterV4: (input) => post<CoachNavigationRosterPageV4>('/api/coach-navigation-roster-v4', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: (value): value is CoachNavigationRosterPageV4 => phase4NavigationRosterPage(value, input.gym), trustedErrors: phase4NavigationErrors }),
    getCoachNavigationAssignmentsV4: (input) => post<CoachNavigationAssignmentsPageV4>('/api/coach-navigation-assignments-v4', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: (value): value is CoachNavigationAssignmentsPageV4 => phase4NavigationAssignmentsPage(value, input.gym, input.athlete), trustedErrors: phase4NavigationErrors }),
    getCoachDashboardRosterPageV1: (input) => { const normalized = { ...input, search_text: normalizeDashboardSearch(input.search_text) }; return post<CoachDashboardRosterPageV1>('/api/coach-dashboard-roster-page-v1', normalized, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: (value): value is CoachDashboardRosterPageV1 => phase55RosterPage(value, normalized), trustedErrors: phase55DashboardErrors }) },
    getCoachDashboardRosterPageV2: (input) => { const normalized = { ...input, search_text: normalizeDashboardSearch(input.search_text) }; return post<CoachDashboardRosterPageV2>('/api/coach-dashboard-roster-page-v3', normalized, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: (value): value is CoachDashboardRosterPageV2 => phase7RosterPage(value, normalized), trustedErrors: phase55DashboardErrors }) },
    getCoachDashboardAssignmentsPageV1: (input) => post<CoachDashboardAssignmentsPageV1>('/api/coach-dashboard-assignments-page-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: (value): value is CoachDashboardAssignmentsPageV1 => phase55AssignmentsPage(value, input), trustedErrors: phase55DashboardErrors }),
    getCoachDashboardAssignmentsPageV2: (input) => post<CoachDashboardAssignmentsPageV2>('/api/coach-dashboard-assignments-page-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: (value): value is CoachDashboardAssignmentsPageV2 => phase6AssignmentsPage(value, input), trustedErrors: phase55DashboardErrors }),
    getCoachRecentActivityPageV1: (input) => post<CoachRecentActivityPageV1>('/api/coach-recent-activity-page-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is CoachRecentActivityPageV1 => phase9ActivityPage(value, input), trustedErrors: phase55DashboardErrors }),
    getCoachWorkoutActivityDetailV1: (input) => post<CoachWorkoutActivityDetailV1>('/api/coach-workout-activity-detail-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, decode: (value): value is CoachWorkoutActivityDetailV1 => phase9ActivityDetail(value, input), trustedErrors: phase55DashboardErrors }),
    archiveCoachProgramV1: (input) => post<CoachProgramArchiveV1Result>('/api/archive-coach-program-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is CoachProgramArchiveV1Result => phase6ProgramArchive(value, input, false), trustedErrors: phase6ProgramArchiveErrors }),
    restoreCoachProgramV1: (input) => post<CoachProgramArchiveV1Result>('/api/restore-coach-program-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is CoachProgramArchiveV1Result => phase6ProgramArchive(value, input, true), trustedErrors: phase6ProgramArchiveErrors }),
    activateAndPublishCoachAssignmentV1: (input: ActivateAndPublishCoachAssignmentV1Input) => post<ActivateAndPublishCoachAssignmentV1Result>('/api/activate-and-publish-coach-assignment-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ActivateAndPublishCoachAssignmentV1Result => phase55ActivateAssignment(value, input), trustedErrors: phase55AssignmentErrors }),
    getCoachWorkoutTemplateLibraryPageV1: (input) => { const normalized = { ...input, search_text: normalizeDashboardSearch(input.search_text) }; return post<WorkoutTemplateLibraryPageV1>('/api/coach-workout-template-library-page-v1', normalized, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: (value): value is WorkoutTemplateLibraryPageV1 => workoutTemplateLibraryPage(value, normalized), trustedErrors: phase55WorkoutTemplateErrors }) },
    getCoachWorkoutTemplateLibraryPageV2: (input) => { const normalized = { ...input, search_text: normalizeDashboardSearch(input.search_text) }; return post<WorkoutTemplateLibraryPageV2>('/api/coach-workout-template-library-page-v2', normalized, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: (value): value is WorkoutTemplateLibraryPageV2 => workoutTemplateLibraryPageV2(value, normalized), trustedErrors: phase55WorkoutTemplateErrors }) },
    createCoachWorkoutTemplateV1: (input) => post<WorkoutTemplateCreateV1Result>('/api/create-coach-workout-template-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is WorkoutTemplateCreateV1Result => workoutTemplateCreate(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    getCoachWorkoutTemplateDetailV1: (input) => post<WorkoutTemplateDetailV1>('/api/coach-workout-template-detail-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is WorkoutTemplateDetailV1 => workoutTemplateDetail(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    getCoachWorkoutTemplateDetailV2: (input) => post<WorkoutTemplateDetailV2>('/api/coach-workout-template-detail-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is WorkoutTemplateDetailV2 => workoutTemplateDetailV2(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    getCoachWorkoutTemplateDayV1: (input) => post<WorkoutTemplateDayV1>('/api/coach-workout-template-day-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is WorkoutTemplateDayV1 => workoutTemplateDay(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    saveCoachWorkoutTemplateDayV1: (input) => post<WorkoutTemplateSaveDayV1Result>('/api/save-coach-workout-template-day-v1', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is WorkoutTemplateSaveDayV1Result => workoutTemplateSave(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    getCoachWorkoutTemplateDayV2: (input) => post<WorkoutTemplateDayV2>('/api/coach-workout-template-day-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is WorkoutTemplateDayV2 => richTemplateDay(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    saveCoachWorkoutTemplateDayV2: (input) => post<WorkoutTemplateSaveDayV2Result>('/api/save-coach-workout-template-day-v2', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is WorkoutTemplateSaveDayV2Result => richTemplateSaveResult(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    setCoachWorkoutTemplateReadinessV1: (input) => post<WorkoutTemplateReadinessV1Result>('/api/set-coach-workout-template-readiness-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is WorkoutTemplateReadinessV1Result => workoutTemplateReadiness(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    setCoachWorkoutTemplateReadinessV2: (input) => post<WorkoutTemplateReadinessV2Result>('/api/set-coach-workout-template-readiness-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is WorkoutTemplateReadinessV2Result => workoutTemplateReadinessV2(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    archiveCoachWorkoutTemplateV1: (input) => post<WorkoutTemplateArchiveV1Result>('/api/archive-coach-workout-template-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is WorkoutTemplateArchiveV1Result => workoutTemplateArchive(value, input, false), trustedErrors: phase55WorkoutTemplateErrors }),
    restoreCoachWorkoutTemplateV1: (input) => post<WorkoutTemplateArchiveV1Result>('/api/restore-coach-workout-template-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is WorkoutTemplateArchiveV1Result => workoutTemplateArchive(value, input, true), trustedErrors: phase55WorkoutTemplateErrors }),
    applyCoachWorkoutTemplateV1: (input) => post<ApplyWorkoutTemplateV1Result>('/api/apply-coach-workout-template-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ApplyWorkoutTemplateV1Result => workoutTemplateApply(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    applyCoachWorkoutTemplateV2: (input) => post<ApplyWorkoutTemplateV2Result>('/api/apply-coach-workout-template-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ApplyWorkoutTemplateV2Result => workoutTemplateApplyV2(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    applyCoachWorkoutTemplateV3: (input) => post<ApplyWorkoutTemplateV3Result>('/api/apply-coach-workout-template-v3', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ApplyWorkoutTemplateV3Result => workoutTemplateApplyV3(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    previewCoachTemplatePercentV1: (input) => post<TemplatePercentPreviewV1>('/api/preview-coach-template-percent-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is TemplatePercentPreviewV1 => p36TemplatePercentPreview(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    applyCoachWorkoutTemplateV4: (input) => post<ApplyWorkoutTemplateV4Result>('/api/apply-coach-workout-template-v4', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ApplyWorkoutTemplateV4Result => workoutTemplateApplyV4(value, input), trustedErrors: phase55WorkoutTemplateErrors }),
    getCoachProgramTemplateLibraryV1: (input) => post<ProgramTemplateLibraryV1>('/api/coach-program-template-library-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4NavigationMaxBytes, decode: programTemplateLibrary, trustedErrors: phase9ProgramTemplateErrors }),
    createCoachProgramTemplateV1: (input) => post<ProgramTemplateCreateV1>('/api/create-coach-program-template-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateCreateV1 => programTemplateCreate(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    getCoachProgramTemplateDetailV1: (input) => post<ProgramTemplateDetailV1>('/api/coach-program-template-detail-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, decode: (value): value is ProgramTemplateDetailV1 => programTemplateDetail(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    getCoachProgramTemplateDayV1: (input) => post<ProgramTemplateDayV1>('/api/coach-program-template-day-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ProgramTemplateDayV1 => programTemplateDay(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    getCoachProgramTemplateDayV2: (input) => post<ProgramTemplateDayV2>('/api/coach-program-template-day-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ProgramTemplateDayV2 => richProgramTemplateDay(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    saveCoachProgramTemplateDayV1: (input) => post<ProgramTemplateSaveDayV1>('/api/save-coach-program-template-day-v1', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ProgramTemplateSaveDayV1 => programTemplateSave(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    saveCoachProgramTemplateDayV2: (input) => post<ProgramTemplateSaveDayV2Result>('/api/save-coach-program-template-day-v2', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is ProgramTemplateSaveDayV2Result => richProgramTemplateSaveResult(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    appendCoachProgramTemplateWeekV1: (input) => post<ProgramTemplateAppendWeekV1>('/api/append-coach-program-template-week-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateAppendWeekV1 => programTemplateAppend(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    copyCoachProgramTemplateWeekV1: (input) => post<ProgramTemplateCopyWeekV1>('/api/copy-coach-program-template-week-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateCopyWeekV1 => programTemplateCopyWeek(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    copyCoachProgramTemplateWeekV2: (input) => post<ProgramTemplateCopyWeekV2>('/api/copy-coach-program-template-week-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateCopyWeekV2 => programTemplateCopyWeekV2(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    saveCoachProgramAsTemplateV1: (input) => post<ProgramTemplateSnapshotV1>('/api/save-coach-program-as-template-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateSnapshotV1 => programTemplateSnapshot(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    saveCoachProgramAsTemplateV2: (input) => post<ProgramTemplateSnapshotV2>('/api/save-coach-program-as-template-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateSnapshotV2 => programTemplateSnapshotV2(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    applyCoachProgramTemplateV1: (input) => post<ProgramTemplateApplyV1>('/api/apply-coach-program-template-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateApplyV1 => programTemplateApply(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    applyCoachProgramTemplateV2: (input) => post<ProgramTemplateApplyV2>('/api/apply-coach-program-template-v2', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateApplyV2 => programTemplateApplyV2(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    setCoachProgramTemplateArchivedV1: (input) => post<ProgramTemplateArchiveV1>('/api/set-coach-program-template-archived-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ProgramTemplateArchiveV1 => programTemplateArchive(value, input), trustedErrors: phase9ProgramTemplateErrors }),
    getCoachAssignmentDetailV4: (input) => post<CoachAssignmentDetailV4>('/api/coach-assignment-detail-v4', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, decode: (value): value is CoachAssignmentDetailV4 => phase4Detail(value, input.assignment), trustedErrors: phase4DetailErrors }),
    getCoachAssignmentDayV4: (input) => post<CoachAssignmentDayV4>('/api/coach-assignment-day-v4', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is CoachAssignmentDayV4 => phase4Day(value, input), trustedErrors: phase4DayErrors }),
    getCoachAssignmentDetailV5: (input) => post<CoachAssignmentDetailV5>('/api/coach-assignment-detail-v5', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DetailMaxBytes, decode: (value): value is CoachAssignmentDetailV5 => phase5Detail(value, input.assignment), trustedErrors: phase4DetailErrors }),
    getCoachAssignmentDayV5: (input) => post<CoachAssignmentDayV5>('/api/coach-assignment-day-v5', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is CoachAssignmentDayV5 => phase5Day(value, input), trustedErrors: phase4DayErrors }),
    saveCoachProgramDayV3: (input) => post<SaveCoachProgramDayV3Result>('/api/save-program-day-v3', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is SaveCoachProgramDayV3Result => phase5SaveResult(value, input), trustedErrors: phase5DaySaveErrors }),
    getCoachAssignmentDayV6: (input) => post<CoachAssignmentDayV6>('/api/coach-assignment-day-v6', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is CoachAssignmentDayV6 => richAssignmentDay(value, input), trustedErrors: phase4DayErrors }),
    saveCoachProgramDayV4: (input) => post<SaveCoachProgramDayV4Result>('/api/save-program-day-v4', input, { requestMaximum: phase5DaySaveMaxBytes, resultMaximum: phase4DayMaxBytes, decode: (value): value is SaveCoachProgramDayV4Result => richSaveResult(value, input), trustedErrors: phase5DaySaveErrors }),
    setCoachProgramReadinessV1: (input) => post<SetCoachProgramReadinessV1Result>('/api/set-program-readiness-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is SetCoachProgramReadinessV1Result => phase4Readiness(value, input), trustedErrors: phase4ReadinessErrors }),
    previewBuilderCopyV1: async (input) => {
      if (!phase5DayCopyInputIsSingleDestination(input)) throw new CoachApiError('invalid_builder_operation', 422)
      return post<PreviewBuilderCopyV1Result>('/api/preview-builder-copy-v1', input, { requestMaximum: phase4BuilderRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is PreviewBuilderCopyV1Result => phase4PreviewCopy(value, input), trustedErrors: phase4CopyPreviewErrors })
    },
    applyBuilderCopyV1: async (input) => {
      if (!phase5DayCopyInputIsSingleDestination(input)) throw new CoachApiError('invalid_builder_operation', 422)
      return post<ApplyBuilderCopyV1Result>('/api/apply-builder-copy-v1', input, { requestMaximum: phase4BuilderRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is ApplyBuilderCopyV1Result => phase4ApplyCopy(value, input), trustedErrors: phase4CopyApplyErrors })
    },
    previewBuilderCopyV2: (input) => post<PreviewBuilderCopyV2Result>('/api/preview-builder-copy-v2', input, { requestMaximum: phase4BuilderRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is PreviewBuilderCopyV2Result => phase5PreviewCopy(value, input), trustedErrors: phase4CopyPreviewErrors }),
    applyBuilderCopyV2: (input) => post<ApplyBuilderCopyV2Result>('/api/apply-builder-copy-v2', input, { requestMaximum: phase4BuilderRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is ApplyBuilderCopyV2Result => phase5ApplyCopy(value, input), trustedErrors: phase4CopyApplyErrors }),
    previewBuilderProgressionV1: (input) => post<PreviewBuilderProgressionV1Result>('/api/preview-builder-progression-v1', input, { requestMaximum: phase4BuilderRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is PreviewBuilderProgressionV1Result => phase4PreviewProgression(value, input), trustedErrors: phase4ProgressionPreviewErrors }),
    applyBuilderProgressionV1: (input) => post<ApplyBuilderProgressionV1Result>('/api/apply-builder-progression-v1', input, { requestMaximum: phase4BuilderRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is ApplyBuilderProgressionV1Result => phase4ApplyProgression(value, input), trustedErrors: phase4ProgressionApplyErrors }),
    previewBuilderProgressionV2: (input) => post<PreviewBuilderProgressionV2Result>('/api/preview-builder-progression-v2', input, { requestMaximum: phase5ProgressionRequestMaxBytes, resultMaximum: phase5ProgressionPreviewMaxBytes, decode: (value): value is PreviewBuilderProgressionV2Result => phase5PreviewProgressionV2(value, input), trustedErrors: phase5ProgressionPreviewErrors }),
    applyBuilderProgressionV2: (input) => post<ApplyBuilderProgressionV2Result>('/api/apply-builder-progression-v2', input, { requestMaximum: phase5ProgressionRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is ApplyBuilderProgressionV2Result => phase5ApplyProgressionV2(value, input), trustedErrors: phase5ProgressionApplyErrors }),
    undoBuilderOperationV1: (input) => post<UndoBuilderOperationV1Result>('/api/undo-builder-operation-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is UndoBuilderOperationV1Result => phase4UndoResult(value, input), trustedErrors: phase4UndoErrors }),
    publishReadyProgramV1: (input) => post<PublishReadyProgramV1Result>('/api/publish-ready-program-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is PublishReadyProgramV1Result => phase4PublishResult(value, input), trustedErrors: phase4PublishErrors }),
    publishCoachScopeV1: (input) => post<PublishCoachScopeV1Result>('/api/publish-coach-scope-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is PublishCoachScopeV1Result => phase9ScopedPublishResult(value, input), trustedErrors: phase9ScopedPublishErrors }),
    activateAndPublishCoachScopeV1: (input) => post<ActivateAndPublishCoachScopeV1Result>('/api/activate-and-publish-coach-scope-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase4OperationMaxBytes, decode: (value): value is ActivateAndPublishCoachScopeV1Result => phase9ActivateScopedPublishResult(value, input), trustedErrors: phase9ScopedPublishErrors }),
    authorCalendarDayV1: (input) => post<AuthorCalendarDayV1Result>('/api/author-calendar-day-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is AuthorCalendarDayV1Result => phase5AuthorCalendarDayResult(value, input), trustedErrors: phase5AuthorDayErrors }),
    listExerciseNameHistoryV1: (input) => post<ExerciseNameHistoryV1Result>('/api/list-exercise-name-history-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is ExerciseNameHistoryV1Result => phase5ExerciseHistoryResult(value, input), trustedErrors: phase5ExerciseHistoryErrors }),
    recordExerciseNameHistoryV1: (input) => post<RecordExerciseNameHistoryV1Result>('/api/record-exercise-name-history-v1', input, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is RecordExerciseNameHistoryV1Result => phase5RecordExerciseHistoryResult(value, input), trustedErrors: phase5ExerciseHistoryErrors }),
    saveCoachProgramDayV2AndRecordHistory: async (input) => {
      const save = await post<SaveCoachProgramDayV2Result>('/api/save-program-day-v2', input)
      const names = input.day.exercises.flatMap((exercise) => exercise.mode === 'replace' ? [exercise.name] : [])
      if (names.length === 0) return { save, history_recorded: true }
      try {
        await post<RecordExerciseNameHistoryV1Result>('/api/record-exercise-name-history-v1', {
          program: input.program, assignment: input.assignment, names,
        }, { requestMaximum: phase4DefaultRequestMaxBytes, resultMaximum: phase5SmallResultMaxBytes, decode: (value): value is RecordExerciseNameHistoryV1Result => phase5RecordExerciseHistoryResult(value, { program: input.program, assignment: input.assignment, names }), trustedErrors: phase5ExerciseHistoryErrors })
        return { save, history_recorded: true }
      } catch {
        // History is derivative convenience data. Its post-commit failure must
        // never misreport or roll back the already-authoritative day save.
        return { save, history_recorded: false }
      }
    },
  }
}
