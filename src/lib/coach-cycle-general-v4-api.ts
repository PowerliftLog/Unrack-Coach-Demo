// Local, default-off contract for the reviewed general v4 SQL wrappers. No
// enrollment, publication, broad v1 access or two-client v3 fallback.
import { isCoachCycleDraftSource, readCoachCycleDraftJson, type CoachCycleDraftSource } from './coach-cycle-draft-api'
import { isCoachCycleTemplateSnapshot, type CoachCycleTemplateSnapshot } from './coach-cycle-template-api'

export const COACH_CYCLE_GENERAL_V4_PATHS = {
  bind: '/api/coach-cycle-general-v4-bind',
  draft_save: '/api/coach-cycle-general-v4-draft-save',
  draft_read: '/api/coach-cycle-general-v4-draft-read',
  draft_delete: '/api/coach-cycle-general-v4-draft-delete',
  template_capture: '/api/coach-cycle-general-v4-template-capture',
  template_read: '/api/coach-cycle-general-v4-template-read',
  template_delete: '/api/coach-cycle-general-v4-template-delete',
  template_apply: '/api/coach-cycle-general-v4-template-apply',
  list: '/api/coach-cycle-general-v4-list',
  status: '/api/coach-cycle-general-v4-status',
  resolve: '/api/coach-cycle-general-v4-resolve',
} as const
export type CoachCycleGeneralV4Operation = keyof typeof COACH_CYCLE_GENERAL_V4_PATHS
export const COACH_CYCLE_GENERAL_V4_MUTATIONS = ['draft_save', 'draft_delete', 'template_capture', 'template_apply', 'template_delete'] as const
export type CoachCycleGeneralV4Mutation = typeof COACH_CYCLE_GENERAL_V4_MUTATIONS[number]
export const COACH_CYCLE_GENERAL_V4_SOURCE_MAX_BYTES = 2 * 1024 * 1024
export const COACH_CYCLE_GENERAL_V4_ERROR_MAX_BYTES = 4096
export const coachCycleGeneralV4RequestMaxBytes = (operation: CoachCycleGeneralV4Operation) =>
  operation === 'draft_save' || operation === 'template_capture' ? COACH_CYCLE_GENERAL_V4_SOURCE_MAX_BYTES + 2048 : 2048
export const coachCycleGeneralV4ResponseMaxBytes = (operation: CoachCycleGeneralV4Operation) =>
  operation === 'draft_read' || operation === 'template_read' ? COACH_CYCLE_GENERAL_V4_SOURCE_MAX_BYTES + 4096
    : operation === 'list' ? 128 * 1024 : 2048

