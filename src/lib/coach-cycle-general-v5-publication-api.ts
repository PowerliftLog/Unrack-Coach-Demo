// Closed local publication contract. Rollout is independent of draft authoring;
// no flag grants authority and no legacy publication route is used.
import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { isCoachCycleGeneralV4Uuid as uuid, type CoachCycleGeneralV4ClientScope as CoachCycleGeneralV5ClientScope } from './coach-cycle-general-v4-api'
import { compileExactStartSchedule } from './coach-cycle-exact-start'
import { isCoachCyclePreviewV2Item, isCoachCyclePreviewV2Source, COACH_CYCLE_PREVIEW_V2_BLOCKS,
  type CoachCyclePreviewV2Item, type CoachCyclePreviewV2Source, type CoachCyclePreviewV2Schedule } from './coach-cycle-preview-v2-api'
export const COACH_CYCLE_GENERAL_V5_PUBLICATION_PATHS = {
  preview: '/api/coach-cycle-general-v5-preview',
  preview_detail: '/api/coach-cycle-general-v5-preview-detail',
  publish: '/api/coach-cycle-general-v5-publish',
  publish_resolve: '/api/coach-cycle-general-v5-publish-resolve',
} as const
export type CoachCycleGeneralV5PublicationOperation = keyof typeof COACH_CYCLE_GENERAL_V5_PUBLICATION_PATHS
export const COACH_CYCLE_GENERAL_V5_PUBLICATION_REQUEST_MAX_BYTES = 2048
export const COACH_CYCLE_GENERAL_V5_PUBLICATION_ERROR_MAX_BYTES = 4096
export const coachCycleGeneralV5PublicationResponseMaxBytes = (operation: CoachCycleGeneralV5PublicationOperation) => operation === 'preview_detail' ? 65535 : operation === 'preview' ? 16383 : 8192
export type CoachCycleGeneralV5PreviewInput = CoachCycleGeneralV5ClientScope & { draft: string; expected_revision: number }
export type CoachCycleGeneralV5PreviewDetailInput = CoachCycleGeneralV5PreviewInput & { expected_review_hash: string; page_index: number }
export type CoachCycleGeneralV5PublishInput = CoachCycleGeneralV5PreviewInput & {
  request: string; expected_review_hash: string; expected_current_assignment: string | null; expected_assignment_hash: string; review_confirmed: true
}
// Deliberately source-free: resolution cannot replay the mutation or adopt a new review.
export type CoachCycleGeneralV5PublishResolveInput = CoachCycleGeneralV5ClientScope & { request: string }
export type CoachCycleGeneralV5PublicationInput = CoachCycleGeneralV5PreviewInput | CoachCycleGeneralV5PreviewDetailInput | CoachCycleGeneralV5PublishInput | CoachCycleGeneralV5PublishResolveInput
type Closed = { local_only: true; publication_authorized: false }
type Binding = { gym_id: string; library_generation: string; athlete_id: string; client_generation: string }
export type CoachCycleGeneralV5PublicationTotals = { exercises: number; skipped: number; groups: number; sets: number }
export type CoachCycleGeneralV5CurrentAssignment = { assignment_id: string; program_id: string | null; status: 'active'; current_revision_id: string | null; assigned_by_coach_id: string | null; assigned_at: string; updated_at: string; ended_at: null; sync_cursor: number; builder_version: number | null }
export type CoachCycleGeneralV5Preview = Closed & Binding & {
  contract: 'coach-cycle-general-preview/5'; contract_version: 5; owner_subject: string; coach_id: string; coach_membership_id: string; coach_role: 'owner' | 'admin' | 'coach'
  athlete_membership_id: string; pairing_epoch: string; roster_id: string | null; draft_id: string; draft_revision: number; source_hash: string
  compiler_version: 'coach-cycle-sql/2'; compiled_hash: string; coverage_hash: string; coverage_count: number
  calendar_version: 2; schedule_contract: 'coach-cycle-exact-start/1'; projection_version: 'coach-cycle-detail/3'; projection_hash: string; name: string; unit: 'lb' | 'kg'; start_on: string; end_on: string; week_count: number
  schedule: CoachCyclePreviewV2Schedule[]; totals: CoachCycleGeneralV5PublicationTotals; detail_item_count: number; detail_page_count: number
  detail_page_item_limit: 4; detail_page_payload_byte_limit: 49152; detail_page_byte_limit: 65536
  expected_current_assignment: string | null; current_assignment: CoachCycleGeneralV5CurrentAssignment | null; assignment_hash: string; review_hash: string
}
export type CoachCycleGeneralV5PreviewDetail = Closed & Binding & {
  contract: 'coach-cycle-general-detail/5'; contract_version: 5; compiler_version: 'coach-cycle-sql/2'; calendar_version: 2; schedule_contract: 'coach-cycle-exact-start/1'; projection_version: 'coach-cycle-detail/3'; draft_id: string; draft_revision: number; source_hash: string; review_hash: string; projection_hash: string
  page_index: number; page_count: number; item_count: number; total_item_count: number; items: CoachCyclePreviewV2Item[]; page_hash: string
}
// Compact committed terminal; calendar dates belong to preview.
export type CoachCycleGeneralV5PublishReceipt = Closed & Binding & {
  contract: 'coach-cycle-general-publish/5'; contract_version: 5; request_id: string; request_hash: string
  draft_id: string; draft_revision: number; source_hash: string; review_hash: string; compiled_hash: string; coverage_hash: string; projection_hash: string
  program_id: string; assignment_id: string; immutable_revision_id: string; release_id: string; immutable_revision_hash: string
  destination_hash_at_commit: string; source_map_hash: string; source_map_item_count: number
}
export type CoachCycleGeneralV5PublishResolution = Closed & {
  contract: 'coach-cycle-general-publish-resolution/5'; request_id: string; operation: 'publish:v5'; historical: true; current_object_proved: false
} & ({ resolution: 'committed'; receipt: CoachCycleGeneralV5PublishReceipt } | { resolution: 'cancelled'; receipt: null })
export type CoachCycleGeneralV5PublicationResult = CoachCycleGeneralV5Preview | CoachCycleGeneralV5PreviewDetail | CoachCycleGeneralV5PublishReceipt | CoachCycleGeneralV5PublishResolution
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const integer = (v: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const nullableUuid = (v: unknown) => v === null || uuid(v)
const date = (v: unknown): v is string => typeof v === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
const timestamp = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(v) && date(v.slice(0,10)) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,19) === v.slice(0,19)
const after = (day: string, count: number) => new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0,10)
const closedKeys = ['local_only','publication_authorized'], bindingKeys = ['gym_id','library_generation','athlete_id','client_generation']
const scopeKeys = ['gym','library_generation','athlete','client_generation'], previewKeys = [...scopeKeys,'draft','expected_revision']
const closed = (v: Record<string,unknown>) => v.local_only === true && v.publication_authorized === false
const bound = (v: Record<string,unknown>, input: CoachCycleGeneralV5ClientScope) => v.gym_id === input.gym && v.library_generation === input.library_generation && v.athlete_id === input.athlete && v.client_generation === input.client_generation
export function isCoachCycleGeneralV5PublicationInput(operation: CoachCycleGeneralV5PublicationOperation, v: unknown): v is CoachCycleGeneralV5PublicationInput {
  if (!object(v) || !scopeKeys.every(k => uuid(v[k]))) return false
  if (operation === 'publish_resolve') return exact(v, [...scopeKeys,'request']) && uuid(v.request)
  if (!uuid(v.draft) || !integer(v.expected_revision)) return false
  if (operation === 'preview') return exact(v, previewKeys)
  if (operation === 'preview_detail') return exact(v, [...previewKeys,'expected_review_hash','page_index']) && hash(v.expected_review_hash) && integer(v.page_index,0,383)
  return operation === 'publish' && exact(v, [...previewKeys,'request','expected_review_hash','expected_current_assignment','expected_assignment_hash','review_confirmed'])
    && uuid(v.request) && hash(v.expected_review_hash) && nullableUuid(v.expected_current_assignment) && hash(v.expected_assignment_hash) && v.review_confirmed === true
}
function totals(v: unknown): v is CoachCycleGeneralV5PublicationTotals {
  return exact(v,['exercises','skipped','groups','sets']) && integer(v.exercises,0,192) && integer(v.skipped,0,384)
    && integer(v.groups,v.exercises,768) && integer(v.sets,v.groups,768) && (v.exercises !== 0 || v.groups === 0 && v.sets === 0)
}
function assignment(v: unknown): v is CoachCycleGeneralV5CurrentAssignment {
  return exact(v,['assignment_id','program_id','status','current_revision_id','assigned_by_coach_id','assigned_at','updated_at','ended_at','sync_cursor','builder_version'])
    && uuid(v.assignment_id) && nullableUuid(v.program_id) && v.status === 'active' && nullableUuid(v.current_revision_id) && nullableUuid(v.assigned_by_coach_id)
    && timestamp(v.assigned_at) && timestamp(v.updated_at) && v.ended_at === null && integer(v.sync_cursor,0) && (v.builder_version === null || integer(v.builder_version,0))
}
const summaryKeys = ['contract','contract_version','owner_subject','coach_id','coach_membership_id','coach_role',...bindingKeys,'athlete_membership_id','pairing_epoch','roster_id','draft_id','draft_revision','source_hash','compiler_version','calendar_version','schedule_contract','compiled_hash','coverage_hash','coverage_count','projection_version','projection_hash','name','unit','start_on','end_on','week_count','schedule','totals','detail_item_count','detail_page_count','detail_page_item_limit','detail_page_payload_byte_limit','detail_page_byte_limit','expected_current_assignment','current_assignment','assignment_hash',...closedKeys,'review_hash']
export function isCoachCycleGeneralV5Preview(v: unknown, input: CoachCycleGeneralV5PreviewInput, owner?: string): v is CoachCycleGeneralV5Preview {
  if (!isCoachCycleGeneralV5PublicationInput('preview', input) || !exact(v,summaryKeys) || !closed(v) || !bound(v,input) || v.contract !== 'coach-cycle-general-preview/5' || v.contract_version !== 5
    || ![v.owner_subject,v.coach_id,v.coach_membership_id,v.athlete_membership_id,v.pairing_epoch].every(uuid) || owner !== undefined && v.owner_subject !== owner
    || !['owner','admin','coach'].includes(String(v.coach_role)) || !nullableUuid(v.roster_id) || v.draft_id !== input.draft || v.draft_revision !== input.expected_revision
    || v.calendar_version !== 2 || v.schedule_contract !== 'coach-cycle-exact-start/1' || v.compiler_version !== 'coach-cycle-sql/2' || v.projection_version !== 'coach-cycle-detail/3' || ![v.source_hash,v.compiled_hash,v.coverage_hash,v.projection_hash,v.assignment_hash,v.review_hash].every(hash)
    || !integer(v.coverage_count,1,5338) || typeof v.name !== 'string' || !v.name.trim() || [...v.name].length > 120 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(v.name) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v.name)
    || !['lb','kg'].includes(String(v.unit)) || !date(v.start_on) || !integer(v.week_count,1,12) || !date(v.end_on) || v.end_on !== after(v.start_on,v.week_count*7-1)
    || !Array.isArray(v.schedule) || !integer(v.schedule.length,1,32) || v.schedule.length % v.week_count !== 0 || !totals(v.totals)
    || v.detail_item_count !== v.totals.exercises + v.totals.skipped || !integer(v.detail_item_count,1,384) || !integer(v.detail_page_count,Math.ceil(v.detail_item_count/4),v.detail_item_count)
    || v.detail_page_item_limit !== 4 || v.detail_page_payload_byte_limit !== 49152 || v.detail_page_byte_limit !== 65536 || !nullableUuid(v.expected_current_assignment)
    || (v.current_assignment === null ? v.expected_current_assignment !== null : !assignment(v.current_assignment) || v.current_assignment.assignment_id !== v.expected_current_assignment)) return false
  const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const first = v.schedule.filter(s => object(s) && s.week === 1).map(s => s.weekday)
  let expected
  try { expected = compileExactStartSchedule(v.start_on, v.week_count, [...first].sort((a,b) => a-b)).weeks.flatMap(w => w.days.map(d => ({week:w.ordinal,weekday:d.weekday,scheduled_date:d.scheduledDate}))) } catch { return false }
  if (expected.length !== v.schedule.length) return false
  for (let i=0; i<expected.length; i++) {
    const actual=v.schedule[i], planned=expected[i]
    if (!exact(actual,['week','weekday','day','scheduled_date','marked_rest']) || actual.week !== planned.week || actual.weekday !== planned.weekday
      || actual.day !== weekdays[planned.weekday-1] || actual.scheduled_date !== planned.scheduled_date || typeof actual.marked_rest !== 'boolean') return false
  }
  return v.detail_item_count <= v.schedule.length*12 && v.totals.exercises <= v.schedule.filter(s => !s.marked_rest).length*12
}
export function isCoachCycleGeneralV5PreviewDetail(v: unknown, input: CoachCycleGeneralV5PreviewDetailInput, summary?: CoachCycleGeneralV5Preview): v is CoachCycleGeneralV5PreviewDetail {
  if (!isCoachCycleGeneralV5PublicationInput('preview_detail',input) || !exact(v,['contract','contract_version',...bindingKeys,'compiler_version','projection_version','calendar_version','schedule_contract','draft_id','draft_revision','source_hash','review_hash','projection_hash','page_index','page_count','item_count','total_item_count','items',...closedKeys,'page_hash'])
    || !closed(v) || !bound(v,input) || v.contract !== 'coach-cycle-general-detail/5' || v.contract_version !== 5 || v.compiler_version !== 'coach-cycle-sql/2' || v.projection_version !== 'coach-cycle-detail/3' || v.calendar_version !== 2 || v.schedule_contract !== 'coach-cycle-exact-start/1' || v.draft_id !== input.draft || v.draft_revision !== input.expected_revision
    || v.review_hash !== input.expected_review_hash || ![v.source_hash,v.review_hash,v.projection_hash,v.page_hash].every(hash) || v.page_index !== input.page_index
    || !integer(v.page_count,1,384) || !integer(v.page_index,0,v.page_count-1) || !integer(v.item_count,1,4) || !integer(v.total_item_count,1,384)
    || v.page_count > v.total_item_count || v.page_count < Math.ceil(v.total_item_count/4) || !Array.isArray(v.items) || v.items.length !== v.item_count) return false
  if (summary && (!isCoachCycleGeneralV5Preview(summary,{gym:input.gym,library_generation:input.library_generation,athlete:input.athlete,client_generation:input.client_generation,draft:input.draft,expected_revision:input.expected_revision})
    || summary.review_hash !== v.review_hash || summary.projection_hash !== v.projection_hash || summary.source_hash !== v.source_hash || summary.detail_item_count !== v.total_item_count || summary.detail_page_count !== v.page_count)) return false
  for (let i=0; i<v.items.length; i++) {
    const item=v.items[i]
    if (!isCoachCyclePreviewV2Item(item,v.total_item_count) || i>0 && item.item_index !== v.items[i-1].item_index+1) return false
    if (summary) {
      const scheduled=summary.schedule.find(s=>s.week===item.week && s.weekday===item.weekday), day=summary.schedule.filter(s=>s.week===1).sort((a,b)=>a.weekday-b.weekday).findIndex(s=>s.weekday===item.weekday)
      if (!scheduled || scheduled.scheduled_date !== item.scheduled_date || item.source.name.column !== day*5+1 || item.status === 'programmed' && scheduled.marked_rest) return false
    }
  }
  const first=v.items[0].item_index,last=v.items[v.items.length-1].item_index,remaining=v.total_item_count-last-1,pages=v.page_count-v.page_index-1
  return first >= v.page_index && first <= v.page_index*4 && remaining >= pages && remaining <= pages*4 && (v.page_index !== 0 || first === 0) && (pages !== 0 || last === v.total_item_count-1)
}
export const COACH_CYCLE_GENERAL_V5_RECEIPT_KEYS = ['contract','contract_version','request_id','request_hash',...bindingKeys,'draft_id','draft_revision','source_hash','review_hash','compiled_hash','coverage_hash','projection_hash','program_id','assignment_id','immutable_revision_id','release_id','immutable_revision_hash','destination_hash_at_commit','source_map_hash','source_map_item_count',...closedKeys] as const
export function isCoachCycleGeneralV5PublishReceipt(v: unknown, input: CoachCycleGeneralV5PublishResolveInput | CoachCycleGeneralV5PublishInput): v is CoachCycleGeneralV5PublishReceipt {
  if (!isCoachCycleGeneralV5PublicationInput('draft' in input ? 'publish' : 'publish_resolve',input) || !exact(v,COACH_CYCLE_GENERAL_V5_RECEIPT_KEYS) || !closed(v) || !bound(v,input)
    || v.contract !== 'coach-cycle-general-publish/5' || v.contract_version !== 5 || v.request_id !== input.request
    || ![v.request_id,v.draft_id,v.program_id,v.assignment_id,v.release_id,v.immutable_revision_id].every(uuid) || !integer(v.draft_revision)
    || ![v.request_hash,v.source_hash,v.review_hash,v.compiled_hash,v.coverage_hash,v.projection_hash,v.immutable_revision_hash,v.destination_hash_at_commit,v.source_map_hash].every(hash)
    || !integer(v.source_map_item_count,1,384)) return false
  return !('draft' in input) || v.draft_id === input.draft && v.draft_revision === input.expected_revision && v.review_hash === input.expected_review_hash
}
export function isCoachCycleGeneralV5PublicationResult(operation: CoachCycleGeneralV5PublicationOperation, v: unknown, input: CoachCycleGeneralV5PublicationInput): v is CoachCycleGeneralV5PublicationResult {
  if (!isCoachCycleGeneralV5PublicationInput(operation,input)) return false
  if (operation === 'preview') return isCoachCycleGeneralV5Preview(v,input as CoachCycleGeneralV5PreviewInput)
  if (operation === 'preview_detail') return isCoachCycleGeneralV5PreviewDetail(v,input as CoachCycleGeneralV5PreviewDetailInput)
  if (operation === 'publish') return isCoachCycleGeneralV5PublishReceipt(v,input as CoachCycleGeneralV5PublishInput)
  return exact(v,['contract','request_id','operation','resolution','historical','receipt','current_object_proved',...closedKeys]) && closed(v)
    && v.contract === 'coach-cycle-general-publish-resolution/5' && v.request_id === (input as CoachCycleGeneralV5PublishResolveInput).request && v.operation === 'publish:v5' && v.historical === true && v.current_object_proved === false
    && (v.resolution === 'cancelled' ? v.receipt === null : v.resolution === 'committed' && isCoachCycleGeneralV5PublishReceipt(v.receipt,input as CoachCycleGeneralV5PublishResolveInput))
}
export const COACH_CYCLE_GENERAL_V5_PUBLICATION_CONFLICTS = ['cycle_general_preview_revision_stale','cycle_general_preview_source_integrity','cycle_general_preview_review_stale','cycle_general_publish_review_stale','cycle_general_publish_compile_changed','cycle_general_publication_integrity','cycle_general_publication_map_integrity','cycle_general_conflict','cycle_general_request_reused','cycle_publish_revision_already_published'] as const
export const COACH_CYCLE_GENERAL_V5_PUBLICATION_BLOCKS = [...COACH_CYCLE_PREVIEW_V2_BLOCKS,'cycle_general_preview_input_invalid','cycle_general_preview_page_invalid','cycle_general_preview_summary_capacity_exceeded','cycle_general_preview_page_capacity_exceeded','cycle_general_publish_input_invalid'] as const
export type CoachCycleGeneralV5PublicationErrorCode = 'unavailable' | 'session_expired' | 'access_denied' | 'conflict' | 'request_reused' | 'retryable' | 'blocked' | 'invalid' | 'network'
export class CoachCycleGeneralV5PublicationError extends Error {
  constructor(readonly code: CoachCycleGeneralV5PublicationErrorCode, readonly reason?: string, readonly coordinate?: CoachCyclePreviewV2Source) {
    super({ unavailable:'Cycle publication is unavailable.',session_expired:'Sign in again to review this cycle.',access_denied:'You no longer have access to this cycle scope.',conflict:'The cycle, assignment or authority changed. Review again.',request_reused:'This request ID was already used for another action.',retryable:'Retry the same request after the concurrent change finishes.',blocked:'Check the saved cycle prescriptions and size.',invalid:'Check the cycle publication request.',network:'The publication outcome could not be confirmed. Resolve the original request before another publication.' }[code]); this.name='CoachCycleGeneralV5PublicationError'
  }
}
export function createCoachCycleGeneralV5PublicationApi(options: { enabled?: boolean; baseUrl?: string; getAccessToken(): Promise<string|null>; getOwnerSubject?(): string|null; onSessionExpired?(token:string|null):void; request?:typeof fetch }) {
  const base=options.baseUrl?.replace(/\/$/,'')??''
  if (base) { let url:URL; try { url=new URL(base) } catch { throw new CoachCycleGeneralV5PublicationError('invalid') }; if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachCycleGeneralV5PublicationError('invalid') }
  async function post(operation:CoachCycleGeneralV5PublicationOperation,input:CoachCycleGeneralV5PublicationInput,summary?:CoachCycleGeneralV5Preview):Promise<CoachCycleGeneralV5PublicationResult> {
    if (options.enabled !== true) throw new CoachCycleGeneralV5PublicationError('unavailable')
    let body:string,snapshot:unknown,review:CoachCycleGeneralV5Preview|undefined
    try { body=JSON.stringify(input);snapshot=JSON.parse(body);if(summary)review=JSON.parse(JSON.stringify(summary)) } catch { throw new CoachCycleGeneralV5PublicationError('invalid') }
    if (!isCoachCycleGeneralV5PublicationInput(operation,snapshot) || new TextEncoder().encode(body).byteLength>COACH_CYCLE_GENERAL_V5_PUBLICATION_REQUEST_MAX_BYTES) throw new CoachCycleGeneralV5PublicationError('invalid')
    const owner=options.getOwnerSubject?.()
    if(options.getOwnerSubject && !uuid(owner))throw new CoachCycleGeneralV5PublicationError('session_expired')
    if(operation==='preview_detail') {
      const detail=snapshot as CoachCycleGeneralV5PreviewDetailInput
      if(!isCoachCycleGeneralV5Preview(review,{gym:detail.gym,library_generation:detail.library_generation,athlete:detail.athlete,client_generation:detail.client_generation,draft:detail.draft,expected_revision:detail.expected_revision},owner??undefined) || review.review_hash!==detail.expected_review_hash || detail.page_index>=review.detail_page_count)throw new CoachCycleGeneralV5PublicationError('invalid')
    }
    const token=await options.getAccessToken()
    if(!token){options.onSessionExpired?.(null);throw new CoachCycleGeneralV5PublicationError('session_expired')}
    if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>8192)throw new CoachCycleGeneralV5PublicationError('session_expired')
    if(options.getOwnerSubject && options.getOwnerSubject()!==owner)throw new CoachCycleGeneralV5PublicationError('session_expired')
    let response:Response
    try { response=await(options.request??fetch)(`${base}${COACH_CYCLE_GENERAL_V5_PUBLICATION_PATHS[operation]}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},credentials:'omit',cache:'no-store',redirect:'error',body}) } catch { throw new CoachCycleGeneralV5PublicationError('network') }
    if(response.status===401){await response.body?.cancel();options.onSessionExpired?.(token);throw new CoachCycleGeneralV5PublicationError('session_expired')}
    if(response.redirected || response.status>=300&&response.status<400 || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'){await response.body?.cancel();throw new CoachCycleGeneralV5PublicationError('network')}
    let value:unknown
    try {value=await readCoachCycleDraftJson(response,response.ok?coachCycleGeneralV5PublicationResponseMaxBytes(operation):COACH_CYCLE_GENERAL_V5_PUBLICATION_ERROR_MAX_BYTES)}catch{throw new CoachCycleGeneralV5PublicationError('network')}
    if(!response.ok){
      if(exact(value,['error'])&&response.status===409){
        if(value.error==='serialization_retry')throw new CoachCycleGeneralV5PublicationError('retryable')
        if(COACH_CYCLE_GENERAL_V5_PUBLICATION_CONFLICTS.some(reason=>reason===value.error))throw new CoachCycleGeneralV5PublicationError(value.error==='cycle_general_request_reused'?'request_reused':'conflict',value.error as string)
      }
      if((exact(value,['error','reason'])||exact(value,['error','reason','coordinate'])&&isCoachCyclePreviewV2Source(value.coordinate))&&value.error==='cycle_general_publication_blocked'&&response.status===422&&COACH_CYCLE_GENERAL_V5_PUBLICATION_BLOCKS.some(reason=>reason===value.reason))throw new CoachCycleGeneralV5PublicationError('blocked',value.reason as string,value.coordinate as CoachCyclePreviewV2Source|undefined)
      throw new CoachCycleGeneralV5PublicationError(response.status===403?'access_denied':response.status===404||response.status===503?'unavailable':response.status>=500?'network':'invalid')
    }
    if(options.getOwnerSubject && options.getOwnerSubject()!==owner)throw new CoachCycleGeneralV5PublicationError('session_expired')
    if(!isCoachCycleGeneralV5PublicationResult(operation,value,snapshot) || operation==='preview'&&!isCoachCycleGeneralV5Preview(value,snapshot as CoachCycleGeneralV5PreviewInput,owner??undefined) || operation==='preview_detail'&&!isCoachCycleGeneralV5PreviewDetail(value,snapshot as CoachCycleGeneralV5PreviewDetailInput,review))throw new CoachCycleGeneralV5PublicationError('network')
    return value
  }
  return {preview:async(input:CoachCycleGeneralV5PreviewInput)=>await post('preview',input) as CoachCycleGeneralV5Preview,
    detail:async(input:CoachCycleGeneralV5PreviewDetailInput,summary:CoachCycleGeneralV5Preview)=>await post('preview_detail',input,summary) as CoachCycleGeneralV5PreviewDetail,
    publish:async(input:CoachCycleGeneralV5PublishInput)=>await post('publish',input) as CoachCycleGeneralV5PublishReceipt,
    resolve:async(input:CoachCycleGeneralV5PublishResolveInput)=>await post('publish_resolve',input) as CoachCycleGeneralV5PublishResolution}
}
