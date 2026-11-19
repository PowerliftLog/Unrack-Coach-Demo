// Default-off authorized /2 preview; SQL alone computes the versioned review hash.
import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { isCoachExcelPreviewInput, isCoachExcelPreviewSummary, isCoachExcelPreviewPage, type CoachExcelPreviewSummary, type CoachExcelPreviewPage, type CoachExcelPreviewInput } from './coach-excel-preview-api'
import { exact, uuid, hash, integer, canonical, isCoachExcelBetaAuthorization, type CoachExcelBetaAuthorization } from './coach-excel-beta-contract'
export const COACH_EXCEL_BETA_PREVIEW_PATH = '/api/coach-excel-beta-preview-v1'
export const COACH_EXCEL_BETA_PREVIEW_REQUEST_MAX_BYTES = 2048
export const COACH_EXCEL_BETA_PREVIEW_RESPONSE_MAX_BYTES = 65536
export const COACH_EXCEL_BETA_PREVIEW_ERROR_MAX_BYTES = 4096
export type CoachExcelBetaPreviewInput = CoachExcelPreviewInput & { expected_gate_epoch: number }
export type CoachExcelBetaPreviewSummary = Omit<CoachExcelPreviewSummary, 'contract' | 'contract_version' | 'local_only' | 'publication_authorized' | 'publishable'> & {
  contract: 'coach-excel-preview/2'; contract_version: 2; local_only: false; publication_authorized: true; publishable: boolean
  authorization: CoachExcelBetaAuthorization; execution_review_hash: string; active_assignment_policy: 'refuse-active/1'; fresh_only: true
}
export type CoachExcelBetaPreviewPage = Omit<CoachExcelPreviewPage, 'contract' | 'summary' | 'local_only' | 'publication_authorized'> & {
  contract: 'coach-excel-preview-page/2'; summary: CoachExcelBetaPreviewSummary; local_only: false; publication_authorized: true
  authorization: CoachExcelBetaAuthorization; publishable: boolean
}
export function isCoachExcelBetaPreviewInput(v: unknown): v is CoachExcelBetaPreviewInput {
  if (!exact(v, ['gym','athlete','draft','expected_revision','page_index','expected_review_hash','expected_gate_epoch']) || !integer(v.expected_gate_epoch, 1)) return false
  const { expected_gate_epoch: _epoch, ...input } = v
  return isCoachExcelPreviewInput(input)
}
function executionSummary(v: CoachExcelBetaPreviewSummary): CoachExcelPreviewSummary {
  const { authorization: _authorization, execution_review_hash, active_assignment_policy: _policy, fresh_only: _fresh, ...summary } = v
  return { ...summary, contract: 'coach-excel-preview/1', contract_version: 1, review_hash: execution_review_hash, local_only: true, publication_authorized: false, publishable: false }
}
const executionInput = (input: CoachExcelBetaPreviewInput, summary: CoachExcelBetaPreviewSummary): CoachExcelPreviewInput => ({ gym: input.gym, athlete: input.athlete, draft: input.draft, expected_revision: input.expected_revision, page_index: input.page_index, expected_review_hash: summary.execution_review_hash })
export function isCoachExcelBetaPreviewSummary(v: unknown, input: CoachExcelBetaPreviewInput, owner?: string): v is CoachExcelBetaPreviewSummary {
  if (!input || !isCoachExcelBetaPreviewInput({ gym: input.gym, athlete: input.athlete, draft: input.draft, expected_revision: input.expected_revision, page_index: input.page_index, expected_review_hash: input.expected_review_hash, expected_gate_epoch: input.expected_gate_epoch }) || !v || typeof v !== 'object' || Array.isArray(v)) return false
  const s = v as CoachExcelBetaPreviewSummary
  if (s.contract !== 'coach-excel-preview/2' || s.contract_version !== 2 || s.local_only !== false || s.publication_authorized !== true
    || s.active_assignment_policy !== 'refuse-active/1' || s.fresh_only !== true || !hash(s.execution_review_hash) || !hash(s.review_hash)
    || input.expected_review_hash !== null && s.review_hash !== input.expected_review_hash || !isCoachExcelBetaAuthorization(s.authorization, input.expected_gate_epoch)) return false
  const a = s.authorization.authority
  if (a.subject !== s.owner_subject || a.coach !== s.coach_id || a.membership !== s.athlete_membership_id || a.epoch !== s.pairing_epoch
    || !isCoachExcelPreviewSummary(executionSummary(s), executionInput(input, s), owner)) return false
  return new TextEncoder().encode(JSON.stringify(s)).byteLength < 16384 && s.publishable === (s.expected_current_assignment === null && s.totals.exercises > 0)
}
export function isCoachExcelBetaPreviewPage(v: unknown, input: CoachExcelBetaPreviewInput, previous?: CoachExcelBetaPreviewSummary, owner?: string): v is CoachExcelBetaPreviewPage {
  if (!exact(v, ['contract','summary','page_index','items','authorization','local_only','publication_authorized','publishable'])
    || v.contract !== 'coach-excel-preview-page/2' || v.local_only !== false || v.publication_authorized !== true
    || !isCoachExcelBetaPreviewSummary(v.summary, input, owner) || v.publishable !== v.summary.publishable
    || canonical(v.authorization) !== canonical(v.summary.authorization) || previous && canonical(v.summary) !== canonical(previous)) return false
  return isCoachExcelPreviewPage({ contract: 'coach-excel-preview-page/1', summary: executionSummary(v.summary), page_index: v.page_index, items: v.items, local_only: true, publication_authorized: false }, executionInput(input, v.summary))
}
export const COACH_EXCEL_BETA_PREVIEW_CONFLICTS = ['EXCEL_BETA_PREVIEW_REVIEW_STALE','excel_preview_revision_stale','excel_preview_source_integrity','excel_preview_assignment_integrity','excel_preview_review_stale'] as const
export type CoachExcelBetaPreviewErrorCode = 'blocked' | 'conflict' | 'retryable' | 'session_expired' | 'access_denied' | 'unavailable' | 'network' | 'invalid'
export class CoachExcelBetaPreviewError extends Error {
  constructor(readonly code: CoachExcelBetaPreviewErrorCode) {
    super({ blocked: 'The server could not interpret this saved worksheet. Check its prescriptions, start date and size.', conflict: 'The saved cycle or current program changed. Reload the saved draft before previewing again.', retryable: 'A concurrent change interrupted preview. Try again.', session_expired: 'Sign in again before previewing this cycle.', access_denied: 'You no longer have access to this client cycle.', unavailable: 'Excel preview is unavailable. This capability remains closed.', network: 'The Excel preview could not be completed. Try again.', invalid: 'Check the Excel preview request.' }[code]); this.name = 'CoachExcelBetaPreviewError'
  }
}
export function createCoachExcelBetaPreviewApi(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; getOwnerSubject?(): string | null; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) { let url: URL; try { url = new URL(base) } catch { throw new CoachExcelBetaPreviewError('invalid') }; if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachExcelBetaPreviewError('invalid') }
  return { preview: async (input: CoachExcelBetaPreviewInput, summary?: CoachExcelBetaPreviewSummary): Promise<CoachExcelBetaPreviewPage> => {
    let body: string, snapshot: unknown, previous: CoachExcelBetaPreviewSummary | undefined
    try { body = JSON.stringify(input); snapshot = JSON.parse(body); previous = summary === undefined ? undefined : JSON.parse(JSON.stringify(summary)) } catch { throw new CoachExcelBetaPreviewError('invalid') }
    if (!isCoachExcelBetaPreviewInput(snapshot) || new TextEncoder().encode(body).byteLength > COACH_EXCEL_BETA_PREVIEW_REQUEST_MAX_BYTES) throw new CoachExcelBetaPreviewError('invalid')
    const owner = options.getOwnerSubject?.()
    if (options.getOwnerSubject && !uuid(owner)) throw new CoachExcelBetaPreviewError('session_expired')
    if (snapshot.expected_review_hash !== null && (!previous || !isCoachExcelBetaPreviewSummary(previous, snapshot, owner ?? undefined))) throw new CoachExcelBetaPreviewError('invalid')
    const token = await options.getAccessToken()
    if (!token) { options.onSessionExpired?.(null); throw new CoachExcelBetaPreviewError('session_expired') }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachExcelBetaPreviewError('session_expired')
    if (options.getOwnerSubject && options.getOwnerSubject() !== owner) throw new CoachExcelBetaPreviewError('session_expired')
    let response: Response
    try { response = await (options.request ?? fetch)(`${base}${COACH_EXCEL_BETA_PREVIEW_PATH}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body }) } catch { throw new CoachExcelBetaPreviewError('network') }
    if (response.status === 401) { await response.body?.cancel(); options.onSessionExpired?.(token); throw new CoachExcelBetaPreviewError('session_expired') }
    let value: unknown
    try {
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await response.body?.cancel(); throw new Error() }
      value = await readCoachCycleDraftJson(response, response.ok ? COACH_EXCEL_BETA_PREVIEW_RESPONSE_MAX_BYTES : COACH_EXCEL_BETA_PREVIEW_ERROR_MAX_BYTES)
    } catch { throw new CoachExcelBetaPreviewError('network') }
    if (!response.ok) {
      if (exact(value, ['error']) && response.status === 409 && value.error === 'serialization_retry') throw new CoachExcelBetaPreviewError('retryable')
      if (exact(value, ['error']) && response.status === 409 && COACH_EXCEL_BETA_PREVIEW_CONFLICTS.some(code => code === value.error)) throw new CoachExcelBetaPreviewError('conflict')
      if (exact(value, ['error']) && response.status === 422 && value.error === 'excel_preview_blocked') throw new CoachExcelBetaPreviewError('blocked')
      throw new CoachExcelBetaPreviewError(response.status === 403 ? 'access_denied' : response.status === 404 || response.status === 503 ? 'unavailable' : response.status >= 500 ? 'network' : 'invalid')
    }
    if (options.getOwnerSubject && options.getOwnerSubject() !== owner) throw new CoachExcelBetaPreviewError('session_expired')
    if (!isCoachExcelBetaPreviewPage(value, snapshot, previous, owner ?? undefined)) throw new CoachExcelBetaPreviewError('network')
    return value
  } }
}
