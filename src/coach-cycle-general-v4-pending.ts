import { isCoachCycleGeneralV4Input, isCoachCycleGeneralV4Uuid, type CoachCycleGeneralV4ClientScope, type CoachCycleGeneralV4ResolveInput } from './lib/coach-cycle-general-v4-api'

export type CoachCycleGeneralV4Pending = {
  owner: string
  scope: CoachCycleGeneralV4ClientScope
  request: string
  operation: 'save' | 'delete' | 'capture' | 'apply' | 'template-delete'
}
export const COACH_CYCLE_GENERAL_V4_PENDING_KEY = 'unrack-coach-cycle-general-v4-pending/1'
export const COACH_CYCLE_GENERAL_V4_ARCHIVE_KEY = 'unrack-coach-cycle-general-v4-archive/1'
const operations = ['save', 'delete', 'capture', 'apply', 'template-delete']
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const valid = (value: unknown): value is CoachCycleGeneralV4Pending => object(value) && exact(value, ['owner', 'scope', 'request', 'operation'])
  && isCoachCycleGeneralV4Uuid(value.owner) && isCoachCycleGeneralV4Uuid(value.request) && typeof value.operation === 'string' && operations.includes(value.operation)
  && object(value.scope) && exact(value.scope, ['gym', 'athlete', 'library_generation', 'client_generation']) && Object.values(value.scope).every(isCoachCycleGeneralV4Uuid)
