// B2 /3 contracts. The server freezes the reviewed successor; no v1 wire changes.
import { exact, uuid, hash, integer, canonical, isCoachExcelBetaAuthorization } from './coach-excel-beta-contract'
import { isCoachExcelBetaPreviewInput, type CoachExcelBetaPreviewInput, type CoachExcelBetaPreviewSummary, type CoachExcelBetaPreviewPage } from './coach-excel-beta-preview-api'
import { isCoachExcelPreviewSummary, isCoachExcelPreviewPage, type CoachExcelPreviewSummary } from './coach-excel-preview-api'

export const COACH_EXCEL_NEXT_CYCLE_PATHS = {
  preview: '/api/coach-excel-beta-preview-v2', publish: '/api/coach-excel-beta-publish-v2',
  status: '/api/coach-excel-beta-publish-status-v2', cancel: '/api/coach-excel-beta-cancel-pending-v2',
  running_state: '/api/coach-cycle-running-state-v1', running_update: '/api/coach-cycle-running-update-v1',
} as const
export const COACH_EXCEL_NEXT_CYCLE_RPCS = {
  preview: 'coach_excel_beta_preview_v2', publish: 'coach_excel_beta_publish_v2',
  status: 'coach_excel_beta_publish_status_v2', cancel: 'coach_excel_beta_cancel_pending_v2',
  running_state: 'coach_cycle_running_state_v1', running_update: 'coach_cycle_running_update_v1',
} as const
export type CoachExcelNextCycleOperation = keyof typeof COACH_EXCEL_NEXT_CYCLE_PATHS
export const COACH_EXCEL_NEXT_CYCLE_REQUEST_MAX_BYTES = 2048
export const COACH_EXCEL_NEXT_CYCLE_RESPONSE_MAX_BYTES = 65536
export const COACH_EXCEL_NEXT_CYCLE_ERROR_MAX_BYTES = 4096
// A full four-week publish runs ~9-10s in hosted SQL (30s function limit).
export const COACH_EXCEL_NEXT_CYCLE_TIMEOUT_MS = 30000
// The browser waits a little longer than the Worker so the Worker answers first.
export const COACH_EXCEL_NEXT_CYCLE_CLIENT_TIMEOUT_MS = COACH_EXCEL_NEXT_CYCLE_TIMEOUT_MS + 5000
export type CoachExcelNextCyclePreviewInput = CoachExcelBetaPreviewInput
export type CoachExcelNextCyclePublishInput = { request_id: string; gym: string; athlete: string; draft: string; expected_revision: number; expected_review_hash: string; expected_gate_epoch: number; expected_queue_version: number }
export type CoachExcelNextCycleStatusInput = { gym: string; athlete: string; request_id: string }
export type CoachExcelNextCycleCancelInput = { gym: string; athlete: string; queue_id: string; expected_queue_version: number }
/** A day of the running program, by 1-based week and ISO weekday (1 = Monday). */
export type CoachCycleRunningDay = [week: number, weekday: number]
export type CoachCycleRunningStateInput = { gym: string; athlete: string; draft: string | null; expected_gate_epoch: number }
export type CoachCycleRunningUpdateInput = { request_id: string; gym: string; athlete: string; draft: string; expected_revision: number; expected_assignment: string; expected_done: CoachCycleRunningDay[]; expected_gate_epoch: number }
export type CoachExcelNextCycleInput = CoachExcelNextCyclePreviewInput | CoachExcelNextCyclePublishInput | CoachExcelNextCycleStatusInput | CoachExcelNextCycleCancelInput | CoachCycleRunningStateInput | CoachCycleRunningUpdateInput
export type CoachCycleRunningDone = { week: number; weekday: number; state: 'in_progress' | 'completed' | 'skipped'; performed_at: string | null; earlier_version: boolean }
export type CoachCycleRunningState = { contract: 'coach-cycle-running-state/1'; linked: false; draft_id: string | null } | {
  contract: 'coach-cycle-running-state/1'; linked: true; draft_id: string; draft_revision: number; published_draft_revision: number
  assignment_id: string; program_id: string; program_name: string; start_on: string
  done: CoachCycleRunningDone[]; opened: { week: number; weekday: number; opened_at: string }[]; checked_at: string
}
export type CoachCycleRunningUpdateResult = {
  contract: 'coach-cycle-running-update/1'; status: 'updated' | 'no_changes'; request_id: string; draft_id: string; draft_revision: number
  assignment_id: string; program_id: string; done_days: CoachCycleRunningDay[]; changed_days: CoachCycleRunningDay[]
  release_id: string | null; revision_id: string | null
}
const runningDay = (v: unknown): v is CoachCycleRunningDay => Array.isArray(v) && v.length === 2 && integer(v[0], 1) && v[0] <= 12 && integer(v[1], 1) && v[1] <= 7
const runningDays = (v: unknown): v is CoachCycleRunningDay[] => Array.isArray(v) && v.length <= 84 && v.every(runningDay)
export type CoachExcelNextCyclePreviewSummary = Omit<CoachExcelBetaPreviewSummary, 'contract' | 'contract_version' | 'active_assignment_policy' | 'fresh_only'> & {
  contract: 'coach-excel-preview/3'; contract_version: 3; active_assignment_policy: 'finish-current/1'; fresh_only: false
  expected_queue_version: number; expected_pending_id: string | null
}
export type CoachExcelNextCyclePreviewPage = Omit<CoachExcelBetaPreviewPage, 'contract' | 'summary'> & { contract: 'coach-excel-preview-page/3'; summary: CoachExcelNextCyclePreviewSummary }
export type CoachExcelNextCyclePublishResult = {
  contract: 'coach-excel-publish/3'; request_id: string; status: 'pending' | 'activated' | 'cancelled'; queue_id: string; queue_version: number
  assignment_id: string; revision_id: string; remaining: number; closed_predecessor: boolean
}
export type CoachExcelNextCycleRemaining = { instance_id: string; label: string; scheduled_on: string | null }
export type CoachExcelNextCycleLastError = { reason: string; terminal: boolean; sqlstate?: string }
export type CoachExcelNextCycleStatus = { contract: 'coach-excel-publish-status/3'; request_id: string } & (
  { status: 'not_found' } | {
    status: 'pending' | 'activated' | 'cancelled'; queue_id: string; queue_version: number; assignment_id: string; revision_id: string
    source_hash: string; content_hash: string; remaining: CoachExcelNextCycleRemaining[]; last_error: CoachExcelNextCycleLastError | null; activated_at: string | null
  })
