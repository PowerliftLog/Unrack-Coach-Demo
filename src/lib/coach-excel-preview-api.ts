// Default-off, read-only saved-source preview. This contract never authorizes publishing.
import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { isCoachCyclePreviewV2Item, type CoachCyclePreviewV2Item, type CoachCyclePreviewV2Schedule } from './coach-cycle-preview-v2-api'
export const COACH_EXCEL_PREVIEW_PATH = '/api/coach-excel-saved-draft-preview-v1'
export const COACH_EXCEL_PREVIEW_REQUEST_MAX_BYTES = 2048
export const COACH_EXCEL_PREVIEW_RESPONSE_MAX_BYTES = 65536
export const COACH_EXCEL_PREVIEW_ERROR_MAX_BYTES = 4096
export type CoachExcelPreviewInput = { gym: string; athlete: string; draft: string; expected_revision: number; page_index: number; expected_review_hash: string | null }
export type CoachExcelPreviewSummary = {
  contract: 'coach-excel-preview/1'; contract_version: 1; owner_subject: string; coach_id: string; gym_id: string; athlete_id: string
  athlete_membership_id: string; pairing_epoch: string; authority_hash: string; draft_id: string; draft_revision: number; source_hash: string
  compiler_version: 'coach-cycle-sql/2'; calendar_version: 2; schedule_contract: 'coach-cycle-exact-start/1'; compiled_hash: string; coverage_hash: string
  projection_version: 'coach-cycle-detail/3'; projection_hash: string; name: string; unit: 'lb' | 'kg'; start_on: string; end_on: string; week_count: number
  schedule: CoachCyclePreviewV2Schedule[]; totals: { exercises: number; skipped: number; groups: number; sets: number }
  detail_item_count: number; detail_page_count: number; expected_current_assignment: string | null; assignment_hash: string
  local_only: true; publication_authorized: false; publishable: false; review_hash: string
}
export type CoachExcelPreviewPage = { contract: 'coach-excel-preview-page/1'; summary: CoachExcelPreviewSummary; page_index: number; items: CoachCyclePreviewV2Item[]; local_only: true; publication_authorized: false }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000'
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max
const text = (v: unknown): v is string => typeof v === 'string' && [...v].length <= 120 && v.trim().length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(v) && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v)
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const date = (v: unknown): v is string => typeof v === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
const after = (day: string, count: number) => new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10)
const canonical = (v: unknown): string => JSON.stringify(v, (_key, value: unknown) => object(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
export function isCoachExcelPreviewInput(v: unknown): v is CoachExcelPreviewInput {
  return exact(v, ['gym','athlete','draft','expected_revision','page_index','expected_review_hash']) && [v.gym,v.athlete,v.draft].every(uuid)
    && integer(v.expected_revision, 1) && integer(v.page_index, 0, 383) && (v.expected_review_hash === null ? v.page_index === 0 : hash(v.expected_review_hash))
}
const summaryKeys = ['contract','contract_version','owner_subject','coach_id','gym_id','athlete_id','athlete_membership_id','pairing_epoch','authority_hash','draft_id','draft_revision','source_hash','compiler_version','calendar_version','schedule_contract','compiled_hash','coverage_hash','projection_version','projection_hash','name','unit','start_on','end_on','week_count','schedule','totals','detail_item_count','detail_page_count','expected_current_assignment','assignment_hash','local_only','publication_authorized','publishable','review_hash']
export function isCoachExcelPreviewSummary(v: unknown, input: CoachExcelPreviewInput, owner?: string): v is CoachExcelPreviewSummary {
  if (!exact(v, summaryKeys) || v.contract !== 'coach-excel-preview/1' || v.contract_version !== 1 || v.compiler_version !== 'coach-cycle-sql/2'
    || v.calendar_version !== 2 || v.schedule_contract !== 'coach-cycle-exact-start/1' || v.projection_version !== 'coach-cycle-detail/3'
    || v.gym_id !== input.gym || v.athlete_id !== input.athlete || v.draft_id !== input.draft || v.draft_revision !== input.expected_revision
    || ![v.owner_subject,v.coach_id,v.gym_id,v.athlete_id,v.draft_id,v.athlete_membership_id,v.pairing_epoch].every(uuid) || !integer(v.draft_revision, 1)
    || owner !== undefined && v.owner_subject !== owner || ![v.authority_hash,v.source_hash,v.compiled_hash,v.coverage_hash,v.projection_hash,v.assignment_hash,v.review_hash].every(hash)
    || input.expected_review_hash !== null && v.review_hash !== input.expected_review_hash || !text(v.name) || !['lb','kg'].includes(String(v.unit))
    || !date(v.start_on) || !date(v.end_on) || !integer(v.week_count, 1, 12) || v.end_on !== after(v.start_on, v.week_count*7-1)
    || !Array.isArray(v.schedule) || !integer(v.schedule.length, 1, 32) || v.schedule.length % v.week_count !== 0
    || !exact(v.totals, ['exercises','skipped','groups','sets']) || !integer(v.totals.exercises, 0, 192) || !integer(v.totals.skipped, 0, 384)
    || !integer(v.totals.groups, v.totals.exercises, 768) || !integer(v.totals.sets, v.totals.groups, 768)
    || v.totals.exercises === 0 && (v.totals.groups !== 0 || v.totals.sets !== 0)
    || v.detail_item_count !== v.totals.exercises + v.totals.skipped || !integer(v.detail_item_count, 1, 384)
    || !integer(v.detail_page_count, Math.ceil(v.detail_item_count/4), v.detail_item_count) || input.page_index >= v.detail_page_count
    || v.expected_current_assignment !== null && !uuid(v.expected_current_assignment)
    || v.local_only !== true || v.publication_authorized !== false || v.publishable !== false) return false
  if (new TextEncoder().encode(JSON.stringify(v)).byteLength >= 16384) return false
  const daysPerWeek = v.schedule.length / v.week_count, firstDays: number[] = []
  if (!integer(daysPerWeek, 1, 7)) return false
  const anchorWeekday = new Date(`${v.start_on}T00:00:00Z`).getUTCDay() || 7
  for (let i = 0; i < v.schedule.length; i++) {
    const s = v.schedule[i], week = Math.floor(i/daysPerWeek)+1, di = i%daysPerWeek
    if (!exact(s, ['week','weekday','day','scheduled_date','marked_rest']) || s.week !== week || !integer(s.weekday, 1, 7) || s.day !== weekdays[s.weekday-1]
      || s.scheduled_date !== after(v.start_on, (week-1)*7+(s.weekday-anchorWeekday+7)%7) || typeof s.marked_rest !== 'boolean') return false
    if (week === 1) { if (firstDays.includes(s.weekday) || di && s.scheduled_date <= v.schedule[i-1].scheduled_date) return false; firstDays.push(s.weekday) }
    else if (s.weekday !== firstDays[di]) return false
  }
  const programmedDays = v.schedule.filter(s => !s.marked_rest).length
  return v.detail_item_count <= v.schedule.length*12 && v.detail_item_count >= v.schedule.length && v.totals.exercises >= programmedDays
    && v.totals.exercises <= programmedDays*12 && v.totals.skipped >= v.schedule.length-programmedDays
    && v.totals.groups <= v.totals.exercises*20 && v.totals.sets <= v.totals.exercises*20
}
// First sheet row of the exercise slot. A week that switches exercise points its
// name at its own run's row, so derive the slot from the prescription row.
const slotRow = (item: CoachCyclePreviewV2Item) => item.source.prescription.row - (item.week - 1)
export function isCoachExcelPreviewPage(v: unknown, input: CoachExcelPreviewInput, previous?: CoachExcelPreviewSummary, owner?: string): v is CoachExcelPreviewPage {
  if (!exact(v, ['contract','summary','page_index','items','local_only','publication_authorized']) || v.contract !== 'coach-excel-preview-page/1'
    || v.local_only !== true || v.publication_authorized !== false || v.page_index !== input.page_index || !isCoachExcelPreviewSummary(v.summary, input, owner)
    || previous && canonical(v.summary) !== canonical(previous) || !Array.isArray(v.items) || !integer(v.items.length, 1, 4)) return false
  if (new TextEncoder().encode(JSON.stringify(v.items)).byteLength > 49152) return false
  const s = v.summary, lanes = s.schedule.filter(d => d.week === 1).map(d => d.weekday).sort((a,b) => a-b)
  for (let i = 0; i < v.items.length; i++) {
    const item = v.items[i]
    if (!isCoachCyclePreviewV2Item(item, s.detail_item_count) || item.week > s.week_count) return false
    const day = s.schedule.find(d => d.week === item.week && d.weekday === item.weekday)
    if (!day || item.scheduled_date !== day.scheduled_date || item.status === 'programmed' && day.marked_rest
      || item.source.name.column !== lanes.indexOf(item.weekday)*5+1
      || (slotRow(item)-2) % (s.week_count+1) !== 0 || slotRow(item) > 2+11*(s.week_count+1)) return false
    if (i > 0 && (item.item_index !== v.items[i-1].item_index+1 || item.scheduled_date < v.items[i-1].scheduled_date
      || (item.scheduled_date === v.items[i-1].scheduled_date ? slotRow(item) !== slotRow(v.items[i-1])+s.week_count+1 : slotRow(item) !== 2))) return false
  }
  const programmed = (v.items as CoachCyclePreviewV2Item[]).filter(item => item.status === 'programmed'), skipped = v.items.length-programmed.length
  if (programmed.length > s.totals.exercises || skipped > s.totals.skipped || programmed.reduce((sum,item) => sum+item.set_groups.length,0) > s.totals.groups
    || programmed.reduce((sum,item) => sum+item.set_groups.reduce((sets,g) => sets+g.sets_min,0),0) > s.totals.sets) return false
  const first = v.items[0].item_index, last = v.items[v.items.length-1].item_index, remaining = s.detail_item_count-last-1, pagesAfter = s.detail_page_count-input.page_index-1
  return first >= input.page_index && first <= input.page_index*4 && remaining >= pagesAfter && remaining <= pagesAfter*4
    && (input.page_index !== 0 || first === 0 && slotRow(v.items[0]) === 2 && v.items[0].scheduled_date === s.schedule[0].scheduled_date)
    && (pagesAfter !== 0 || last === s.detail_item_count-1 && v.items.at(-1)!.scheduled_date === s.schedule.at(-1)!.scheduled_date)
}
export const COACH_EXCEL_PREVIEW_CONFLICTS = ['excel_preview_revision_stale','excel_preview_source_integrity','excel_preview_assignment_integrity','excel_preview_review_stale'] as const
export type CoachExcelPreviewErrorCode = 'blocked' | 'conflict' | 'retryable' | 'session_expired' | 'access_denied' | 'unavailable' | 'network' | 'invalid'
export class CoachExcelPreviewError extends Error {
  constructor(readonly code: CoachExcelPreviewErrorCode) {
    super({ blocked: 'The server could not interpret this saved worksheet. Check its prescriptions, start date and size.', conflict: 'The saved cycle or current program changed. Reload the saved draft before previewing again.', retryable: 'A concurrent change interrupted preview. Try again.', session_expired: 'Sign in again before previewing this cycle.', access_denied: 'You no longer have access to this client cycle.', unavailable: 'Excel preview is unavailable. This capability remains closed.', network: 'The Excel preview could not be completed. Try again.', invalid: 'Check the Excel preview request.' }[code]); this.name = 'CoachExcelPreviewError'
  }
}
export function createCoachExcelPreviewApi(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; getOwnerSubject?(): string | null; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) { let url: URL; try { url = new URL(base) } catch { throw new CoachExcelPreviewError('invalid') }; if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachExcelPreviewError('invalid') }
  return { preview: async (input: CoachExcelPreviewInput, summary?: CoachExcelPreviewSummary): Promise<CoachExcelPreviewPage> => {
    let body: string, snapshot: unknown, previous: CoachExcelPreviewSummary | undefined
    try { body = JSON.stringify(input); snapshot = JSON.parse(body); previous = summary === undefined ? undefined : JSON.parse(JSON.stringify(summary)) } catch { throw new CoachExcelPreviewError('invalid') }
    if (!isCoachExcelPreviewInput(snapshot) || new TextEncoder().encode(body).byteLength > COACH_EXCEL_PREVIEW_REQUEST_MAX_BYTES) throw new CoachExcelPreviewError('invalid')
    const owner = options.getOwnerSubject?.()
    if (options.getOwnerSubject && !uuid(owner)) throw new CoachExcelPreviewError('session_expired')
    if (snapshot.expected_review_hash !== null && (!previous || !isCoachExcelPreviewSummary(previous, snapshot, owner ?? undefined))) throw new CoachExcelPreviewError('invalid')
    const token = await options.getAccessToken()
    if (!token) { options.onSessionExpired?.(null); throw new CoachExcelPreviewError('session_expired') }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192) throw new CoachExcelPreviewError('session_expired')
    if (options.getOwnerSubject && options.getOwnerSubject() !== owner) throw new CoachExcelPreviewError('session_expired')
    let response: Response
    try { response = await (options.request ?? fetch)(`${base}${COACH_EXCEL_PREVIEW_PATH}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error', body }) } catch { throw new CoachExcelPreviewError('network') }
    if (response.status === 401) { await response.body?.cancel(); options.onSessionExpired?.(token); throw new CoachExcelPreviewError('session_expired') }
    let value: unknown
    try {
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await response.body?.cancel(); throw new Error() }
      value = await readCoachCycleDraftJson(response, response.ok ? COACH_EXCEL_PREVIEW_RESPONSE_MAX_BYTES : COACH_EXCEL_PREVIEW_ERROR_MAX_BYTES)
    } catch { throw new CoachExcelPreviewError('network') }
    if (!response.ok) {
      if (exact(value, ['error']) && response.status === 409 && value.error === 'serialization_retry') throw new CoachExcelPreviewError('retryable')
      if (exact(value, ['error']) && response.status === 409 && COACH_EXCEL_PREVIEW_CONFLICTS.some(code => code === value.error)) throw new CoachExcelPreviewError('conflict')
      if (exact(value, ['error']) && response.status === 422 && value.error === 'excel_preview_blocked') throw new CoachExcelPreviewError('blocked')
      throw new CoachExcelPreviewError(response.status === 403 ? 'access_denied' : response.status === 404 || response.status === 503 ? 'unavailable' : response.status >= 500 ? 'network' : 'invalid')
    }
    if (options.getOwnerSubject && options.getOwnerSubject() !== owner) throw new CoachExcelPreviewError('session_expired')
    if (!isCoachExcelPreviewPage(value, snapshot, previous, owner ?? undefined)) throw new CoachExcelPreviewError('network')
    return value
  } }
}
