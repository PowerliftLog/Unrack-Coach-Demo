// Local preparation only: these RPCs have no hosted grants or route enrollment.
// SQL owns identity/scope. Templates contain literal reusable authoring only.
import { readCoachCycleDraftJson, CoachCycleDraftLimitError } from './coach-cycle-draft-api'
// Keep the Worker contract independent of the FortuneSheet editor module.
export type CoachCycleTemplateSnapshot = {
  format: 'unrack-cycle-template-v1'; name: string; weeks: number; unit: 'lb' | 'kg';
  days: { name: string; exercises: { name: string; weeks: { prescription: string; instructions: string }[] }[] }[]
}
export { readCoachCycleDraftJson as readCoachCycleTemplateJson, CoachCycleDraftLimitError as CoachCycleTemplateLimitError }
export const COACH_CYCLE_TEMPLATE_PATHS = {
  create: '/api/coach-cycle-template-create-v1', read: '/api/coach-cycle-template-read-v1',
  list: '/api/coach-cycle-template-list-v1', delete: '/api/coach-cycle-template-delete-v1',
} as const
export type CoachCycleTemplateOperation = keyof typeof COACH_CYCLE_TEMPLATE_PATHS
export const COACH_CYCLE_TEMPLATE_SNAPSHOT_MAX_BYTES = 2 * 1024 * 1024
export const COACH_CYCLE_TEMPLATE_REQUEST_MAX_BYTES = 2048
export const COACH_CYCLE_TEMPLATE_READ_MAX_BYTES = COACH_CYCLE_TEMPLATE_SNAPSHOT_MAX_BYTES + 4096
// A name can occupy the entire snapshot budget. Bound lists independently.
export const COACH_CYCLE_TEMPLATE_LIST_MAX_BYTES = COACH_CYCLE_TEMPLATE_SNAPSHOT_MAX_BYTES + 64 * 1024
export const COACH_CYCLE_TEMPLATE_RECEIPT_MAX_BYTES = 2048
export const COACH_CYCLE_TEMPLATE_ERROR_MAX_BYTES = 4096
export type CoachCycleTemplateScope = { gym: string }
export type CoachCycleTemplateReadInput = CoachCycleTemplateScope & { template: string }
export type CoachCycleTemplateListInput = CoachCycleTemplateScope & { page_limit: number }
export type CoachCycleTemplateCreateInput = CoachCycleTemplateReadInput & {
  request_id: string; athlete: string; draft: string; expected_revision: number; expected_source_hash: string
}
export type CoachCycleTemplateDeleteInput = CoachCycleTemplateReadInput & { request_id: string; expected_revision: 1 }
export type CoachCycleTemplateInput = CoachCycleTemplateCreateInput | CoachCycleTemplateReadInput | CoachCycleTemplateListInput | CoachCycleTemplateDeleteInput
export type CoachCycleTemplateSummary = {
  template_id: string; gym_id: string; revision: 1; snapshot_hash: string;
  name: string; created_at: string; publishable: false
}
export type CoachCycleTemplateRecord = Omit<CoachCycleTemplateSummary, 'name'> & { snapshot: CoachCycleTemplateSnapshot }
// Receipts describe the original idempotent operation, including after deletion.
export type CoachCycleTemplateCreateReceipt = Omit<CoachCycleTemplateSummary, 'name'> & { deleted: false }
export type CoachCycleTemplateDeleteReceipt = { template_id: string; gym_id: string; revision: 2; deleted: true; publishable: false }
export type CoachCycleTemplateResult = CoachCycleTemplateRecord | CoachCycleTemplateSummary[] | CoachCycleTemplateCreateReceipt | CoachCycleTemplateDeleteReceipt
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).byteLength
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
// Deliberately standalone: importing the template editor at runtime would pull
// Fortune/React into the Worker. This checks every semantic field and key.
export function isCoachCycleTemplateSnapshot(v: unknown): v is CoachCycleTemplateSnapshot {
  try {
    if (!object(v) || !exact(v, ['format', 'name', 'weeks', 'unit', 'days']) || v.format !== 'unrack-cycle-template-v1'
      || typeof v.name !== 'string' || !v.name.trim() || v.name !== v.name.trim() || [...v.name].length > 120
      || /[\u0000-\u001f\u007f-\u009f]/.test(v.name) || !integer(v.weeks, 1, 16) || (v.unit !== 'lb' && v.unit !== 'kg')
      || !Array.isArray(v.days) || v.days.length < 1 || v.days.length > 7) return false
    const seen = new Set<string>()
    for (const day of v.days) {
      if (!object(day) || !exact(day, ['name', 'exercises']) || typeof day.name !== 'string' || !weekdays.includes(day.name) || seen.has(day.name)
        || !Array.isArray(day.exercises) || day.exercises.length < 1 || day.exercises.length > 20) return false
      seen.add(day.name)
      for (const exercise of day.exercises) {
        if (!object(exercise) || !exact(exercise, ['name', 'weeks']) || typeof exercise.name !== 'string'
          || !Array.isArray(exercise.weeks) || exercise.weeks.length !== v.weeks) return false
        for (const week of exercise.weeks) if (!object(week) || !exact(week, ['prescription', 'instructions'])
          || typeof week.prescription !== 'string' || typeof week.instructions !== 'string') return false
      }
    }
    return bytes(v) <= COACH_CYCLE_TEMPLATE_SNAPSHOT_MAX_BYTES
  } catch { return false }
}
export function isCoachCycleTemplateInput(operation: CoachCycleTemplateOperation, v: unknown): v is CoachCycleTemplateInput {
  if (!object(v) || !uuid(v.gym)) return false
  if (operation === 'list') return exact(v, ['gym', 'page_limit']) && integer(v.page_limit, 1, 100)
  if (!uuid(v.template)) return false
  if (operation === 'read') return exact(v, ['gym', 'template'])
  if (operation === 'delete') return exact(v, ['gym', 'template', 'request_id', 'expected_revision']) && uuid(v.request_id) && v.expected_revision === 1
  return operation === 'create' && exact(v, ['gym', 'template', 'request_id', 'athlete', 'draft', 'expected_revision', 'expected_source_hash'])
    && uuid(v.request_id) && uuid(v.athlete) && uuid(v.draft) && integer(v.expected_revision, 1) && hash(v.expected_source_hash)
}
const commonKeys = ['template_id', 'gym_id', 'revision', 'snapshot_hash', 'created_at', 'publishable']
function common(v: Record<string, unknown>, scope: CoachCycleTemplateScope): boolean {
  return uuid(v.template_id) && v.gym_id === scope.gym && v.revision === 1 && hash(v.snapshot_hash) && v.publishable === false
    && typeof v.created_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v.created_at) && Number.isFinite(Date.parse(v.created_at))
}
export function isCoachCycleTemplateResult(operation: CoachCycleTemplateOperation, v: unknown, input: CoachCycleTemplateInput): v is CoachCycleTemplateResult {
  if (!isCoachCycleTemplateInput(operation, input)) return false
  if (operation === 'list') {
    const list = input as CoachCycleTemplateListInput
    return Array.isArray(v) && v.length <= list.page_limit && new Set(v.map(item => object(item) ? item.template_id : null)).size === v.length
      && v.every(item => object(item) && exact(item, [...commonKeys, 'name']) && common(item, list)
        && typeof item.name === 'string' && !!item.name.trim() && item.name === item.name.trim() && [...item.name].length <= 120
        && !/[\u0000-\u001f\u007f-\u009f]/.test(item.name))
  }
  if (!object(v) || !('template' in input) || v.template_id !== input.template || v.gym_id !== input.gym || v.publishable !== false) return false
  if (operation === 'delete') return exact(v, ['template_id', 'gym_id', 'revision', 'deleted', 'publishable']) && v.revision === 2 && v.deleted === true
  if (!common(v, input)) return false
  if (operation === 'create') return exact(v, [...commonKeys, 'deleted']) && v.deleted === false
  return operation === 'read' && exact(v, [...commonKeys, 'snapshot']) && isCoachCycleTemplateSnapshot(v.snapshot)
}
export const coachCycleTemplateResponseMaxBytes = (operation: CoachCycleTemplateOperation) => operation === 'read' ? COACH_CYCLE_TEMPLATE_READ_MAX_BYTES : operation === 'list' ? COACH_CYCLE_TEMPLATE_LIST_MAX_BYTES : COACH_CYCLE_TEMPLATE_RECEIPT_MAX_BYTES
export type CoachCycleTemplateErrorCode = 'unavailable' | 'session_expired' | 'access_denied' | 'not_found' | 'source_conflict' | 'revision_conflict' | 'request_reused' | 'exists' | 'retryable' | 'invalid' | 'network'
export class CoachCycleTemplateError extends Error {
  constructor(readonly code: CoachCycleTemplateErrorCode) {
    super({ unavailable: 'Private cycle templates are unavailable.', session_expired: 'Sign in again to access templates.', access_denied: 'You no longer have access to these templates.', not_found: 'This private cycle template was not found.', source_conflict: 'The source draft changed. Reopen it before creating a template.', revision_conflict: 'This template changed. Reopen it before deleting.', request_reused: 'This request ID was already used for another action.', exists: 'This template ID already exists.', retryable: 'Retry the same request after the concurrent change finishes.', invalid: 'Check the template request and try again.', network: 'The private template request could not be completed.' }[code])
    this.name = 'CoachCycleTemplateError'
  }
}
export function createCoachCycleTemplateApi(options: { enabled?: boolean; baseUrl?: string; getAccessToken(): Promise<string | null>; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) {
    let url: URL
    try { url = new URL(base) } catch { throw new CoachCycleTemplateError('invalid') }
    if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachCycleTemplateError('invalid')
  }
  async function post(operation: CoachCycleTemplateOperation, input: CoachCycleTemplateInput): Promise<CoachCycleTemplateResult> {
    if (options.enabled !== true) throw new CoachCycleTemplateError('unavailable')
    let snapshot: unknown, body: string
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachCycleTemplateError('invalid') }
    if (!isCoachCycleTemplateInput(operation, snapshot) || new TextEncoder().encode(body).byteLength > COACH_CYCLE_TEMPLATE_REQUEST_MAX_BYTES) throw new CoachCycleTemplateError('invalid')
    const token = await options.getAccessToken()
    if (!token) { options.onSessionExpired?.(null); throw new CoachCycleTemplateError('session_expired') }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachCycleTemplateError('session_expired')
    let response: Response
    try { response = await (options.request ?? fetch)(`${base}${COACH_CYCLE_TEMPLATE_PATHS[operation]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body }) }
    catch { throw new CoachCycleTemplateError('network') }
    if (response.status === 401) { await response.body?.cancel(); options.onSessionExpired?.(token); throw new CoachCycleTemplateError('session_expired') }
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await response.body?.cancel(); throw new CoachCycleTemplateError('network') }
    let value: unknown
    try { value = await readCoachCycleDraftJson(response, response.ok ? coachCycleTemplateResponseMaxBytes(operation) : COACH_CYCLE_TEMPLATE_ERROR_MAX_BYTES) } catch { throw new CoachCycleTemplateError('network') }
    if (!response.ok) {
      const error = object(value) && exact(value, ['error']) ? value.error : null
      if (response.status === 403) throw new CoachCycleTemplateError('access_denied')
      if (response.status === 404 && error === 'not_found') throw new CoachCycleTemplateError('not_found')
      if (response.status === 409) {
        const codes = { cycle_template_source_conflict: 'source_conflict', cycle_template_revision_conflict: 'revision_conflict', cycle_template_request_reused: 'request_reused', cycle_template_exists: 'exists', serialization_retry: 'retryable' } as const
        if (typeof error === 'string' && Object.hasOwn(codes, error)) throw new CoachCycleTemplateError(codes[error as keyof typeof codes])
      }
      throw new CoachCycleTemplateError(response.status === 503 ? 'unavailable' : response.status >= 500 ? 'network' : 'invalid')
    }
    if (!isCoachCycleTemplateResult(operation, value, snapshot)) throw new CoachCycleTemplateError('network')
    return value
  }
  return {
    create: async (input: CoachCycleTemplateCreateInput) => await post('create', input) as CoachCycleTemplateCreateReceipt,
    read: async (input: CoachCycleTemplateReadInput) => await post('read', input) as CoachCycleTemplateRecord,
    list: async (input: CoachCycleTemplateListInput) => await post('list', input) as CoachCycleTemplateSummary[],
    delete: async (input: CoachCycleTemplateDeleteInput) => await post('delete', input) as CoachCycleTemplateDeleteReceipt,
  }
}