export type CoachCycleGeneralV4LibraryScope = { gym: string; library_generation: string }
export type CoachCycleGeneralV4ClientScope = CoachCycleGeneralV4LibraryScope & { athlete: string; client_generation: string }
export type CoachCycleGeneralV4BindInput = { gym: string; athlete: string }
export type CoachCycleGeneralV4DraftReadInput = CoachCycleGeneralV4ClientScope & { draft: string }
export type CoachCycleGeneralV4DraftSaveInput = CoachCycleGeneralV4ClientScope & {
  request: string; draft: string | null; expected_revision: number; source: CoachCycleDraftSource
}
export type CoachCycleGeneralV4DraftDeleteInput = CoachCycleGeneralV4DraftReadInput & { request: string; expected_revision: number }
export type CoachCycleGeneralV4TemplateCaptureInput = CoachCycleGeneralV4DraftDeleteInput & {
  expected_source_hash: string; reviewed_snapshot: CoachCycleTemplateSnapshot; reviewed_hash: string; confirmed: true
}
export type CoachCycleGeneralV4TemplateReadInput = CoachCycleGeneralV4LibraryScope & { template: string }
export type CoachCycleGeneralV4TemplateDeleteInput = CoachCycleGeneralV4TemplateReadInput & { request: string; expected_revision: 1 }
export type CoachCycleGeneralV4TemplateApplyInput = CoachCycleGeneralV4ClientScope & {
  request: string; template: string; expected_revision: 1; expected_hash: string; start: string; unit: 'lb' | 'kg'; confirmed: true
}
// The first coordinate is server-derived owner scope. It is opaque to the
// transport; SQL compares it against auth.uid(), never a caller's JWT metadata.
export type CoachCycleGeneralV4Cursor = {
  scope: [string, string, string, string | null, string | null, 'draft' | 'template']; created_at: string; id: string
}
export type CoachCycleGeneralV4ListInput = CoachCycleGeneralV4LibraryScope & { page_limit: number; cursor: CoachCycleGeneralV4Cursor | null } & (
  { kind: 'draft'; athlete: string; client_generation: string } | { kind: 'template'; athlete: null; client_generation: null }
)
export type CoachCycleGeneralV4StatusInput = CoachCycleGeneralV4LibraryScope & { request: string }
export type CoachCycleGeneralV4ResolveInput = CoachCycleGeneralV4LibraryScope & { request: string } & (
  { operation: 'template_delete'; athlete: null; client_generation: null }
  | { operation: Exclude<CoachCycleGeneralV4Mutation, 'template_delete'>; athlete: string; client_generation: string }
)
export type CoachCycleGeneralV4Input = CoachCycleGeneralV4BindInput | CoachCycleGeneralV4DraftReadInput | CoachCycleGeneralV4DraftSaveInput
  | CoachCycleGeneralV4DraftDeleteInput | CoachCycleGeneralV4TemplateCaptureInput | CoachCycleGeneralV4TemplateReadInput
  | CoachCycleGeneralV4TemplateDeleteInput | CoachCycleGeneralV4TemplateApplyInput | CoachCycleGeneralV4ListInput | CoachCycleGeneralV4StatusInput | CoachCycleGeneralV4ResolveInput
export type CoachCycleGeneralV4Binding = { gym_id: string; athlete_id: string; library_generation: string; client_generation: string }
export type CoachCycleGeneralV4BindResult = CoachCycleGeneralV4Binding & { publishable: false }
export type CoachCycleGeneralV4DraftSummary = { draft_id: string; revision: number; source_hash: string; created_at: string; updated_at: string; publishable: false }
export type CoachCycleGeneralV4DraftRecord = CoachCycleGeneralV4DraftSummary & {
  source: CoachCycleDraftSource; target_binding: CoachCycleGeneralV4Binding; requires_review: true; review: null
}
export type CoachCycleGeneralV4DraftReceipt = Omit<CoachCycleGeneralV4DraftSummary, 'created_at'> & {
  library_generation: string; client_generation: string; deleted: false; requires_review: true; review: null
}
export type CoachCycleGeneralV4ApplyReceipt = CoachCycleGeneralV4DraftReceipt & { unit_changed: boolean }
export type CoachCycleGeneralV4DraftDeleteReceipt = {
  draft_id: string; library_generation: string; client_generation: string; revision: number; deleted: true; publishable: false
}
export type CoachCycleGeneralV4TemplateReceipt = { template_id: string; revision: 1; snapshot_hash: string; reviewed_hash: string; publishable: false }
export type CoachCycleGeneralV4TemplateRecord = CoachCycleGeneralV4TemplateReceipt & { created_at: string; snapshot: CoachCycleTemplateSnapshot }
export type CoachCycleGeneralV4TemplateSummary = Omit<CoachCycleGeneralV4TemplateReceipt, 'reviewed_hash'> & { name: string; created_at: string }
export type CoachCycleGeneralV4TemplateDeleteReceipt = { template_id: string; revision: 2; deleted: true; publishable: false }
export type CoachCycleGeneralV4Receipt = CoachCycleGeneralV4DraftReceipt | CoachCycleGeneralV4ApplyReceipt | CoachCycleGeneralV4DraftDeleteReceipt
  | CoachCycleGeneralV4TemplateReceipt | CoachCycleGeneralV4TemplateDeleteReceipt
