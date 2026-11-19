// Authorized-at-commit /2 history. Stored authorization does not imply a live gate.
import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { isCoachExcelBetaPreviewSummary, COACH_EXCEL_BETA_PREVIEW_CONFLICTS, type CoachExcelBetaPreviewSummary } from './coach-excel-beta-preview-api'
import { isCoachExcelPublishInput, isCoachExcelPublishReceipt, type CoachExcelPublishReceipt, type CoachExcelPublishStatusInput } from './coach-excel-publish-api'
import { COACH_CYCLE_PUBLISH_BLOCK_REASONS } from './coach-cycle-publish-api'
import { exact, uuid, hash, integer, canonical, type CoachExcelBetaAuthorization } from './coach-excel-beta-contract'
export const COACH_EXCEL_BETA_PUBLISH_PATHS = { publish: '/api/coach-excel-beta-publish-v1', status: '/api/coach-excel-beta-publish-status-v1' } as const
export type CoachExcelBetaPublishOperation = keyof typeof COACH_EXCEL_BETA_PUBLISH_PATHS
export const COACH_EXCEL_BETA_PUBLISH_REQUEST_MAX_BYTES = 2048
// /2 embeds the complete /1 receipt plus its outer projection and review summary.
export const COACH_EXCEL_BETA_PUBLISH_RESPONSE_MAX_BYTES = 262144
export const COACH_EXCEL_BETA_PUBLISH_ERROR_MAX_BYTES = 4096
export const COACH_EXCEL_BETA_PUBLISH_TIMEOUT_MS = 15000
export type CoachExcelBetaPublishInput = { request_id: string; gym: string; athlete: string; draft: string; expected_revision: number; expected_review_hash: string; expected_gate_epoch: number }
export type CoachExcelBetaPublishStatusInput = CoachExcelPublishStatusInput
export type CoachExcelBetaPublishReceipt = Omit<CoachExcelPublishReceipt, 'contract' | 'contract_version' | 'local_only' | 'publication_authorized' | 'internal_execution' | 'fanout'> & {
  contract: 'coach-excel-publish/2'; contract_version: 2; local_only: false; publication_authorized: true; authorized_at_commit: true
  execution_review_hash: string; execution_receipt: CoachExcelPublishReceipt; execution_result_hash: string
  review_summary: CoachExcelBetaPreviewSummary; authorization: CoachExcelBetaAuthorization
  fanout: Omit<CoachExcelPublishReceipt['fanout'], 'contract' | 'local_only' | 'publication_authorized'> & { contract: 'coach-excel-fanout/2'; local_only: false; publication_authorized: true; authorized_at_commit: true }
}
export type CoachExcelBetaPublishStatus = { contract: 'coach-excel-publish-status/2'; request_id: string; local_only: false }
  & ({ status: 'not_found'; receipt: null; authorized_at_commit: false } | { status: 'committed'; receipt: CoachExcelBetaPublishReceipt; authorized_at_commit: true })
