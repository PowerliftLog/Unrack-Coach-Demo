import { useEffect, useId, useRef, useState } from 'react'
import { ModalDialog } from './ModalDialog'
import { CoachApiError, type CoachEraseAthleteInputV1, type October18CoachApi } from './lib/coach-api'

export function CoachAthleteErasure({ erase, gym, athlete, name, onClose, onErased }: {
  erase: October18CoachApi['eraseCoachAthleteV1']
  gym: string
  athlete: string
  name: string
  onClose(): void
  onErased(): void
}) {
  const titleId = useId()
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attempt = useRef<CoachEraseAthleteInputV1 | null>(null)
  const inFlight = useRef(false)
  const active = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  const confirmName = confirmation.trim()
  async function apply() {
    if (inFlight.current || confirmName !== name) return
    // Send the roster name itself once the typed text matches it, so Unicode trimming can't block a real name.
    attempt.current ??= { request_id: crypto.randomUUID(), gym, athlete, confirm_name: name }
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await erase(attempt.current)
    } catch (cause) {
      if (active.current) {
        if (cause instanceof CoachApiError && cause.status === 422) {
          // Nothing was erased: the next try is a fresh request.
          attempt.current = null
          setRetry(false)
          setError(new CoachApiError('erase_confirm_required').message)
        } else if (cause instanceof CoachApiError && cause.status === 409 && cause.code === 'erase_refused') {
          setRetry(false)
          setError(cause.message)
        } else if (!(cause instanceof CoachApiError) || cause.status === null || cause.status >= 500
          || cause.code === 'serialization_retry' || cause.code === 'invalid_response' || [408, 429].includes(cause.status)) {
          setRetry(true)
          setError('Check your connection and try again. Retrying is safe.')
        } else {
          setRetry(false)
          setError(cause.message)
        }
      }
      return
    } finally {
      inFlight.current = false
      if (active.current) setBusy(false)
    }
    if (active.current) {
      onClose()
      onErased()
    }
  }

  return <ModalDialog box className="dialog oct18-dialog" labelledBy={titleId} onEscape={() => { if (!busy) onClose() }}>
    <h2 id={titleId}>Delete {name}'s data?</h2>
    <p>Use this when the athlete can't delete it themselves, for example after losing their phone.</p>
    <p>This permanently deletes their name, profile, logged workouts, maxes, bodyweight, coach notes and delivered programs, and disconnects every phone they used. Sets not yet synced from a phone are lost. The cycles you built for them in the builder stay yours, without their logs or name, under "Deleted athlete" in Removed clients and the Library.</p>
    <p><strong>This can't be undone.</strong></p>
    <label className="oct18-erasure-confirm">Type the client's name to confirm
      <input autoFocus type="text" placeholder={name} value={confirmation} disabled={busy || retry} onChange={event => setConfirmation(event.target.value)} />
    </label>
    {error && <p role="alert" className="workspace-error">{error}</p>}
    <div className="dialog-actions">
      <button className="button outline" disabled={busy} onClick={onClose}>Cancel</button>
      <button className="button primary danger" disabled={busy || confirmName !== name} onClick={() => void apply()}>
        {busy ? 'Deleting…' : retry ? 'Retry same request' : 'Delete data permanently'}
      </button>
    </div>
  </ModalDialog>
}