export type CoachCycleGeneralV4ListResult = { items: CoachCycleGeneralV4DraftSummary[] | CoachCycleGeneralV4TemplateSummary[]; next_cursor: CoachCycleGeneralV4Cursor | null }
export type CoachCycleGeneralV4StatusResult = { historical: true; result: CoachCycleGeneralV4Receipt; current_object_proved: false; publishable: false }
export type CoachCycleGeneralV4ResolveResult = { request_id: string; operation: CoachCycleGeneralV4Mutation; historical: true; current_object_proved: false; publishable: false } & (
  { resolution: 'committed'; result: CoachCycleGeneralV4Receipt } | { resolution: 'cancelled'; result: null }
)
export type CoachCycleGeneralV4Result = CoachCycleGeneralV4BindResult | CoachCycleGeneralV4DraftRecord | CoachCycleGeneralV4Receipt
  | CoachCycleGeneralV4TemplateRecord | CoachCycleGeneralV4ListResult | CoachCycleGeneralV4StatusResult | CoachCycleGeneralV4ResolveResult

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
export const isCoachCycleGeneralV4Uuid = (v: unknown): v is string => typeof v === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000'
const uuid = isCoachCycleGeneralV4Uuid
const integer = (v: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const date = (v: unknown): v is string => typeof v === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)
  && v.slice(0, 4) !== '0000' && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
