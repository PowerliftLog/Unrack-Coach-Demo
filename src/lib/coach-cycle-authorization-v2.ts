// Only database responses carry this discriminator. Rollout flags grant no authority.
export const COACH_CYCLE_AUTHORIZATION_V2 = 'coach-cycle-pilot-authorized/1' as const
export type CoachCycleAuthorizationV2 =
  | { local_only: true; publication_authorized: false; authorization_contract?: never }
  | { local_only: false; publication_authorized: true; authorization_contract: typeof COACH_CYCLE_AUTHORIZATION_V2 }
export function authorizationV2Keys(value: unknown): string[] {
  return value && typeof value === 'object' && Object.hasOwn(value, 'authorization_contract') ? ['authorization_contract'] : []
}
export function isCoachCycleAuthorizationV2(value: Record<string, unknown>): boolean {
  return value.local_only === true && value.publication_authorized === false && !Object.hasOwn(value, 'authorization_contract')
    || value.local_only === false && value.publication_authorized === true && value.authorization_contract === COACH_CYCLE_AUTHORIZATION_V2
}
export function sameCoachCycleAuthorizationV2(a: CoachCycleAuthorizationV2, b: CoachCycleAuthorizationV2): boolean {
  return a.local_only === b.local_only && a.publication_authorized === b.publication_authorized && a.authorization_contract === b.authorization_contract
}
