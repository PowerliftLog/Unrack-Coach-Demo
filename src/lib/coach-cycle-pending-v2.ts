// Durable request recovery; the UI separately requires complete authorized review.
// A future caller must finish the complete detail review before prepare(), call
// inputForDispatch() before each explicit dispatch, and resolve only that request.
import { isCoachCycleCommitV2Input, isCoachCycleCommitV2Receipt, isCoachCycleCommitV2Status, type CoachCycleCommitV2Input, type CoachCycleCommitV2Receipt, type CoachCycleCommitV2StatusInput } from './coach-cycle-commit-v2-api'
import { isCoachCyclePreviewV2Summary, type CoachCyclePreviewV2Summary } from './coach-cycle-preview-v2-api'

export const COACH_CYCLE_PENDING_V2_KEY = 'unrack.coach-cycle.pending.v2'
const TAB_KEY = `${COACH_CYCLE_PENDING_V2_KEY}.tab`
const LOCK_KEY = `${COACH_CYCLE_PENDING_V2_KEY}.exclusive`
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type CoachCyclePendingV2Scope = { owner: string; gym: string; athlete: string; draft: string }
type ReviewBinding = Pick<CoachCyclePreviewV2Summary, 'source_hash' | 'compiled_hash' | 'coverage_hash' | 'projection_hash' | 'admission_id'> & { authorization_contract?: 'coach-cycle-pilot-authorized/1' }
export type CoachCyclePendingV2 = Readonly<{
  version: 2; owner: string; tab: string; phase: 'prepared' | 'unknown'
  input: Readonly<CoachCycleCommitV2Input>; review: Readonly<ReviewBinding>
}>
export class CoachCyclePendingV2Error extends Error {
  constructor(readonly code: 'unsupported' | 'storage' | 'tab_busy' | 'scope' | 'pending_exists' | 'invalid' | 'closed') {
    super({ unsupported: 'Safe cycle recovery requires browser Web Locks and persistent storage. Publication must remain unavailable in this browser.', storage: 'Cycle recovery could not be saved or verified. Do not dispatch this request.', tab_busy: 'Cycle recovery is open in another tab. Close that recovery tab before continuing here.', scope: 'This pending cycle request belongs to a different signed-in owner or cycle scope.', pending_exists: 'Resolve or explicitly discard the existing cycle request before preparing a changed review.', invalid: 'The cycle recovery data does not match the pinned request and review.', closed: 'This cycle recovery controller is closed. Sign in and reopen recovery.' }[code])
    this.name = 'CoachCyclePendingV2Error'
  }
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v) && v !== '00000000-0000-0000-0000-000000000000'
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
const reviewKeys = ['source_hash', 'compiled_hash', 'coverage_hash', 'projection_hash', 'admission_id'] as const
const reviewBinding = (review: CoachCyclePreviewV2Summary): ReviewBinding => ({ source_hash: review.source_hash, compiled_hash: review.compiled_hash, coverage_hash: review.coverage_hash, projection_hash: review.projection_hash, admission_id: review.admission_id, ...(review.publication_authorized ? { authorization_contract: review.authorization_contract } : {}) })
function parse(raw: string): CoachCyclePendingV2 {
  if (raw.length > 4096) throw new CoachCyclePendingV2Error('invalid')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new CoachCyclePendingV2Error('invalid') }
  if (!exact(value, ['version', 'owner', 'tab', 'phase', 'input', 'review']) || value.version !== 2 || !uuid(value.owner) || !uuid(value.tab)
    || value.phase !== 'prepared' && value.phase !== 'unknown' || !isCoachCycleCommitV2Input('commit', value.input)
    || !exact(value.review, [...reviewKeys, ...(value.review && typeof value.review === 'object' && Object.hasOwn(value.review, 'authorization_contract') ? ['authorization_contract'] : [])])) throw new CoachCyclePendingV2Error('invalid')
  const review = value.review
  if (review.authorization_contract !== undefined && review.authorization_contract !== 'coach-cycle-pilot-authorized/1') throw new CoachCyclePendingV2Error('invalid')
  if (!reviewKeys.every(key => key === 'admission_id' ? uuid(review[key]) : hash(review[key]))) throw new CoachCyclePendingV2Error('invalid')
  Object.freeze(value.input); Object.freeze(value.review)
  return Object.freeze(value) as CoachCyclePendingV2
}
const sameInput = (a: Readonly<CoachCycleCommitV2Input>, b: Readonly<CoachCycleCommitV2Input>) => Object.keys(a).every(key => a[key as keyof typeof a] === b[key as keyof typeof b])

/** The injected lease must be exclusive for this origin until close(). Browser
 * callers use openBrowserCoachCyclePendingV2(), which supplies a Web Lock.
 * Storage is read afresh on every action; malformed records fail closed.
 */
