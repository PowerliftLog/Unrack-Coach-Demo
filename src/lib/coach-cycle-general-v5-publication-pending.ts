import { isCoachCycleGeneralV4Uuid as uuid, type CoachCycleGeneralV4ClientScope } from './coach-cycle-general-v4-api'
import { isCoachCycleGeneralV5PublicationInput, type CoachCycleGeneralV5PublishResolveInput } from './coach-cycle-general-v5-publication-api'

// Only an uncertain operation identity survives reload. This is never a saved
// mutation, review, source, or permission to publish again.
export type CoachCycleGeneralV5PublicationPending = {
  owner: string; operation: 'publish:v5'; scope: CoachCycleGeneralV4ClientScope; request: string
}
export const COACH_CYCLE_GENERAL_V5_PUBLICATION_PENDING_KEY = 'unrack-coach-cycle-general-v5-publication-pending/1'
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
  && Reflect.ownKeys(value).length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value')
  })
export function isCoachCycleGeneralV5PublicationScope(value: unknown): value is CoachCycleGeneralV4ClientScope {
  return exact(value, ['gym', 'library_generation', 'athlete', 'client_generation']) && Object.values(value).every(uuid)
}
export function isCoachCycleGeneralV5PublicationPending(value: unknown): value is CoachCycleGeneralV5PublicationPending {
  return exact(value, ['owner', 'operation', 'scope', 'request']) && uuid(value.owner) && value.operation === 'publish:v5'
    && uuid(value.request) && isCoachCycleGeneralV5PublicationScope(value.scope)
}
export function coachCycleGeneralV5PublicationPending(owner: string, input: CoachCycleGeneralV5PublishResolveInput): CoachCycleGeneralV5PublicationPending {
  if (!uuid(owner) || !exact(input, ['gym', 'library_generation', 'athlete', 'client_generation', 'request']) || !isCoachCycleGeneralV5PublicationInput('publish_resolve', input)) throw new Error('Invalid publication identity')
  return { owner, operation: 'publish:v5', request: input.request, scope: { gym: input.gym, library_generation: input.library_generation, athlete: input.athlete, client_generation: input.client_generation } }
}
export function coachCycleGeneralV5PublicationResolveInput(pending: CoachCycleGeneralV5PublicationPending, owner: string, scope: CoachCycleGeneralV4ClientScope): CoachCycleGeneralV5PublishResolveInput {
  if (!isCoachCycleGeneralV5PublicationPending(pending) || !uuid(owner) || !isCoachCycleGeneralV5PublicationScope(scope)
    || pending.owner !== owner || pending.scope.gym !== scope.gym || pending.scope.athlete !== scope.athlete
    || pending.scope.library_generation !== scope.library_generation || pending.scope.client_generation !== scope.client_generation) {
    throw new Error('Publication resolution requires its original current authority')
  }
  return { ...pending.scope, request: pending.request }
}
export function encodeCoachCycleGeneralV5PublicationPending(pending: CoachCycleGeneralV5PublicationPending): string {
  if (!isCoachCycleGeneralV5PublicationPending(pending)) throw new Error('Invalid publication identity')
  return JSON.stringify(pending)
}
export function decodeCoachCycleGeneralV5PublicationPending(encoded: string): CoachCycleGeneralV5PublicationPending {
  if (typeof encoded !== 'string' || new TextEncoder().encode(encoded).byteLength > 2048) throw new Error('Invalid publication identity')
  const pending: unknown = JSON.parse(encoded)
  if (!isCoachCycleGeneralV5PublicationPending(pending)) throw new Error('Invalid publication identity')
  return pending
}
