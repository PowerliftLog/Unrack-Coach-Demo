import { useEffect, useMemo, useRef, useState } from 'react'
import type { CoachCycleDraftRecord, createCoachCycleDraftApi } from './lib/coach-cycle-draft-api'
import type { CoachErasedAthleteDraftSummaryV1, October18CoachApi } from './lib/coach-api'

// Library (Joe, Nov 16 review 3): every saved cycle across the coach's clients, ready to copy to
// the athlete being built. Copying makes a new unsaved draft and leaves the original intact.
type DraftApi = Pick<ReturnType<typeof createCoachCycleDraftApi>, 'list' | 'read'>
export type ErasedAthleteDraftApi = Partial<Pick<October18CoachApi, 'getCoachErasedAthleteDraftsV1' | 'readCoachErasedAthleteDraftV1'>>
type Entry = {
  id: string; clientName: string; updatedAt: string; record: CoachCycleDraftRecord | null
  intake: Pick<CoachErasedAthleteDraftSummaryV1, 'name' | 'weeks' | 'days' | 'unit'>
}
const MAX_CLIENTS = 60, MAX_READS = 120
const DELETED_ATHLETE = 'Deleted athlete'

export function CoachCycleLibrary({ api, erasedApi, gym, clients, targetName, onUse, onClose }: {
  api: DraftApi; erasedApi?: ErasedAthleteDraftApi; gym: string; clients: { id: string; name: string }[]; targetName: string
  onUse(record: CoachCycleDraftRecord, clientName: string): void; onClose(): void
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [reading, setReading] = useState(false)
  const [readFailed, setReadFailed] = useState(false)
  const [search, setSearch] = useState('')
  const readAttempt = useRef<object | null>(null)
  const useRecord = useRef(onUse)
  useEffect(() => { useRecord.current = onUse }, [onUse])
  const clientKey = JSON.stringify(clients.map(client => [client.id, client.name]))
  useEffect(() => {
    let active = true
    setEntries(null)
    setFailed(false)
    setReading(false)
    setReadFailed(false)
    void (async () => {
      const drafts: { id: string; athleteId: string; clientName: string; updatedAt: string }[] = []
      let error = false
      const erased = (async () => {
        if (!erasedApi?.getCoachErasedAthleteDraftsV1 || !erasedApi.readCoachErasedAthleteDraftV1) return []
        try { return (await erasedApi.getCoachErasedAthleteDraftsV1({ gym, page_limit: 100 })).items }
        catch { error = true; return [] }
      })()
      for (const client of clients.slice(0, MAX_CLIENTS)) {
        try {
          const list = await api.list({ gym, athlete: client.id, page_limit: 100 })
          for (const draft of list) drafts.push({ id: draft.draft_id, athleteId: client.id, clientName: client.name, updatedAt: draft.updated_at })
        } catch { error = true }
        if (!active) return
      }
      drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      const existing = Promise.all(drafts.slice(0, MAX_READS).map(async ({ id, athleteId, clientName, updatedAt }): Promise<Entry | null> => {
        try {
          const record = await api.read({ gym, athlete: athleteId, draft: id })
          return { id, clientName, updatedAt, record, intake: record.source.intake }
        } catch { error = true; return null }
      }))
      const [saved, deleted] = await Promise.all([existing, erased])
      if (!active) return
      const erasedIds = new Set(deleted.map(item => item.draft_id))
      const found: Entry[] = [
        ...saved.filter((entry): entry is Entry => entry !== null && !erasedIds.has(entry.id)),
        ...deleted.map(intake => ({ id: intake.draft_id, clientName: DELETED_ATHLETE, updatedAt: intake.updated_at, record: null, intake })),
      ]
      setEntries(found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
      setFailed(error)
    })()
    return () => { active = false; readAttempt.current = null }
  }, [api, erasedApi, gym, clientKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (entries ?? []).filter(entry => !needle || `${entry.intake.name} ${entry.clientName}`.toLowerCase().includes(needle))
  }, [entries, search])

  async function useEntry(entry: Entry) {
    if (readAttempt.current) return
    if (entry.record) {
      onUse(entry.record, entry.clientName)
      return
    }
    if (!erasedApi?.readCoachErasedAthleteDraftV1) return
    const attempt = {}
    readAttempt.current = attempt
    setReading(true)
    setReadFailed(false)
    try {
      const { draft_id, updated_at, revision, source } = await erasedApi.readCoachErasedAthleteDraftV1({ gym, draft: entry.id })
      if (readAttempt.current !== attempt) return
      // Copying consumes only source. The erased read contract has no source hash.
      useRecord.current({ draft_id, gym_id: gym, athlete_id: source.intake.client, source_hash: '',
        updated_at, revision, source, publishable: false }, DELETED_ATHLETE)
    } catch {
      if (readAttempt.current === attempt) setReadFailed(true)
    } finally {
      if (readAttempt.current === attempt) {
        readAttempt.current = null
        setReading(false)
      }
    }
  }

  return <div className="ccd-library-panel">
    <div className="ccd-drawer-head"><h2>Library</h2><button onClick={onClose}>Back to sheet</button></div>
    <p>Every saved cycle across your clients. <b>Use for {targetName}</b> copies it into a new draft for {targetName}, starting next Monday. The original stays as it is.</p>
    <input className="ccd-library-search" aria-label="Search library" placeholder="Search by cycle or client" value={search} onChange={event => setSearch(event.target.value)} />
    {!entries ? <p role="status">Loading saved cycles…</p>
      : shown.length === 0 ? <p>{entries.length ? 'No cycles match.' : 'No saved cycles yet. Save a cycle for any client and it shows up here.'}</p>
      : <ul className="ccd-library-list" aria-label="Saved cycles">{shown.map(entry => {
        const { intake } = entry
        const details = [
          intake.weeks !== null ? `${intake.weeks} ${intake.weeks === 1 ? 'week' : 'weeks'}` : '',
          intake.days.map(day => day.slice(0, 3)).join(', '), intake.unit,
        ].filter(Boolean).join(' · ')
        return <li key={entry.id}>
          <div><strong>{intake.name || 'Untitled cycle'}</strong>
            {details && <span>{details}</span>}
            <small>{entry.clientName} · saved {new Date(entry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></div>
          <button className="button primary" disabled={reading} onClick={() => void useEntry(entry)}>Use for {targetName}</button>
        </li>
      })}</ul>}
    {failed && <p className="ccd-note">Some clients' cycles could not be loaded.</p>}
    {reading && <p className="ccd-note" role="status">Loading saved cycle…</p>}
    {readFailed && <p className="ccd-note" role="alert">That cycle could not be loaded. Try again.</p>}
  </div>
}

/** Next Monday on or after tomorrow, local time (published cycles start on a Monday). */
export function nextMondayIso(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
