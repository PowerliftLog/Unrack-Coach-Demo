// Local-only preparation. The server recompiles stored source; neither method
// accepts a browser candidate, actor, program, source body or interpretation.
import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { COACH_CYCLE_PUBLISH_LIMITS } from './coach-cycle-limits'
export const COACH_CYCLE_PUBLISH_PATHS = { preview: '/api/coach-cycle-publish-preview-v1', commit: '/api/coach-cycle-publish-commit-v1' } as const
export type CoachCyclePublishOperation = keyof typeof COACH_CYCLE_PUBLISH_PATHS
export const COACH_CYCLE_PUBLISH_REQUEST_MAX_BYTES = 2048
export const COACH_CYCLE_PUBLISH_PREVIEW_MAX_BYTES = 24 * 1024 * 1024
export const COACH_CYCLE_PUBLISH_RECEIPT_MAX_BYTES = 16 * 1024
export const COACH_CYCLE_PUBLISH_ERROR_MAX_BYTES = 4096
export const COACH_CYCLE_SQL_COMPILER = 'coach-cycle-sql/1' as const
export type CoachCyclePublishPreviewInput = { gym: string; athlete: string; draft: string; expected_revision: number }
export type CoachCyclePublishCommitInput = CoachCyclePublishPreviewInput & { request_id: string; expected_review_hash: string; expected_current_assignment: string | null }
export type CoachCyclePublishInput = CoachCyclePublishPreviewInput | CoachCyclePublishCommitInput
export type CoachCyclePublishSource = { sheet: 'cycle'; row: number; column: number; address: string; day?: string; week?: number; block_id?: string }
export type CoachCycleSqlGroup = {
  mode: 'replace'; identity_token: null; ordinal: number; sets_mode: 'exact'; sets_min: number; sets_max: null
  dose_mode: 'reps' | 'time' | 'distance'; reps_mode: 'exact' | 'range' | null; dose_min: number; dose_max: number | null
  distance_unit: 'm' | 'km' | 'ft' | 'mi' | null; laterality: 'bilateral' | 'each_side'
  load_mode: 'exact' | 'rpe' | 'qualitative' | 'bodyweight' | 'none' | 'athlete_choice'; load_basis: 'total'
  exact_weight: number | null; percent: null; percent_basis_exercise_id: null; percent_basis_max_type: null; manual_override: null
  rpe_min: number | null; rpe_max: number | null; qualitative: 'L' | 'M' | 'MH' | 'H' | null; unit_override: 'lb' | 'kg' | null
  rest_seconds: null; note: null
}
export type CoachCycleSqlExercise = { mode: 'replace'; identity_token: null; ordinal: number; group_ordinal: null; status: 'programmed'; name: string; instruction: string | null; note: null; protocol: string; exercise_id: null; track_in_metrics: false; set_groups: CoachCycleSqlGroup[] }
export type CoachCycleSqlDay = { weekday: number; scheduled_date: string; payload: { identity_token: null; ordinal: number; label: string; subtitle: null; marked_rest: boolean; workout_instruction: null; movement_groups: []; ungrouped_exercises: CoachCycleSqlExercise[] } }
export type CoachCycleSqlCoverage = { sheet: 'cycle'; row: number; column: number; role: 'structure' | 'exercise' | 'prescription' | 'instructions'; day: string; block_id: string | null; week: number | null; text: string }
export type CoachCycleSqlTrace = { ordinal: number; start: number; end: number; raw: string }
export type CoachCycleSqlProvenance = { day: string; week: number; block_id: string; name_row: number; prescription_row: number; column: number; raw_prescription: string; raw_instructions: string; skipped: boolean; groups: CoachCycleSqlTrace[] }
export type CoachCycleSqlCompiled = { compiler_version: typeof COACH_CYCLE_SQL_COMPILER; draft_id: string; name: string; unit: 'lb' | 'kg'; start_on: string; end_on: string; week_count: number; weekdays: number[]; weeks: { ordinal: number; days: CoachCycleSqlDay[] }[]; coverage: CoachCycleSqlCoverage[]; provenance: CoachCycleSqlProvenance[]; totals: { exercises: number; skipped: number; groups: number; sets: number } }
// RELEASE BLOCKER: these local-candidate markers never authorize UI commit. A
// separately admitted hosted contract and matching validator must replace them.
export type CoachCyclePublishPreview = { gym_id: string; athlete_id: string; draft_id: string; draft_revision: number; source_hash: string; compiler_version: typeof COACH_CYCLE_SQL_COMPILER; compiled_hash: string; coverage_hash: string; expected_current_assignment: string | null; compiled: CoachCycleSqlCompiled; review_hash: string; local_only: true; publication_authorized: false }
export type CoachCyclePublication = { request_id: string; operation_type: 'activate_scope'; program_id: string; assignment_id: string; previous_assignment_id: string | null; builder_version: number; release_id: string; scope_kind: 'program'; scope_token: null; visible_day_tokens: string[]; published_at: string; retired_instance_count: number }
export type CoachCyclePublishReceipt = { contract: 'coach-cycle-sql-publish/1'; request_id: string; draft_id: string; draft_revision: number; source_hash: string; compiler_version: typeof COACH_CYCLE_SQL_COMPILER; compiled_hash: string; coverage_hash: string; review_hash: string; program_id: string; assignment_id: string; builder_version: number; publication: CoachCyclePublication; destination_hash: string; revision_hash: string; local_only: true }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000'
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const integer = (v: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= minimum && Number(v) <= maximum
const number = (v: unknown, minimum: number, maximum: number, scale = 3): v is number => typeof v === 'number' && Number.isFinite(v) && v >= minimum && v <= maximum && Math.abs(v * 10 ** scale - Math.round(v * 10 ** scale)) < 0.00001
const text = (v: unknown, maximum: number, required = false): v is string => typeof v === 'string' && [...v].length <= maximum && (!required || v.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(v) && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v)
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const date = (v: unknown): v is string => typeof v === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
const after = (day: string, count: number) => new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10)
const address = (row: number, column: number) => `${column < 26 ? String.fromCharCode(65 + column) : `A${String.fromCharCode(65 + column - 26)}`}${row + 1}`
export function isCoachCyclePublishInput(operation: CoachCyclePublishOperation, v: unknown): v is CoachCyclePublishInput {
  return exact(v, ['gym', 'athlete', 'draft', 'expected_revision', ...(operation === 'commit' ? ['request_id', 'expected_review_hash', 'expected_current_assignment'] : [])]) && uuid(v.gym) && uuid(v.athlete) && uuid(v.draft) && integer(v.expected_revision, 1)
    && (operation === 'preview' || uuid(v.request_id) && hash(v.expected_review_hash) && (v.expected_current_assignment === null || uuid(v.expected_current_assignment)))
}
export function isCoachCyclePublishSource(v: unknown): v is CoachCyclePublishSource {
  if (!object(v) || !exact(v, ['sheet', 'row', 'column', 'address', ...(Object.hasOwn(v, 'day') ? ['day', 'week', 'block_id'] : [])]) || v.sheet !== 'cycle' || !integer(v.row, 0, 156) || !integer(v.column, 0, 33) || v.address !== address(v.row, v.column)) return false
  return !Object.hasOwn(v, 'day') || weekdays.includes(String(v.day)) && integer(v.week, 1, 12) && uuid(v.block_id) && v.column % 5 === 2 && v.row >= v.week + 1
}
const groupKeys = ['mode','identity_token','ordinal','sets_mode','sets_min','sets_max','dose_mode','reps_mode','dose_min','dose_max','distance_unit','laterality','load_mode','load_basis','exact_weight','percent','percent_basis_exercise_id','percent_basis_max_type','manual_override','rpe_min','rpe_max','qualitative','unit_override','rest_seconds','note']
function group(v: unknown, ordinal: number): boolean {
  if (!exact(v, groupKeys) || v.mode !== 'replace' || v.identity_token !== null || v.ordinal !== ordinal || v.sets_mode !== 'exact' || !integer(v.sets_min, 1, 20) || v.sets_max !== null || !['bilateral', 'each_side'].includes(String(v.laterality)) || v.load_basis !== 'total' || ['percent', 'percent_basis_exercise_id', 'percent_basis_max_type', 'manual_override', 'rest_seconds', 'note'].some(key => v[key] !== null)) return false
  if (v.dose_mode === 'reps') {
    if (!integer(v.dose_min, 1, 1000) || v.distance_unit !== null || (v.reps_mode === 'exact' ? v.dose_max !== null : v.reps_mode !== 'range' || !integer(v.dose_max, Number(v.dose_min) + 1, 1000))) return false
  } else if (v.dose_mode === 'time') { if (!integer(v.dose_min, 1, 9999999) || v.dose_max !== null || v.reps_mode !== null || v.distance_unit !== null) return false }
  else if (v.dose_mode === 'distance') { if (!number(v.dose_min, 0.001, 9999999.999) || v.dose_max !== null || v.reps_mode !== null || !['m', 'km', 'ft', 'mi'].includes(String(v.distance_unit))) return false }
  else return false
  if (v.rpe_min === null ? v.rpe_max !== null : !number(v.rpe_min, 1, 10, 1) || v.rpe_max !== null && (!number(v.rpe_max, Number(v.rpe_min), 10, 1) || v.rpe_max === v.rpe_min)) return false
  if (v.unit_override !== null && v.unit_override !== 'lb' && v.unit_override !== 'kg') return false
  if (v.load_mode === 'exact') return number(v.exact_weight, 0.001, 9999999.999) && v.qualitative === null
  if (v.unit_override !== null) return false
  if (v.load_mode === 'bodyweight') return v.exact_weight === 0 && v.qualitative === null
  if (v.exact_weight !== null) return false
  if (v.load_mode === 'qualitative') return ['L', 'M', 'MH', 'H'].includes(String(v.qualitative))
  return v.qualitative === null && (v.load_mode === 'none' || v.load_mode === 'athlete_choice' && v.rpe_min === null || v.load_mode === 'rpe' && v.rpe_min !== null)
}
function compiled(v: unknown, draft: string): v is CoachCycleSqlCompiled {
  if (!exact(v, ['compiler_version','draft_id','name','unit','start_on','end_on','week_count','weekdays','weeks','coverage','provenance','totals']) || v.compiler_version !== COACH_CYCLE_SQL_COMPILER || v.draft_id !== draft || !text(v.name, 120, true) || !['lb','kg'].includes(String(v.unit)) || !date(v.start_on) || new Date(`${v.start_on}T00:00:00Z`).getUTCDay() !== 1 || !date(v.end_on) || !integer(v.week_count, 1, 12) || v.end_on !== after(v.start_on, v.week_count * 7 - 1) || !Array.isArray(v.weekdays) || v.weekdays.length < 1 || v.weekdays.length > 7 || v.weekdays.length * v.week_count > COACH_CYCLE_PUBLISH_LIMITS.authoredDays || !v.weekdays.every((d, i, days) => integer(d, 1, 7) && (i === 0 || d > days[i-1])) || !Array.isArray(v.weeks) || v.weeks.length !== v.week_count) return false
  const totals = { exercises: 0, groups: 0, sets: 0, skipped: 0 }
  for (let wi = 0; wi < v.weeks.length; wi++) {
    const week = v.weeks[wi]
    if (!exact(week, ['ordinal','days']) || week.ordinal !== wi + 1 || !Array.isArray(week.days) || week.days.length !== v.weekdays.length) return false
    for (let di = 0; di < week.days.length; di++) {
      const day = week.days[di], weekday = v.weekdays[di]
      if (!exact(day, ['weekday','scheduled_date','payload']) || day.weekday !== weekday || day.scheduled_date !== after(v.start_on, wi * 7 + weekday - 1)) return false
      const p = day.payload
      if (!exact(p, ['identity_token','ordinal','label','subtitle','marked_rest','workout_instruction','movement_groups','ungrouped_exercises']) || p.identity_token !== null || p.ordinal !== weekday || p.label !== weekdays[weekday-1] || p.subtitle !== null || p.workout_instruction !== null || !Array.isArray(p.movement_groups) || p.movement_groups.length !== 0 || !Array.isArray(p.ungrouped_exercises) || p.ungrouped_exercises.length > 12 || p.marked_rest !== (p.ungrouped_exercises.length === 0)) return false
      for (let ei = 0; ei < p.ungrouped_exercises.length; ei++) {
        const e = p.ungrouped_exercises[ei]
        if (!exact(e, ['mode','identity_token','ordinal','group_ordinal','status','name','instruction','note','protocol','exercise_id','track_in_metrics','set_groups']) || e.mode !== 'replace' || e.identity_token !== null || e.ordinal !== ei + 1 || e.group_ordinal !== null || e.status !== 'programmed' || !text(e.name, 120, true) || e.instruction !== null && !text(e.instruction, 500, true) || e.note !== null || !text(e.protocol, 1000, true) || e.exercise_id !== null || e.track_in_metrics !== false || !Array.isArray(e.set_groups) || e.set_groups.length < 1 || e.set_groups.length > 20 || !e.set_groups.every((g, i) => group(g, i + 1))) return false
        const sets = e.set_groups.reduce((sum, g) => sum + g.sets_min, 0)
        if (sets > 20) return false
        totals.exercises++; totals.groups += e.set_groups.length; totals.sets += sets
      }
    }
  }
  if (!Array.isArray(v.coverage) || !v.coverage.length || v.coverage.length > 5338 || !Array.isArray(v.provenance) || !v.provenance.length || v.provenance.length > 1008) return false
  const columns = v.weekdays.length * 5 - 1, rows = v.coverage.length / columns
  if (!integer(rows, 3, 157)) return false
  for (let i = 0; i < v.coverage.length; i++) {
    const c = v.coverage[i]
    if (!exact(c, ['sheet','row','column','role','day','block_id','week','text']) || c.sheet !== 'cycle' || c.row !== Math.floor(i / columns) || c.column !== i % columns || !['structure','exercise','prescription','instructions'].includes(String(c.role)) || c.day !== weekdays[v.weekdays[Math.floor(Number(c.column) / 5)]-1] || c.block_id !== null && !uuid(c.block_id) || c.week !== null && !integer(c.week, 1, v.week_count) || !text(c.text, 1000)) return false
  }
  const seen = new Set<string>()
  for (const p of v.provenance) {
    if (!exact(p, ['day','week','block_id','name_row','prescription_row','column','raw_prescription','raw_instructions','skipped','groups']) || !weekdays.includes(String(p.day)) || !integer(p.week, 1, v.week_count) || !uuid(p.block_id) || !integer(p.name_row, 2, rows - 1) || p.prescription_row !== p.name_row + p.week - 1 || !integer(p.column, 0, columns-4) || p.column % 5 !== 0 || !text(p.raw_prescription, 1000, true) || !text(p.raw_instructions, 500) || typeof p.skipped !== 'boolean' || !Array.isArray(p.groups) || p.groups.length > 20 || (p.skipped ? p.groups.length !== 0 : p.groups.length === 0)) return false
    const k = `${p.day}:${p.week}:${p.block_id}`; if (seen.has(k)) return false; seen.add(k)
    const raw = [...p.raw_prescription]
    for (let i = 0; i < p.groups.length; i++) { const g = p.groups[i]; if (!exact(g, ['ordinal','start','end','raw']) || g.ordinal !== i + 1 || !integer(g.start, 0, raw.length-1) || !integer(g.end, g.start+1, raw.length) || g.raw !== raw.slice(g.start, g.end).join('')) return false }
    if (p.skipped) totals.skipped++
  }
  return totals.exercises <= COACH_CYCLE_PUBLISH_LIMITS.exercises && totals.groups <= COACH_CYCLE_PUBLISH_LIMITS.groups && totals.sets <= COACH_CYCLE_PUBLISH_LIMITS.sets && v.provenance.length === totals.exercises + totals.skipped && exact(v.totals, ['exercises','skipped','groups','sets']) && Object.entries(totals).every(([key,value]) => (v.totals as Record<string, unknown>)[key] === value)
}
export function isCoachCyclePublishPreview(v: unknown, input: CoachCyclePublishPreviewInput): v is CoachCyclePublishPreview {
  return exact(v, ['gym_id','athlete_id','draft_id','draft_revision','source_hash','compiler_version','compiled_hash','coverage_hash','expected_current_assignment','compiled','review_hash','local_only','publication_authorized']) && v.gym_id === input.gym && v.athlete_id === input.athlete && v.draft_id === input.draft && v.draft_revision === input.expected_revision && [v.source_hash,v.compiled_hash,v.coverage_hash,v.review_hash].every(hash) && v.compiler_version === COACH_CYCLE_SQL_COMPILER && (v.expected_current_assignment === null || uuid(v.expected_current_assignment)) && v.local_only === true && v.publication_authorized === false && compiled(v.compiled, input.draft)
}
export function isCoachCyclePublishReceipt(v: unknown, input: CoachCyclePublishCommitInput): v is CoachCyclePublishReceipt {
  if (!exact(v, ['contract','request_id','draft_id','draft_revision','source_hash','compiler_version','compiled_hash','coverage_hash','review_hash','program_id','assignment_id','builder_version','publication','destination_hash','revision_hash','local_only']) || v.contract !== 'coach-cycle-sql-publish/1' || v.request_id !== input.request_id || v.draft_id !== input.draft || v.draft_revision !== input.expected_revision || v.review_hash !== input.expected_review_hash || ![v.source_hash,v.compiled_hash,v.coverage_hash,v.destination_hash,v.revision_hash].every(hash) || v.compiler_version !== COACH_CYCLE_SQL_COMPILER || !uuid(v.program_id) || !uuid(v.assignment_id) || !integer(v.builder_version, 0) || v.local_only !== true) return false
  const p = v.publication
  return exact(p, ['request_id','operation_type','program_id','assignment_id','previous_assignment_id','builder_version','release_id','scope_kind','scope_token','visible_day_tokens','published_at','retired_instance_count']) && uuid(p.request_id) && p.operation_type === 'activate_scope' && p.program_id === v.program_id && p.assignment_id === v.assignment_id && p.previous_assignment_id === input.expected_current_assignment && p.builder_version === v.builder_version && uuid(p.release_id) && p.scope_kind === 'program' && p.scope_token === null && Array.isArray(p.visible_day_tokens) && p.visible_day_tokens.length >= 1 && p.visible_day_tokens.length <= COACH_CYCLE_PUBLISH_LIMITS.authoredDays && p.visible_day_tokens.every(uuid) && new Set(p.visible_day_tokens).size === p.visible_day_tokens.length && typeof p.published_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(p.published_at) && Number.isFinite(Date.parse(p.published_at)) && integer(p.retired_instance_count, 0)
}
export const COACH_CYCLE_PUBLISH_BLOCK_REASONS = ['cycle_publish_capacity_exceeded','cycle_publish_prescription_invalid','cycle_publish_percentage_resolution_required','cycle_publish_unsupported_prescription','cycle_publish_numeric_limit','cycle_publish_measure_range_unsupported','cycle_publish_unsupported_modifier','cycle_publish_duplicate_modifier','cycle_publish_ambiguous_or_duplicate_rpe','cycle_publish_rpe_invalid','cycle_publish_exact_weight_invalid','cycle_publish_ambiguous_chain','cycle_publish_set_limit','cycle_publish_destination_limit','cycle_publish_intake_invalid','cycle_publish_schedule_invalid','cycle_publish_extra_cell','cycle_publish_cell_invalid','cycle_publish_duplicate_cell','cycle_publish_formula_or_cell_invalid','cycle_publish_dual_snapshot_mismatch','cycle_publish_structure_or_uncovered_cell','cycle_publish_merge_invalid','cycle_publish_exercise_text_invalid','cycle_publish_input_invalid'] as const
export type CoachCyclePublishBlockReason = typeof COACH_CYCLE_PUBLISH_BLOCK_REASONS[number]
export const COACH_CYCLE_PUBLISH_CONFLICT_REASONS = ['cycle_publish_request_reused','cycle_publish_revision_stale','cycle_publish_source_integrity','cycle_publish_destination_changed','cycle_publish_revision_already_published','cycle_publish_review_stale'] as const
export type CoachCyclePublishErrorCode = 'blocked' | 'conflict' | 'retryable' | 'session_expired' | 'access_denied' | 'not_found' | 'unavailable' | 'network' | 'invalid'
export class CoachCyclePublishError extends Error {
  constructor(readonly code: CoachCyclePublishErrorCode, readonly reason?: string, readonly source?: CoachCyclePublishSource) {
    const blocked = reason === 'cycle_publish_capacity_exceeded' ? 'This cycle is larger than the tested publication limit. Reduce workout days, exercises or sets and preview again.' : reason === 'cycle_publish_percentage_resolution_required' ? 'Percentages need a reviewed approved max before publication.' : reason === 'cycle_publish_prescription_invalid' ? 'Enter a prescription or SKIP for this week.' : reason === 'cycle_publish_schedule_invalid' ? 'Choose an explicit Monday start date.' : reason === 'cycle_publish_destination_limit' ? 'Publication supports 1–12 weeks, 1–12 exercises per day and at most 20 sets per exercise.' : 'The server could not interpret this sheet. Use supported complete prescriptions and review the source cell.'
    super(code === 'blocked' ? blocked : { conflict: 'The draft, review or current assignment changed. Preview again before publishing.', retryable: 'A concurrent change interrupted publication. Retry the same request.', session_expired: 'Sign in again before publishing.', access_denied: 'You no longer have access to this client cycle.', not_found: 'This private cycle draft was not found.', unavailable: 'Cycle publication is unavailable.', network: 'The publication request could not be completed. Retry the same request ID.', invalid: 'Check the publication request and review again.' }[code]); this.name = 'CoachCyclePublishError'
  }
}
export function parseCoachCyclePublishError(v: unknown): { code: 'blocked' | 'conflict' | 'retryable'; reason?: string; source?: CoachCyclePublishSource } | null {
  if (!object(v)) return null
  if (v.error === 'cycle_publish_blocked' && exact(v, ['error','reason', ...(Object.hasOwn(v, 'source') ? ['source'] : [])]) && COACH_CYCLE_PUBLISH_BLOCK_REASONS.includes(v.reason as CoachCyclePublishBlockReason) && (!Object.hasOwn(v, 'source') || isCoachCyclePublishSource(v.source))) return { code: 'blocked', reason: v.reason as string, ...(Object.hasOwn(v, 'source') ? { source: v.source as CoachCyclePublishSource } : {}) }
  if (exact(v, ['error']) && COACH_CYCLE_PUBLISH_CONFLICT_REASONS.includes(v.error as typeof COACH_CYCLE_PUBLISH_CONFLICT_REASONS[number])) return { code: 'conflict', reason: v.error as string }
  if (exact(v, ['error']) && v.error === 'serialization_retry') return { code: 'retryable' }
  return null
}
export function createCoachCyclePublishApi(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) { let url: URL; try { url = new URL(base) } catch { throw new CoachCyclePublishError('invalid') }; if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachCyclePublishError('invalid') }
  async function post(operation: CoachCyclePublishOperation, input: CoachCyclePublishInput): Promise<CoachCyclePublishPreview | CoachCyclePublishReceipt> {
    let body: string, snapshot: unknown
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachCyclePublishError('invalid') }
    if (!isCoachCyclePublishInput(operation, snapshot) || new TextEncoder().encode(body).byteLength > COACH_CYCLE_PUBLISH_REQUEST_MAX_BYTES) throw new CoachCyclePublishError('invalid')
    const token = await options.getAccessToken()
    if (!token) { options.onSessionExpired?.(null); throw new CoachCyclePublishError('session_expired') }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachCyclePublishError('session_expired')
    let response: Response
    try { response = await (options.request ?? fetch)(`${base}${COACH_CYCLE_PUBLISH_PATHS[operation]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body }) } catch { throw new CoachCyclePublishError('network') }
    if (response.status === 401) { await response.body?.cancel(); options.onSessionExpired?.(token); throw new CoachCyclePublishError('session_expired') }
    let value: unknown
    try { value = await readCoachCycleDraftJson(response, response.ok ? operation === 'preview' ? COACH_CYCLE_PUBLISH_PREVIEW_MAX_BYTES : COACH_CYCLE_PUBLISH_RECEIPT_MAX_BYTES : COACH_CYCLE_PUBLISH_ERROR_MAX_BYTES) } catch { throw new CoachCyclePublishError('network') }
    if (!response.ok) {
      const safe = parseCoachCyclePublishError(value)
      if (safe && (safe.code === 'blocked' ? response.status === 422 : response.status === 409)) throw new CoachCyclePublishError(safe.code, safe.reason, safe.source)
      throw new CoachCyclePublishError(response.status === 403 ? 'access_denied' : response.status === 404 ? 'not_found' : response.status === 503 ? 'unavailable' : response.status >= 500 ? 'network' : 'invalid')
    }
    if (operation === 'preview' ? !isCoachCyclePublishPreview(value, snapshot) : !isCoachCyclePublishReceipt(value, snapshot as CoachCyclePublishCommitInput)) throw new CoachCyclePublishError('network')
    return value as CoachCyclePublishPreview | CoachCyclePublishReceipt
  }
  return { preview: async (input: CoachCyclePublishPreviewInput) => await post('preview', input) as CoachCyclePublishPreview, commit: async (input: CoachCyclePublishCommitInput) => await post('commit', input) as CoachCyclePublishReceipt }
}
