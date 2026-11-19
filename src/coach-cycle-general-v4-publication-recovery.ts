import type { CoachCycleGeneralV4ClientScope } from './lib/coach-cycle-general-v4-api'
import { COACH_CYCLE_GENERAL_V4_PUBLICATION_PENDING_KEY, decodeCoachCycleGeneralV4PublicationPending, encodeCoachCycleGeneralV4PublicationPending, type CoachCycleGeneralV4PublicationPending } from './lib/coach-cycle-general-v4-publication-pending'

const keyOf = (row: CoachCycleGeneralV4PublicationPending) => `${COACH_CYCLE_GENERAL_V4_PUBLICATION_PENDING_KEY}/${row.owner}/${row.request}`
function rows(): CoachCycleGeneralV4PublicationPending[] {
  const found: CoachCycleGeneralV4PublicationPending[] = []
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key?.startsWith(`${COACH_CYCLE_GENERAL_V4_PUBLICATION_PENDING_KEY}/`)) continue
    const encoded = localStorage.getItem(key)
    if (!encoded || found.length >= 20) throw new Error('Publication recovery is invalid')
    const row = decodeCoachCycleGeneralV4PublicationPending(encoded)
    if (keyOf(row) !== key) throw new Error('Publication recovery identity mismatch')
    found.push(row)
  }
  return found
}
export function readCoachCycleGeneralV4PublicationPending(owner: string, scope: CoachCycleGeneralV4ClientScope) {
  return rows().find(row => row.owner === owner && row.scope.gym === scope.gym && row.scope.athlete === scope.athlete) ?? null
}
export function storeCoachCycleGeneralV4PublicationPending(row: CoachCycleGeneralV4PublicationPending) {
  const encoded = encodeCoachCycleGeneralV4PublicationPending(row), found = rows(), key = keyOf(row)
  if (found.length >= 20 || found.some(item => item.owner === row.owner && item.scope.gym === row.scope.gym && item.scope.athlete === row.scope.athlete) || localStorage.getItem(key) !== null) throw new Error('Resolve retained publication first')
  localStorage.setItem(key, encoded)
  if (localStorage.getItem(key) !== encoded) throw new Error('Publication recovery could not be verified')
}
export function removeCoachCycleGeneralV4PublicationPending(row: CoachCycleGeneralV4PublicationPending) {
  // A stale tab may never remove a different operation identity.
  const key = keyOf(row), encoded = localStorage.getItem(key)
  if (encoded !== null && encoded !== encodeCoachCycleGeneralV4PublicationPending(row)) throw new Error('Publication recovery identity changed')
  localStorage.removeItem(key)
  if (localStorage.getItem(key) !== null) throw new Error('Publication recovery cleanup failed')
}
export function hasCoachCycleGeneralV4PublicationPendingOwner(owner: string) { return rows().some(row => row.owner === owner) }
export function clearCoachCycleGeneralV4PublicationPendingOwner(owner: string): boolean {
  try {
    for (const row of rows().filter(row => row.owner === owner)) removeCoachCycleGeneralV4PublicationPending(row)
    const prefix = `${COACH_CYCLE_GENERAL_V4_PUBLICATION_ARCHIVE_KEY}/${owner}/`
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index++) { const key = localStorage.key(index); if (key?.startsWith(prefix)) keys.push(key) }
    for (const key of keys) { localStorage.removeItem(key); if (localStorage.getItem(key) !== null) throw new Error('Publication archive cleanup failed') }
    return !hasCoachCycleGeneralV4PublicationPendingOwner(owner)
  } catch { return false }
}

export const COACH_CYCLE_GENERAL_V4_PUBLICATION_ARCHIVE_KEY = 'unrack-coach-cycle-general-v4-publication-archive/1'
export function isCoachCycleGeneralV4PublicationFenced(row: CoachCycleGeneralV4PublicationPending, owner: string, scope: CoachCycleGeneralV4ClientScope) {
  return row.owner === owner && row.scope.gym === scope.gym && row.scope.athlete === scope.athlete && (row.scope.library_generation !== scope.library_generation || row.scope.client_generation !== scope.client_generation)
}
export function archiveCoachCycleGeneralV4PublicationPending(row: CoachCycleGeneralV4PublicationPending, owner: string, scope: CoachCycleGeneralV4ClientScope) {
  if (!isCoachCycleGeneralV4PublicationFenced(row, owner, scope)) throw new Error('Publication is not fenced')
  const key = `${COACH_CYCLE_GENERAL_V4_PUBLICATION_ARCHIVE_KEY}/${row.owner}/${row.request}`
  const encoded = JSON.stringify({ ...row, outcome: 'unknown' })
  const prior = localStorage.getItem(key)
  if (prior !== null && prior !== encoded) throw new Error('Archived publication identity changed')
  if (prior === null) {
    let count = 0
    for (let index = 0; index < localStorage.length; index++) if (localStorage.key(index)?.startsWith(`${COACH_CYCLE_GENERAL_V4_PUBLICATION_ARCHIVE_KEY}/`)) count++
    if (count >= 100) throw new Error('Publication recovery archive is full')
    localStorage.setItem(key, encoded)
  }
  if (localStorage.getItem(key) !== encoded) throw new Error('Publication recovery archive failed')
  removeCoachCycleGeneralV4PublicationPending(row)
}