export type CoachExcelNextCycleCancelResult = { contract: 'coach-excel-cancel/3'; status: 'cancelled'; queue_id: string; queue_version: number }
export function isCoachExcelNextCycleInput(operation: CoachExcelNextCycleOperation, v: unknown): v is CoachExcelNextCycleInput {
  if (operation === 'preview') return isCoachExcelBetaPreviewInput(v)
  if (operation === 'status') return exact(v, ['gym','athlete','request_id']) && [v.gym,v.athlete,v.request_id].every(uuid)
  if (operation === 'running_state') return exact(v, ['gym','athlete','draft','expected_gate_epoch']) && [v.gym,v.athlete].every(uuid) && (v.draft === null || uuid(v.draft)) && integer(v.expected_gate_epoch, 1)
  if (operation === 'running_update') return exact(v, ['request_id','gym','athlete','draft','expected_revision','expected_assignment','expected_done','expected_gate_epoch'])
    && [v.request_id,v.gym,v.athlete,v.draft,v.expected_assignment].every(uuid) && integer(v.expected_revision, 1) && runningDays(v.expected_done) && integer(v.expected_gate_epoch, 1)
  if (operation === 'cancel') return exact(v, ['gym','athlete','queue_id','expected_queue_version']) && [v.gym,v.athlete,v.queue_id].every(uuid) && integer(v.expected_queue_version, 1)
  return operation === 'publish' && exact(v, ['request_id','gym','athlete','draft','expected_revision','expected_review_hash','expected_gate_epoch','expected_queue_version'])
    && [v.request_id,v.gym,v.athlete,v.draft].every(uuid) && integer(v.expected_revision, 1) && hash(v.expected_review_hash)
    && integer(v.expected_gate_epoch, 1) && integer(v.expected_queue_version, 0)
}
function executionSummary(v: CoachExcelNextCyclePreviewSummary): CoachExcelPreviewSummary {
  const { authorization: _authorization, execution_review_hash, active_assignment_policy: _policy, fresh_only: _fresh,
    expected_queue_version: _queue, expected_pending_id: _pending, ...summary } = v
  return { ...summary, contract: 'coach-excel-preview/1', contract_version: 1, review_hash: execution_review_hash, local_only: true, publication_authorized: false, publishable: false }
}
export function isCoachExcelNextCyclePreviewSummary(v: unknown, input: CoachExcelNextCyclePreviewInput): v is CoachExcelNextCyclePreviewSummary {
  if (!isCoachExcelBetaPreviewInput(input) || !v || typeof v !== 'object' || Array.isArray(v)) return false
  const s = v as CoachExcelNextCyclePreviewSummary
  if (s.contract !== 'coach-excel-preview/3' || s.contract_version !== 3 || s.local_only !== false || s.publication_authorized !== true
    || s.active_assignment_policy !== 'finish-current/1' || s.fresh_only !== false || !hash(s.execution_review_hash) || !hash(s.review_hash)
    || input.expected_review_hash !== null && input.expected_review_hash !== s.review_hash
    || !integer(s.expected_queue_version, 0) || (s.expected_queue_version === 0 ? s.expected_pending_id !== null : !uuid(s.expected_pending_id))
    || !isCoachExcelBetaAuthorization(s.authorization, input.expected_gate_epoch)) return false
  const a = s.authorization.authority, base = executionSummary(s)
  return a.subject === s.owner_subject && a.coach === s.coach_id && a.membership === s.athlete_membership_id && a.epoch === s.pairing_epoch
    && isCoachExcelPreviewSummary(base, { ...input, expected_review_hash: s.execution_review_hash })
    && new TextEncoder().encode(JSON.stringify(s)).byteLength < 16384 && s.publishable === (s.totals.exercises > 0)
}
export function isCoachExcelNextCyclePreviewPage(v: unknown, input: CoachExcelNextCyclePreviewInput): v is CoachExcelNextCyclePreviewPage {
  if (!exact(v, ['contract','summary','page_index','items','authorization','local_only','publication_authorized','publishable'])
    || v.contract !== 'coach-excel-preview-page/3' || v.local_only !== false || v.publication_authorized !== true
    || !isCoachExcelNextCyclePreviewSummary(v.summary, input) || v.publishable !== v.summary.publishable
    || canonical(v.authorization) !== canonical(v.summary.authorization)) return false
  return isCoachExcelPreviewPage({ contract: 'coach-excel-preview-page/1', summary: executionSummary(v.summary), page_index: v.page_index, items: v.items, local_only: true, publication_authorized: false }, { ...input, expected_review_hash: v.summary.execution_review_hash })
}
const date = (v: unknown): v is string => typeof v === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
const timestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && date(v.slice(0, 10)) && Number.isFinite(Date.parse(v))
const text = (v: unknown, maximum: number): v is string => typeof v === 'string' && [...v].length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(v) && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v)
function remaining(v: unknown): v is CoachExcelNextCycleRemaining[] {
  return Array.isArray(v) && v.every(r => exact(r, ['instance_id','label','scheduled_on']) && uuid(r.instance_id) && text(r.label, 120) && (r.scheduled_on === null || date(r.scheduled_on)))
    && new Set(v.map(r => r.instance_id)).size === v.length
}
// Private cancellation callers plus the activation handler's fixed vocabulary.
export const COACH_EXCEL_NEXT_CYCLE_REASONS = ['coach_cancelled','replaced','predecessor_replaced_or_closed','another_active_assignment','membership_revoked','pairing_changed','enrollment_revoked_or_replaced','coach_membership_revoked','coach_roster_revoked','materialized_hash_drift','finish_time_missing','activation_retry','activation_failed','athlete_erasure','athlete_disconnected','activation_refused','membership_revoked_or_replaced','draft_deleted'] as const
function lastError(v: unknown): v is CoachExcelNextCycleLastError | null {
  if (v === null) return true
  return (exact(v, ['reason','terminal']) || exact(v, ['reason','terminal','sqlstate']))
    && COACH_EXCEL_NEXT_CYCLE_REASONS.some(r => r === v.reason) && v.terminal === (v.reason !== 'activation_retry')
    && (!Object.hasOwn(v, 'sqlstate') || typeof v.sqlstate === 'string' && /^[0-9A-Z]{5}$/.test(v.sqlstate))
}
export function isCoachExcelNextCyclePublishResult(v: unknown, input: CoachExcelNextCyclePublishInput): v is CoachExcelNextCyclePublishResult {
  return exact(v, ['contract','request_id','status','queue_id','queue_version','assignment_id','revision_id','remaining','closed_predecessor'])
    && v.contract === 'coach-excel-publish/3' && v.request_id === input.request_id && ['pending','activated','cancelled'].includes(String(v.status))
    && [v.queue_id,v.assignment_id,v.revision_id].every(uuid) && integer(v.queue_version, 1) && integer(v.remaining, 0)
    && (v.status === 'pending' || v.remaining === 0) && typeof v.closed_predecessor === 'boolean' && (v.status === 'activated' || v.closed_predecessor === false)
}
export function isCoachExcelNextCycleStatus(v: unknown, input: CoachExcelNextCycleStatusInput): v is CoachExcelNextCycleStatus {
  if (exact(v, ['contract','request_id','status']) && v.status === 'not_found') return v.contract === 'coach-excel-publish-status/3' && v.request_id === input.request_id
  return exact(v, ['contract','request_id','status','queue_id','queue_version','assignment_id','revision_id','source_hash','content_hash','remaining','last_error','activated_at'])
    && v.contract === 'coach-excel-publish-status/3' && v.request_id === input.request_id && ['pending','activated','cancelled'].includes(String(v.status))
    && [v.queue_id,v.assignment_id,v.revision_id].every(uuid) && integer(v.queue_version, 1) && hash(v.source_hash) && hash(v.content_hash)
    && remaining(v.remaining) && (v.status === 'pending' || v.remaining.length === 0) && lastError(v.last_error)
    && (v.status === 'activated' ? timestamp(v.activated_at) && v.last_error === null : v.activated_at === null)
}
export function isCoachExcelNextCycleCancelResult(v: unknown, input: CoachExcelNextCycleCancelInput): v is CoachExcelNextCycleCancelResult {
  return exact(v, ['contract','status','queue_id','queue_version']) && v.contract === 'coach-excel-cancel/3' && v.status === 'cancelled'
    && v.queue_id === input.queue_id && v.queue_version === input.expected_queue_version
}
export function isCoachCycleRunningState(v: unknown, input: CoachCycleRunningStateInput): v is CoachCycleRunningState {
  if (exact(v, ['contract','linked','draft_id']) && v.linked === false) return v.contract === 'coach-cycle-running-state/1' && v.draft_id === input.draft
  if (!exact(v, ['contract','linked','draft_id','draft_revision','published_draft_revision','assignment_id','program_id','program_name','start_on','done','opened','checked_at'])
    || v.contract !== 'coach-cycle-running-state/1' || v.linked !== true || !uuid(v.draft_id) || (input.draft !== null && v.draft_id !== input.draft)
    || !integer(v.draft_revision, 1) || !integer(v.published_draft_revision, 1) || ![v.assignment_id,v.program_id].every(uuid)
    || !text(v.program_name, 200) || !date(v.start_on) || !timestamp(v.checked_at) || !Array.isArray(v.done) || !Array.isArray(v.opened)) return false
  return v.done.every(d => exact(d, ['week','weekday','state','performed_at','earlier_version']) && runningDay([d.week, d.weekday])
      && ['in_progress','completed','skipped'].includes(String(d.state)) && (d.performed_at === null || timestamp(d.performed_at)) && typeof d.earlier_version === 'boolean')
    && v.opened.every(d => exact(d, ['week','weekday','opened_at']) && runningDay([d.week, d.weekday]) && timestamp(d.opened_at))
}
export function isCoachCycleRunningUpdateResult(v: unknown, input: CoachCycleRunningUpdateInput): v is CoachCycleRunningUpdateResult {
  return exact(v, ['contract','status','request_id','draft_id','draft_revision','assignment_id','program_id','done_days','changed_days','release_id','revision_id'])
    && v.contract === 'coach-cycle-running-update/1' && v.request_id === input.request_id && v.draft_id === input.draft
    && v.draft_revision === input.expected_revision && v.assignment_id === input.expected_assignment && uuid(v.program_id)
    && runningDays(v.done_days) && runningDays(v.changed_days)
    && (v.status === 'updated' ? v.changed_days.length > 0 && uuid(v.release_id) && uuid(v.revision_id)
      : v.status === 'no_changes' && v.changed_days.length === 0 && v.release_id === null && v.revision_id === null)
}
export function isCoachExcelNextCycleResult(operation: CoachExcelNextCycleOperation, v: unknown, input: CoachExcelNextCycleInput): boolean {
  if (operation === 'running_state') return isCoachCycleRunningState(v, input as CoachCycleRunningStateInput)
  if (operation === 'running_update') return isCoachCycleRunningUpdateResult(v, input as CoachCycleRunningUpdateInput)
  if (operation === 'preview') return isCoachExcelNextCyclePreviewPage(v, input as CoachExcelNextCyclePreviewInput)
  if (operation === 'publish') return isCoachExcelNextCyclePublishResult(v, input as CoachExcelNextCyclePublishInput)
  if (operation === 'status') return isCoachExcelNextCycleStatus(v, input as CoachExcelNextCycleStatusInput)
  return operation === 'cancel' && isCoachExcelNextCycleCancelResult(v, input as CoachExcelNextCycleCancelInput)
}
// Literal SQL messages reachable through v2 calls and their write-trigger graph.
export const COACH_EXCEL_NEXT_CYCLE_CONFLICTS = [
  'EXCEL_BETA_FRESH_REQUEST_REQUIRED',
  'EXCEL_BETA_HISTORY_INTEGRITY',
  'EXCEL_BETA_PREVIEW_REVIEW_STALE',
  'EXCEL_BETA_PUBLISH_ENVELOPE_CHANGED',
  'EXCEL_BETA_PUBLISH_FINAL_CHANGED',
  'EXCEL_BETA_PUBLISH_NOT_ELIGIBLE',
  'EXCEL_BETA_PUBLISH_REQUEST_REUSED',
  'EXCEL_HISTORY_DELIVERY_INTEGRITY',
  'EXCEL_HISTORY_GRAPH_INTEGRITY',
  'EXCEL_HISTORY_INSTANCE_INTEGRITY',
  'EXCEL_HISTORY_LEDGER_INTEGRITY',
  'EXCEL_HISTORY_MAP_COVERAGE',
  'EXCEL_HISTORY_MAP_JOIN',
  'EXCEL_HISTORY_ORPHAN_LEDGER',
  'EXCEL_HISTORY_RELEASE_INTEGRITY',
  'EXCEL_HISTORY_REVISION_INTEGRITY',
  'EXCEL_HISTORY_ROOT_MISSING',
  'EXCEL_MATERIALIZE_VERSION_STALE',
  'EXCEL_PUBLISH_ACTIVE_ASSIGNMENT_REFUSED',
  'EXCEL_PUBLISH_ALL_SKIP_REFUSED',
  'EXCEL_PUBLISH_CONTEXT_OLD_ASSIGNMENT_CHANGED',
  'EXCEL_PUBLISH_CONTEXT_REVIEW_STALE',
  'EXCEL_PUBLISH_FINAL_FRESH_STATE_CHANGED',
  'EXCEL_PUBLISH_FINAL_SOURCE_CHANGED',
  'EXCEL_PUBLISH_FRESH_REQUEST_REQUIRED',
  'EXCEL_PUBLISH_PREMINT_CHANGED',
  'EXCEL_PUBLISH_REQUEST_REUSED',
  'EXCEL_PUBLISH_REVIEW_STALE',
  'EXCEL_PUBLISH_SCOPE_CHANGED',
  'NEXT_CYCLE_AUTHORITY_CHANGED',
  'NEXT_CYCLE_QUEUE_VERSION_STALE',
  'NEXT_CYCLE_REQUEST_REUSED',
  'NEXT_CYCLE_REVIEW_STALE',
  'RUNNING_UPDATE_AUTHORITY_CHANGED',
  'RUNNING_UPDATE_DONE_CHANGED',
  'RUNNING_UPDATE_DRAFT_STALE',
  'RUNNING_UPDATE_EARLIER_OPEN_DAY_CHANGED',
  'RUNNING_UPDATE_ENGINE_REFUSED',
  'RUNNING_UPDATE_NOT_RUNNING',
  'RUNNING_UPDATE_NO_WORKOUT_TO_DELIVER',
  'RUNNING_UPDATE_REQUEST_REUSED',
  'RUNNING_UPDATE_SCHEDULE_CHANGED',
  'RUNNING_UPDATE_WORKOUT_STARTED',
  'cycle_lifecycle_v2_identity_integrity',
  'excel_paused_assert_compile_changed',
  'excel_paused_assert_day_changed',
  'excel_paused_assert_destination_changed',
  'excel_paused_assert_graph_changed',
  'excel_paused_assert_hash_invalid',
  'excel_paused_assert_source_stale',
  'excel_paused_writer_fresh_request_required',
  'excel_paused_writer_review_stale',
  'excel_paused_writer_source_stale',
  'excel_preview_assignment_integrity',
  'excel_preview_review_stale',
  'excel_preview_revision_stale',
  'excel_preview_source_integrity',
] as const
export const COACH_EXCEL_NEXT_CYCLE_BLOCKS = [
  'EXCEL_CHOICE_DEVICE_UPGRADE_REQUIRED',
  'COACH_CALENDAR_V3_INPUT_INVALID',
  'COACH_DASHBOARD_TRIGGER_SOURCE_INVALID',
  'COACH_NAVIGATION_GENERATION_SCOPE_INVALID',
  'COACH_NAVIGATION_PRINCIPAL_INVALID',
  'COACH_NAVIGATION_TRIGGER_ARGUMENT_INVALID',
  'COACH_NAVIGATION_TRIGGER_SOURCE_INVALID',
  'COACH_RICH_CHOICE_EXTRAS_INVALID',
  'COACH_RICH_DAY_INVALID',
  'COACH_RICH_DAY_TOO_MANY_ROWS',
  'COACH_RICH_DOSE_INVALID',
  'COACH_RICH_EXERCISE_INVALID',
  'COACH_RICH_EXERCISE_ORDER_INVALID',
  'COACH_RICH_EXPANDED_EXERCISE_LIMIT',
  'COACH_RICH_EXPANDED_EXERCISE_ORDER',
  'COACH_RICH_EXPANDED_GROUP_LIMIT',
  'COACH_RICH_EXPANDED_GROUP_ORDER',
  'COACH_RICH_EXPANDED_ID_DUPLICATE',
  'COACH_RICH_EXPANDED_PHYSICAL_SET_LIMIT',
  'COACH_RICH_EXPANDED_SET_ORDER',
  'COACH_RICH_EXPANDED_UNGROUPED_ORDER',
  'COACH_RICH_GROUP_INVALID',
  'COACH_RICH_GROUP_ORDER_INVALID',
  'COACH_RICH_ID_DUPLICATE',
  'COACH_RICH_LOAD_EXTRAS_INVALID',
  'COACH_RICH_LOAD_INVALID',
  'COACH_RICH_SET_COUNT_INVALID',
  'COACH_RICH_SET_INVALID',
  'COACH_RICH_SET_ORDER_INVALID',
  'EXCEL_BETA_HISTORY_INPUT_INVALID',
  'EXCEL_BETA_PREVIEW_CAPACITY',
  'EXCEL_BETA_PREVIEW_INPUT_INVALID',
  'EXCEL_BETA_PUBLISH_INPUT_INVALID',
  'EXCEL_BETA_PUBLISH_RECEIPT_CAPACITY',
  'EXCEL_HISTORY_INPUT_INVALID',
  'EXCEL_MATERIALIZE_INPUT_INVALID',
  'EXCEL_MATERIALIZE_SCHEDULE_INVALID',
  'EXCEL_MATERIALIZE_SOURCE_INCOMPLETE',
  'EXCEL_PUBLISH_FANOUT_INPUT_INVALID',
  'EXCEL_PUBLISH_INPUT_INVALID',
  'NEXT_CYCLE_PREVIEW_CAPACITY',
  'NEXT_CYCLE_PREVIEW_INPUT_INVALID',
  'NEXT_CYCLE_PUBLISH_INPUT_INVALID',
  'NEXT_CYCLE_SCHEDULE_DATE_INVALID',
  'P36_CROSS_UNIT_PERCENT_OVERRIDE',
  'P36_DAY_INVALID',
  'P36_EXERCISE_METADATA_INVALID',
  'P36_EXERCISE_UNAVAILABLE',
  'P36_PERCENT_INPUT_INVALID',
  'P36_TRACKING_INPUT_INVALID',
  'P36_TRACKING_REQUEST_DRIFT',
  'P36_TRACKING_REQUIRES_EXERCISE_ID',
  'P50_PERCENT_BASIS_UNAVAILABLE',
  'PERCENT_MAX_REQUIRED',
  'RUNNING_STATE_INPUT_INVALID',
  'RUNNING_UPDATE_INPUT_INVALID',
  'cycle_authoring_pilot_input_invalid',
  'cycle_draft_source_invalid',
  'cycle_exact_start_schedule_invalid',
  'cycle_preview_item_capacity_exceeded',
  'cycle_preview_projection_contract_invalid',
  'cycle_publish_ambiguous_chain',
  'cycle_publish_ambiguous_or_duplicate_rpe',
  'cycle_publish_capacity_exceeded',
  'cycle_publish_cell_invalid',
  'cycle_publish_destination_limit',
  'cycle_publish_dual_snapshot_mismatch',
  'cycle_publish_duplicate_cell',
  'cycle_publish_duplicate_modifier',
  'cycle_publish_exact_weight_invalid',
  'cycle_publish_exercise_text_invalid',
  'cycle_publish_extra_cell',
  'cycle_publish_formula_or_cell_invalid',
  'cycle_publish_intake_invalid',
  'cycle_publish_measure_range_unsupported',
  'cycle_publish_merge_invalid',
  'cycle_publish_numeric_limit',
  'cycle_publish_percentage_resolution_required',
  'cycle_publish_prescription_invalid',
  'cycle_publish_rpe_invalid',
  'cycle_publish_schedule_invalid',
  'cycle_publish_set_limit',
  'cycle_publish_structure_or_uncovered_cell',
  'cycle_publish_unsupported_modifier',
  'cycle_publish_unsupported_prescription',
  'excel_materialized_assert_input_invalid',
  'excel_paused_assert_input_invalid',
  'excel_paused_writer_input_invalid',
  'excel_preview_input_invalid',
  'excel_preview_page_capacity_exceeded',
  'excel_preview_page_invalid',
  'excel_preview_summary_capacity_exceeded',
] as const
