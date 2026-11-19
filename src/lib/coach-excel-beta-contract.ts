// Candidate-only contracts. Epoch is enrollment freshness, separate from pairing_epoch.
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000'
export const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
export const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max
const timestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
export const canonical = (v: unknown): string => JSON.stringify(v, (_key, value: unknown) => object(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
export type CoachExcelBetaAuthorization = {
  contract: 'coach-excel-beta-gate/1'; gate_epoch: number; expires_at: string
  authority: { subject: string; coach: string; membership: string; epoch: string; coach_membership: string; coach_membership_updated_at: string; coach_roster: string | null }
}
export function isCoachExcelBetaAuthorization(v: unknown, epoch: number): v is CoachExcelBetaAuthorization {
  if (!exact(v, ['contract','gate_epoch','expires_at','authority']) || v.contract !== 'coach-excel-beta-gate/1'
    || !integer(epoch, 1) || v.gate_epoch !== epoch || !timestamp(v.expires_at)) return false
  const a = v.authority
  // No client clock check: historical receipts intentionally remain valid after expiry.
  return exact(a, ['subject','coach','membership','epoch','coach_membership','coach_membership_updated_at','coach_roster'])
    && [a.subject,a.coach,a.membership,a.epoch,a.coach_membership].every(uuid) && timestamp(a.coach_membership_updated_at)
    && (a.coach_roster === null || uuid(a.coach_roster))
}
