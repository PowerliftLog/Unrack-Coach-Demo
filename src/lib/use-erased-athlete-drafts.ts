import { useCallback, useEffect, useRef, useState } from 'react'
import type { CoachErasedAthleteDraftCursor, CoachErasedAthleteDraftsV2, October18CoachApi } from './coach-api'

export function useErasedAthleteDrafts(gym: string, getPage?: October18CoachApi['getCoachErasedAthleteDraftsV2']) {
  const [page, setPage] = useState<CoachErasedAthleteDraftsV2 | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const epoch = useRef(0)
  const inFlight = useRef(false)

  const read = useCallback(async (cursor: CoachErasedAthleteDraftCursor | null) => {
    if (!getPage || inFlight.current) return
    const token = epoch.current
    inFlight.current = true
    setLoading(true)
    setFailed(false)
    try {
      const next = await getPage({ gym, page_limit: 100,
        cursor_updated_at: cursor?.updated_at ?? null, cursor_draft: cursor?.draft_id ?? null })
      if (token !== epoch.current) return
      setPage(previous => {
        if (!cursor || !previous) return next
        const seen = new Set(previous.items.map(item => item.draft_id))
        return { ...next, items: [...previous.items, ...next.items.filter(item => !seen.has(item.draft_id))] }
      })
    } catch {
      if (token === epoch.current) setFailed(true)
    } finally {
      if (token === epoch.current) {
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

  return { page, loading, failed, showMore: () => { if (page?.next_cursor) void read(page.next_cursor) } }
}
