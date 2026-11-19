import { isCoachCycleGeneralV4Uuid as uuid, type CoachCycleGeneralV4ClientScope } from './coach-cycle-general-v4-api'
import { isCoachCycleGeneralV4PublicationInput, type CoachCycleGeneralV4PublishInput, type CoachCycleGeneralV4PublishResolveInput } from './coach-cycle-general-v4-publication-api'

// A retained publication identity contains no draft, source, prescription,
// reviewed summary or original mutation arguments. It can only resolve.
export type CoachCycleGeneralV4PublicationPending = { owner: string; operation: 'publish'; scope: CoachCycleGeneralV4ClientScope; request: string }
export const COACH_CYCLE_GENERAL_V4_PUBLICATION_PENDING_KEY = 'unrack-coach-cycle-general-v4-publication-pending/1'
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: Record<string,unknown>,keys: string[]) => Object.keys(v).length === keys.length && keys.every(k=>Object.hasOwn(v,k))
export function isCoachCycleGeneralV4PublicationPending(v: unknown): v is CoachCycleGeneralV4PublicationPending {
  return object(v) && exact(v,['owner','operation','scope','request']) && uuid(v.owner) && v.operation === 'publish' && uuid(v.request)
    && object(v.scope) && exact(v.scope,['gym','library_generation','athlete','client_generation']) && Object.values(v.scope).every(uuid)
}
export function coachCycleGeneralV4PublicationPending(owner: string, input: CoachCycleGeneralV4PublishInput): CoachCycleGeneralV4PublicationPending {
  if (!uuid(owner) || !isCoachCycleGeneralV4PublicationInput('publish', input)) throw new Error('Invalid publication identity')
  return { owner, operation: 'publish', request: input.request, scope: { gym: input.gym, library_generation: input.library_generation, athlete: input.athlete, client_generation: input.client_generation } }
}
export function coachCycleGeneralV4PublicationResolveInput(pending: CoachCycleGeneralV4PublicationPending, owner: string, scope: CoachCycleGeneralV4ClientScope): CoachCycleGeneralV4PublishResolveInput {
  if (!isCoachCycleGeneralV4PublicationPending(pending) || pending.owner !== owner || pending.scope.gym !== scope.gym || pending.scope.athlete !== scope.athlete
    || pending.scope.library_generation !== scope.library_generation || pending.scope.client_generation !== scope.client_generation) throw new Error('Publication resolution requires its original current authority')
  return { ...pending.scope, request: pending.request }
}
export function encodeCoachCycleGeneralV4PublicationPending(pending: CoachCycleGeneralV4PublicationPending): string {
  if (!isCoachCycleGeneralV4PublicationPending(pending)) throw new Error('Invalid publication identity')
  return JSON.stringify(pending)
}
export function decodeCoachCycleGeneralV4PublicationPending(encoded: string): CoachCycleGeneralV4PublicationPending {
  if (new TextEncoder().encode(encoded).byteLength > 2048) throw new Error('Invalid publication identity')
  const pending: unknown = JSON.parse(encoded)
  if (!isCoachCycleGeneralV4PublicationPending(pending)) throw new Error('Invalid publication identity')
  return pending
}
