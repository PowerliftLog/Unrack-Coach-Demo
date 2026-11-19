import { coachExcelBetaPublicationRecoveryKey, COACH_EXCEL_BETA_RECOVERY_CHANGED } from './coach-excel-publication-recovery'
import { isCoachExcelNextCycleInput, type CoachExcelNextCyclePublishInput } from './lib/coach-excel-next-cycle-api'
export const COACH_EXCEL_NEXT_CYCLE_RECOVERY_PREFIX = 'unrack:coach-excel-publish-pending:3:'
export type NextCycleRecovery = {
  contract: 'coach-excel-pending/3'; input: CoachExcelNextCyclePublishInput; rejected: boolean; resolved: boolean
  queueId: string | null; name: string; predecessorName: string | null; predecessorId: string | null
  /** Absent in older records. A retry starts a conservative waiting period for those records. */
  firstSentAt?: number
}
type Scope = { gym: string; athlete: string }
export function nextCycleRecoveryKey(owner: string | undefined, scope: Scope) {
  return coachExcelBetaPublicationRecoveryKey(owner, scope).replace('unrack:coach-excel-publish-pending:2:', COACH_EXCEL_NEXT_CYCLE_RECOVERY_PREFIX)
}
export function readNextCycleRecovery(owner: string | undefined, scope: Scope): NextCycleRecovery | null {
  const raw = window.localStorage.getItem(nextCycleRecoveryKey(owner, scope))
  if (raw === null) return null
  const invalid = () => new Error('Publication recovery could not be read. Keep it for recovery before publishing again.')
  let v: NextCycleRecovery
  try { v = JSON.parse(raw) } catch { throw invalid() }
  const uuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)
  if (!v || v.contract !== 'coach-excel-pending/3'
    || !isCoachExcelNextCycleInput('publish', v.input) || v.input.gym !== scope.gym || v.input.athlete !== scope.athlete
    || !(v.queueId === null || uuid(v.queueId))
    || typeof v.rejected !== 'boolean' || typeof v.resolved !== 'boolean'
    || !(v.predecessorId === null || uuid(v.predecessorId))) throw invalid()
  // Titles are display-only. Their absence or corruption must never affect request custody.
  // Keep accepted tabs/newlines; unusable display data gets generic copy without rewriting storage.
  const title = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value) ? value : null
  return { ...v, name: title(v.name) ?? 'Program details unavailable', predecessorName: title(v.predecessorName),
    firstSentAt: Number.isSafeInteger(v.firstSentAt) && v.firstSentAt! > 0 ? v.firstSentAt : undefined }
}
export function storeNextCycleRecovery(owner: string | undefined, scope: Scope, value: NextCycleRecovery | null, request: string) {
  const key = nextCycleRecoveryKey(owner, scope), existing = readNextCycleRecovery(owner, scope)
  if (existing && existing.input.request_id !== request && !existing.resolved) throw new Error('Recover the earlier publication request first.')
  if (value) window.localStorage.setItem(key, JSON.stringify(value))
  else window.localStorage.removeItem(key)
  window.dispatchEvent(new CustomEvent(COACH_EXCEL_BETA_RECOVERY_CHANGED, { detail: coachExcelBetaPublicationRecoveryKey(owner, scope) }))
}
