import { useEffect, useMemo, useRef, useState } from 'react'
import type { CoachCycleDraftRecord, createCoachCycleDraftApi } from './lib/coach-cycle-draft-api'
import type { CoachErasedAthleteDraftSummaryV1, October18CoachApi } from './lib/coach-api'
import { coachCycleTemplatePeek } from './lib/coach-cycle-template'
import { useErasedAthleteDrafts } from './lib/use-erased-athlete-drafts'

// Library (Joe, Nov 16 review 3): every saved cycle across the coach's clients, ready to copy to
// the athlete being built. Copying makes a new unsaved draft and leaves the original intact.
type DraftApi = Pick<ReturnType<typeof createCoachCycleDraftApi>, 'list' | 'read'>
export type ErasedAthleteDraftApi = Partial<Pick<October18CoachApi, 'getCoachErasedAthleteDraftsV2' | 'readCoachErasedAthleteDraftV1'>>
type EntrySource = {
  id: string; clientName: string; updatedAt: string; record: CoachCycleDraftRecord | null
  peek?: string
  intake: Pick<CoachErasedAthleteDraftSummaryV1, 'name' | 'weeks' | 'days' | 'unit'>
}
type Entry = Omit<EntrySource, 'intake'> & { name: string; searchText: string; details: string }
const MAX_CLIENTS = 60, MAX_READS = 120
const DELETED_ATHLETE = 'Deleted athlete'

