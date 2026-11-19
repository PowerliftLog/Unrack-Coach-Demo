import { isCoachCycleGeneralV4Uuid as uuid, type CoachCycleGeneralV4ClientScope } from './lib/coach-cycle-general-v4-api'
import { COACH_CYCLE_GENERAL_V5_PUBLICATION_PENDING_KEY, decodeCoachCycleGeneralV5PublicationPending, encodeCoachCycleGeneralV5PublicationPending, isCoachCycleGeneralV5PublicationScope, type CoachCycleGeneralV5PublicationPending } from './lib/coach-cycle-general-v5-publication-pending'

export const COACH_CYCLE_GENERAL_V5_PUBLICATION_ARCHIVE_KEY = 'unrack-coach-cycle-general-v5-publication-archive/1'
const pendingPrefix = `${COACH_CYCLE_GENERAL_V5_PUBLICATION_PENDING_KEY}/`
const archivePrefix = `${COACH_CYCLE_GENERAL_V5_PUBLICATION_ARCHIVE_KEY}/`
const keyOf = (row: CoachCycleGeneralV5PublicationPending, archive = false) => `${archive ? archivePrefix : pendingPrefix}${row.owner}/${row.request}`
const sameTarget = (row: CoachCycleGeneralV5PublicationPending, owner: string, scope: CoachCycleGeneralV4ClientScope) => row.owner === owner && row.scope.gym === scope.gym && row.scope.athlete === scope.athlete
const validateAuthority = (owner: string, scope?: CoachCycleGeneralV4ClientScope) => {
  if (!uuid(owner) || scope !== undefined && !isCoachCycleGeneralV5PublicationScope(scope)) throw new Error('Invalid publication authority')
}
function keys(): string[] {
  const found: string[] = [], length = localStorage.length
  for (let index = 0; index < length; index++) {
    const key = localStorage.key(index)
    if (key === null) throw new Error('Publication recovery changed')
    if (key.startsWith(pendingPrefix) || key.startsWith(archivePrefix)) found.push(key)
  }
  if (length !== localStorage.length || new Set(found).size !== found.length) throw new Error('Publication recovery changed')
  return found.sort()
}
function snapshot() {
  const before = keys(), active: CoachCycleGeneralV5PublicationPending[] = [], archived: CoachCycleGeneralV5PublicationPending[] = []
  const values = new Map<string, string>()
  for (const key of before) {
    const encoded = localStorage.getItem(key)
    if (encoded === null) throw new Error('Publication recovery changed')
    let row: CoachCycleGeneralV5PublicationPending
    if (key.startsWith(archivePrefix)) {
      if (new TextEncoder().encode(encoded).byteLength > 2048) throw new Error('Invalid publication archive')
      const value: unknown = JSON.parse(encoded)
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'outcome') || (value as { outcome?: unknown }).outcome !== 'unknown') throw new Error('Invalid publication archive')
      const { outcome, ...identity } = value as Record<string, unknown>
      void outcome
      row = decodeCoachCycleGeneralV5PublicationPending(JSON.stringify(identity))
      archived.push(row)
      if (archived.length > 100) throw new Error('Publication recovery capacity exceeded')
    } else {
      row = decodeCoachCycleGeneralV5PublicationPending(encoded)
      if (active.some(prior => sameTarget(prior, row.owner, row.scope))) throw new Error('Conflicting publication recovery identities')
      active.push(row)
      if (active.length > 20) throw new Error('Publication recovery capacity exceeded')
    }
    if (key !== keyOf(row, key.startsWith(archivePrefix))) throw new Error('Publication recovery identity mismatch')
    values.set(key, encoded)
  }
  for (const row of active) {
    const archive = archived.find(prior => prior.owner === row.owner && prior.request === row.request)
    if (archive && encodeCoachCycleGeneralV5PublicationPending(archive) !== encodeCoachCycleGeneralV5PublicationPending(row)) throw new Error('Archived publication identity changed')
  }
  if (JSON.stringify(keys()) !== JSON.stringify(before) || [...values].some(([key, value]) => localStorage.getItem(key) !== value)) throw new Error('Publication recovery changed')
  return { active, archived, values }
}
export function readCoachCycleGeneralV5PublicationPending(owner: string, scope: CoachCycleGeneralV4ClientScope) {
  validateAuthority(owner, scope)
  // A generation-fenced row remains visible for explicit unknown archival.
  return snapshot().active.find(row => sameTarget(row, owner, scope)) ?? null
}
export function storeCoachCycleGeneralV5PublicationPending(row: CoachCycleGeneralV5PublicationPending) {
  const encoded = encodeCoachCycleGeneralV5PublicationPending(row), found = snapshot(), key = keyOf(row)
  if (found.active.length >= 20 || found.active.some(prior => sameTarget(prior, row.owner, row.scope))
    || found.archived.some(prior => prior.owner === row.owner && prior.request === row.request) || localStorage.getItem(key) !== null) throw new Error('Resolve retained publication first')
  localStorage.setItem(key, encoded)
  if (snapshot().values.get(key) !== encoded) throw new Error('Publication recovery could not be verified')
}
export function removeCoachCycleGeneralV5PublicationPending(row: CoachCycleGeneralV5PublicationPending) {
  const encoded = encodeCoachCycleGeneralV5PublicationPending(row), found = snapshot(), key = keyOf(row), prior = found.values.get(key)
  if (prior !== undefined && prior !== encoded || found.active.some(item => sameTarget(item, row.owner, row.scope) && item.request !== row.request)) throw new Error('Publication recovery identity changed')
  localStorage.removeItem(key)
  const remaining = snapshot()
  if (remaining.values.has(key) || remaining.active.some(item => sameTarget(item, row.owner, row.scope))) throw new Error('Publication recovery cleanup failed')
}
export function hasCoachCycleGeneralV5PublicationPendingOwner(owner: string) {
  validateAuthority(owner)
  return snapshot().active.some(row => row.owner === owner)
}
export function clearCoachCycleGeneralV5PublicationPendingOwner(owner: string): boolean {
  try {
    validateAuthority(owner)
    const found = snapshot()
    for (const [key, encoded] of found.values) {
      if (!key.startsWith(`${pendingPrefix}${owner}/`) && !key.startsWith(`${archivePrefix}${owner}/`)) continue
      if (localStorage.getItem(key) !== encoded) throw new Error('Publication recovery identity changed')
      localStorage.removeItem(key)
      if (localStorage.getItem(key) !== null) throw new Error('Publication recovery cleanup failed')
    }
    const remaining = snapshot()
    return ![...remaining.active, ...remaining.archived].some(row => row.owner === owner)
  } catch { return false }
}
export function isCoachCycleGeneralV5PublicationFenced(row: CoachCycleGeneralV5PublicationPending, owner: string, scope: CoachCycleGeneralV4ClientScope) {
  encodeCoachCycleGeneralV5PublicationPending(row)
  validateAuthority(owner, scope)
  return sameTarget(row, owner, scope) && (row.scope.library_generation !== scope.library_generation || row.scope.client_generation !== scope.client_generation)
}
export function archiveCoachCycleGeneralV5PublicationPending(row: CoachCycleGeneralV5PublicationPending, owner: string, scope: CoachCycleGeneralV4ClientScope) {
  if (!isCoachCycleGeneralV5PublicationFenced(row, owner, scope)) throw new Error('Publication is not fenced')
  const found = snapshot(), pending = encodeCoachCycleGeneralV5PublicationPending(row)
  if (found.values.get(keyOf(row)) !== pending) throw new Error('Publication recovery identity changed')
  const key = keyOf(row, true), encoded = JSON.stringify({ ...row, outcome: 'unknown' }), prior = found.values.get(key)
  if (prior !== undefined && prior !== encoded) throw new Error('Archived publication identity changed')
  if (prior === undefined) {
    if (found.archived.length >= 100) throw new Error('Publication recovery archive is full')
    localStorage.setItem(key, encoded)
  }
  if (snapshot().values.get(key) !== encoded) throw new Error('Publication recovery archive failed')
  removeCoachCycleGeneralV5PublicationPending(row)
}
