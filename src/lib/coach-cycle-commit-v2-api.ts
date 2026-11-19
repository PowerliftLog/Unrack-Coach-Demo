import { authorizationV2Keys, isCoachCycleAuthorizationV2, sameCoachCycleAuthorizationV2, type CoachCycleAuthorizationV2 } from './coach-cycle-authorization-v2'
// Separate frozen /2 commit + historical status. No Publish UI or automatic retry.
// Only reviewed scalar input crosses HTTP; SQL owns source/compilation/authority.
import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { COACH_CYCLE_PREVIEW_V2_BLOCKS, isCoachCyclePreviewV2Summary, type CoachCyclePreviewV2Summary } from './coach-cycle-preview-v2-api'
export const COACH_CYCLE_COMMIT_V2_PATHS = { commit: '/api/coach-cycle-commit-v2', status: '/api/coach-cycle-commit-status-v2' } as const
export type CoachCycleCommitV2Operation = keyof typeof COACH_CYCLE_COMMIT_V2_PATHS
export const COACH_CYCLE_COMMIT_V2_REQUEST_MAX_BYTES = 2048
// Inclusive readers preserve strict less-than 16 KiB for both success envelopes.
export const COACH_CYCLE_COMMIT_V2_RESPONSE_MAX_BYTES = 16383
export const COACH_CYCLE_COMMIT_V2_ERROR_MAX_BYTES = 4096
export type CoachCycleCommitV2Input = {
  request_id: string; gym: string; athlete: string; draft: string; expected_revision: number; expected_admission_version: number
  expected_review_hash: string; expected_current_assignment: string | null
}
export type CoachCycleCommitV2StatusInput = { gym: string; athlete: string; request_id: string }
export type CoachCycleCommitV2Receipt = CoachCycleAuthorizationV2 & {
  contract: 'coach-cycle-sql-publish/2'; contract_version: 2; request_id: string; request_hash: string; draft_id: string; draft_revision: number
  source_hash: string; review_hash: string; compiler_version: 'coach-cycle-sql/1'; compiled_hash: string; coverage_hash: string
  projection_version: 'coach-cycle-detail/2'; projection_hash: string; admission_id: string; admission_version: number
  program_id: string; assignment_id: string; builder_version: number; release_id: string; immutable_revision_id: string; immutable_revision_number: number
  immutable_revision_hash: string; destination_hash_at_commit: string
  internal_execution: { contract: 'coach-cycle-sql-publish/1'; request_id: string; review_hash: string; request_hash: string; result_hash: string }
}
export type CoachCycleCommitV2Status = CoachCycleAuthorizationV2 & {
  contract: 'coach-cycle-status/2'; request_id: string
} & ({ status: 'not_found' } | { status: 'committed'; receipt: CoachCycleCommitV2Receipt })
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000'
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const integer = (v: unknown, minimum: number): v is number => Number.isSafeInteger(v) && Number(v) >= minimum
export function isCoachCycleCommitV2Input(operation: CoachCycleCommitV2Operation, v: unknown): v is CoachCycleCommitV2Input | CoachCycleCommitV2StatusInput {
  if (operation !== 'commit' && operation !== 'status') return false
  if (!exact(v, ['gym','athlete','request_id', ...(operation === 'commit' ? ['draft','expected_revision','expected_admission_version','expected_review_hash','expected_current_assignment'] : [])])
    || !uuid(v.gym) || !uuid(v.athlete) || !uuid(v.request_id)) return false
  return operation === 'status' || uuid(v.draft) && integer(v.expected_revision, 1) && integer(v.expected_admission_version, 1) && hash(v.expected_review_hash) && (v.expected_current_assignment === null || uuid(v.expected_current_assignment))
}
const receiptKeys = ['contract','contract_version','request_id','request_hash','draft_id','draft_revision','source_hash','review_hash','compiler_version','compiled_hash','coverage_hash','projection_version','projection_hash','admission_id','admission_version','program_id','assignment_id','builder_version','release_id','immutable_revision_id','immutable_revision_number','immutable_revision_hash','destination_hash_at_commit','internal_execution','local_only','publication_authorized']
function receipt(v: unknown): v is CoachCycleCommitV2Receipt {
  if (!exact(v, [...receiptKeys, ...authorizationV2Keys(v)]) || v.contract !== 'coach-cycle-sql-publish/2' || v.contract_version !== 2 || v.compiler_version !== 'coach-cycle-sql/1' || v.projection_version !== 'coach-cycle-detail/2'
    || ![v.request_id,v.draft_id,v.admission_id,v.program_id,v.assignment_id,v.release_id,v.immutable_revision_id].every(uuid)
    || ![v.request_hash,v.source_hash,v.review_hash,v.compiled_hash,v.coverage_hash,v.projection_hash,v.immutable_revision_hash,v.destination_hash_at_commit].every(hash)
    || !integer(v.draft_revision, 1) || !integer(v.admission_version, 1) || !integer(v.builder_version, 0) || !integer(v.immutable_revision_number, 1)
    || !isCoachCycleAuthorizationV2(v)) return false
  const i = v.internal_execution
  return exact(i, ['contract','request_id','review_hash','request_hash','result_hash']) && i.contract === 'coach-cycle-sql-publish/1' && i.request_id === v.request_id && [i.review_hash,i.request_hash,i.result_hash].every(hash)
}
export function isCoachCycleCommitV2Receipt(v: unknown, input: CoachCycleCommitV2Input, reviewed?: CoachCyclePreviewV2Summary): v is CoachCycleCommitV2Receipt {
  if (!isCoachCycleCommitV2Input('commit', input) || !receipt(v) || v.request_id !== input.request_id || v.draft_id !== input.draft || v.draft_revision !== input.expected_revision
    || v.review_hash !== input.expected_review_hash || v.admission_version !== input.expected_admission_version) return false
  return !reviewed || isCoachCyclePreviewV2Summary(reviewed, input) && reviewed.review_hash === input.expected_review_hash && reviewed.expected_current_assignment === input.expected_current_assignment
    && sameCoachCycleAuthorizationV2(v, reviewed) && v.source_hash === reviewed.source_hash && v.compiled_hash === reviewed.compiled_hash && v.coverage_hash === reviewed.coverage_hash && v.projection_hash === reviewed.projection_hash && v.admission_id === reviewed.admission_id
}
export function isCoachCycleCommitV2Status(v: unknown, input: CoachCycleCommitV2StatusInput, expected?: CoachCycleCommitV2Input): v is CoachCycleCommitV2Status {
  if (!isCoachCycleCommitV2Input('status', input) || !object(v) || !exact(v, ['contract','request_id','status','local_only','publication_authorized', ...(v.status === 'committed' ? ['receipt'] : []), ...authorizationV2Keys(v)])
    || v.contract !== 'coach-cycle-status/2' || v.request_id !== input.request_id || !isCoachCycleAuthorizationV2(v)
    || expected && (!isCoachCycleCommitV2Input('commit', expected) || expected.request_id !== input.request_id || expected.gym !== input.gym || expected.athlete !== input.athlete)) return false
  if (v.status === 'not_found') return true
  return v.status === 'committed' && receipt(v.receipt) && sameCoachCycleAuthorizationV2(v as CoachCycleCommitV2Status, v.receipt) && v.receipt.request_id === input.request_id && (!expected || isCoachCycleCommitV2Receipt(v.receipt, expected))
}
export const COACH_CYCLE_COMMIT_V2_CONFLICTS = ['cycle_commit_request_reused','cycle_commit_review_stale','cycle_commit_compile_changed','cycle_commit_receipt_integrity','cycle_pilot_draft_stale','cycle_pilot_version_stale','cycle_publish_request_reused','cycle_publish_revision_stale','cycle_publish_source_integrity','cycle_publish_destination_changed','cycle_publish_revision_already_published','cycle_publish_review_stale'] as const
export const COACH_CYCLE_COMMIT_V2_BLOCKS = ['cycle_commit_input_invalid', ...COACH_CYCLE_PREVIEW_V2_BLOCKS] as const
export type CoachCycleCommitV2ErrorCode = 'ambiguous' | 'blocked' | 'conflict' | 'retryable' | 'session_expired' | 'access_denied' | 'not_found' | 'unavailable' | 'network' | 'invalid'
export class CoachCycleCommitV2Error extends Error {
  readonly pendingInput?: Readonly<CoachCycleCommitV2Input>
  readonly recoveryInput?: Readonly<CoachCycleCommitV2StatusInput>
  readonly outcome: 'unknown' | undefined
  constructor(readonly code: CoachCycleCommitV2ErrorCode, readonly reason?: string, pendingInput?: CoachCycleCommitV2Input) {
    super({ ambiguous: 'The commit outcome is unknown. Check historical status with this same request ID before starting another commit.', blocked: 'This saved cycle cannot be committed. Check its prescriptions and size.', conflict: 'The cycle or pilot authority changed. Check historical status for a prior attempt before reviewing again.', retryable: 'This request is busy. Check its status or retry the identical input.', session_expired: 'Sign in again before checking this cycle request.', access_denied: 'You no longer have access to this cycle request.', not_found: 'This cycle commit service is unavailable.', unavailable: 'Cycle commit is unavailable.', network: 'The cycle request could not be completed.', invalid: 'Check the cycle commit request.' }[code])
    this.name = 'CoachCycleCommitV2Error'
    if (pendingInput) {
      this.pendingInput = Object.freeze({ ...pendingInput })
      this.recoveryInput = Object.freeze({ gym: pendingInput.gym, athlete: pendingInput.athlete, request_id: pendingInput.request_id })
    }
    this.outcome = pendingInput ? 'unknown' : undefined
  }
}
export function createCoachCycleCommitV2Api(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; getOwnerSubject?(): string | null; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) { let url: URL; try { url = new URL(base) } catch { throw new CoachCycleCommitV2Error('invalid') }; if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachCycleCommitV2Error('invalid') }
  const discard = async (response: Response) => { try { await response.body?.cancel() } catch { /* Preserve the caller's recoverable outcome. */ } }
  const expire = (token: string | null) => { try { options.onSessionExpired?.(token) } catch { /* Preserve the request outcome even if local session cleanup fails. */ } }
  async function post(operation: CoachCycleCommitV2Operation, input: CoachCycleCommitV2Input | CoachCycleCommitV2StatusInput, context?: CoachCyclePreviewV2Summary | CoachCycleCommitV2Input): Promise<CoachCycleCommitV2Receipt | CoachCycleCommitV2Status> {
    const ownerAtStart = options.getOwnerSubject?.()
    if (options.getOwnerSubject && !uuid(ownerAtStart)) throw new CoachCycleCommitV2Error('session_expired')
    let body: string, snapshot: unknown, reviewed: CoachCyclePreviewV2Summary | undefined, expected: CoachCycleCommitV2Input | undefined
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachCycleCommitV2Error('invalid') }
    if (!isCoachCycleCommitV2Input(operation, snapshot) || new TextEncoder().encode(body).byteLength > COACH_CYCLE_COMMIT_V2_REQUEST_MAX_BYTES) throw new CoachCycleCommitV2Error('invalid')
    if (context !== undefined) {
      let saved: unknown; try { saved = JSON.parse(JSON.stringify(context)) } catch { throw new CoachCycleCommitV2Error('invalid') }
      if (operation === 'commit') {
        const commit = snapshot as CoachCycleCommitV2Input, owner = options.getOwnerSubject?.()
        if (options.getOwnerSubject && !uuid(owner)) throw new CoachCycleCommitV2Error('session_expired')
        if (!isCoachCyclePreviewV2Summary(saved, commit, owner ?? undefined) || saved.review_hash !== commit.expected_review_hash || saved.expected_current_assignment !== commit.expected_current_assignment) throw new CoachCycleCommitV2Error('invalid')
        reviewed = saved
      } else {
        const status = snapshot as CoachCycleCommitV2StatusInput
        if (!isCoachCycleCommitV2Input('commit', saved) || saved.request_id !== status.request_id || saved.gym !== status.gym || saved.athlete !== status.athlete) throw new CoachCycleCommitV2Error('invalid')
        expected = saved as CoachCycleCommitV2Input
      }
    }
    let token: string | null
    try { token = await options.getAccessToken() } catch { throw new CoachCycleCommitV2Error('network') }
    if (!token) { expire(null); throw new CoachCycleCommitV2Error('session_expired') }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachCycleCommitV2Error('session_expired')
    if (options.getOwnerSubject && options.getOwnerSubject() !== ownerAtStart) throw new CoachCycleCommitV2Error('session_expired')
    const pending = operation === 'commit' ? snapshot as CoachCycleCommitV2Input : undefined
    const fail = (code: CoachCycleCommitV2ErrorCode, reason?: string) => new CoachCycleCommitV2Error(code, reason, pending)
    let response: Response
    try { response = await (options.request ?? fetch)(`${base}${COACH_CYCLE_COMMIT_V2_PATHS[operation]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body }) } catch { throw fail(pending ? 'ambiguous' : 'network') }
    if (response.status === 401) { await discard(response); expire(token); throw fail('session_expired') }
    let value: unknown
    try {
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await discard(response); throw new Error() }
      value = await readCoachCycleDraftJson(response, response.ok ? COACH_CYCLE_COMMIT_V2_RESPONSE_MAX_BYTES : COACH_CYCLE_COMMIT_V2_ERROR_MAX_BYTES)
    } catch { throw fail(pending ? 'ambiguous' : 'network') }
    if (!response.ok) {
      if (exact(value, ['error']) && value.error === 'serialization_retry' && response.status === 409) throw fail('retryable')
      if (exact(value, ['error']) && COACH_CYCLE_COMMIT_V2_CONFLICTS.some(reason => reason === value.error) && response.status === 409) throw fail('conflict', value.error as string)
      if (exact(value, ['error','reason']) && value.error === 'cycle_commit_blocked' && COACH_CYCLE_COMMIT_V2_BLOCKS.some(reason => reason === value.reason) && response.status === 422) throw fail('blocked', value.reason as string)
      throw fail(response.status === 403 ? 'access_denied' : response.status === 404 ? 'not_found' : response.status === 503 ? 'unavailable' : response.status >= 500 ? pending ? 'ambiguous' : 'network' : 'invalid')
    }
    if (options.getOwnerSubject && options.getOwnerSubject() !== ownerAtStart) throw fail('session_expired')
    if (operation === 'commit' ? !isCoachCycleCommitV2Receipt(value, snapshot as CoachCycleCommitV2Input, reviewed) : !isCoachCycleCommitV2Status(value, snapshot as CoachCycleCommitV2StatusInput, expected)) throw fail(pending ? 'ambiguous' : 'network')
    return value as CoachCycleCommitV2Receipt | CoachCycleCommitV2Status
  }
  return {
    commit: async (input: CoachCycleCommitV2Input, reviewed?: CoachCyclePreviewV2Summary) => await post('commit', input, reviewed) as CoachCycleCommitV2Receipt,
    status: async (input: CoachCycleCommitV2StatusInput, expected?: CoachCycleCommitV2Input) => await post('status', input, expected) as CoachCycleCommitV2Status,
  }
}