export function createCoachCyclePendingV2Controller(options: {
  storage: StoragePort; tab: string; leaseHeld(): boolean; releaseLease(): void
  getOwnerSubject(): string | null; newRequestId?(): string
}) {
  let closed = false
  const assertOpen = () => { if (closed || !options.leaseHeld()) throw new CoachCyclePendingV2Error('closed') }
  const readRaw = () => { try { return options.storage.getItem(COACH_CYCLE_PENDING_V2_KEY) } catch { throw new CoachCyclePendingV2Error('storage') } }
  const read = () => { const raw = readRaw(); return raw === null ? null : parse(raw) }
  function requireOwner(owner: string) {
    assertOpen()
    if (!uuid(owner) || options.getOwnerSubject() !== owner) throw new CoachCyclePendingV2Error('scope')
  }
  function scoped(scope: CoachCyclePendingV2Scope) {
    requireOwner(scope.owner)
    const current = read()
    if (current && (current.owner !== scope.owner || current.input.gym !== scope.gym || current.input.athlete !== scope.athlete || current.input.draft !== scope.draft)) throw new CoachCyclePendingV2Error('scope')
    // The old tab may have closed and lost its sessionStorage identity. The
    // origin-wide exclusive lease is the concurrency authority; same-owner,
    // same-scope recovery may rebind ONLY the tab scalar, keeping the exact
    // request and review. Verify that durable rebind before exposing any input.
    if (current && current.tab !== options.tab) return save({ ...current, tab: options.tab })
    return current
  }
  function save(value: CoachCyclePendingV2) {
    const raw = JSON.stringify(value)
    try { options.storage.setItem(COACH_CYCLE_PENDING_V2_KEY, raw) } catch { throw new CoachCyclePendingV2Error('storage') }
    if (readRaw() !== raw) throw new CoachCyclePendingV2Error('storage')
    return parse(raw)
  }
  function remove() {
    try { options.storage.removeItem(COACH_CYCLE_PENDING_V2_KEY) } catch { throw new CoachCyclePendingV2Error('storage') }
    if (readRaw() !== null) throw new CoachCyclePendingV2Error('storage')
  }
  function expected(scope: CoachCyclePendingV2Scope, requestId: string) {
    const current = scoped(scope)
    if (!current || current.input.request_id !== requestId) throw new CoachCyclePendingV2Error('invalid')
    return current
  }
  function resolveReceipt(current: CoachCyclePendingV2, receipt: unknown): CoachCycleCommitV2Receipt {
    if (!isCoachCycleCommitV2Receipt(receipt, current.input) || receipt.authorization_contract !== current.review.authorization_contract || !reviewKeys.every(key => receipt[key] === current.review[key])) throw new CoachCyclePendingV2Error('invalid')
    remove()
    return receipt
  }
  function close() { if (!closed) { closed = true; options.releaseLease() } }
  if (!uuid(options.tab)) throw new CoachCyclePendingV2Error('invalid')
  return {
    pending: scoped,
    prepare(scope: CoachCyclePendingV2Scope, reviewed: CoachCyclePreviewV2Summary) {
      const current = scoped(scope)
      const base = { gym: scope.gym, athlete: scope.athlete, draft: scope.draft, expected_revision: reviewed.draft_revision, expected_admission_version: reviewed.admission_version }
      if (!isCoachCyclePreviewV2Summary(reviewed, base, scope.owner)) throw new CoachCyclePendingV2Error('invalid')
      const input: CoachCycleCommitV2Input = { ...base, request_id: current?.input.request_id ?? (options.newRequestId ?? (() => crypto.randomUUID()))(), expected_review_hash: reviewed.review_hash, expected_current_assignment: reviewed.expected_current_assignment }
      if (!isCoachCycleCommitV2Input('commit', input)) throw new CoachCyclePendingV2Error('invalid')
      const review = reviewBinding(reviewed)
      if (current) {
        if (!sameInput(current.input, input) || current.review.authorization_contract !== review.authorization_contract || !reviewKeys.every(key => current.review[key] === review[key])) throw new CoachCyclePendingV2Error('pending_exists')
        return current
      }
      return save({ version: 2, owner: scope.owner, tab: options.tab, phase: 'prepared', input, review })
    },
    /** This is the only dispatch handoff. Its durable unknown marker precedes
     * any network call, including an identical explicit retry after reload.
     * It returns the old pinned input even if the server has since changed.
     */
    inputForDispatch(scope: CoachCyclePendingV2Scope, requestId: string): Readonly<CoachCycleCommitV2Input> {
      const current = expected(scope, requestId)
      return save({ ...current, phase: 'unknown' }).input
    },
    statusInput(scope: CoachCyclePendingV2Scope, requestId: string): Readonly<CoachCycleCommitV2StatusInput> {
      const { input } = expected(scope, requestId)
      return Object.freeze({ gym: input.gym, athlete: input.athlete, request_id: input.request_id })
    },
    /** All failures (including 401, 409, abort and network loss) leave the
     * durable record intact. Never infer a failed commit from an exception.
     */
    noteFailure(scope: CoachCyclePendingV2Scope, requestId: string) { return expected(scope, requestId) },
    resolveCommit(scope: CoachCyclePendingV2Scope, requestId: string, receipt: unknown) { return resolveReceipt(expected(scope, requestId), receipt) },
    resolveStatus(scope: CoachCyclePendingV2Scope, requestId: string, status: unknown) {
      const current = expected(scope, requestId)
      const input = { gym: current.input.gym, athlete: current.input.athlete, request_id: requestId }
      if (!isCoachCycleCommitV2Status(status, input, current.input)) throw new CoachCyclePendingV2Error('invalid')
      // A concurrent transaction may still commit after this snapshot.
      if (status.authorization_contract !== current.review.authorization_contract) throw new CoachCyclePendingV2Error('invalid')
      return status.status === 'not_found' ? null : resolveReceipt(current, status.receipt)
    },
    discard(scope: CoachCyclePendingV2Scope, requestId: string) { expected(scope, requestId); remove() },
    /** Wire this to the authenticated owner's explicit signout. Cleanup is
     * allowed after getOwnerSubject() becomes null, but never for a new owner.
     * The caller supplies the previous owner from its auth transition.
     */
    signOut(previousOwner: string) {
      assertOpen()
      if (!uuid(previousOwner) || options.getOwnerSubject() !== null && options.getOwnerSubject() !== previousOwner) throw new CoachCyclePendingV2Error('scope')
      const current = read()
      if (current && current.owner !== previousOwner) throw new CoachCyclePendingV2Error('scope')
      remove(); close()
    },
    close,
  }
}