export function isCoachExcelBetaPublishInput(operation: CoachExcelBetaPublishOperation, v: unknown): v is CoachExcelBetaPublishInput | CoachExcelBetaPublishStatusInput {
  if (operation === 'status') return isCoachExcelPublishInput('status', v)
  if (operation !== 'publish' || !exact(v, ['gym','athlete','request_id','draft','expected_revision','expected_review_hash','expected_gate_epoch']) || !integer(v.expected_gate_epoch, 1)) return false
  const { expected_gate_epoch: _epoch, ...input } = v
  return isCoachExcelPublishInput('publish', input)
}
function receipt(v: unknown, scope: CoachExcelBetaPublishStatusInput): v is CoachExcelBetaPublishReceipt {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const r = v as CoachExcelBetaPublishReceipt, s = r.review_summary
  if (r.contract !== 'coach-excel-publish/2' || r.contract_version !== 2 || r.local_only !== false || r.publication_authorized !== true
    || r.authorized_at_commit !== true || !hash(r.request_hash) || !hash(r.execution_result_hash) || !s) return false
  const input = { gym: scope.gym, athlete: scope.athlete, request_id: scope.request_id, draft: r.draft_id, expected_revision: r.draft_revision, expected_review_hash: r.review_hash, expected_gate_epoch: r.authorization?.gate_epoch }
  if (!isCoachExcelBetaPublishInput('publish', input) || !isCoachExcelBetaPreviewSummary(s, { ...input, page_index: 0 }) || !s.publishable
    || r.execution_review_hash !== s.execution_review_hash || canonical(r.authorization) !== canonical(s.authorization)) return false
  const old = r.execution_receipt
  if (!isCoachExcelPublishReceipt(old, { gym: scope.gym, athlete: scope.athlete, request_id: scope.request_id, draft: r.draft_id, expected_revision: r.draft_revision, expected_review_hash: r.execution_review_hash })
    || old.source_hash !== s.source_hash || old.compiled_hash !== s.compiled_hash || old.coverage_hash !== s.coverage_hash || old.projection_hash !== s.projection_hash) return false
  const { contract: _contract, contract_version: _version, request_hash: _requestHash, review_hash: _reviewHash,
    local_only: _local, publication_authorized: _authorized, internal_execution: _execution, fanout: _fanout, ...unchanged } = old
  // Exact projection comparison binds every retained graph/history field and rejects extra keys.
  return canonical(r) === canonical({ ...unchanged, contract: 'coach-excel-publish/2', contract_version: 2, request_hash: r.request_hash,
    review_hash: s.review_hash, execution_review_hash: s.execution_review_hash, review_summary: s, authorization: s.authorization,
    authorized_at_commit: true, local_only: false, publication_authorized: true,
    fanout: { ...old.fanout, contract: 'coach-excel-fanout/2', local_only: false, publication_authorized: true, authorized_at_commit: true },
    execution_receipt: old, execution_result_hash: r.execution_result_hash })
}
export function isCoachExcelBetaPublishReceipt(v: unknown, input: CoachExcelBetaPublishInput, reviewed?: CoachExcelBetaPreviewSummary): v is CoachExcelBetaPublishReceipt {
  return isCoachExcelBetaPublishInput('publish', input) && receipt(v, input) && v.draft_id === input.draft && v.draft_revision === input.expected_revision
    && v.review_hash === input.expected_review_hash && v.authorization.gate_epoch === input.expected_gate_epoch
    && (!reviewed || isCoachExcelBetaPreviewSummary(reviewed, { ...input, page_index: 0 }) && reviewed.publishable && canonical(v.review_summary) === canonical(reviewed))
}
export function isCoachExcelBetaPublishStatus(v: unknown, input: CoachExcelBetaPublishStatusInput, expected?: CoachExcelBetaPublishInput): v is CoachExcelBetaPublishStatus {
  if (!isCoachExcelBetaPublishInput('status', input) || !exact(v, ['contract','request_id','status','receipt','local_only','authorized_at_commit'])
    || v.contract !== 'coach-excel-publish-status/2' || v.request_id !== input.request_id || v.local_only !== false
    || expected && (!isCoachExcelBetaPublishInput('publish', expected) || expected.request_id !== input.request_id || expected.gym !== input.gym || expected.athlete !== input.athlete)) return false
  return v.status === 'not_found' ? v.receipt === null && v.authorized_at_commit === false
    : v.status === 'committed' && v.authorized_at_commit === true && receipt(v.receipt, input) && (!expected || isCoachExcelBetaPublishReceipt(v.receipt, expected))
}
export const COACH_EXCEL_BETA_PUBLISH_CONFLICTS = ['EXCEL_BETA_PUBLISH_REQUEST_REUSED','EXCEL_BETA_FRESH_REQUEST_REQUIRED','EXCEL_BETA_PUBLISH_NOT_ELIGIBLE','EXCEL_BETA_PUBLISH_FINAL_CHANGED','EXCEL_BETA_PUBLISH_ENVELOPE_CHANGED','EXCEL_BETA_HISTORY_INTEGRITY','EXCEL_PUBLISH_REQUEST_REUSED','EXCEL_PUBLISH_FRESH_REQUEST_REQUIRED','EXCEL_PUBLISH_ACTIVE_ASSIGNMENT_REFUSED','EXCEL_PUBLISH_REVIEW_STALE','EXCEL_PUBLISH_SCOPE_CHANGED','EXCEL_PUBLISH_ALL_SKIP_REFUSED','EXCEL_PUBLISH_PREMINT_CHANGED', ...COACH_EXCEL_BETA_PREVIEW_CONFLICTS,
  'EXCEL_HISTORY_ORPHAN_LEDGER','EXCEL_HISTORY_LEDGER_INTEGRITY','EXCEL_HISTORY_ROOT_MISSING','EXCEL_HISTORY_REVISION_INTEGRITY','EXCEL_HISTORY_RELEASE_INTEGRITY','EXCEL_HISTORY_GRAPH_INTEGRITY','EXCEL_HISTORY_MAP_COVERAGE','EXCEL_HISTORY_MAP_JOIN','EXCEL_HISTORY_INSTANCE_INTEGRITY','EXCEL_HISTORY_DELIVERY_INTEGRITY'] as const
