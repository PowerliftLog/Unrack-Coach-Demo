import { readCoachCycleDraftJson } from './coach-cycle-draft-api'
import { canonical, exact, uuid } from './coach-excel-beta-contract'
import {
  COACH_EXCEL_NEXT_CYCLE_PATHS, COACH_EXCEL_NEXT_CYCLE_CONFLICTS, COACH_EXCEL_NEXT_CYCLE_BLOCKS,
  COACH_EXCEL_NEXT_CYCLE_CLIENT_TIMEOUT_MS, COACH_EXCEL_NEXT_CYCLE_REQUEST_MAX_BYTES,
  COACH_EXCEL_NEXT_CYCLE_RESPONSE_MAX_BYTES, COACH_EXCEL_NEXT_CYCLE_ERROR_MAX_BYTES,
  isCoachExcelNextCycleInput, isCoachExcelNextCycleResult,
  type CoachExcelNextCycleOperation, type CoachExcelNextCycleInput,
  type CoachExcelNextCyclePreviewInput, type CoachExcelNextCyclePreviewPage, type CoachExcelNextCyclePreviewSummary,
  type CoachExcelNextCyclePublishInput, type CoachExcelNextCyclePublishResult,
  type CoachExcelNextCycleStatusInput, type CoachExcelNextCycleStatus,
  type CoachExcelNextCycleCancelInput, type CoachExcelNextCycleCancelResult,
  type CoachCycleRunningStateInput, type CoachCycleRunningState, type CoachCycleRunningUpdateInput, type CoachCycleRunningUpdateResult,
  type CoachCycleQueuedStateInput, type CoachCycleQueuedState,
} from './coach-excel-next-cycle-api'

