import { isCoachExcelBetaPublishInput, type CoachExcelBetaPublishInput } from './lib/coach-excel-beta-publish-api'

/** Same-origin request metadata only. Never store credentials or worksheet content. */
export const COACH_EXCEL_PUBLICATION_RECOVERY_PREFIX = 'unrack:coach-excel-publish-pending:1:'
export const COACH_EXCEL_BETA_PUBLICATION_RECOVERY_PREFIX = 'unrack:coach-excel-publish-pending:2:'
const ownerPrefixes = (owner: string) => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(owner)) throw new Error('Publication recovery owner is invalid.')
  return [COACH_EXCEL_PUBLICATION_RECOVERY_PREFIX, COACH_EXCEL_BETA_PUBLICATION_RECOVERY_PREFIX, 'unrack:coach-excel-publish-pending:3:'].map(prefix => `${prefix}${owner}:`)
}
function ownerKeys(owner: string): string[] {
  const prefixes = ownerPrefixes(owner), keys: string[] = []
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)
    if (key && prefixes.some(prefix => key.startsWith(prefix))) keys.push(key)
  }
  return keys
}
export function hasCoachExcelPublicationPendingOwner(owner: string): boolean {
  return ownerKeys(owner).some(key => {
    if (!key.startsWith('unrack:coach-excel-publish-pending:3:')) return true
    try { return JSON.parse(window.localStorage.getItem(key) ?? 'null')?.resolved !== true } catch { return true }
  })
}
/** Explicit sign-out only; automatic session recovery must preserve these identities. */
export function clearCoachExcelPublicationPendingOwner(owner: string): boolean {
  try {
    for (const key of ownerKeys(owner)) window.localStorage.removeItem(key)
    return ownerKeys(owner).length === 0
  } catch { return false }
}

export const COACH_EXCEL_BETA_RECOVERY_CHANGED = 'unrack:coach-excel-beta-recovery-changed'
export type CoachExcelBetaPublicationRecovery = { contract: 'coach-excel-beta-pending/2'; input: CoachExcelBetaPublishInput; rejected: boolean }
type BetaScope = { gym: string; athlete: string }
/** Also used as the Web Lock name for publication, recovery and draft deletion. */
export function coachExcelBetaPublicationRecoveryKey(owner: string | undefined, scope: BetaScope): string {
  if (!owner || !isCoachExcelBetaPublishInput('status', { ...scope, request_id: owner })) throw new Error('Sign in before opening safe publication recovery.')
  return `${COACH_EXCEL_BETA_PUBLICATION_RECOVERY_PREFIX}${owner}:${scope.gym}:${scope.athlete}`
}
export function readCoachExcelBetaPublicationRecovery(owner: string | undefined, scope: BetaScope): CoachExcelBetaPublicationRecovery | null {
  const raw = window.localStorage.getItem(coachExcelBetaPublicationRecoveryKey(owner, scope))
  if (!raw) return null
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'contract,input,rejected') throw new Error('Publication recovery metadata is invalid. Keep it for recovery before publishing again.')
  const saved = value as CoachExcelBetaPublicationRecovery
  if (saved.contract !== 'coach-excel-beta-pending/2' || typeof saved.rejected !== 'boolean' || !isCoachExcelBetaPublishInput('publish', saved.input) || saved.input.gym !== scope.gym || saved.input.athlete !== scope.athlete) throw new Error('Publication recovery metadata does not match this client.')
  return saved
}