export const COACH_EXCEL_CHOICE_DEVICE_UPGRADE_REQUIRED = 'EXCEL_CHOICE_DEVICE_UPGRADE_REQUIRED'
export const COACH_EXCEL_CHOICE_DEVICE_UPGRADE_MESSAGE = 'This program has weights the athlete chooses. The athlete needs to reconnect on the new athlete app before it can be sent. Send them a new Connect app link, then publish again.'
export const COACH_EXCEL_BETA_PUBLISH_BLOCKS = ['EXCEL_BETA_PUBLISH_RECEIPT_CAPACITY',COACH_EXCEL_CHOICE_DEVICE_UPGRADE_REQUIRED,'EXCEL_BETA_PUBLISH_INPUT_INVALID','EXCEL_BETA_STATUS_INPUT_INVALID','EXCEL_BETA_HISTORY_INPUT_INVALID','EXCEL_BETA_PREVIEW_INPUT_INVALID','EXCEL_BETA_PREVIEW_CAPACITY','EXCEL_PUBLISH_INPUT_INVALID','EXCEL_STATUS_INPUT_INVALID','excel_preview_input_invalid','excel_preview_page_invalid','excel_preview_summary_capacity_exceeded','excel_preview_page_capacity_exceeded','cycle_preview_item_capacity_exceeded','cycle_exact_start_schedule_invalid', ...COACH_CYCLE_PUBLISH_BLOCK_REASONS] as const
export type CoachExcelBetaPublishErrorCode = 'ambiguous' | 'blocked' | 'conflict' | 'retryable' | 'session_expired' | 'access_denied' | 'unavailable' | 'network' | 'invalid'
export class CoachExcelBetaPublishError extends Error {
  readonly pendingInput?: Readonly<CoachExcelBetaPublishInput>
  readonly recoveryInput?: Readonly<CoachExcelBetaPublishStatusInput>
  readonly outcome: 'unknown' | undefined
  constructor(readonly code: CoachExcelBetaPublishErrorCode, readonly reason?: string, pendingInput?: CoachExcelBetaPublishInput) {
    super({ ambiguous: 'The publication outcome is unknown. Check status with the same request ID before starting another publication.', blocked: 'This saved worksheet cannot be published. Check its prescriptions, start date and size.', conflict: 'The saved cycle, review or client scope changed. Check the prior request status before reviewing again.', retryable: 'This request is busy. Check status or retry the identical request.', session_expired: 'Sign in again before checking this publication.', access_denied: 'You no longer have access to this client publication.', unavailable: 'Excel publication is unavailable. This capability remains closed.', network: 'Publication status could not be checked. Try again.', invalid: 'Check the publication request and review again.' }[code])
    if (code === 'blocked' && reason === COACH_EXCEL_CHOICE_DEVICE_UPGRADE_REQUIRED) this.message = COACH_EXCEL_CHOICE_DEVICE_UPGRADE_MESSAGE
    this.name = 'CoachExcelBetaPublishError'
    if (pendingInput) { this.pendingInput = Object.freeze({ ...pendingInput }); this.recoveryInput = Object.freeze({ gym: pendingInput.gym, athlete: pendingInput.athlete, request_id: pendingInput.request_id }) }
    this.outcome = pendingInput ? 'unknown' : undefined
  }
}
export function createCoachExcelBetaPublishApi(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; getOwnerSubject?(): string | null; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) { let url: URL; try { url = new URL(base) } catch { throw new CoachExcelBetaPublishError('invalid') }; if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachExcelBetaPublishError('invalid') }
  const discard = async (response: Response) => { try { await response.body?.cancel() } catch { /* Preserve the caller's recoverable outcome. */ } }
  const expire = (token: string | null) => { try { options.onSessionExpired?.(token) } catch { /* Preserve the request outcome even if local session cleanup fails. */ } }
  async function post(operation: CoachExcelBetaPublishOperation, input: CoachExcelBetaPublishInput | CoachExcelBetaPublishStatusInput, context?: CoachExcelBetaPreviewSummary | CoachExcelBetaPublishInput): Promise<CoachExcelBetaPublishReceipt | CoachExcelBetaPublishStatus> {
    const ownerAtStart = options.getOwnerSubject?.()
    if (options.getOwnerSubject && !uuid(ownerAtStart)) throw new CoachExcelBetaPublishError('session_expired')
    let body: string, snapshot: unknown, reviewed: CoachExcelBetaPreviewSummary | undefined, expected: CoachExcelBetaPublishInput | undefined
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachExcelBetaPublishError('invalid') }
    if (!isCoachExcelBetaPublishInput(operation, snapshot) || new TextEncoder().encode(body).byteLength > COACH_EXCEL_BETA_PUBLISH_REQUEST_MAX_BYTES) throw new CoachExcelBetaPublishError('invalid')
    if (context !== undefined) {
      let saved: unknown; try { saved = JSON.parse(JSON.stringify(context)) } catch { throw new CoachExcelBetaPublishError('invalid') }
      if (operation === 'publish') {
        const commit = snapshot as CoachExcelBetaPublishInput, owner = options.getOwnerSubject?.()
        if (options.getOwnerSubject && !uuid(owner)) throw new CoachExcelBetaPublishError('session_expired')
        if (!isCoachExcelBetaPreviewSummary(saved, { ...commit, page_index: 0, expected_review_hash: commit.expected_review_hash }, owner ?? undefined) || saved.expected_current_assignment !== null) throw new CoachExcelBetaPublishError('invalid')
        reviewed = saved
      } else {
        const status = snapshot as CoachExcelBetaPublishStatusInput
        if (!isCoachExcelBetaPublishInput('publish', saved) || saved.request_id !== status.request_id || saved.gym !== status.gym || saved.athlete !== status.athlete) throw new CoachExcelBetaPublishError('invalid')
        expected = saved as CoachExcelBetaPublishInput
      }
    }
    const controller = new AbortController()
    let pending: CoachExcelBetaPublishInput | undefined
    const fail = (code: CoachExcelBetaPublishErrorCode, reason?: string) => new CoachExcelBetaPublishError(code, reason, pending)
    // Race the complete asynchronous transport, including token lookup and body
    // consumption. Abort alone cannot settle custom requests/streams that ignore
    // cancellation, and the caller must be able to release its publication lock.
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(fail(pending ? 'ambiguous' : 'network'))
        controller.abort()
      }, COACH_EXCEL_BETA_PUBLISH_TIMEOUT_MS)
    })
    const transport = async (): Promise<CoachExcelBetaPublishReceipt | CoachExcelBetaPublishStatus> => {
      let token: string | null
      try { token = await options.getAccessToken() } catch { throw new CoachExcelBetaPublishError('network') }
      if (controller.signal.aborted) throw fail('network')
      if (!token) { expire(null); throw new CoachExcelBetaPublishError('session_expired') }
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachExcelBetaPublishError('session_expired')
      if (options.getOwnerSubject && options.getOwnerSubject() !== ownerAtStart) throw new CoachExcelBetaPublishError('session_expired')
      pending = operation === 'publish' ? snapshot as CoachExcelBetaPublishInput : undefined
      let response: Response
      try { response = await (options.request ?? fetch)(`${base}${COACH_EXCEL_BETA_PUBLISH_PATHS[operation]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body, signal: controller.signal }) } catch { throw fail(pending ? 'ambiguous' : 'network') }
      if (controller.signal.aborted) { void discard(response); throw fail(pending ? 'ambiguous' : 'network') }
      if (response.status === 401) { await discard(response); if (controller.signal.aborted) throw fail(pending ? 'ambiguous' : 'network'); expire(token); throw fail('session_expired') }
      let value: unknown
      try {
        if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await discard(response); throw new Error() }
        value = await readCoachCycleDraftJson(response, response.ok ? COACH_EXCEL_BETA_PUBLISH_RESPONSE_MAX_BYTES : COACH_EXCEL_BETA_PUBLISH_ERROR_MAX_BYTES)
      } catch { throw fail(pending ? 'ambiguous' : 'network') }
      if (controller.signal.aborted) throw fail(pending ? 'ambiguous' : 'network')
      if (!response.ok) {
        if (exact(value, ['error']) && value.error === 'serialization_retry' && response.status === 409) throw fail('retryable')
        if (exact(value, ['error']) && COACH_EXCEL_BETA_PUBLISH_CONFLICTS.some(reason => reason === value.error) && response.status === 409) throw fail('conflict', value.error as string)
        if (exact(value, ['error','reason']) && value.error === 'excel_publish_blocked' && COACH_EXCEL_BETA_PUBLISH_BLOCKS.some(reason => reason === value.reason) && response.status === 422) throw fail('blocked', value.reason as string)
        throw fail(response.status === 403 ? 'access_denied' : response.status === 404 ? 'unavailable' : response.status === 503 ? 'unavailable' : response.status >= 500 ? pending ? 'ambiguous' : 'network' : 'invalid')
      }
      if (options.getOwnerSubject && options.getOwnerSubject() !== ownerAtStart) throw fail('session_expired')
      if (operation === 'publish' ? !isCoachExcelBetaPublishReceipt(value, snapshot as CoachExcelBetaPublishInput, reviewed) : !isCoachExcelBetaPublishStatus(value, snapshot as CoachExcelBetaPublishStatusInput, expected)) throw fail(pending ? 'ambiguous' : 'network')
      return value as CoachExcelBetaPublishReceipt | CoachExcelBetaPublishStatus
    }
    try { return await Promise.race([transport(), deadline]) }
    finally { clearTimeout(timer) }
  }
  return {
    publish: async (input: CoachExcelBetaPublishInput, reviewed?: CoachExcelBetaPreviewSummary) => await post('publish', input, reviewed) as CoachExcelBetaPublishReceipt,
    status: async (input: CoachExcelBetaPublishStatusInput, expected?: CoachExcelBetaPublishInput) => await post('status', input, expected) as CoachExcelBetaPublishStatus,
  }
}
