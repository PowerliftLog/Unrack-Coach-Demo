import { authorizationV2Keys, isCoachCycleAuthorizationV2, sameCoachCycleAuthorizationV2, type CoachCycleAuthorizationV2 } from './coach-cycle-authorization-v2'
// Frozen local v2 review contract. No commit, source body, compiled input or UI authority.
import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { isCoachCycleSqlGroup, type CoachCycleSqlGroup } from './coach-cycle-publish-api'
export const COACH_CYCLE_PREVIEW_V2_PATHS = { preview: '/api/coach-cycle-preview-v2', detail: '/api/coach-cycle-preview-detail-v2' } as const
export type CoachCyclePreviewV2Operation = keyof typeof COACH_CYCLE_PREVIEW_V2_PATHS
export const COACH_CYCLE_PREVIEW_V2_REQUEST_MAX_BYTES = 2048
// Reader caps are inclusive; SQL's wire bounds are strictly less than 16/64 KiB.
export const COACH_CYCLE_PREVIEW_V2_SUMMARY_MAX_BYTES = 16383
export const COACH_CYCLE_PREVIEW_V2_DETAIL_MAX_BYTES = 65535
export const COACH_CYCLE_PREVIEW_V2_ERROR_MAX_BYTES = 4096
export type CoachCyclePreviewV2Input = { gym: string; athlete: string; draft: string; expected_revision: number; expected_admission_version: number }
export type CoachCyclePreviewDetailV2Input = CoachCyclePreviewV2Input & { expected_review_hash: string; page_index: number }
export type CoachCyclePreviewV2Schedule = { week: number; weekday: number; day: string; scheduled_date: string; marked_rest: boolean }
export type CoachCyclePreviewV2Summary = CoachCycleAuthorizationV2 & {
  contract: 'coach-cycle-preview/2'; contract_version: 2; owner_subject: string; coach_id: string; coach_membership_id: string
  gym_id: string; athlete_id: string; athlete_membership_id: string; pairing_epoch: string; admission_id: string; admission_version: number; admission_expires_at: string; admission_hash: string
  draft_id: string; draft_revision: number; source_hash: string; compiler_version: 'coach-cycle-sql/1'; compiled_hash: string; coverage_hash: string; coverage_count: number
  projection_version: 'coach-cycle-detail/2'; projection_hash: string; name: string; unit: 'lb' | 'kg'; start_on: string; end_on: string; week_count: number
  schedule: CoachCyclePreviewV2Schedule[]; totals: { exercises: number; skipped: number; groups: number; sets: number }
  detail_item_count: number; detail_page_count: number; detail_page_item_limit: 4; detail_page_byte_limit: 65536
  expected_current_assignment: string | null; assignment_hash: string; review_hash: string
}
export type CoachCyclePreviewV2Source = { sheet: 'cycle'; row: number; column: number; address: string }
export type CoachCyclePreviewV2Item = {
  item_index: number; week: number; weekday: number; day: string; scheduled_date: string; block_id: string; status: 'skipped' | 'programmed'
  name: string; prescription: string; instruction: string; set_groups: CoachCycleSqlGroup[]
  source: { name: CoachCyclePreviewV2Source; prescription: CoachCyclePreviewV2Source; instruction: CoachCyclePreviewV2Source }
  group_source: { ordinal: number; start: number; end: number; raw: string; source: CoachCyclePreviewV2Source }[]
}
export type CoachCyclePreviewV2Detail = CoachCycleAuthorizationV2 & {
  contract: 'coach-cycle-detail/2'; review_hash: string; projection_hash: string; draft_id: string; draft_revision: number; source_hash: string
  admission_id: string; admission_version: number; page_index: number; page_count: number; item_count: number; total_item_count: number
  items: CoachCyclePreviewV2Item[]; page_hash: string
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000'
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const integer = (v: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= minimum && Number(v) <= maximum
const text = (v: unknown, maximum: number, required = false): v is string => typeof v === 'string' && [...v].length <= maximum && (!required || v.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(v) && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v)
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const date = (v: unknown): v is string => typeof v === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
const after = (day: string, count: number) => new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10)
const address = (row: number, column: number) => `${column < 26 ? String.fromCharCode(65 + column) : `A${String.fromCharCode(65 + column - 26)}`}${row + 1}`
const timestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
export function isCoachCyclePreviewV2Input(operation: CoachCyclePreviewV2Operation, v: unknown): v is CoachCyclePreviewV2Input | CoachCyclePreviewDetailV2Input {
  if (operation !== 'preview' && operation !== 'detail') return false
  return exact(v, ['gym','athlete','draft','expected_revision','expected_admission_version', ...(operation === 'detail' ? ['expected_review_hash','page_index'] : [])])
    && uuid(v.gym) && uuid(v.athlete) && uuid(v.draft) && integer(v.expected_revision, 1) && integer(v.expected_admission_version, 1)
    && (operation === 'preview' || hash(v.expected_review_hash) && integer(v.page_index, 0, 383))
}
const summaryKeys = ['contract','contract_version','owner_subject','coach_id','coach_membership_id','gym_id','athlete_id','athlete_membership_id','pairing_epoch','admission_id','admission_version','admission_expires_at','admission_hash','draft_id','draft_revision','source_hash','compiler_version','compiled_hash','coverage_hash','coverage_count','projection_version','projection_hash','name','unit','start_on','end_on','week_count','schedule','totals','detail_item_count','detail_page_count','detail_page_item_limit','detail_page_byte_limit','expected_current_assignment','assignment_hash','local_only','publication_authorized','review_hash']
export function isCoachCyclePreviewV2Summary(v: unknown, input: CoachCyclePreviewV2Input, ownerSubject?: string): v is CoachCyclePreviewV2Summary {
  if (!exact(v, [...summaryKeys, ...authorizationV2Keys(v)]) || v.contract !== 'coach-cycle-preview/2' || v.contract_version !== 2 || v.compiler_version !== 'coach-cycle-sql/1' || v.projection_version !== 'coach-cycle-detail/2'
    || v.gym_id !== input.gym || v.athlete_id !== input.athlete || v.draft_id !== input.draft || v.draft_revision !== input.expected_revision || v.admission_version !== input.expected_admission_version
    || ![v.gym_id,v.athlete_id,v.draft_id].every(uuid) || !integer(v.draft_revision, 1) || !integer(v.admission_version, 1)
    || ![v.owner_subject,v.coach_id,v.coach_membership_id,v.athlete_membership_id,v.admission_id].every(uuid) || ownerSubject !== undefined && v.owner_subject !== ownerSubject
    || !uuid(v.pairing_epoch) || !timestamp(v.admission_expires_at) || ![v.source_hash,v.compiled_hash,v.coverage_hash,v.projection_hash,v.admission_hash,v.assignment_hash,v.review_hash].every(hash)
    || !integer(v.coverage_count, 1, 5338) || !text(v.name, 120, true) || !['lb','kg'].includes(String(v.unit)) || !date(v.start_on) || new Date(`${v.start_on}T00:00:00Z`).getUTCDay() !== 1
    || !integer(v.week_count, 1, 12) || v.end_on !== after(v.start_on, v.week_count * 7 - 1) || !Array.isArray(v.schedule) || !integer(v.schedule.length, 1, 32)
    || v.schedule.length % v.week_count !== 0 || !exact(v.totals, ['exercises','skipped','groups','sets']) || !integer(v.totals.exercises, 0, 192) || !integer(v.totals.skipped, 0, 384)
    || !integer(v.totals.groups, v.totals.exercises, 768) || !integer(v.totals.sets, v.totals.groups, 768) || (v.totals.exercises === 0 && (v.totals.groups !== 0 || v.totals.sets !== 0))
    || v.detail_item_count !== v.totals.exercises + v.totals.skipped || !integer(v.detail_item_count, 1, 384) || !integer(v.detail_page_count, Math.ceil(v.detail_item_count / 4), v.detail_item_count)
    || v.detail_page_item_limit !== 4 || v.detail_page_byte_limit !== 65536 || v.expected_current_assignment !== null && !uuid(v.expected_current_assignment)
    || !isCoachCycleAuthorizationV2(v)) return false
  const daysPerWeek = v.schedule.length / v.week_count, firstDays: number[] = []
  if (!integer(daysPerWeek, 1, 7)) return false
  for (let i = 0; i < v.schedule.length; i++) {
    const s = v.schedule[i], week = Math.floor(i / daysPerWeek) + 1, dayIndex = i % daysPerWeek
    if (!exact(s, ['week','weekday','day','scheduled_date','marked_rest']) || s.week !== week || !integer(s.weekday, 1, 7) || s.day !== weekdays[s.weekday-1]
      || s.scheduled_date !== after(v.start_on, (week-1)*7 + s.weekday-1) || typeof s.marked_rest !== 'boolean') return false
    if (week === 1) { if (dayIndex && s.weekday <= firstDays[dayIndex-1]) return false; firstDays.push(s.weekday) }
    else if (s.weekday !== firstDays[dayIndex]) return false
  }
  return v.detail_item_count <= v.schedule.length * 12 && v.totals.exercises <= v.schedule.filter(s => !s.marked_rest).length * 12
}
function source(v: unknown): v is CoachCyclePreviewV2Source {
  return exact(v, ['sheet','row','column','address']) && v.sheet === 'cycle' && integer(v.row, 0, 156) && integer(v.column, 0, 33) && v.address === address(v.row, v.column)
}
function item(v: unknown, total: number, summary?: CoachCyclePreviewV2Summary): v is CoachCyclePreviewV2Item {
  if (!exact(v, ['item_index','week','weekday','day','scheduled_date','block_id','status','name','prescription','instruction','set_groups','source','group_source'])
    || !integer(v.item_index, 0, total-1) || !integer(v.week, 1, summary?.week_count ?? 12) || !integer(v.weekday, 1, 7) || v.day !== weekdays[v.weekday-1] || !date(v.scheduled_date)
    || new Date(`${v.scheduled_date}T00:00:00Z`).getUTCDay() !== v.weekday % 7 || !uuid(v.block_id) || !['programmed','skipped'].includes(String(v.status)) || !text(v.name, 120, true) || !text(v.prescription, 1000, true) || !text(v.instruction, 500)
    || !Array.isArray(v.set_groups) || v.set_groups.length > 20 || !v.set_groups.every((g, i) => isCoachCycleSqlGroup(g, i+1))
    || !exact(v.source, ['name','prescription','instruction']) || ![v.source.name,v.source.prescription,v.source.instruction].every(source)
    || !Array.isArray(v.group_source) || v.group_source.length !== v.set_groups.length) return false
  // A week that switches exercise names its own row (its run's first week), so
  // the name row is at or above the prescription row within the slot.
  const links = v.source as CoachCyclePreviewV2Item['source']
  if (links.name.column % 5 !== 1 || links.prescription.column !== links.name.column+1 || links.instruction.column !== links.name.column+2
    || links.name.row < 2 || links.prescription.row - (v.week - 1) < 2 || links.name.row > links.prescription.row || links.name.row < links.prescription.row - (v.week - 1) || links.instruction.row !== links.prescription.row) return false
  if (v.status === 'skipped' ? v.set_groups.length !== 0 || v.prescription.trim().toUpperCase() !== 'SKIP' : v.set_groups.length === 0 || v.set_groups.reduce((n, g) => n + g.sets_min, 0) > 20) return false
  const raw = [...v.prescription]; let end = 0
  for (let i = 0; i < v.group_source.length; i++) {
    const trace = v.group_source[i]
    if (!exact(trace, ['ordinal','start','end','raw','source']) || trace.ordinal !== i+1 || !integer(trace.start, end, raw.length-1) || !integer(trace.end, trace.start+1, raw.length)
      || trace.raw !== raw.slice(trace.start, trace.end).join('') || !source(trace.source) || trace.source.row !== links.prescription.row || trace.source.column !== links.prescription.column) return false
    end = trace.end
  }
  if (summary) {
    const scheduled = summary.schedule.find(s => s.week === v.week && s.weekday === v.weekday)
    const dayIndex = summary.schedule.filter(s => s.week === 1).findIndex(s => s.weekday === v.weekday)
    if (!scheduled || scheduled.scheduled_date !== v.scheduled_date || links.name.column !== dayIndex * 5 + 1 || v.status === 'programmed' && scheduled.marked_rest) return false
  }
  return true
}
export function isCoachCyclePreviewV2Detail(v: unknown, input: CoachCyclePreviewDetailV2Input, summary?: CoachCyclePreviewV2Summary): v is CoachCyclePreviewV2Detail {
  if (!exact(v, ['contract','review_hash','projection_hash','draft_id','draft_revision','source_hash','admission_id','admission_version','page_index','page_count','item_count','total_item_count','items','local_only','publication_authorized','page_hash', ...authorizationV2Keys(v)])
    || v.contract !== 'coach-cycle-detail/2' || v.review_hash !== input.expected_review_hash || ![v.review_hash,v.projection_hash,v.source_hash,v.page_hash].every(hash)
    || v.draft_id !== input.draft || !uuid(v.draft_id) || v.draft_revision !== input.expected_revision || !integer(v.draft_revision, 1) || v.admission_version !== input.expected_admission_version || !integer(v.admission_version, 1) || !uuid(v.admission_id)
    || v.page_index !== input.page_index || !integer(v.page_count, 1, 384) || !integer(v.page_index, 0, v.page_count-1) || !integer(v.item_count, 1, 4) || !integer(v.total_item_count, 1, 384)
    || v.page_count > v.total_item_count || v.page_count < Math.ceil(v.total_item_count/4) || !Array.isArray(v.items) || v.items.length !== v.item_count || !isCoachCycleAuthorizationV2(v)) return false
  if (summary && (!isCoachCyclePreviewV2Summary(summary, input) || summary.review_hash !== input.expected_review_hash || summary.projection_hash !== v.projection_hash
    || !sameCoachCycleAuthorizationV2(summary, v as CoachCyclePreviewV2Detail) || summary.source_hash !== v.source_hash || summary.admission_id !== v.admission_id || summary.detail_page_count !== v.page_count || summary.detail_item_count !== v.total_item_count)) return false
  for (let i = 0; i < v.items.length; i++) {
    const current = v.items[i]
    if (!item(current, v.total_item_count, summary) || i > 0 && current.item_index !== v.items[i-1].item_index+1) return false
  }
  const first = v.items[0].item_index, last = v.items[v.items.length-1].item_index
  if (first < v.page_index || first > v.page_index * 4 || v.total_item_count - last - 1 < v.page_count - v.page_index - 1 || v.total_item_count - last - 1 > (v.page_count - v.page_index - 1) * 4) return false
  return (v.page_index !== 0 || v.items[0].item_index === 0) && (v.page_index !== v.page_count-1 || v.items[v.items.length-1].item_index === v.total_item_count-1)
}
export const COACH_CYCLE_PREVIEW_V2_CONFLICTS = ['cycle_preview_review_stale','cycle_pilot_draft_stale','cycle_pilot_version_stale','cycle_publish_revision_stale','cycle_publish_source_integrity'] as const
export const COACH_CYCLE_PREVIEW_V2_BLOCKS = ['cycle_preview_input_invalid','cycle_preview_page_invalid','cycle_preview_item_capacity_exceeded','cycle_preview_summary_capacity_exceeded','cycle_preview_page_capacity_exceeded',
  'cycle_publish_capacity_exceeded','cycle_publish_prescription_invalid','cycle_publish_percentage_resolution_required','cycle_publish_unsupported_prescription','cycle_publish_numeric_limit','cycle_publish_measure_range_unsupported','cycle_publish_unsupported_modifier','cycle_publish_duplicate_modifier','cycle_publish_ambiguous_or_duplicate_rpe','cycle_publish_rpe_invalid','cycle_publish_exact_weight_invalid','cycle_publish_ambiguous_chain','cycle_publish_set_limit','cycle_publish_destination_limit','cycle_publish_intake_invalid','cycle_publish_schedule_invalid','cycle_publish_extra_cell','cycle_publish_cell_invalid','cycle_publish_duplicate_cell','cycle_publish_formula_or_cell_invalid','cycle_publish_dual_snapshot_mismatch','cycle_publish_structure_or_uncovered_cell','cycle_publish_merge_invalid','cycle_publish_exercise_text_invalid','cycle_publish_input_invalid'] as const
export type CoachCyclePreviewV2ErrorCode = 'blocked' | 'conflict' | 'retryable' | 'session_expired' | 'access_denied' | 'not_found' | 'unavailable' | 'network' | 'invalid'
export class CoachCyclePreviewV2Error extends Error {
  constructor(readonly code: CoachCyclePreviewV2ErrorCode, readonly reason?: string) {
    super({ blocked: 'This saved cycle cannot be reviewed. Check its prescriptions and size.', conflict: 'The saved cycle, pilot admission or assignment changed. Preview again.', retryable: 'A concurrent change interrupted review. Try again.', session_expired: 'Sign in again before reviewing this cycle.', access_denied: 'You no longer have access to this cycle pilot.', not_found: 'This cycle preview is unavailable.', unavailable: 'Cycle preview is unavailable.', network: 'The cycle review request could not be completed.', invalid: 'Check the cycle preview request.' }[code]); this.name = 'CoachCyclePreviewV2Error'
  }
}
export function createCoachCyclePreviewV2Api(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; getOwnerSubject?(): string | null; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) { let url: URL; try { url = new URL(base) } catch { throw new CoachCyclePreviewV2Error('invalid') }; if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachCyclePreviewV2Error('invalid') }
  async function post(operation: CoachCyclePreviewV2Operation, input: CoachCyclePreviewV2Input | CoachCyclePreviewDetailV2Input, summary?: CoachCyclePreviewV2Summary): Promise<CoachCyclePreviewV2Summary | CoachCyclePreviewV2Detail> {
    let body: string, snapshot: unknown
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachCyclePreviewV2Error('invalid') }
    if (!isCoachCyclePreviewV2Input(operation, snapshot) || new TextEncoder().encode(body).byteLength > COACH_CYCLE_PREVIEW_V2_REQUEST_MAX_BYTES) throw new CoachCyclePreviewV2Error('invalid')
    const owner = options.getOwnerSubject?.()
    if (options.getOwnerSubject && !uuid(owner)) throw new CoachCyclePreviewV2Error('session_expired')
    // Detail is always tied to the caller's exact previous authoritative summary.
    let review: CoachCyclePreviewV2Summary | undefined
    if (operation === 'detail') {
      try { review = JSON.parse(JSON.stringify(summary)) } catch { throw new CoachCyclePreviewV2Error('invalid') }
      if (!isCoachCyclePreviewV2Summary(review, snapshot, owner ?? undefined) || review.review_hash !== (snapshot as CoachCyclePreviewDetailV2Input).expected_review_hash || (snapshot as CoachCyclePreviewDetailV2Input).page_index >= review.detail_page_count) throw new CoachCyclePreviewV2Error('invalid')
    }
    const token = await options.getAccessToken()
    if (!token) { options.onSessionExpired?.(null); throw new CoachCyclePreviewV2Error('session_expired') }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachCyclePreviewV2Error('session_expired')
    if (options.getOwnerSubject && options.getOwnerSubject() !== owner) throw new CoachCyclePreviewV2Error('session_expired')
    let response: Response
    try { response = await (options.request ?? fetch)(`${base}${COACH_CYCLE_PREVIEW_V2_PATHS[operation]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body }) } catch { throw new CoachCyclePreviewV2Error('network') }
    if (response.status === 401) { await response.body?.cancel(); options.onSessionExpired?.(token); throw new CoachCyclePreviewV2Error('session_expired') }
    let value: unknown
    try {
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await response.body?.cancel(); throw new Error() }
      value = await readCoachCycleDraftJson(response, response.ok ? operation === 'preview' ? COACH_CYCLE_PREVIEW_V2_SUMMARY_MAX_BYTES : COACH_CYCLE_PREVIEW_V2_DETAIL_MAX_BYTES : COACH_CYCLE_PREVIEW_V2_ERROR_MAX_BYTES)
    } catch { throw new CoachCyclePreviewV2Error('network') }
    if (!response.ok) {
      if (exact(value, ['error']) && value.error === 'serialization_retry' && response.status === 409) throw new CoachCyclePreviewV2Error('retryable')
      if (exact(value, ['error']) && COACH_CYCLE_PREVIEW_V2_CONFLICTS.some(reason => reason === value.error) && response.status === 409) throw new CoachCyclePreviewV2Error('conflict', value.error as string)
      if (exact(value, ['error','reason']) && value.error === 'cycle_preview_blocked' && COACH_CYCLE_PREVIEW_V2_BLOCKS.some(reason => reason === value.reason) && response.status === 422) throw new CoachCyclePreviewV2Error('blocked', value.reason as string)
      throw new CoachCyclePreviewV2Error(response.status === 403 ? 'access_denied' : response.status === 404 ? 'not_found' : response.status === 503 ? 'unavailable' : response.status >= 500 ? 'network' : 'invalid')
    }
    if (options.getOwnerSubject && options.getOwnerSubject() !== owner) throw new CoachCyclePreviewV2Error('session_expired')
    if (operation === 'preview' ? !isCoachCyclePreviewV2Summary(value, snapshot, owner ?? undefined) : !isCoachCyclePreviewV2Detail(value, snapshot as CoachCyclePreviewDetailV2Input, review)) throw new CoachCyclePreviewV2Error('network')
    return value as CoachCyclePreviewV2Summary | CoachCyclePreviewV2Detail
  }
  return { preview: async (input: CoachCyclePreviewV2Input) => await post('preview', input) as CoachCyclePreviewV2Summary,
    detail: async (input: CoachCyclePreviewDetailV2Input, summary: CoachCyclePreviewV2Summary) => await post('detail', input, summary) as CoachCyclePreviewV2Detail }
}

// General v4 retains this exact SQL projection grammar, independently of the
// v2 authorization envelope and publication routes.
export { item as isCoachCyclePreviewV2Item, source as isCoachCyclePreviewV2Source }