export const coachCycleGeneralV4PendingKey = (owner: string, scope: CoachCycleGeneralV4ClientScope) => `${owner}:${scope.gym}:${scope.athlete}:${scope.library_generation}:${scope.client_generation}`
export function isCoachCycleGeneralV4PendingFenced(row: CoachCycleGeneralV4Pending, owner: string, scope: CoachCycleGeneralV4ClientScope): boolean {
  return row.owner === owner && row.scope.gym === scope.gym && row.scope.athlete === scope.athlete
    && (row.scope.library_generation !== scope.library_generation || row.operation !== 'template-delete' && row.scope.client_generation !== scope.client_generation)
}
export function coachCycleGeneralV4ResolveInput(row: CoachCycleGeneralV4Pending, owner: string, scope: CoachCycleGeneralV4ClientScope): CoachCycleGeneralV4ResolveInput {
  if (!valid(row) || row.owner !== owner || row.scope.gym !== scope.gym || row.scope.athlete !== scope.athlete || isCoachCycleGeneralV4PendingFenced(row, owner, scope)) throw new Error('Operation resolution requires its original current authority')
  const operation = ({ save: 'draft_save', delete: 'draft_delete', capture: 'template_capture', apply: 'template_apply', 'template-delete': 'template_delete' } as const)[row.operation]
  const input = { ...row.scope, request: row.request, operation, ...(operation === 'template_delete' ? { athlete: null, client_generation: null } : {}) }
  if (!isCoachCycleGeneralV4Input('resolve', input)) throw new Error('Invalid operation resolution scope')
  return input as CoachCycleGeneralV4ResolveInput
}
type ArchivedPending = CoachCycleGeneralV4Pending & { outcome: 'unknown'; replacement_scope: CoachCycleGeneralV4ClientScope }
function archived(): { key: string; row: ArchivedPending }[] {
  const rows: { key: string; row: ArchivedPending }[] = []
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key?.startsWith(`${COACH_CYCLE_GENERAL_V4_ARCHIVE_KEY}/`)) continue
    const text = localStorage.getItem(key)
    if (!text || text.length > 2048 || rows.length >= 100) throw new Error('Archived operation recovery is invalid')
    const row: unknown = JSON.parse(text)
    if (!object(row) || !exact(row, ['owner', 'scope', 'request', 'operation', 'outcome', 'replacement_scope'])) throw new Error('Archived operation recovery is invalid')
    const pending = { owner: row.owner, scope: row.scope, request: row.request, operation: row.operation }
    if (!valid(pending) || row.outcome !== 'unknown' || !object(row.replacement_scope) || !exact(row.replacement_scope, ['gym', 'athlete', 'library_generation', 'client_generation'])
      || !Object.values(row.replacement_scope).every(isCoachCycleGeneralV4Uuid) || !isCoachCycleGeneralV4PendingFenced(pending, pending.owner, row.replacement_scope as CoachCycleGeneralV4ClientScope)
      || key !== `${COACH_CYCLE_GENERAL_V4_ARCHIVE_KEY}/${pending.owner}/${pending.request}`) throw new Error('Archived operation recovery is invalid')
    rows.push({ key, row: row as ArchivedPending })
  }
  return rows
}
export function archiveCoachCycleGeneralV4Pending(row: CoachCycleGeneralV4Pending, owner: string, scope: CoachCycleGeneralV4ClientScope) {
  if (!valid(row) || !isCoachCycleGeneralV4PendingFenced(row, owner, scope)) throw new Error('Original operation is not fenced by current authority')
  const key = `${COACH_CYCLE_GENERAL_V4_ARCHIVE_KEY}/${row.owner}/${row.request}`
  const entries = archived()
  const existing = entries.find(item => item.key === key)?.row
  if (existing) {
    // A crash may occur after the durable archive write but before pending
    // removal. Reuse the first fenced scope even if authority has rotated
    // again or the archive is now full.
    if (existing.owner !== row.owner || existing.request !== row.request || existing.operation !== row.operation
      || existing.scope.gym !== row.scope.gym || existing.scope.athlete !== row.scope.athlete
      || existing.scope.library_generation !== row.scope.library_generation || existing.scope.client_generation !== row.scope.client_generation)
      throw new Error('Archived operation identity conflicts')
  } else {
    if (entries.length >= 100) throw new Error('Archived operation recovery is full')
    const encoded = JSON.stringify({ ...row, outcome: 'unknown', replacement_scope: scope })
    localStorage.setItem(key, encoded)
    if (localStorage.getItem(key) !== encoded) throw new Error('Archived operation recovery could not be verified')
  }
  removeCoachCycleGeneralV4Pending(row)
}
function read(): CoachCycleGeneralV4Pending[] {
  const rows: CoachCycleGeneralV4Pending[] = []
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key?.startsWith(`${COACH_CYCLE_GENERAL_V4_PENDING_KEY}/`)) continue
    const text = localStorage.getItem(key)
    if (!text || text.length > 2048) throw new Error('Operation recovery storage is invalid')
    const row: unknown = JSON.parse(text)
    if (!valid(row) || storageKey(row) !== key || rows.length >= 20) throw new Error('Operation recovery storage is invalid')
    rows.push(row)
  }
  return rows
}
const storageKey = (row: CoachCycleGeneralV4Pending) => `${COACH_CYCLE_GENERAL_V4_PENDING_KEY}/${row.owner}/${row.request}`
export function readCoachCycleGeneralV4Pending(owner: string, scope: CoachCycleGeneralV4ClientScope): CoachCycleGeneralV4Pending | null {
  // A previous generation remains under the original selected client. It may
  // expose historical status, but can never supply current mutation authority.
  return read().find(row => row.owner === owner && row.scope.gym === scope.gym && row.scope.athlete === scope.athlete) ?? null
}
export function storeCoachCycleGeneralV4Pending(row: CoachCycleGeneralV4Pending) {
  if (!valid(row)) throw new Error('Invalid operation recovery scope')
  const rows = read()
  if (rows.some(item => item.owner === row.owner && item.scope.gym === row.scope.gym && item.scope.athlete === row.scope.athlete) || rows.length >= 20) throw new Error('Resolve retained operations before another change')
  // Separate request keys prevent concurrent tabs from overwriting another
  // client's retained receipt through a shared read/modify/write array.
  const encoded = JSON.stringify(row), key = storageKey(row)
  if (localStorage.getItem(key) !== null) throw new Error('Operation identity was already retained')
  localStorage.setItem(key, encoded)
  if (localStorage.getItem(key) !== encoded) throw new Error('Operation recovery storage could not be verified')
}
export function removeCoachCycleGeneralV4Pending(row: CoachCycleGeneralV4Pending) {
  const key = storageKey(row)
  localStorage.removeItem(key)
  if (localStorage.getItem(key) !== null) throw new Error('Operation recovery cleanup could not be verified')
}
export function clearCoachCycleGeneralV4PendingOwner(owner: string): boolean {
  try {
    for (const row of read().filter(row => row.owner === owner)) removeCoachCycleGeneralV4Pending(row)
    for (const item of archived().filter(item => item.row.owner === owner)) {
      localStorage.removeItem(item.key)
      if (localStorage.getItem(item.key) !== null) throw new Error('Archived operation recovery cleanup could not be verified')
    }
    return !read().some(row => row.owner === owner) && !archived().some(item => item.row.owner === owner)
  } catch { return false }
}