const timestamp = (v: unknown): v is string => typeof v === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(v) && date(v.slice(0, 10))
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 19) === v.slice(0, 19)
const title = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v === v.trim() && [...v].length <= 120 && !/[\u0000-\u001f\u007f-\u009f]/.test(v)
const libraryKeys = ['gym', 'library_generation'], clientKeys = [...libraryKeys, 'athlete', 'client_generation']
const clientScope = (v: Record<string, unknown>) => uuid(v.athlete) && uuid(v.client_generation)
function cursor(v: unknown, input: CoachCycleGeneralV4ListInput): v is CoachCycleGeneralV4Cursor {
  return object(v) && exact(v, ['scope', 'created_at', 'id']) && timestamp(v.created_at) && uuid(v.id)
    && Array.isArray(v.scope) && v.scope.length === 6 && uuid(v.scope[0]) && v.scope[1] === input.gym
    && v.scope[2] === input.library_generation && v.scope[3] === input.athlete && v.scope[4] === input.client_generation && v.scope[5] === input.kind
}
export function isCoachCycleGeneralV4Input(operation: CoachCycleGeneralV4Operation, v: unknown): v is CoachCycleGeneralV4Input {
  if (!object(v) || !uuid(v.gym)) return false
  if (operation === 'bind') return exact(v, ['gym', 'athlete']) && uuid(v.athlete)
  if (!uuid(v.library_generation)) return false
  if (operation === 'status') return exact(v, [...libraryKeys, 'request']) && uuid(v.request)
  if (operation === 'resolve') return exact(v, [...clientKeys, 'request', 'operation']) && uuid(v.request)
    && typeof v.operation === 'string' && (COACH_CYCLE_GENERAL_V4_MUTATIONS as readonly string[]).includes(v.operation)
    && (v.operation === 'template_delete' ? v.athlete === null && v.client_generation === null : clientScope(v))
  if (operation === 'list') return exact(v, [...clientKeys, 'kind', 'page_limit', 'cursor']) && integer(v.page_limit, 1, 100)
    && (v.kind === 'draft' ? clientScope(v) : v.kind === 'template' && v.athlete === null && v.client_generation === null)
    && (v.cursor === null || cursor(v.cursor, v as CoachCycleGeneralV4ListInput))
  if (operation === 'template_read') return exact(v, [...libraryKeys, 'template']) && uuid(v.template)
  if (operation === 'template_delete') return exact(v, [...libraryKeys, 'template', 'request', 'expected_revision'])
    && uuid(v.template) && uuid(v.request) && v.expected_revision === 1
  if (!clientScope(v)) return false
  if (operation === 'draft_read') return exact(v, [...clientKeys, 'draft']) && uuid(v.draft)
  if (!uuid(v.request)) return false
  if (operation === 'template_apply') return exact(v, [...clientKeys, 'request', 'template', 'expected_revision', 'expected_hash', 'start', 'unit', 'confirmed'])
    && uuid(v.template) && v.expected_revision === 1 && hash(v.expected_hash) && date(v.start) && v.start >= '2000-01-01' && v.start <= '2100-12-31'
    && (v.unit === 'lb' || v.unit === 'kg') && v.confirmed === true
  if (operation === 'draft_save') return exact(v, [...clientKeys, 'request', 'draft', 'expected_revision', 'source'])
    && integer(v.expected_revision, 0, Number.MAX_SAFE_INTEGER - 1) && (v.expected_revision === 0 ? v.draft === null : uuid(v.draft)) && isCoachCycleDraftSource(v.source)
  if (!uuid(v.draft) || !integer(v.expected_revision, 1, operation === 'draft_delete' ? Number.MAX_SAFE_INTEGER - 1 : Number.MAX_SAFE_INTEGER)) return false
  if (operation === 'draft_delete') return exact(v, [...clientKeys, 'request', 'draft', 'expected_revision'])
  return operation === 'template_capture' && exact(v, [...clientKeys, 'request', 'draft', 'expected_revision', 'expected_source_hash', 'reviewed_snapshot', 'reviewed_hash', 'confirmed'])
    && hash(v.expected_source_hash) && hash(v.reviewed_hash) && isCoachCycleTemplateSnapshot(v.reviewed_snapshot) && v.confirmed === true
}
const draftKeys = ['draft_id', 'revision', 'source_hash', 'updated_at', 'publishable']
const generationKeys = ['library_generation', 'client_generation']
const savedKeys = [...draftKeys, ...generationKeys, 'deleted', 'requires_review', 'review']
const templateKeys = ['template_id', 'revision', 'snapshot_hash', 'publishable']
const capturedKeys = [...templateKeys, 'reviewed_hash']
const bindingKeys = ['gym_id', 'athlete_id', ...generationKeys]
const draftSummary = (v: Record<string, unknown>) => uuid(v.draft_id) && integer(v.revision) && hash(v.source_hash) && timestamp(v.updated_at) && v.publishable === false
const templateSummary = (v: Record<string, unknown>) => uuid(v.template_id) && v.revision === 1 && hash(v.snapshot_hash) && v.publishable === false
const generations = (v: Record<string, unknown>) => uuid(v.library_generation) && uuid(v.client_generation)
const saved = (v: Record<string, unknown>) => draftSummary(v) && generations(v) && v.deleted === false && v.requires_review === true && v.review === null
const captured = (v: Record<string, unknown>) => templateSummary(v) && hash(v.reviewed_hash) && v.reviewed_hash === v.snapshot_hash
const binding = (v: unknown, input: CoachCycleGeneralV4ClientScope) => object(v) && exact(v, bindingKeys)
  && v.gym_id === input.gym && v.athlete_id === input.athlete && v.library_generation === input.library_generation && v.client_generation === input.client_generation
