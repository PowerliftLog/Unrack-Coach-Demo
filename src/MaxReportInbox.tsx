import { useEffect, useId, useRef, useState } from 'react'
import type { BacklogRevisionApi, CoachMaxReportV1 } from './lib/coach-api'

type Cursor = { reported_at: string; report_id: string }
export function MaxReportInbox({ api, gym, athlete = null, review = false, effectiveDate, selectedReportId, onOpen, onReviewed, onPendingCount, refreshKey = 0 }: {
  api: Partial<BacklogRevisionApi>; gym: string; athlete?: string | null; review?: boolean; effectiveDate?: string; selectedReportId?: string
  onOpen?(report: CoachMaxReportV1): void; onReviewed?(): void | Promise<void>
  onPendingCount?(count: number | null): void
  refreshKey?: number
}) {
  const [items, setItems] = useState<CoachMaxReportV1[]>([])
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const elementPrefix = useId()
  const epoch = useRef(0)
  const refresh = useRef<() => Promise<void>>(async () => {})
  const loadMore = useRef<() => Promise<void>>(async () => {})
  const requests = useRef(new Map<string, string>())
  const busyRef = useRef(false)
  const cursorRef = useRef<Cursor | null>(null)
  const pendingCountCallback = useRef(onPendingCount)
  pendingCountCallback.current = onPendingCount
  cursorRef.current = cursor
  useEffect(() => {
    const token = ++epoch.current
    let inFlight = false
    pendingCountCallback.current?.(null)
    setItems([]); setTotal(0); setCursor(null); setMore(false); setError(null)
    const read = async (append = false) => {
      if (!api.getCoachMaxReportInboxV1 || inFlight || busyRef.current || document.visibilityState === 'hidden') return
      inFlight = true; setLoading(true)
      try {
        const page = await api.getCoachMaxReportInboxV1({ target_gym: gym, target_athlete: athlete, cursor: append ? cursorRef.current : null, page_size: 10 })
        if (token !== epoch.current) return
        setItems(current => append ? [...current, ...page.items.filter(item => !current.some(existing => existing.report_id === item.report_id))] : page.items)
        setTotal(page.total_pending); setCursor(page.next_cursor); setMore(page.has_more); setError(null)
        pendingCountCallback.current?.(page.total_pending)
      } catch (cause) { if (token === epoch.current) { setItems([]); setTotal(0); setError(cause instanceof Error ? cause.message : 'Could not load 1RM reports.') } }
      finally { inFlight = false; if (token === epoch.current) setLoading(false) }
    }
    refresh.current = () => read(false); loadMore.current = () => read(true)
    void read()
    const foreground = () => { if (document.visibilityState !== 'hidden') void read() }
    const timer = window.setInterval(foreground, 30_000)
    window.addEventListener('focus', foreground); document.addEventListener('visibilitychange', foreground)
    return () => { ++epoch.current; window.clearInterval(timer); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground) }
  }, [api, gym, athlete, refreshKey])
  useEffect(() => {
    if (selectedReportId && items.some(item => item.report_id === selectedReportId)) document.getElementById(`${elementPrefix}-max-report-${selectedReportId}`)?.focus()
  }, [selectedReportId, items, elementPrefix])
  const act = async (report: CoachMaxReportV1, action: 'approve' | 'dismiss') => {
    if (!api.reviewCoachMaxReportV1 || busyRef.current || (action === 'approve' && !effectiveDate)) return
    const token = epoch.current
    const key = `${report.report_id}:${action}:${action === 'approve' ? effectiveDate : ''}`
    const requestId = requests.current.get(key) ?? crypto.randomUUID()
    requests.current.set(key, requestId); busyRef.current = true; setBusy(report.report_id); setError(null)
    try {
      await api.reviewCoachMaxReportV1({ request_id: requestId, target_gym: gym, target_athlete: report.athlete_id, report_id: report.report_id, action, effective_from: action === 'approve' ? effectiveDate! : null })
      if (token !== epoch.current) return
      setItems(current => current.filter(item => item.report_id !== report.report_id)); setTotal(current => Math.max(0, current - 1))
      await onReviewed?.()
    } catch (cause) { if (token === epoch.current) setError(cause instanceof Error ? cause.message : 'Could not review this 1RM report.') }
    finally { busyRef.current = false; if (token === epoch.current) { setBusy(null); void refresh.current() } }
  }
  if (!api.getCoachMaxReportInboxV1) return null
  if (!review && total === 0 && !error) return null
  return <section className="athlete-pr-alert max-report-inbox" aria-label={review ? 'Pending 1RM reports' : 'Athlete 1RM notifications'}>
    <h3>{review ? 'Athlete 1RM reports' : 'New athlete 1RM reports'}</h3>
    <p role="status" aria-live="polite">{total ? `${total} ${total === 1 ? 'report needs' : 'reports need'} coach review.` : loading ? 'Checking reports…' : 'No pending reports.'}</p>
    {review && <p>Reported values require approval before they can be used for programming.</p>}
    {error && <div role="alert"><p>{error}</p><button className="button outline" disabled={loading || Boolean(busy)} onClick={() => void refresh.current()}>Retry reports</button></div>}
    <div className="max-report-list">{items.map(report => <article id={`${elementPrefix}-max-report-${report.report_id}`} tabIndex={-1} key={report.report_id}>
      <div><strong>{report.athlete_name} · {report.exercise_name}</strong><span className="max-report-value">{report.value} {report.unit}</span><small>{report.source === 'workout_single' ? 'Athlete-confirmed workout single' : 'Athlete-reported profile 1RM'} · <time dateTime={report.reported_at}>{new Date(report.reported_at).toLocaleString()}</time></small></div>
      {review ? <div className="max-report-actions"><button className="button primary" disabled={Boolean(busy) || !effectiveDate} onClick={() => void act(report, 'approve')}>{busy === report.report_id ? 'Saving…' : 'Approve as tested 1RM'}</button><button className="button outline" disabled={Boolean(busy)} onClick={() => void act(report, 'dismiss')}>Dismiss report</button></div> : <button className="button outline" aria-label={`Review ${report.athlete_name} ${report.exercise_name} report`} onClick={() => onOpen?.(report)}>Review</button>}
      {review && report.workout && <details><summary>Reported workout set</summary><p>{report.workout.workout_title ?? 'Workout'} · Set {report.workout.set_number}: {report.value} {report.unit} × {report.workout.actual_reps}{report.actual_rpe === null ? '' : ` · RPE ${report.actual_rpe}`}</p>{report.workout.performed_at && <time dateTime={report.workout.performed_at}>{new Date(report.workout.performed_at).toLocaleString()}</time>}</details>}
    </article>)}</div>
    {more && <button className="button outline" disabled={loading || Boolean(busy)} onClick={() => void loadMore.current()}>Load more reports</button>}
  </section>
}
