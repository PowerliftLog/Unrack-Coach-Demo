import { useEffect, useRef, useState } from 'react'
import { CoachApiError, type October18CoachApi, type CoachClientRemovalContextV1, type CoachClientRemovalInputV1, type CoachRemovedClientsV1 } from './lib/coach-api'

const failure = (cause: unknown) => cause instanceof CoachApiError && (cause.status === 404 || cause.code === 'feature_unavailable') ? 'Client removal is unavailable while the workspace update finishes. Retry shortly.' : cause instanceof Error ? cause.message : 'The client change could not be confirmed. Retry the same request.'
export function CoachClientRemoval({ api, gym, client, onClose, onChanged }: { api: Partial<October18CoachApi>; gym: string; client: { athlete: string; name: string } | null; onClose(): void; onChanged(): void }) {
  const [items, setItems] = useState<CoachRemovedClientsV1['items']>([]), [cursor, setCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState(client), [context, setContext] = useState<CoachClientRemovalContextV1 | null>(null)
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null), epoch = useRef(0), inFlight = useRef(false), attempt = useRef<CoachClientRemovalInputV1 | null>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => { if (dialog.current?.showModal) dialog.current.showModal(); else dialog.current?.setAttribute('open', ''); return () => { ++epoch.current; opener.current?.isConnected && opener.current.focus() } }, [])
  const read = async (more = false) => {
    const token = ++epoch.current; setLoading(true); setError(null); attempt.current = null
    try {
      if (selected) {
        setContext(null)
        if (!api.getCoachClientRemovalContextV1) throw new Error('Client removal is unavailable. Retry after the workspace update.')
        const next = await api.getCoachClientRemovalContextV1({ gym, athlete: selected.athlete })
        if (token === epoch.current) setContext(next)
      } else {
        if (!api.getCoachRemovedClientsV1) throw new Error('Removed clients are unavailable. Retry after the workspace update.')
        const page = await api.getCoachRemovedClientsV1({ gym, cursor: more ? cursor : null, page_size: 20 })
        if (token === epoch.current) { setItems(old => more ? [...old, ...page.items.filter(row => !old.some(item => item.athlete_id === row.athlete_id))] : page.items); setCursor(page.next_cursor) }
      }
    } catch (cause) { if (token === epoch.current) setError(failure(cause)) } finally { if (token === epoch.current) setLoading(false) }
  }
  useEffect(() => { void read() }, [gym, selected?.athlete])
  const apply = async () => {
    if (!selected || !context || !api.setCoachClientRemovedV1 || inFlight.current) return
    const token = epoch.current
    attempt.current ??= { request_id: crypto.randomUUID(), gym, athlete: selected.athlete, expected_membership_state: context.membership_state, expected_pairing_epoch: context.pairing_epoch, removed: !context.removed }
    inFlight.current = true; setBusy(true); setError(null)
    try {
      await api.setCoachClientRemovedV1(attempt.current)
      if (token !== epoch.current) return
      attempt.current = null; onChanged(); onClose()
    } catch (cause) {
      if (token !== epoch.current) return
      setError(failure(cause))
      if (cause instanceof CoachApiError && cause.status !== null && cause.status >= 400 && cause.status < 500 && ![408, 429].includes(cause.status)) { attempt.current = null; setContext(null) }
    } finally { inFlight.current = false; if (token === epoch.current) setBusy(false) }
  }
  return <dialog ref={dialog} className="dialog oct18-dialog" aria-labelledby="client-removal-title" onCancel={event => { event.preventDefault(); if (!busy && !attempt.current) onClose() }}>
    <h2 id="client-removal-title">{selected ? context?.removed ? 'Restore client?' : 'Remove client?' : 'Removed clients'}</h2>
    {selected ? <><p><strong>{selected.name}</strong></p>{context?.removed ? <p>Restore this client to your roster. Saved programming and history remain available. Assign a new plan and connect the app with a new invite; previous connections and plans stay ended.</p> : <p>Remove this client from the roster and end their current plans and app connections. Saved programming and athlete history are retained. You can restore the client later from Removed clients.</p>}</> : <><p>Restore a client to the roster without reviving old app credentials or assignments.</p>{items.map(item => <article className="oct18-review-row" key={item.athlete_id}><strong>{item.name}</strong><button className="button outline" disabled={busy || loading} onClick={() => setSelected({ athlete: item.athlete_id, name: item.name })}>Restore client</button></article>)}{!loading && !error && !items.length && <p>No removed clients.</p>}{cursor && items.length < 500 && <button className="button outline" disabled={loading} onClick={() => void read(true)}>Load more removed clients</button>}</>}
    {loading && <p role="status">Loading current membership…</p>}{error && <p role="alert" className="workspace-error">{error}</p>}
    <div className="dialog-actions"><button autoFocus className="button outline" disabled={busy || !!attempt.current} onClick={onClose}>Cancel</button>{error && !attempt.current && <button className="button outline" disabled={busy || loading} onClick={() => void read()}>Refresh and review</button>}{selected && context && <button className="button primary" disabled={busy || loading} onClick={() => void apply()}>{busy ? 'Saving…' : attempt.current ? 'Retry same request' : context.removed ? 'Restore client' : 'Remove client'}</button>}</div>
  </dialog>
}
