import { useCallback, useEffect, useRef, useState } from 'react'
import type { CoachErasedAthleteDraftCursor, CoachErasedAthleteDraftsV2, October18CoachApi } from './coach-api'

export function useErasedAthleteDrafts(gym: string, getPage?: October18CoachApi['getCoachErasedAthleteDraftsV2']) {
  const [page, setPage] = useState<CoachErasedAthleteDraftsV2 | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const epoch = useRef(0)
  const inFlight = useRef(false)

  const read = useCallback(async (cursor: CoachErasedAthleteDraftCursor | null, all = false) => {
    if (!getPage || inFlight.current) return
    const token = epoch.current
    const append = cursor !== null
    const loaded: CoachErasedAthleteDraftsV2[] = []
    let readFailed = false
    inFlight.current = true
    setLoading(true)
    setFailed(false)
    try {
      do {
        const next = await getPage({ gym, page_limit: 100,
          cursor_updated_at: cursor?.updated_at ?? null, cursor_draft: cursor?.draft_id ?? null })
        if (token !== epoch.current) return
        loaded.push(next)
        cursor = next.next_cursor
      } while (all && cursor)
    } catch {
      readFailed = true
    } finally {
      if (token === epoch.current) {
        const last = loaded.at(-1)
        if (last) setPage(previous => {
          const items = append && previous ? [...previous.items] : []
          const seen = new Set(items.map(item => item.draft_id))
          for (const { items: newItems } of loaded) {
            for (const item of newItems) {
              if (seen.has(item.draft_id)) continue
              seen.add(item.draft_id)
              items.push(item)
            }
          }
          return { ...last, items }
        })
        if (readFailed) setFailed(true)
        inFlight.current = false
        setLoading(false)
      }
    }
  }, [getPage, gym])

  useEffect(() => {
    setPage(null)
    setLoading(false)
    setFailed(false)
    void read(null)
    return () => {
      ++epoch.current
      inFlight.current = false
    }
  }, [read])

  const cursor = page?.next_cursor
  const loadAll = useCallback(() => { if (cursor) return read(cursor, true) }, [cursor, read])
  return { page, loading, failed, loadAll, showMore: () => { if (cursor) void read(cursor) } }
}
