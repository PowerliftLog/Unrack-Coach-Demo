import { useEffect, useMemo, useState } from 'react'
import type { CoachCycleDraftRecord, createCoachCycleDraftApi } from './lib/coach-cycle-draft-api'

// Library (Joe, Nov 16 review 3): every saved cycle across the coach's clients, ready to copy to
// the athlete being built. It reads through the same owner-checked draft list/read calls the
// builder already uses; copying makes a new unsaved draft and never changes the original.
type DraftApi = Pick<ReturnType<typeof createCoachCycleDraftApi>, 'list' | 'read'>
type Entry = { id: string; athleteId: string; clientName: string; updatedAt: string; record: CoachCycleDraftRecord | null }
const MAX_CLIENTS = 60, MAX_READS = 120

export function CoachCycleLibrary({ api, gym, clients, targetName, onUse, onClose }: {
  api: DraftApi; gym: string; clients: { id: string; name: string }[]; targetName: string
  onUse(record: CoachCycleDraftRecord, clientName: string): void; onClose(): void
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const clientKey = JSON.stringify(clients.map(client => [client.id, client.name]))
  useEffect(() => {
    let active = true
    void (async () => {
      const found: Entry[] = []
      let error = false
      for (const client of clients.slice(0, MAX_CLIENTS)) {
        try {
          const list = await api.list({ gym, athlete: client.id, page_limit: 100 })
          for (const draft of list) found.push({ id: draft.draft_id, athleteId: client.id, clientName: client.name, updatedAt: draft.updated_at, record: null })
        } catch { error = true }
        if (!active) return
      }
      found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      await Promise.all(found.slice(0, MAX_READS).map(async entry => {
        try { entry.record = await api.read({ gym, athlete: entry.athleteId, draft: entry.id }) } catch { error = true }
      }))
      if (!active) return
      setEntries(found.filter(entry => entry.record))
      setFailed(error)
    })()
    return () => { active = false }
  }, [api, gym, clientKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (entries ?? []).filter(entry => !needle || `${entry.record!.source.intake.name} ${entry.clientName}`.toLowerCase().includes(needle))
  }, [entries, search])
  return <div className="ccd-library-panel">
    <div className="ccd-drawer-head"><h2>Library</h2><button onClick={onClose}>Back to sheet</button></div>
    <p>Every saved cycle across your clients. <b>Use for {targetName}</b> copies it into a new draft for {targetName}, starting next Monday. The original stays as it is.</p>
    <input className="ccd-library-search" aria-label="Search library" placeholder="Search by cycle or client" value={search} onChange={event => setSearch(event.target.value)} />
    {!entries ? <p role="status">Loading saved cycles…</p>
      : shown.length === 0 ? <p>{entries.length ? 'No cycles match.' : 'No saved cycles yet. Save a cycle for any client and it shows up here.'}</p>
      : <ul className="ccd-library-list" aria-label="Saved cycles">{shown.map(entry => {
        const intake = entry.record!.source.intake
        return <li key={entry.id}>
          <div><strong>{intake.name || 'Untitled cycle'}</strong>
            <span>{intake.weeks} {intake.weeks === 1 ? 'week' : 'weeks'} · {intake.days.map(day => day.slice(0, 3)).join(', ')} · {intake.unit}</span>
            <small>{entry.clientName} · saved {new Date(entry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></div>
          <button className="button primary" onClick={() => onUse(entry.record!, entry.clientName)}>Use for {targetName}</button>
        </li>
      })}</ul>}
    {failed && <p className="ccd-note">Some clients' cycles could not be loaded.</p>}
  </div>
}

/** Next Monday on or after tomorrow, local time (published cycles start on a Monday). */
export function nextMondayIso(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
