// Unreleased, default-off Excel publication and historical recovery. SQL owns
// authorization and compilation. Neither status nor this adapter retries writes.
import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { isCoachExcelPreviewSummary, COACH_EXCEL_PREVIEW_CONFLICTS, type CoachExcelPreviewSummary } from './coach-excel-preview-api'
import { COACH_CYCLE_PUBLISH_BLOCK_REASONS } from './coach-cycle-publish-api'
export const COACH_EXCEL_PUBLISH_PATHS = { publish: '/api/coach-excel-publish-v1', status: '/api/coach-excel-publish-status-v1' } as const
export type CoachExcelPublishOperation = keyof typeof COACH_EXCEL_PUBLISH_PATHS
export const COACH_EXCEL_PUBLISH_REQUEST_MAX_BYTES = 2048
export const COACH_EXCEL_PUBLISH_RESPONSE_MAX_BYTES = 262144
export const COACH_EXCEL_PUBLISH_ERROR_MAX_BYTES = 4096
export const COACH_EXCEL_PUBLISH_TIMEOUT_MS = 15000
export type CoachExcelPublishInput = { request_id: string; gym: string; athlete: string; draft: string; expected_revision: number; expected_review_hash: string }
export type CoachExcelPublishStatusInput = { gym: string; athlete: string; request_id: string }
export type CoachExcelPublishReceipt = {
  contract: 'coach-excel-publish/1'; contract_version: 1; request_id: string; request_hash: string; draft_id: string; draft_revision: number
  source_hash: string; review_hash: string; calendar_version: 2; schedule_contract: 'coach-cycle-exact-start/1'; compiler_version: 'coach-cycle-sql/2'
  projection_version: 'coach-cycle-detail/3'; compiled_hash: string; coverage_hash: string; projection_hash: string
  program_id: string; assignment_id: string; builder_version: number; immutable_revision_id: string; immutable_revision_number: 1
  immutable_revision_hash: string; release_id: string; destination_hash_at_commit: string
  fanout: { contract: 'coach-excel-fanout/1'; local_only: true; publication_authorized: false; program_id: string; assignment_id: string; revision_id: string
    release_id: string; revision_hash: string; graph_hash: string; graph_counts: Record<string, number>; release_day_count: number; workout_instance_count: number; delivery_receipt_count: number }
  history: { calendar_marker: Record<string, unknown>; revision: Record<string, unknown>; release: Record<string, unknown>; instance_hash: string; receipt_ids: string[]; receipt_hash: string; feed_id: string; outbox_id: string }
  active_assignment_policy: 'refuse-active/1'; fresh_only: true; local_only: true; publication_authorized: false
  internal_execution: { contract: 'coach-excel-publication/1'; request_id: string; review_hash: string; request_hash: string; result_hash: string }
}
export type CoachExcelPublishStatus = { contract: 'coach-excel-publish-status/1'; request_id: string; local_only: true; publication_authorized: false }
  & ({ status: 'not_found'; receipt: null } | { status: 'committed'; receipt: CoachExcelPublishReceipt })
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000'
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max
const timestamp = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
export function isCoachExcelPublishInput(operation: CoachExcelPublishOperation, v: unknown): v is CoachExcelPublishInput | CoachExcelPublishStatusInput {
  return (operation === 'publish' || operation === 'status') && exact(v, ['gym','athlete','request_id', ...(operation === 'publish' ? ['draft','expected_revision','expected_review_hash'] : [])])
    && [v.gym,v.athlete,v.request_id].every(uuid) && (operation === 'status' || uuid(v.draft) && integer(v.expected_revision, 1) && hash(v.expected_review_hash))
}
const receiptKeys = ['contract','contract_version','request_id','request_hash','draft_id','draft_revision','source_hash','review_hash','calendar_version','schedule_contract','compiler_version','projection_version','compiled_hash','coverage_hash','projection_hash','program_id','assignment_id','builder_version','immutable_revision_id','immutable_revision_number','immutable_revision_hash','release_id','destination_hash_at_commit','fanout','history','active_assignment_policy','fresh_only','local_only','publication_authorized','internal_execution']
function receipt(v: unknown, scope: CoachExcelPublishStatusInput): v is CoachExcelPublishReceipt {
  if (!exact(v, receiptKeys) || v.contract !== 'coach-excel-publish/1' || v.contract_version !== 1 || v.request_id !== scope.request_id
    || v.calendar_version !== 2 || v.schedule_contract !== 'coach-cycle-exact-start/1' || v.compiler_version !== 'coach-cycle-sql/2' || v.projection_version !== 'coach-cycle-detail/3'
    || ![v.request_id,v.draft_id,v.program_id,v.assignment_id,v.immutable_revision_id,v.release_id].every(uuid)
    || ![v.request_hash,v.source_hash,v.review_hash,v.compiled_hash,v.coverage_hash,v.projection_hash,v.immutable_revision_hash,v.destination_hash_at_commit].every(hash)
    || !integer(v.draft_revision, 1) || !integer(v.builder_version, 0) || v.immutable_revision_number !== 1
    || v.active_assignment_policy !== 'refuse-active/1' || v.fresh_only !== true || v.local_only !== true || v.publication_authorized !== false) return false
  const i = v.internal_execution, f = v.fanout, h = v.history
  if (!exact(i, ['contract','request_id','review_hash','request_hash','result_hash']) || i.contract !== 'coach-excel-publication/1' || i.request_id !== v.request_id || i.review_hash !== v.review_hash || ![i.request_hash,i.result_hash].every(hash)
    || !exact(f, ['contract','local_only','publication_authorized','program_id','assignment_id','revision_id','release_id','revision_hash','graph_hash','graph_counts','release_day_count','workout_instance_count','delivery_receipt_count'])
    || f.contract !== 'coach-excel-fanout/1' || f.local_only !== true || f.publication_authorized !== false || f.program_id !== v.program_id || f.assignment_id !== v.assignment_id
    || f.revision_id !== v.immutable_revision_id || f.release_id !== v.release_id || f.revision_hash !== v.immutable_revision_hash || !hash(f.graph_hash)
    || !exact(f.graph_counts, ['revision_blocks','revision_weeks','revision_days','revision_movement_groups','revision_exercise_rows','revision_set_groups'])
    || !Object.values(f.graph_counts).every(n => integer(n, 0, 768)) || f.graph_counts.revision_blocks !== 1 || !integer(f.graph_counts.revision_weeks, 1, 12)
    || !integer(f.release_day_count, 1, 32) || f.graph_counts.revision_days !== f.release_day_count || !integer(f.workout_instance_count, 1, f.release_day_count)
    || !integer(f.delivery_receipt_count, 0) || !integer(f.graph_counts.revision_exercise_rows, 1, 192)
    || !exact(h, ['calendar_marker','revision','release','instance_hash','receipt_ids','receipt_hash','feed_id','outbox_id'])
    || ![h.instance_hash,h.receipt_hash].every(hash) || ![h.feed_id,h.outbox_id].every(uuid) || !Array.isArray(h.receipt_ids)
    || h.receipt_ids.length !== f.delivery_receipt_count || !h.receipt_ids.every(uuid) || new Set(h.receipt_ids).size !== h.receipt_ids.length) return false
  // These are the frozen rows returned by the reviewed SQL, not arbitrary JSON.
  const m = h.calendar_marker, r = h.revision, l = h.release
  return exact(m, ['gym_id','athlete_id','program_id','calendar_version','schedule_contract']) && m.gym_id === scope.gym && m.athlete_id === scope.athlete && m.program_id === v.program_id && m.calendar_version === 2 && m.schedule_contract === v.schedule_contract
    && exact(r, ['id','gym_id','assignment_id','revision_number','status','program_name','cycle_label','default_unit','plate_increment','start_on','end_on','schema_major','schema_minor','minimum_client_build','required_features','content_hash','created_by_coach_id','created_at','published_by_coach_id','published_at','sync_cursor'])
    && r.id === v.immutable_revision_id && r.gym_id === scope.gym && r.assignment_id === v.assignment_id && r.revision_number === 1 && r.status === 'published'
    && r.content_hash === `\\x${v.immutable_revision_hash}` && [r.created_by_coach_id,r.published_by_coach_id].every(uuid) && timestamp(r.created_at) && timestamp(r.published_at)
    && typeof r.program_name === 'string' && r.program_name.length > 0 && (r.cycle_label === null || typeof r.cycle_label === 'string') && ['kg','lb'].includes(String(r.default_unit))
    && typeof r.plate_increment === 'number' && r.plate_increment > 0 && typeof r.start_on === 'string' && typeof r.end_on === 'string'
    && integer(r.schema_major, 1) && integer(r.schema_minor, 0) && (r.minimum_client_build === null || integer(r.minimum_client_build, 1))
    && Array.isArray(r.required_features) && r.required_features.every(feature => typeof feature === 'string') && integer(r.sync_cursor, 1)
    && exact(l, ['id','gym_id','athlete_id','assignment_id','revision_id','supersedes_release_id','release_sequence','effective_from_logical_day_id','effective_position_ordinal','published_by_coach_id','published_at','sync_cursor','release_scope_kind','visible_day_ids'])
    && l.id === v.release_id && l.gym_id === scope.gym && l.athlete_id === scope.athlete && l.assignment_id === v.assignment_id && l.revision_id === v.immutable_revision_id
    && l.supersedes_release_id === null && l.release_sequence === 1 && uuid(l.effective_from_logical_day_id) && integer(l.effective_position_ordinal, 1)
    && uuid(l.published_by_coach_id) && l.published_by_coach_id === r.published_by_coach_id && timestamp(l.published_at) && integer(l.sync_cursor, 1) && l.release_scope_kind === 'program'
    && Array.isArray(l.visible_day_ids) && l.visible_day_ids.length === f.release_day_count && l.visible_day_ids.every(uuid) && new Set(l.visible_day_ids).size === l.visible_day_ids.length
}
export function isCoachExcelPublishReceipt(v: unknown, input: CoachExcelPublishInput, reviewed?: CoachExcelPreviewSummary): v is CoachExcelPublishReceipt {
  if (!isCoachExcelPublishInput('publish', input) || !receipt(v, input) || v.draft_id !== input.draft || v.draft_revision !== input.expected_revision || v.review_hash !== input.expected_review_hash) return false
  return !reviewed || isCoachExcelPreviewSummary(reviewed, { ...input, page_index: 0, expected_review_hash: input.expected_review_hash }) && reviewed.expected_current_assignment === null
    && v.source_hash === reviewed.source_hash && v.compiled_hash === reviewed.compiled_hash && v.coverage_hash === reviewed.coverage_hash && v.projection_hash === reviewed.projection_hash
}
export function isCoachExcelPublishStatus(v: unknown, input: CoachExcelPublishStatusInput, expected?: CoachExcelPublishInput): v is CoachExcelPublishStatus {
  if (!isCoachExcelPublishInput('status', input) || !exact(v, ['contract','request_id','status','receipt','local_only','publication_authorized'])
    || v.contract !== 'coach-excel-publish-status/1' || v.request_id !== input.request_id || v.local_only !== true || v.publication_authorized !== false
    || expected && (!isCoachExcelPublishInput('publish', expected) || expected.request_id !== input.request_id || expected.gym !== input.gym || expected.athlete !== input.athlete)) return false
  return v.status === 'not_found' ? v.receipt === null : v.status === 'committed' && receipt(v.receipt, input) && (!expected || isCoachExcelPublishReceipt(v.receipt, expected))
}
export const COACH_EXCEL_PUBLISH_CONFLICTS = ['EXCEL_PUBLISH_REQUEST_REUSED','EXCEL_PUBLISH_FRESH_REQUEST_REQUIRED','EXCEL_PUBLISH_ACTIVE_ASSIGNMENT_REFUSED','EXCEL_PUBLISH_REVIEW_STALE','EXCEL_PUBLISH_SCOPE_CHANGED','EXCEL_PUBLISH_ALL_SKIP_REFUSED','EXCEL_PUBLISH_PREMINT_CHANGED', ...COACH_EXCEL_PREVIEW_CONFLICTS,
  'EXCEL_HISTORY_ORPHAN_LEDGER','EXCEL_HISTORY_LEDGER_INTEGRITY','EXCEL_HISTORY_ROOT_MISSING','EXCEL_HISTORY_REVISION_INTEGRITY','EXCEL_HISTORY_RELEASE_INTEGRITY','EXCEL_HISTORY_GRAPH_INTEGRITY','EXCEL_HISTORY_MAP_COVERAGE','EXCEL_HISTORY_MAP_JOIN','EXCEL_HISTORY_INSTANCE_INTEGRITY','EXCEL_HISTORY_DELIVERY_INTEGRITY'] as const
