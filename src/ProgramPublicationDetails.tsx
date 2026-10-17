import { useEffect, useState } from 'react'
import type { BacklogRevisionApi, ProgramPublicationMetadataV1 } from './lib/coach-api'

export function useProgramPublicationMetadata(api: Partial<BacklogRevisionApi>, gym: string, athlete: string, programIds: string[], refreshKey?: string | number) {
  const [items, setItems] = useState<ProgramPublicationMetadataV1[]>([])
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const ids = programIds.join(',')
  useEffect(() => {
    let active = true; setItems([]); setError(false)
    if (api.getCoachProgramPublicationMetadataV1 && ids) {
      const requested = [...new Set(ids.split(','))]
      const chunks = Array.from({ length: Math.ceil(requested.length / 50) }, (_, index) => requested.slice(index * 50, (index + 1) * 50))
      void Promise.all(chunks.map(program_ids => api.getCoachProgramPublicationMetadataV1!({ target_gym: gym, target_athlete: athlete, program_ids }))).then(results => { if (active) setItems(results.flatMap(result => result.items)) }, () => { if (active) setError(true) })
    }
    return () => { active = false }
  }, [api, gym, athlete, ids, refreshKey, retry])
  return { items, error, retry: () => setRetry(value => value + 1) }
}

export function ProgramPublicationDetails({ api, gym, athlete, programIds, compact = false, refreshKey }: { api: Partial<BacklogRevisionApi>; gym: string; athlete: string; programIds: string[]; compact?: boolean; refreshKey?: string | number }) {
  const { items, error, retry } = useProgramPublicationMetadata(api, gym, athlete, programIds, refreshKey)
  if (!api.getCoachProgramPublicationMetadataV1) return null
  if (error) return <p role="alert">Program dates could not be loaded. <button className="text-button" onClick={retry}>Retry dates</button></p>
  return <div className={`program-publication-details${compact ? ' compact' : ''}`}>{items.map(item => <ProgramPublicationSummary key={item.program_id} item={item} />)}</div>
}

export function ProgramPublicationSummary({ item }: { item: ProgramPublicationMetadataV1 }) {
  const date = (value: string) => <time dateTime={value}>{new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
  return <div className="program-publication-details" data-program-id={item.program_id}>
    <p>Created {date(item.created_at)}</p><p>{item.latest_published_at ? <>Latest published {date(item.latest_published_at)}</> : 'Not published'}</p>
    {item.releases.length > 0 && <details><summary>Publication history</summary>{item.first_published_at && <p>First published {date(item.first_published_at)}</p>}<ul>{item.releases.map(release => <li key={release.release_id}>{date(release.published_at)} · {release.scope_kind === 'week' ? `Week ${release.week_ordinals.join(', ')}` : release.scope_kind === 'day' ? `Day ${release.day_ordinals.join(', ')}` : 'Full program'}</li>)}</ul></details>}
  </div>
}