// Compare UTC microseconds without Date's millisecond truncation.
const timeKey = (v: string) => {
  const [seconds, fraction = ''] = v.replace(/(?:Z|\+00:00)$/, '').split('.')
  return `${seconds}.${fraction.padEnd(6, '0')}`
}
function listResult(v: Record<string, unknown>, input: CoachCycleGeneralV4ListInput): boolean {
  if (!exact(v, ['items', 'next_cursor']) || !Array.isArray(v.items) || v.items.length > input.page_limit) return false
  const idKey = input.kind === 'draft' ? 'draft_id' : 'template_id', seen = new Set<unknown>()
  let prior = input.cursor === null ? null : { time: timeKey(input.cursor.created_at), id: input.cursor.id }
  for (const row of v.items) {
    if (!object(row) || !timestamp(row.created_at) || seen.has(row[idKey])) return false
    if (input.kind === 'draft' ? !exact(row, [...draftKeys, 'created_at']) || !draftSummary(row)
      : !exact(row, [...templateKeys, 'created_at', 'name']) || !templateSummary(row) || !title(row.name)) return false
    const current = { time: timeKey(row.created_at), id: row[idKey] as string }
    if (prior && (current.time > prior.time || current.time === prior.time && current.id <= prior.id)) return false
    seen.add(current.id); prior = current
  }
  if (v.items.length < input.page_limit) return v.next_cursor === null
  const last = v.items[v.items.length - 1]
  return cursor(v.next_cursor, input) && v.next_cursor.id === last[idKey] && timeKey(v.next_cursor.created_at) === timeKey(last.created_at)
    && (input.cursor === null || v.next_cursor.scope[0] === input.cursor.scope[0])
}
// Historical status has no selected target and proves no current object. Permit
// only the five exact source-free mutation receipt shapes, including old client
// generations under the same current library generation (the SQL custody rule).
function historicalReceipt(v: unknown, library: string): boolean {
  if (!object(v) || v.publishable !== false) return false
  if (exact(v, capturedKeys)) return captured(v)
  if (exact(v, ['template_id', 'revision', 'deleted', 'publishable'])) return uuid(v.template_id) && v.revision === 2 && v.deleted === true
  if (v.library_generation !== library || !generations(v)) return false
  if (exact(v, ['draft_id', ...generationKeys, 'revision', 'deleted', 'publishable'])) return uuid(v.draft_id) && integer(v.revision, 2) && v.deleted === true
  if (exact(v, savedKeys)) return saved(v)
  return exact(v, [...savedKeys, 'unit_changed']) && saved(v) && v.revision === 1 && typeof v.unit_changed === 'boolean'
}
function resolvedReceipt(v: unknown, input: CoachCycleGeneralV4ResolveInput): boolean {
  if (!object(v) || v.publishable !== false) return false
  if (input.operation === 'template_capture') return exact(v, capturedKeys) && captured(v)
  if (input.operation === 'template_delete') return exact(v, ['template_id', 'revision', 'deleted', 'publishable']) && uuid(v.template_id) && v.revision === 2 && v.deleted === true
  if (v.library_generation !== input.library_generation || v.client_generation !== input.client_generation) return false
  if (input.operation === 'draft_delete') return exact(v, ['draft_id', ...generationKeys, 'revision', 'deleted', 'publishable']) && uuid(v.draft_id) && integer(v.revision, 2) && v.deleted === true
  if (input.operation === 'draft_save') return exact(v, savedKeys) && saved(v)
  return exact(v, [...savedKeys, 'unit_changed']) && saved(v) && v.revision === 1 && typeof v.unit_changed === 'boolean' && v.draft_id !== input.athlete
}
export function isCoachCycleGeneralV4Result(operation: CoachCycleGeneralV4Operation, v: unknown, input: CoachCycleGeneralV4Input): v is CoachCycleGeneralV4Result {
  if (!isCoachCycleGeneralV4Input(operation, input) || !object(v)) return false
  if (operation === 'list') return listResult(v, input as CoachCycleGeneralV4ListInput)
  if (v.publishable !== false) return false
  if (operation === 'bind') return exact(v, [...bindingKeys, 'publishable']) && v.gym_id === input.gym && 'athlete' in input && v.athlete_id === input.athlete && generations(v)
  if (operation === 'resolve') {
    const resolving = input as CoachCycleGeneralV4ResolveInput
    return exact(v, ['request_id', 'operation', 'resolution', 'historical', 'result', 'current_object_proved', 'publishable'])
      && v.request_id === resolving.request && v.operation === resolving.operation && v.historical === true && v.current_object_proved === false
      && (v.resolution === 'cancelled' ? v.result === null : v.resolution === 'committed' && resolvedReceipt(v.result, resolving))
  }
  if (operation === 'status') return exact(v, ['historical', 'result', 'current_object_proved', 'publishable']) && v.historical === true
    && v.current_object_proved === false && historicalReceipt(v.result, (input as CoachCycleGeneralV4StatusInput).library_generation)
  if (operation === 'draft_read') return exact(v, [...draftKeys, 'created_at', 'source', 'target_binding', 'requires_review', 'review']) && draftSummary(v)
    && v.draft_id === (input as CoachCycleGeneralV4DraftReadInput).draft && timestamp(v.created_at) && isCoachCycleDraftSource(v.source)
    && binding(v.target_binding, input as CoachCycleGeneralV4ClientScope) && v.requires_review === true && v.review === null
  if (operation === 'template_read') return exact(v, [...capturedKeys, 'created_at', 'snapshot']) && captured(v)
    && v.template_id === (input as CoachCycleGeneralV4TemplateReadInput).template && timestamp(v.created_at) && isCoachCycleTemplateSnapshot(v.snapshot)
  if (operation === 'template_capture') return exact(v, capturedKeys) && captured(v) && v.reviewed_hash === (input as CoachCycleGeneralV4TemplateCaptureInput).reviewed_hash
  if (operation === 'template_delete') return exact(v, ['template_id', 'revision', 'deleted', 'publishable'])
    && v.template_id === (input as CoachCycleGeneralV4TemplateDeleteInput).template && v.revision === 2 && v.deleted === true
  const scoped = input as CoachCycleGeneralV4ClientScope
  if (v.library_generation !== scoped.library_generation || v.client_generation !== scoped.client_generation) return false
  if (operation === 'draft_delete') return exact(v, ['draft_id', ...generationKeys, 'revision', 'deleted', 'publishable'])
    && v.draft_id === (input as CoachCycleGeneralV4DraftDeleteInput).draft && v.revision === (input as CoachCycleGeneralV4DraftDeleteInput).expected_revision + 1 && v.deleted === true
  if (operation === 'draft_save') {
    const saving = input as CoachCycleGeneralV4DraftSaveInput
    return exact(v, savedKeys) && saved(v) && (saving.draft === null || v.draft_id === saving.draft) && v.revision === saving.expected_revision + 1
  }
  return operation === 'template_apply' && exact(v, [...savedKeys, 'unit_changed']) && saved(v) && v.revision === 1 && typeof v.unit_changed === 'boolean'
    && v.draft_id !== (input as CoachCycleGeneralV4TemplateApplyInput).template && v.draft_id !== scoped.athlete
}