export const COACH_EXCEL_PUBLISH_BLOCKS = ['EXCEL_PUBLISH_INPUT_INVALID','EXCEL_STATUS_INPUT_INVALID','excel_preview_input_invalid','excel_preview_page_invalid','excel_preview_summary_capacity_exceeded','excel_preview_page_capacity_exceeded','cycle_preview_item_capacity_exceeded','cycle_exact_start_schedule_invalid', ...COACH_CYCLE_PUBLISH_BLOCK_REASONS] as const
export type CoachExcelPublishErrorCode = 'ambiguous' | 'blocked' | 'conflict' | 'retryable' | 'session_expired' | 'access_denied' | 'unavailable' | 'network' | 'invalid'
export class CoachExcelPublishError extends Error {
  readonly pendingInput?: Readonly<CoachExcelPublishInput>
  readonly recoveryInput?: Readonly<CoachExcelPublishStatusInput>
  readonly outcome: 'unknown' | undefined
  constructor(readonly code: CoachExcelPublishErrorCode, readonly reason?: string, pendingInput?: CoachExcelPublishInput) {
    super({ ambiguous: 'The publication outcome is unknown. Check status with the same request ID before starting another publication.', blocked: 'This saved worksheet cannot be published. Check its prescriptions, start date and size.', conflict: 'The saved cycle, review or client scope changed. Check the prior request status before reviewing again.', retryable: 'This request is busy. Check status or retry the identical request.', session_expired: 'Sign in again before checking this publication.', access_denied: 'You no longer have access to this client publication.', unavailable: 'Excel publication is unavailable. This capability remains closed.', network: 'Publication status could not be checked. Try again.', invalid: 'Check the publication request and review again.' }[code])
    this.name = 'CoachExcelPublishError'
    if (pendingInput) { this.pendingInput = Object.freeze({ ...pendingInput }); this.recoveryInput = Object.freeze({ gym: pendingInput.gym, athlete: pendingInput.athlete, request_id: pendingInput.request_id }) }
    this.outcome = pendingInput ? 'unknown' : undefined
  }
}
export function createCoachExcelPublishApi(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; getOwnerSubject?(): string | null; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) { let url: URL; try { url = new URL(base) } catch { throw new CoachExcelPublishError('invalid') }; if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachExcelPublishError('invalid') }
  const discard = async (response: Response) => { try { await response.body?.cancel() } catch { /* Preserve the caller's recoverable outcome. */ } }
  const expire = (token: string | null) => { try { options.onSessionExpired?.(token) } catch { /* Preserve the request outcome even if local session cleanup fails. */ } }
  async function post(operation: CoachExcelPublishOperation, input: CoachExcelPublishInput | CoachExcelPublishStatusInput, context?: CoachExcelPreviewSummary | CoachExcelPublishInput): Promise<CoachExcelPublishReceipt | CoachExcelPublishStatus> {
    const ownerAtStart = options.getOwnerSubject?.()
    if (options.getOwnerSubject && !uuid(ownerAtStart)) throw new CoachExcelPublishError('session_expired')
    let body: string, snapshot: unknown, reviewed: CoachExcelPreviewSummary | undefined, expected: CoachExcelPublishInput | undefined
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachExcelPublishError('invalid') }
    if (!isCoachExcelPublishInput(operation, snapshot) || new TextEncoder().encode(body).byteLength > COACH_EXCEL_PUBLISH_REQUEST_MAX_BYTES) throw new CoachExcelPublishError('invalid')
    if (context !== undefined) {
      let saved: unknown; try { saved = JSON.parse(JSON.stringify(context)) } catch { throw new CoachExcelPublishError('invalid') }
      if (operation === 'publish') {
        const commit = snapshot as CoachExcelPublishInput, owner = options.getOwnerSubject?.()
        if (options.getOwnerSubject && !uuid(owner)) throw new CoachExcelPublishError('session_expired')
        if (!isCoachExcelPreviewSummary(saved, { ...commit, page_index: 0, expected_review_hash: commit.expected_review_hash }, owner ?? undefined) || saved.expected_current_assignment !== null) throw new CoachExcelPublishError('invalid')
        reviewed = saved
      } else {
        const status = snapshot as CoachExcelPublishStatusInput
        if (!isCoachExcelPublishInput('publish', saved) || saved.request_id !== status.request_id || saved.gym !== status.gym || saved.athlete !== status.athlete) throw new CoachExcelPublishError('invalid')
        expected = saved as CoachExcelPublishInput
      }
    }
    const controller = new AbortController()
    let pending: CoachExcelPublishInput | undefined
    const fail = (code: CoachExcelPublishErrorCode, reason?: string) => new CoachExcelPublishError(code, reason, pending)
    // Race the complete asynchronous transport, including token lookup and body
    // consumption. Abort alone cannot settle custom requests/streams that ignore
    // cancellation, and the caller must be able to release its publication lock.
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(fail(pending ? 'ambiguous' : 'network'))
        controller.abort()
      }, COACH_EXCEL_PUBLISH_TIMEOUT_MS)
    })
    const transport = async (): Promise<CoachExcelPublishReceipt | CoachExcelPublishStatus> => {
      let token: string | null
      try { token = await options.getAccessToken() } catch { throw new CoachExcelPublishError('network') }
      if (controller.signal.aborted) throw fail('network')
      if (!token) { expire(null); throw new CoachExcelPublishError('session_expired') }
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachExcelPublishError('session_expired')
      if (options.getOwnerSubject && options.getOwnerSubject() !== ownerAtStart) throw new CoachExcelPublishError('session_expired')
      pending = operation === 'publish' ? snapshot as CoachExcelPublishInput : undefined
      let response: Response
      try { response = await (options.request ?? fetch)(`${base}${COACH_EXCEL_PUBLISH_PATHS[operation]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body, signal: controller.signal }) } catch { throw fail(pending ? 'ambiguous' : 'network') }
      if (controller.signal.aborted) { void discard(response); throw fail(pending ? 'ambiguous' : 'network') }
      if (response.status === 401) { await discard(response); if (controller.signal.aborted) throw fail(pending ? 'ambiguous' : 'network'); expire(token); throw fail('session_expired') }
      let value: unknown
      try {
        if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await discard(response); throw new Error() }
        value = await readCoachCycleDraftJson(response, response.ok ? COACH_EXCEL_PUBLISH_RESPONSE_MAX_BYTES : COACH_EXCEL_PUBLISH_ERROR_MAX_BYTES)
      } catch { throw fail(pending ? 'ambiguous' : 'network') }
      if (controller.signal.aborted) throw fail(pending ? 'ambiguous' : 'network')
      if (!response.ok) {
        if (exact(value, ['error']) && value.error === 'serialization_retry' && response.status === 409) throw fail('retryable')
        if (exact(value, ['error']) && COACH_EXCEL_PUBLISH_CONFLICTS.some(reason => reason === value.error) && response.status === 409) throw fail('conflict', value.error as string)
        if (exact(value, ['error','reason']) && value.error === 'excel_publish_blocked' && COACH_EXCEL_PUBLISH_BLOCKS.some(reason => reason === value.reason) && response.status === 422) throw fail('blocked', value.reason as string)
        throw fail(response.status === 403 ? 'access_denied' : response.status === 404 ? 'unavailable' : response.status === 503 ? 'unavailable' : response.status >= 500 ? pending ? 'ambiguous' : 'network' : 'invalid')
      }
      if (options.getOwnerSubject && options.getOwnerSubject() !== ownerAtStart) throw fail('session_expired')
      if (operation === 'publish' ? !isCoachExcelPublishReceipt(value, snapshot as CoachExcelPublishInput, reviewed) : !isCoachExcelPublishStatus(value, snapshot as CoachExcelPublishStatusInput, expected)) throw fail(pending ? 'ambiguous' : 'network')
      return value as CoachExcelPublishReceipt | CoachExcelPublishStatus
    }
    try { return await Promise.race([transport(), deadline]) }
    finally { clearTimeout(timer) }
  }
  return {
    publish: async (input: CoachExcelPublishInput, reviewed?: CoachExcelPreviewSummary) => await post('publish', input, reviewed) as CoachExcelPublishReceipt,
    status: async (input: CoachExcelPublishStatusInput, expected?: CoachExcelPublishInput) => await post('status', input, expected) as CoachExcelPublishStatus,
  }
}
