// Local preparation only. This API stores private generated-cycle source; every
// result must explicitly deny publication. It never calls historical sheet APIs.
export const COACH_CYCLE_DRAFT_PATHS = {
  save: '/api/coach-cycle-draft-save-v1', read: '/api/coach-cycle-draft-read-v1',
  list: '/api/coach-cycle-draft-list-v1', delete: '/api/coach-cycle-draft-delete-v1',
} as const
export type CoachCycleDraftOperation = keyof typeof COACH_CYCLE_DRAFT_PATHS
export const COACH_CYCLE_DRAFT_SOURCE_MAX_BYTES = 2 * 1024 * 1024
export const COACH_CYCLE_DRAFT_REQUEST_MAX_BYTES = COACH_CYCLE_DRAFT_SOURCE_MAX_BYTES + 2048
export const COACH_CYCLE_DRAFT_READ_MAX_BYTES = COACH_CYCLE_DRAFT_SOURCE_MAX_BYTES + 4096
export const COACH_CYCLE_DRAFT_LIST_MAX_BYTES = 64 * 1024
export const COACH_CYCLE_DRAFT_RECEIPT_MAX_BYTES = 2048
export const COACH_CYCLE_DRAFT_ERROR_MAX_BYTES = 4096
export type CoachCycleDraftSource = {
  format: 'unrack-generated-cycle-v1'
  intake: { client: string; name: string; weeks: number; days: string[]; start: string; unit: 'lb' | 'kg' }
  counts: Record<string, number>; blockIds: Record<string, string[]>; sheets: unknown[]
  /** Weeks (2+) where a block names a different exercise, keyed by block ID. Omitted when unused. */
  switches?: Record<string, number[]>
}
export type CoachCycleDraftScope = { gym: string; athlete: string }
export type CoachCycleDraftReadInput = CoachCycleDraftScope & { draft: string }
export type CoachCycleDraftListInput = CoachCycleDraftScope & { page_limit: number }
export type CoachCycleDraftDeleteInput = CoachCycleDraftReadInput & { request_id: string; expected_revision: number }
export type CoachCycleDraftSaveInput = CoachCycleDraftDeleteInput & { source: CoachCycleDraftSource }
export type CoachCycleDraftInput = CoachCycleDraftReadInput | CoachCycleDraftListInput | CoachCycleDraftDeleteInput | CoachCycleDraftSaveInput
export type CoachCycleDraftSummary = {
  draft_id: string; gym_id: string; athlete_id: string; revision: number;
  source_hash: string; updated_at: string; publishable: false
}
/** completed_workouts (planned, not served yet): for a running program, the workouts already done. */
export type CoachCycleDraftRecord = CoachCycleDraftSummary & { source: CoachCycleDraftSource; completed_workouts?: { day: string; week: number }[] }
// A receipt describes the original request, including on replay. Explicitly read
// current state after saving; a historic save receipt can survive deletion.
export type CoachCycleDraftSaveReceipt = CoachCycleDraftSummary & { deleted: false }
export type CoachCycleDraftDeleteReceipt = {
  draft_id: string; gym_id: string; athlete_id: string; revision: number; deleted: true; publishable: false
}
export type CoachCycleDraftResult = CoachCycleDraftRecord | CoachCycleDraftSummary[] | CoachCycleDraftSaveReceipt | CoachCycleDraftDeleteReceipt
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).byteLength
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
function jsonValue(v: unknown, depth = 0): boolean {
  if (depth > 64) return false
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true
  if (typeof v === 'number') return Number.isFinite(v)
  if (Array.isArray(v)) return v.every(item => jsonValue(item, depth + 1))
  return object(v) && Object.getPrototypeOf(v) === Object.prototype && Object.values(v).every(item => jsonValue(item, depth + 1))
}
export function isCoachCycleDraftSource(v: unknown): v is CoachCycleDraftSource {
  try {
    if (!object(v) || !exact(v, ['format', 'intake', 'counts', 'blockIds', 'sheets', ...(Object.hasOwn(v, 'switches') ? ['switches'] : [])]) || v.format !== 'unrack-generated-cycle-v1'
      || !jsonValue(v) || bytes(v) > COACH_CYCLE_DRAFT_SOURCE_MAX_BYTES) return false
    const i = v.intake, counts = v.counts, ids = v.blockIds
    if (!object(i) || !exact(i, ['client', 'name', 'weeks', 'days', 'start', 'unit']) || typeof i.client !== 'string'
      || typeof i.name !== 'string' || typeof i.start !== 'string' || !['lb', 'kg'].includes(String(i.unit)) || !integer(i.weeks, 1, 16)
      || !Array.isArray(i.days) || i.days.length < 1 || i.days.length > 7 || new Set(i.days).size !== i.days.length
      || !i.days.every(day => typeof day === 'string' && weekdays.includes(day)) || !object(counts) || !object(ids)
      || !exact(counts, i.days) || !exact(ids, i.days) || !Array.isArray(v.sheets) || v.sheets.length !== 1) return false
    const seen = new Set<string>(); let maximum = 0
    for (const day of i.days as string[]) {
      const count = counts[day], blocks = ids[day]
      if (!integer(count, 1, 20) || !Array.isArray(blocks) || blocks.length !== count) return false
      maximum = Math.max(maximum, count)
      for (const id of blocks) { if (!uuid(id) || seen.has(id)) return false; seen.add(id) }
    }
    if (Object.hasOwn(v, 'switches')) {
      const switches = v.switches
      if (!object(switches) || !Object.keys(switches).length) return false
      for (const [id, weeks] of Object.entries(switches)) {
        if (!seen.has(id) || !Array.isArray(weeks) || !weeks.length || weeks.some((week, index) => !integer(week, 2, i.weeks as number) || index > 0 && week <= (weeks[index - 1] as number))) return false
      }
    }
    const sheet = v.sheets[0]
    return object(sheet) && sheet.id === 'cycle' && sheet.row === 1 + maximum * (i.weeks + 1)
      && sheet.column === i.days.length * 5 - 1 && (Array.isArray(sheet.celldata) || Array.isArray(sheet.data))
  } catch { return false }
}
export function isCoachCycleDraftInput(operation: CoachCycleDraftOperation, v: unknown): v is CoachCycleDraftInput {
  if (!object(v) || !uuid(v.gym) || !uuid(v.athlete)) return false
  if (operation === 'list') return exact(v, ['gym', 'athlete', 'page_limit']) && integer(v.page_limit, 1, 100)
  if (!uuid(v.draft)) return false
  if (operation === 'read') return exact(v, ['gym', 'athlete', 'draft'])
  return exact(v, ['gym', 'athlete', 'draft', 'request_id', 'expected_revision', ...(operation === 'save' ? ['source'] : [])])
    && uuid(v.request_id) && integer(v.expected_revision, operation === 'save' ? 0 : 1, Number.MAX_SAFE_INTEGER - 1)
    && (operation !== 'save' || isCoachCycleDraftSource(v.source))
}
const summaryKeys = ['draft_id', 'gym_id', 'athlete_id', 'revision', 'source_hash', 'updated_at', 'publishable']
function summary(v: Record<string, unknown>, scope: CoachCycleDraftScope): boolean {
  return uuid(v.draft_id) && v.gym_id === scope.gym && v.athlete_id === scope.athlete && integer(v.revision, 1)
    && typeof v.source_hash === 'string' && /^[a-f0-9]{64}$/.test(v.source_hash) && v.publishable === false
    && typeof v.updated_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v.updated_at) && Number.isFinite(Date.parse(v.updated_at))
}
export function isCoachCycleDraftResult(operation: CoachCycleDraftOperation, v: unknown, input: CoachCycleDraftInput): v is CoachCycleDraftResult {
  if (operation === 'list') {
    const list = input as CoachCycleDraftListInput
    return Array.isArray(v) && v.length <= list.page_limit && new Set(v.map(item => object(item) ? item.draft_id : null)).size === v.length
      && v.every(item => object(item) && exact(item, summaryKeys) && summary(item, list))
  }
  if (!object(v) || !('draft' in input) || v.draft_id !== input.draft || v.gym_id !== input.gym || v.athlete_id !== input.athlete || v.publishable !== false) return false
  if (operation === 'delete') return exact(v, ['draft_id', 'gym_id', 'athlete_id', 'revision', 'deleted', 'publishable'])
    && 'expected_revision' in input && v.revision === input.expected_revision + 1 && v.deleted === true
  if (!summary(v, input)) return false
  if (operation === 'save') return exact(v, [...summaryKeys, 'deleted']) && v.deleted === false
    && 'expected_revision' in input && v.revision === input.expected_revision + 1
  return exact(v, [...summaryKeys, 'source']) && isCoachCycleDraftSource(v.source)
}
export const coachCycleDraftResponseMaxBytes = (operation: CoachCycleDraftOperation) => operation === 'read' ? COACH_CYCLE_DRAFT_READ_MAX_BYTES : operation === 'list' ? COACH_CYCLE_DRAFT_LIST_MAX_BYTES : COACH_CYCLE_DRAFT_RECEIPT_MAX_BYTES