function libraryEntry({ intake, ...entry }: EntrySource): Entry {
  const details = [
    entry.clientName,
    intake.weeks !== null ? `${intake.weeks} ${intake.weeks === 1 ? 'week' : 'weeks'}` : '',
    intake.days.map(day => day.slice(0, 3)).join(', '), intake.unit,
    `saved ${new Date(entry.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
  ].filter(Boolean).join(' · ')
  return {
    ...entry, details, name: intake.name || 'Untitled cycle',
    searchText: `${intake.name} ${entry.clientName} ${entry.peek ?? ''}`.toLowerCase(),
  }
}

export function CoachCycleLibrary({ api, erasedApi, gym, clients, targetName, onUse, onClose }: {
  api: DraftApi; erasedApi?: ErasedAthleteDraftApi; gym: string; clients: { id: string; name: string }[]; targetName: string
  onUse(record: CoachCycleDraftRecord, clientName: string): void; onClose(): void
}) {
  const [saved, setSaved] = useState<Entry[] | null>(null)
  const erasedDrafts = useErasedAthleteDrafts(gym, erasedApi?.readCoachErasedAthleteDraftV1 ? erasedApi.getCoachErasedAthleteDraftsV2 : undefined)
  const [failed, setFailed] = useState(false)
  const [reading, setReading] = useState(false)
  const [readFailed, setReadFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [deletedOpen, setDeletedOpen] = useState(false)
  const needle = search.trim().toLowerCase()
  const showDeleted = deletedOpen || Boolean(needle)
  const { loadAll, page: erasedPage, loading: loadingErased, failed: erasedFailed } = erasedDrafts
  useEffect(() => {
    if (showDeleted && !loadingErased && !erasedFailed) void loadAll()
  }, [showDeleted, loadingErased, erasedFailed, loadAll])
  const readAttempt = useRef<object | null>(null)
  const useRecord = useRef(onUse)
  useEffect(() => { useRecord.current = onUse }, [onUse])
  const clientKey = JSON.stringify(clients.map(client => [client.id, client.name]))
  useEffect(() => {
    let active = true
    setSaved(null)
    setFailed(false)
    setReading(false)
    setReadFailed(false)
    void (async () => {
      const drafts: { id: string; athleteId: string; clientName: string; updatedAt: string }[] = []
      let error = false
      for (const client of clients.slice(0, MAX_CLIENTS)) {
        try {
          const list = await api.list({ gym, athlete: client.id, page_limit: 100 })
          for (const draft of list) drafts.push({ id: draft.draft_id, athleteId: client.id, clientName: client.name, updatedAt: draft.updated_at })
        } catch { error = true }
        if (!active) return
      }
      drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      const existing = await Promise.all(drafts.slice(0, MAX_READS).map(async ({ id, athleteId, clientName, updatedAt }): Promise<Entry | null> => {
        try {
          const record = await api.read({ gym, athlete: athleteId, draft: id })
          return libraryEntry({ id, clientName, updatedAt, record, intake: record.source.intake, peek: coachCycleTemplatePeek(record.source) })
        } catch { error = true; return null }
      }))
      if (!active) return
      setSaved(existing.filter((entry): entry is Entry => entry !== null))
      setFailed(error)
    })()
    return () => { active = false; readAttempt.current = null }
  }, [api, erasedApi, gym, clientKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const entries = useMemo(() => {
    if (!saved) return null
    const deleted = (erasedPage?.items ?? []).map(intake => libraryEntry({
      id: intake.draft_id, clientName: DELETED_ATHLETE, updatedAt: intake.updated_at, record: null, intake,
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const erasedIds = new Set(deleted.map(entry => entry.id))
    return { saved: saved.filter(entry => !erasedIds.has(entry.id)), deleted }
  }, [saved, erasedPage])
  const { shownSaved, matchingDeleted } = useMemo(() => {
    const matches = (entry: Entry) => entry.searchText.includes(needle)
    return { shownSaved: entries?.saved.filter(matches) ?? [], matchingDeleted: entries?.deleted.filter(matches) ?? [] }
  }, [entries, needle])
  const hasMoreDeleted = Boolean(erasedPage?.next_cursor)
  const loadingDeleted = showDeleted && (loadingErased || hasMoreDeleted && !erasedFailed)
  const shownDeleted = showDeleted && !(needle && loadingDeleted) ? matchingDeleted : []

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

  function cycleList(rows: Entry[], label: string) {
    return <ul className="ccd-library-list" aria-label={label}>{rows.map(entry => {
      const { name, details } = entry
      return <li key={entry.id}>
        <div>
          <strong>{name}</strong>
          <span>{details}</span>
          {entry.peek && <small className="ccd-library-peek">{entry.peek}</small>}
        </div>
        <button className="button primary" aria-label={`Use ${name} for ${targetName}`} disabled={reading} onClick={() => void useEntry(entry)}>Use</button>
      </li>
    })}</ul>
  }

  const deletedCount = entries?.deleted.length ?? 0
  return <div className="ccd-library-panel">
    <div className="ccd-drawer-head"><h2>Library</h2><button onClick={onClose}>Back to sheet</button></div>
    <p>Copy a cycle you've written. The copy starts next Monday for {targetName}; the original doesn't change.</p>
    <input className="ccd-library-search" aria-label="Search library" placeholder="Search by cycle, athlete or exercise" value={search} onChange={event => setSearch(event.target.value)} />
    {!entries || (loadingErased && !erasedPage) ? <p role="status">Loading saved cycles…</p> : <>
      {shownSaved.length > 0 && cycleList(shownSaved, 'Saved cycles')}
      {!needle && (deletedCount > 0 || hasMoreDeleted) && <button className="ccd-quiet ccd-library-fold" aria-expanded={deletedOpen}
        onClick={() => setDeletedOpen(value => !value)}>{deletedOpen ? 'Hide cycles from deleted athletes'
          : hasMoreDeleted ? 'Show cycles from deleted athletes' : `Show ${deletedCount} ${deletedCount === 1 ? 'cycle' : 'cycles'} from deleted athletes`}</button>}
      {shownDeleted.length > 0 && <><h3 className="ccd-library-group-title">From deleted athletes</h3>
        {cycleList(shownDeleted, 'From deleted athletes')}</>}
      {loadingDeleted && <p role="status">Loading cycles from deleted athletes…</p>}
      {!loadingDeleted && !shownSaved.length && !shownDeleted.length && (needle || !deletedCount && !hasMoreDeleted)
        && <p>{entries.saved.length || deletedCount ? 'No cycles match.' : 'No saved cycles yet. Save a cycle for any client and it shows up here.'}</p>}
      {showDeleted && erasedFailed && hasMoreDeleted && <button className="button outline" onClick={loadAll}>Show more</button>}
    </>}
    {(failed || (erasedFailed && !erasedPage)) && <p className="ccd-note">Some clients' cycles could not be loaded.</p>}
    {erasedFailed && erasedPage && <p className="ccd-note" role="alert">More cycles could not be loaded. Try again.</p>}
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
