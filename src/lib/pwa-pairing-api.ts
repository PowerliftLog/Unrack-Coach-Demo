export type AthleteConnectionState = 'not_connected' | 'invite_ready' | 'paired' | 'waiting_for_download'
  | 'partially_downloaded' | 'downloaded' | 'opened' | 'expired' | 'revoked'

export type AthleteConnectionStatus = {
  state: AthleteConnectionState
  invite_active: boolean
  invite_created_at: string | null
  invite_expires_at: string | null
  paired_at: string | null
  device_last_seen_at: string | null
  device_revoked_at: string | null
  expected_receipts: number
  acknowledged_receipts: number
  opened_receipts: number
  last_downloaded_at: string | null
  last_opened_at: string | null
}

export type AthleteInviteResult = { invite_url: string; expires_at: string; state: 'invite_ready' }
export type AthleteRevokeResult = { state: 'not_connected' | 'revoked'; revoked_at: string | null }

export interface PwaPairingCoachApi {
  getAthleteConnectionStatus(athleteId: string): Promise<AthleteConnectionStatus>
  issueAthleteInvite(athleteId: string, replacement: boolean): Promise<AthleteInviteResult>
  revokeAthleteInvite(athleteId: string): Promise<AthleteRevokeResult>
  revokeAthleteDevice(athleteId: string): Promise<AthleteRevokeResult>
}

type Options = { baseUrl?: string; getAccessToken(): Promise<string | null>; request?: typeof fetch }
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const nullableTimestamp = (value: unknown): value is string | null => value === null || timestamp(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))

export class PwaPairingApiError extends Error {
  constructor(readonly code: string, readonly requestId?: string) { super(code) }
}

export function createPwaPairingCoachApi(options: Options): PwaPairingCoachApi {
  const baseUrl = options.baseUrl?.replace(/\/$/u, '') ?? ''
  const request = options.request ?? fetch
  const post = async <T>(path: string, body: object, decode: (value: unknown) => value is T): Promise<T> => {
    const token = await options.getAccessToken()
    if (!token) throw new PwaPairingApiError('session_expired')
    const encoded = JSON.stringify(body)
    if (new TextEncoder().encode(encoded).byteLength > 16 * 1024) throw new PwaPairingApiError('invalid_request')
    let response: Response
    try { response = await request(`${baseUrl}${path}`, { method: 'POST', credentials: 'omit', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: encoded }) }
    catch { throw new PwaPairingApiError('network_unavailable') }
    const requestId = response.headers.get('x-request-id')?.slice(0, 128)
    let value: unknown
    try {
      const text = await response.text()
      if (new TextEncoder().encode(text).byteLength > 64 * 1024) throw new Error('oversize')
      value = JSON.parse(text)
    } catch { throw new PwaPairingApiError('invalid_response', requestId) }
    if (!response.ok) {
      const code = exact(value, ['error']) && typeof value.error === 'string' ? value.error : 'request_rejected'
      throw new PwaPairingApiError(code, requestId)
    }
    if (!decode(value)) throw new PwaPairingApiError('invalid_response', requestId)
    return value
  }
  const invite = (value: unknown): value is AthleteInviteResult => exact(value, ['invite_url', 'expires_at', 'state'])
    && typeof value.invite_url === 'string' && (() => { try { return new URL(value.invite_url as string).protocol === 'https:' } catch { return false } })()
    && timestamp(value.expires_at) && value.state === 'invite_ready'
  const revoked = (value: unknown): value is AthleteRevokeResult => exact(value, ['state', 'revoked_at'])
    && (value.state === 'not_connected' || value.state === 'revoked') && nullableTimestamp(value.revoked_at)
  const status = (value: unknown): value is AthleteConnectionStatus => exact(value, ['state', 'invite_active', 'invite_created_at', 'invite_expires_at', 'paired_at', 'device_last_seen_at', 'device_revoked_at', 'expected_receipts', 'acknowledged_receipts', 'opened_receipts', 'last_downloaded_at', 'last_opened_at'])
    && typeof value.state === 'string' && ['not_connected', 'invite_ready', 'paired', 'waiting_for_download', 'partially_downloaded', 'downloaded', 'opened', 'expired', 'revoked'].includes(value.state)
    && typeof value.invite_active === 'boolean'
    && nullableTimestamp(value.invite_created_at) && nullableTimestamp(value.invite_expires_at) && nullableTimestamp(value.paired_at)
    && nullableTimestamp(value.device_last_seen_at) && nullableTimestamp(value.device_revoked_at)
    && integer(value.expected_receipts) && integer(value.acknowledged_receipts) && integer(value.opened_receipts)
    && nullableTimestamp(value.last_downloaded_at) && nullableTimestamp(value.last_opened_at)
  return {
    getAthleteConnectionStatus: athlete_id => post('/api/athlete-invites/v1/status', { athlete_id }, status),
    issueAthleteInvite: (athlete_id, replacement) => post('/api/athlete-invites/v1/issue', { request_id: crypto.randomUUID(), athlete_id, replacement }, invite),
    revokeAthleteInvite: athlete_id => post('/api/athlete-invites/v1/revoke', { request_id: crypto.randomUUID(), athlete_id }, revoked),
    revokeAthleteDevice: athlete_id => post('/api/athlete-device/v1/revoke', { request_id: crypto.randomUUID(), athlete_id }, revoked),
  }
}
