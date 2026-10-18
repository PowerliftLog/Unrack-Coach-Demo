import { useEffect, useRef, useState } from 'react'
import { CoachApiError, type October18CoachApi, type PercentageProgrammingApi, type CoachPersonalTrackingRequestV2, type CoachPersonalTrackingReviewInputV2, type ProgrammingBasisOptionV1 } from './lib/coach-api'

type Api = Partial<October18CoachApi & Pick<PercentageProgrammingApi, 'getProgrammingMaxesV1' | 'getAthleteTrackingV1'>>
const failure = (cause: unknown) => cause instanceof CoachApiError && (cause.status === 404 || cause.code === 'feature_unavailable') ? 'Tracking reviews are unavailable while the workspace update finishes. Retry shortly.' : cause instanceof Error ? cause.message : 'The tracking review could not be confirmed. Retry the same request.'
export function PersonalTrackingInbox({ api, gym }: { api: Api; gym: string }) {
  const [items, setItems] = useState<CoachPersonalTrackingRequestV2[]>([]), [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CoachPersonalTrackingRequestV2 | null>(null), [options, setOptions] = useState<ProgrammingBasisOptionV1[]>([])
  const [exercise, setExercise] = useState(''), [trackingVersion, setTrackingVersion] = useState<number | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null), [reviewLoading, setReviewLoading] = useState(false)
  const attempt = useRef<CoachPersonalTrackingReviewInputV2 | null>(null), epoch = useRef(0), reviewEpoch = useRef(0), inFlight = useRef(false), dialog = useRef<HTMLDialogElement>(null)
  const load = async (more = false) => {
    if (!api.getCoachPersonalTrackingRequestsV2) return
    const token = ++epoch.current; setLoading(true); setError(null)
    try {
      const page = await api.getCoachPersonalTrackingRequestsV2({ gym, athlete: null, cursor: more ? cursor : null, page_size: 20 })
      if (token === epoch.current) { setItems(old => more ? [...old, ...page.items.filter(row => !old.some(item => item.request_id === row.request_id))] : page.items); setCursor(page.next_cursor) }
    } catch (cause) { if (token === epoch.current) setError(failure(cause)) } finally { if (token === epoch.current) setLoading(false) }
  }
  useEffect(() => { setItems([]); setCursor(null); void load(); return () => { ++epoch.current; ++reviewEpoch.current } }, [api, gym])
  const review = async (row: CoachPersonalTrackingRequestV2) => {
    const token = ++reviewEpoch.current
    setSelected(row); setOptions([]); setExercise(''); setTrackingVersion(null); setReviewError(null); setReviewLoading(true); attempt.current = null
    try {
      if (!api.getProgrammingMaxesV1 || !api.getAthleteTrackingV1) throw new Error('Exercise mapping is unavailable. Retry after the workspace update.')
      const [catalog, tracking] = await Promise.all([api.getProgrammingMaxesV1({ target_gym: gym, target_athlete: row.athlete_id }), api.getAthleteTrackingV1({ target_gym: gym, target_athlete: row.athlete_id })])
      if (token === reviewEpoch.current) { setOptions(catalog.basis_options.filter(option => option.archived_at === null)); setTrackingVersion(tracking.tracking_version) }
    } catch (cause) { if (token === reviewEpoch.current) setReviewError(failure(cause)) } finally { if (token === reviewEpoch.current) setReviewLoading(false) }
  }
  useEffect(() => { if (selected) { if (dialog.current?.showModal) dialog.current.showModal(); else dialog.current?.setAttribute('open', '') } }, [selected?.request_id])
  const apply = async (action: 'resolve' | 'dismiss') => {
    if (!api.reviewCoachPersonalTrackingRequestV2 || !selected || trackingVersion === null || inFlight.current || action === 'resolve' && !exercise) return
    const token = reviewEpoch.current
    attempt.current ??= { request_id: crypto.randomUUID(), gym, mapping_request_id: selected.request_id, expected_review_version: selected.review_version, expected_tracking_version: trackingVersion, action, exercise_id: action === 'resolve' ? exercise : null }
    inFlight.current = true; setBusy(true); setReviewError(null)
    try {
      await api.reviewCoachPersonalTrackingRequestV2(attempt.current)
      if (token !== reviewEpoch.current) return
      attempt.current = null; setSelected(null); void load()
    } catch (cause) {
      if (token !== reviewEpoch.current) return
      setReviewError(failure(cause))
      if (cause instanceof CoachApiError && cause.status !== null && cause.status >= 400 && cause.status < 500 && ![408, 429].includes(cause.status)) { attempt.current = null; setTrackingVersion(null) }
    } finally { inFlight.current = false; if (token === reviewEpoch.current) setBusy(false) }
  }
  if (!api.getCoachPersonalTrackingRequestsV2) return null
  return <section className="oct18-tracking-inbox" aria-label="Exercise tracking requests"><header><h2>Exercise tracking requests</h2><button className="text-button" disabled={loading || busy} onClick={() => void load()}>Refresh requests</button></header><p>Review the athlete’s selected lift before joining its metrics to a library exercise.</p>{items.map(row => <article className="oct18-review-row" key={row.request_id}><div><strong>{row.athlete_name} · {row.exercise_name}</strong><small>{row.status === 'pending' ? 'Personal tracking · Needs mapping' : row.status === 'resolved' ? 'Mapped to library' : 'Dismissed · Personal tracking retained'}</small></div>{row.status === 'pending' && <button className="button outline" onClick={() => void review(row)}>Review lift</button>}</article>)}{!items.length && !loading && !error && <p>No exercise tracking requests.</p>}{loading && <p role="status">Loading requests…</p>}{error && <p className="workspace-error" role="alert">{error}</p>}{cursor && items.length < 500 && <button className="button outline" disabled={loading} onClick={() => void load(true)}>Load more tracking requests</button>}
    {selected && <dialog ref={dialog} className="dialog oct18-dialog" aria-labelledby="tracking-review-title" onCancel={event => { event.preventDefault(); if (!busy && !attempt.current) { ++reviewEpoch.current; setSelected(null) } }}><h2 id="tracking-review-title">Review {selected.exercise_name}</h2><p>{selected.athlete_name} tracks this particular exercise in their program. Mapping joins its metrics to the chosen library identity and requires the athlete to keep tracking that library lift. It does not change saved prescriptions or performed sets.</p><label>Library exercise<select disabled={busy || reviewLoading || !!attempt.current} value={exercise} onChange={event => setExercise(event.target.value)}><option value="">Choose the same lift</option>{options.map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}</select></label><p>Dismiss keeps the athlete’s personal tracking and leaves the request in review history.</p>{reviewLoading && <p role="status">Loading current tracking and exercises…</p>}{reviewError && <p className="workspace-error" role="alert">{reviewError}</p>}<div className="dialog-actions"><button className="button outline" disabled={busy || !!attempt.current} onClick={() => { ++reviewEpoch.current; setSelected(null) }}>Cancel</button>{trackingVersion === null && !reviewLoading && <button className="button outline" onClick={() => { setSelected(null); void load() }}>Refresh request list</button>}{attempt.current ? <button className="button primary" disabled={busy} onClick={() => void apply(attempt.current!.action)}>Retry same review</button> : <><button className="button outline" disabled={busy || reviewLoading || trackingVersion === null} onClick={() => void apply('dismiss')}>Dismiss request</button><button className="button primary" disabled={busy || reviewLoading || trackingVersion === null || !exercise} onClick={() => void apply('resolve')}>Map and require tracking</button></>}</div></dialog>}
  </section>
}