export class CoachCycleDraftLimitError extends Error {}
// Bound actual streamed bytes as well as the untrusted Content-Length header.
export async function readCoachCycleDraftJson(response: Response, maximum: number): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) { await response.body?.cancel(); throw new CoachCycleDraftLimitError() }
  if (!response.body) throw new Error('Missing JSON')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break
      size += next.value.byteLength
      if (size > maximum) { await reader.cancel(); throw new CoachCycleDraftLimitError() }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const buffer = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
}
export type CoachCycleDraftErrorCode = 'unavailable' | 'session_expired' | 'access_denied' | 'not_found' | 'revision_conflict' | 'request_reused' | 'deleted' | 'retryable' | 'invalid' | 'network'
export class CoachCycleDraftError extends Error {
  constructor(readonly code: CoachCycleDraftErrorCode) {
    super({ unavailable: 'Private cycle drafts are unavailable.', session_expired: 'Sign in again to access this draft.', access_denied: 'You no longer have access to this client draft.', not_found: 'This private cycle draft was not found.', revision_conflict: 'This draft changed. Reopen it before saving again.', request_reused: 'This request ID was already used for another action.', deleted: 'This draft was deleted.', retryable: 'Retry the same request after the concurrent change finishes.', invalid: 'Check the private draft and try again.', network: 'The private draft request could not be completed.' }[code])
    this.name = 'CoachCycleDraftError'
  }
}
export function createCoachCycleDraftApi(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) {
    let url: URL
    try { url = new URL(base) } catch { throw new CoachCycleDraftError('invalid') }
    if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachCycleDraftError('invalid')
  }
  async function post(operation: CoachCycleDraftOperation, input: CoachCycleDraftInput): Promise<CoachCycleDraftResult> {
    let snapshot: unknown, body: string
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachCycleDraftError('invalid') }
    if (!isCoachCycleDraftInput(operation, snapshot) || new TextEncoder().encode(body).byteLength > (operation === 'save' ? COACH_CYCLE_DRAFT_REQUEST_MAX_BYTES : 2048)) throw new CoachCycleDraftError('invalid')
    const token = await options.getAccessToken()
    if (!token) { options.onSessionExpired?.(null); throw new CoachCycleDraftError('session_expired') }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachCycleDraftError('session_expired')
    let response: Response
    try { response = await (options.request ?? fetch)(`${base}${COACH_CYCLE_DRAFT_PATHS[operation]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body }) }
    catch { throw new CoachCycleDraftError('network') }
    if (response.status === 401) { await response.body?.cancel(); options.onSessionExpired?.(token); throw new CoachCycleDraftError('session_expired') }
    let value: unknown
    try { value = await readCoachCycleDraftJson(response, response.ok ? coachCycleDraftResponseMaxBytes(operation) : COACH_CYCLE_DRAFT_ERROR_MAX_BYTES) } catch { throw new CoachCycleDraftError('network') }
    if (!response.ok) {
      const error = object(value) && exact(value, ['error']) ? value.error : null
      if (response.status === 403) throw new CoachCycleDraftError('access_denied')
      if (response.status === 404 && error === 'not_found') throw new CoachCycleDraftError('not_found')
      if (response.status === 409 && error === 'cycle_draft_revision_conflict') throw new CoachCycleDraftError('revision_conflict')
      if (response.status === 409 && error === 'cycle_draft_request_reused') throw new CoachCycleDraftError('request_reused')
      if (response.status === 409 && error === 'cycle_draft_deleted') throw new CoachCycleDraftError('deleted')
      if (response.status === 409 && error === 'serialization_retry') throw new CoachCycleDraftError('retryable')
      throw new CoachCycleDraftError(response.status === 503 ? 'unavailable' : response.status >= 500 ? 'network' : 'invalid')
    }
    if (!isCoachCycleDraftResult(operation, value, snapshot)) throw new CoachCycleDraftError('network')
    return value
  }
  return {
    save: async (input: CoachCycleDraftSaveInput) => await post('save', input) as CoachCycleDraftSaveReceipt,
    read: async (input: CoachCycleDraftReadInput) => await post('read', input) as CoachCycleDraftRecord,
    list: async (input: CoachCycleDraftListInput) => await post('list', input) as CoachCycleDraftSummary[],
    delete: async (input: CoachCycleDraftDeleteInput) => await post('delete', input) as CoachCycleDraftDeleteReceipt,
  }
}