export type CoachCycleGeneralV4ErrorCode = 'unavailable' | 'session_expired' | 'access_denied' | 'conflict' | 'request_reused' | 'retryable' | 'invalid' | 'network'
export class CoachCycleGeneralV4Error extends Error {
  constructor(readonly code: CoachCycleGeneralV4ErrorCode) {
    super({ unavailable: 'Cycle authoring is unavailable.', session_expired: 'Sign in again to access cycle authoring.',
      access_denied: 'You no longer have access to this cycle scope.', conflict: 'This cycle or template changed. Reopen it before trying again.',
      request_reused: 'This request ID was already used for another action.', retryable: 'Retry the same request after the concurrent change finishes.',
      invalid: 'Check the cycle request and try again.', network: 'The cycle request could not be completed.' }[code])
    this.name = 'CoachCycleGeneralV4Error'
  }
}
export function createCoachCycleGeneralV4Api(options: {
  enabled?: boolean; baseUrl?: string; getAccessToken(): Promise<string | null>;
  onSessionExpired?(token: string | null): void; request?: typeof fetch
}) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) {
    let url: URL
    try { url = new URL(base) } catch { throw new CoachCycleGeneralV4Error('invalid') }
    if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachCycleGeneralV4Error('invalid')
  }
  async function post(operation: CoachCycleGeneralV4Operation, input: CoachCycleGeneralV4Input): Promise<CoachCycleGeneralV4Result> {
    if (options.enabled !== true) throw new CoachCycleGeneralV4Error('unavailable')
    let snapshot: unknown, body: string
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachCycleGeneralV4Error('invalid') }
    if (!isCoachCycleGeneralV4Input(operation, snapshot) || new TextEncoder().encode(body).byteLength > coachCycleGeneralV4RequestMaxBytes(operation)) throw new CoachCycleGeneralV4Error('invalid')
    const token = await options.getAccessToken()
    if (!token) { options.onSessionExpired?.(null); throw new CoachCycleGeneralV4Error('session_expired') }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachCycleGeneralV4Error('session_expired')
    let response: Response
    try {
      response = await (options.request ?? fetch)(`${base}${COACH_CYCLE_GENERAL_V4_PATHS[operation]}`, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        credentials: 'omit', cache: 'no-store', redirect: 'error', body,
      })
    } catch { throw new CoachCycleGeneralV4Error('network') }
    if (response.status === 401) { await response.body?.cancel(); options.onSessionExpired?.(token); throw new CoachCycleGeneralV4Error('session_expired') }
    if (response.redirected || response.status >= 300 && response.status < 400
      || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      await response.body?.cancel(); throw new CoachCycleGeneralV4Error('network')
    }
    let value: unknown
    try { value = await readCoachCycleDraftJson(response, response.ok ? coachCycleGeneralV4ResponseMaxBytes(operation) : COACH_CYCLE_GENERAL_V4_ERROR_MAX_BYTES) }
    catch { throw new CoachCycleGeneralV4Error('network') }
    if (!response.ok) {
      const code = object(value) && exact(value, ['error']) ? value.error : null
      if (response.status === 403 && code === 'access_denied') throw new CoachCycleGeneralV4Error('access_denied')
      if (response.status === 409 && code === 'cycle_general_conflict') throw new CoachCycleGeneralV4Error('conflict')
      if (response.status === 409 && code === 'cycle_general_request_reused') throw new CoachCycleGeneralV4Error('request_reused')
      if (response.status === 409 && code === 'serialization_retry') throw new CoachCycleGeneralV4Error('retryable')
      throw new CoachCycleGeneralV4Error(response.status === 404 || response.status === 503 ? 'unavailable' : response.status >= 500 ? 'network' : 'invalid')
    }
    if (!isCoachCycleGeneralV4Result(operation, value, snapshot)) throw new CoachCycleGeneralV4Error('network')
    return value
  }
  return {
    bind: async (input: CoachCycleGeneralV4BindInput) => await post('bind', input) as CoachCycleGeneralV4BindResult,
    draftSave: async (input: CoachCycleGeneralV4DraftSaveInput) => await post('draft_save', input) as CoachCycleGeneralV4DraftReceipt,
    draftRead: async (input: CoachCycleGeneralV4DraftReadInput) => await post('draft_read', input) as CoachCycleGeneralV4DraftRecord,
    draftDelete: async (input: CoachCycleGeneralV4DraftDeleteInput) => await post('draft_delete', input) as CoachCycleGeneralV4DraftDeleteReceipt,
    templateCapture: async (input: CoachCycleGeneralV4TemplateCaptureInput) => await post('template_capture', input) as CoachCycleGeneralV4TemplateReceipt,
    templateRead: async (input: CoachCycleGeneralV4TemplateReadInput) => await post('template_read', input) as CoachCycleGeneralV4TemplateRecord,
    templateDelete: async (input: CoachCycleGeneralV4TemplateDeleteInput) => await post('template_delete', input) as CoachCycleGeneralV4TemplateDeleteReceipt,
    templateApply: async (input: CoachCycleGeneralV4TemplateApplyInput) => await post('template_apply', input) as CoachCycleGeneralV4ApplyReceipt,
    list: async (input: CoachCycleGeneralV4ListInput) => await post('list', input) as CoachCycleGeneralV4ListResult,
    status: async (input: CoachCycleGeneralV4StatusInput) => await post('status', input) as CoachCycleGeneralV4StatusResult,
    resolve: async (input: CoachCycleGeneralV4ResolveInput) => await post('resolve', input) as CoachCycleGeneralV4ResolveResult,
  }
}