/** Requires secure-context Web Locks, localStorage and sessionStorage. Runtime
 * feature detection is authoritative; unsupported browsers fail closed. The lock
 * prevents concurrent controllers, including Duplicate Tab's copied identity.
 * Once the original releases its lock, a fresh or duplicate tab may recover the
 * SAME pinned request for the same owner/scope, persisting its new tab binding.
 * This is deliberate: server idempotency is the final authority.
 * close() releases the lock but deliberately keeps recovery data for reload.
 */
export type CoachCyclePendingV2Controller = ReturnType<typeof createCoachCyclePendingV2Controller>
const browserControllers = new Set<CoachCyclePendingV2Controller>()
/** Read-only routing hint for a signed-in owner. Recovery still requires the
 * exclusive Web Lock and revalidates the exact stored request before any call. */
export function readBrowserCoachCyclePendingV2Scope(owner: string): CoachCyclePendingV2Scope | null {
  if (!uuid(owner)) throw new CoachCyclePendingV2Error('scope')
  let raw: string | null
  try { raw = window.localStorage.getItem(COACH_CYCLE_PENDING_V2_KEY) } catch { throw new CoachCyclePendingV2Error('storage') }
  if (raw === null) return null
  const current = parse(raw)
  if (current.owner !== owner) throw new CoachCyclePendingV2Error('scope')
  return { owner, gym: current.input.gym, athlete: current.input.athlete, draft: current.input.draft }
}
/** Explicit signout removes only the previous owner's pinned request. Automatic
 * session recovery/unmount keeps it for same-owner historical status recovery. */
export function clearBrowserCoachCyclePendingV2OnSignOut(previousOwner: string): boolean {
  try {
    for (const controller of browserControllers) { controller.signOut(previousOwner); browserControllers.delete(controller) }
    const raw = window.localStorage.getItem(COACH_CYCLE_PENDING_V2_KEY)
    if (raw !== null) {
      if (parse(raw).owner !== previousOwner) return false
      window.localStorage.removeItem(COACH_CYCLE_PENDING_V2_KEY)
    }
    return window.localStorage.getItem(COACH_CYCLE_PENDING_V2_KEY) === null
  } catch { return false }
}
export async function openBrowserCoachCyclePendingV2(getOwnerSubject: () => string | null) {
  if (!globalThis.navigator?.locks?.request) throw new CoachCyclePendingV2Error('unsupported')
  let tab: string
  let storage: Storage
  try {
    storage = window.localStorage
    const session = window.sessionStorage
    tab = session.getItem(TAB_KEY) ?? crypto.randomUUID()
    session.setItem(TAB_KEY, tab)
    if (session.getItem(TAB_KEY) !== tab) throw new Error()
    // Check availability without mutating a retained request.
    storage.getItem(COACH_CYCLE_PENDING_V2_KEY)
  } catch { throw new CoachCyclePendingV2Error('storage') }
  let held = false, release = () => {}
  let ready!: () => void
  const acquired = new Promise<void>(resolve => { ready = resolve })
  const lock = navigator.locks.request(LOCK_KEY, { ifAvailable: true, mode: 'exclusive' }, async value => {
    held = value !== null
    if (!held) { ready(); return }
    const untilClosed = new Promise<void>(resolve => { release = resolve })
    ready()
    await untilClosed
    held = false
  })
  try { await Promise.race([acquired, lock]) } catch { throw new CoachCyclePendingV2Error('unsupported') }
  if (!held) throw new CoachCyclePendingV2Error('tab_busy')
  try {
    const base = createCoachCyclePendingV2Controller({ storage, tab, leaseHeld: () => held, releaseLease: () => { browserControllers.delete(controller); release() }, getOwnerSubject })
    // React may close an opener and immediately start another one. Wait for
    // the browser's lock callback to exit, not merely for release() to be called.
    const controller = { ...base, close: async () => { base.close(); await lock } }
    browserControllers.add(controller)
    return controller
  }
  catch (error) { release(); throw error }
}