export class CoachExcelNextCycleError extends Error {
  constructor(readonly code: 'ambiguous' | 'network' | 'invalid' | 'session_expired' | 'access_denied' | 'unavailable' | 'retryable' | 'conflict' | 'blocked', readonly reason?: string) {
    super({ ambiguous: 'The publication outcome is unknown. Check the original request before retrying.', network: 'The server response could not be confirmed. Try again.', invalid: 'Review the saved cycle again.', session_expired: 'Sign in again before continuing.', access_denied: 'You no longer have access to this client cycle.', unavailable: 'Next-cycle publication is unavailable.', retryable: 'This request is busy. Check status or retry the same request.', conflict: 'The queued program or saved review changed. Review again before publishing.', blocked: 'This worksheet cannot be published. Check its prescriptions, start date and size.' }[code])
    if (code === 'conflict' && reason === 'NEXT_CYCLE_OTHER_COACH_QUEUED') this.message = 'Another coach already has a program queued for this athlete. It was not replaced.'
    if (code === 'blocked' && reason === 'EXCEL_CHOICE_DEVICE_UPGRADE_REQUIRED') this.message = 'This program has weights the athlete chooses. The athlete needs to reconnect on the new athlete app before it can be sent. Send them a new Connect app link, then publish again.'
    this.name = 'CoachExcelNextCycleError'
  }
}
export function createCoachExcelNextCycleApi(options: { baseUrl?: string; getAccessToken(): Promise<string | null>; getOwnerSubject(): string | null | undefined; onSessionExpired?(token: string | null): void; request?: typeof fetch }) {
  const base = options.baseUrl?.replace(/\/$/, '') ?? ''
  if (base) {
    let url: URL
    try { url = new URL(base) } catch { throw new CoachExcelNextCycleError('invalid') }
    if (url.protocol !== 'https:' || url.origin !== base || url.username || url.password) throw new CoachExcelNextCycleError('invalid')
  }
  async function post(operation: CoachExcelNextCycleOperation, input: CoachExcelNextCycleInput): Promise<unknown> {
    const owner = options.getOwnerSubject()
    if (!uuid(owner)) throw new CoachExcelNextCycleError('session_expired')
    let body: string, snapshot: CoachExcelNextCycleInput
    try { body = JSON.stringify(input); snapshot = JSON.parse(body) } catch { throw new CoachExcelNextCycleError('invalid') }
    if (!isCoachExcelNextCycleInput(operation, snapshot) || new TextEncoder().encode(body).byteLength > COACH_EXCEL_NEXT_CYCLE_REQUEST_MAX_BYTES) throw new CoachExcelNextCycleError('invalid')
    const controller = new AbortController()
    let sent = false, timer: ReturnType<typeof setTimeout> | undefined
    const uncertain = () => new CoachExcelNextCycleError(sent && (operation === 'publish' || operation === 'running_update') ? 'ambiguous' : 'network')
    const expire = (token: string | null) => { try { options.onSessionExpired?.(token) } catch { /* Preserve the request outcome. */ } }
    const deadline = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { reject(uncertain()); controller.abort() }, COACH_EXCEL_NEXT_CYCLE_CLIENT_TIMEOUT_MS) })
    async function transport() {
      let token: string | null
      try { token = await options.getAccessToken() } catch { throw uncertain() }
      if (controller.signal.aborted) throw uncertain()
      if (!token) { expire(null); throw new CoachExcelNextCycleError('session_expired') }
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 8192 || options.getOwnerSubject() !== owner) throw new CoachExcelNextCycleError('session_expired')
      let response: Response
      sent = true
      try { response = await (options.request ?? fetch)(`${base}${COACH_EXCEL_NEXT_CYCLE_PATHS[operation]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal }) } catch { throw uncertain() }
      if (controller.signal.aborted) { void response.body?.cancel(); throw uncertain() }
      if (response.status === 401) { await response.body?.cancel(); expire(token); throw new CoachExcelNextCycleError('session_expired') }
      let value: unknown
      try {
        if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { await response.body?.cancel(); throw new Error() }
        value = await readCoachCycleDraftJson(response, response.ok ? COACH_EXCEL_NEXT_CYCLE_RESPONSE_MAX_BYTES : COACH_EXCEL_NEXT_CYCLE_ERROR_MAX_BYTES)
      } catch { throw uncertain() }
      if (controller.signal.aborted) throw uncertain()
      if (options.getOwnerSubject() !== owner) throw new CoachExcelNextCycleError('session_expired')
      if (!response.ok) {
        if (response.status === 409 && exact(value, ['error'])) {
          if (value.error === 'serialization_retry') throw new CoachExcelNextCycleError('retryable', value.error)
          if (COACH_EXCEL_NEXT_CYCLE_CONFLICTS.some(reason => reason === value.error)) throw new CoachExcelNextCycleError('conflict', String(value.error))
        }
        const reviewingOrSending = operation === 'preview' || operation === 'publish'
        if (response.status === 422 && exact(value, ['error', 'reason']) && COACH_EXCEL_NEXT_CYCLE_BLOCKS.some(reason => reason === value.reason)) throw new CoachExcelNextCycleError('blocked', String(value.reason))
        if (response.status === 403) throw new CoachExcelNextCycleError('access_denied')
        if (reviewingOrSending) {
          if (exact(value, ['error'])) {
            if (response.status === 404 && value.error === 'not_found'
              || response.status === 503 && ['builder_paused_for_athlete', 'service_not_configured'].some(error => error === value.error)) {
              throw new CoachExcelNextCycleError('unavailable')
            }
            if (response.status === 400 && value.error === 'invalid_request_body'
              || response.status === 413 && value.error === 'request_body_too_large'
              || response.status === 415 && value.error === 'content_type_must_be_json'
              || response.status === 429 && value.error === 'rate_limit_exceeded') {
              throw new CoachExcelNextCycleError('invalid')
            }
          }
          // Unrecognized responses cannot prove a publish was rejected before it took effect.
          throw uncertain()
        }
        if (response.status === 404 || response.status === 503) throw new CoachExcelNextCycleError('unavailable')
        if (response.status >= 500) throw uncertain()
        throw new CoachExcelNextCycleError('invalid')
      }
      if (!isCoachExcelNextCycleResult(operation, value, snapshot)) throw uncertain()
      if (operation === 'preview' && (value as CoachExcelNextCyclePreviewPage).summary.owner_subject !== owner) throw new CoachExcelNextCycleError('access_denied')
      return value
    }
    try { return await Promise.race([transport(), deadline]) } finally { clearTimeout(timer) }
  }
  return {
    preview: async (input: CoachExcelNextCyclePreviewInput, previous?: CoachExcelNextCyclePreviewSummary) => {
      const page = await post('preview', input) as CoachExcelNextCyclePreviewPage
      if (previous && canonical(page.summary) !== canonical(previous)) throw new CoachExcelNextCycleError('conflict', 'NEXT_CYCLE_REVIEW_STALE')
      return page
    },
    publish: async (input: CoachExcelNextCyclePublishInput) => await post('publish', input) as CoachExcelNextCyclePublishResult,
    status: async (input: CoachExcelNextCycleStatusInput) => await post('status', input) as CoachExcelNextCycleStatus,
    cancel: async (input: CoachExcelNextCycleCancelInput) => await post('cancel', input) as CoachExcelNextCycleCancelResult,
    runningState: async (input: CoachCycleRunningStateInput) => await post('running_state', input) as CoachCycleRunningState,
    runningUpdate: async (input: CoachCycleRunningUpdateInput) => await post('running_update', input) as CoachCycleRunningUpdateResult,
    queuedState: async (input: CoachCycleQueuedStateInput) => await post('queued_state', input) as CoachCycleQueuedState,
  }
}
type FullApi = ReturnType<typeof createCoachExcelNextCycleApi>
type CycleOperations = 'runningState' | 'runningUpdate' | 'queuedState'
/** Cycle operations are optional so older callers and test doubles stay valid. */
export type CoachExcelNextCycleApi = Omit<FullApi, CycleOperations> & Partial<Pick<FullApi, CycleOperations>>
