import { useEffect, useId, useRef, useState } from 'react'
import { CoachCyclePreviewV2Error, isCoachCyclePreviewV2Detail, isCoachCyclePreviewV2Summary, type createCoachCyclePreviewV2Api, type CoachCyclePreviewV2Input, type CoachCyclePreviewV2Summary, type CoachCyclePreviewV2Item } from './lib/coach-cycle-preview-v2-api'
import CoachCycleV2Publish from './CoachCycleV2Publish'
import type { createCoachCycleCommitV2Api } from './lib/coach-cycle-commit-v2-api'
import type { CoachCyclePendingV2Controller } from './lib/coach-cycle-pending-v2'
import { describeGroup } from './CoachCycleServerPreview'

export type CoachCycleV2ReviewProps = {
  commitApi?: ReturnType<typeof createCoachCycleCommitV2Api> | null
  openPending?: (getOwnerSubject: () => string | null) => Promise<CoachCyclePendingV2Controller>
  onPendingStored?(): void
  api: ReturnType<typeof createCoachCyclePreviewV2Api>
  input: CoachCyclePreviewV2Input
  ownerSubject: string
  sourceHash: string
  disabled?: boolean
  onConflict(): void
  onAccessEnded(): void
}
/** A changed source, owner or scope destroys the visible review. Durable intent survives for historical recovery. */
export default function CoachCycleV2Review(props: CoachCycleV2ReviewProps) {
  const key = JSON.stringify([props.input, props.ownerSubject, props.sourceHash, props.disabled])
  return <BoundReview key={key} {...props} />
}
function BoundReview({ api, commitApi, openPending, onPendingStored, input, ownerSubject, sourceHash, disabled, onConflict, onAccessEnded }: CoachCycleV2ReviewProps) {
  const [review, setReview] = useState<{ summary: CoachCyclePreviewV2Summary; items: CoachCyclePreviewV2Item[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const generation = useRef(0)
  const active = useRef(true)
  const sourceId = useId()
  useEffect(() => { active.current = true; return () => { active.current = false; generation.current++ } }, [api])
  async function load() {
    if (disabled || loading) return
    const request = ++generation.current
    const current = () => active.current && generation.current === request
    setReview(null); setError(''); setLoading(true); setMessage('Checking saved source and loading every detail page…')
    try {
      const summary = await api.preview(input)
      if (!current()) return
      if (!isCoachCyclePreviewV2Summary(summary, input, ownerSubject) || summary.source_hash !== sourceHash) throw new CoachCyclePreviewV2Error('conflict')
      const items: CoachCyclePreviewV2Item[] = []
      for (let page = 0; page < summary.detail_page_count; page++) {
        const pageInput = { ...input, expected_review_hash: summary.review_hash, page_index: page }
        const detail = await api.detail(pageInput, summary)
        if (!current()) return
        if (!isCoachCyclePreviewV2Detail(detail, pageInput, summary) || detail.items[0].item_index !== items.length) throw new CoachCyclePreviewV2Error('conflict')
        items.push(...detail.items)
        setMessage(`Loaded ${page + 1} of ${summary.detail_page_count} detail pages. Review is incomplete until all pages are checked.`)
      }
      const programmed = items.filter(item => item.status === 'programmed')
      const totals = { exercises: programmed.length, skipped: items.length - programmed.length, groups: programmed.reduce((n, item) => n + item.set_groups.length, 0), sets: programmed.reduce((n, item) => n + item.set_groups.reduce((total, group) => total + group.sets_min, 0), 0) }
      if (items.length !== summary.detail_item_count || Object.entries(totals).some(([key, value]) => summary.totals[key as keyof typeof totals] !== value)
        || new Set(items.map(item => `${item.week}:${item.weekday}:${item.block_id}`)).size !== items.length
        || summary.schedule.some(day => !items.some(item => item.week === day.week && item.weekday === day.weekday))) throw new CoachCyclePreviewV2Error('conflict')
      if (!current()) return
      setReview({ summary, items }); setMessage('Every detail page is loaded for this saved revision. Review the complete cycle below.')
    } catch (caught) {
      if (!current()) return
      setReview(null); setMessage('')
      const code = caught instanceof CoachCyclePreviewV2Error ? caught.code : 'network'
      if (code === 'session_expired' || code === 'access_denied') { onAccessEnded(); return }
      if (code === 'conflict' || code === 'not_found') { setError('The saved source, pilot scope or current assignment changed. Reload the saved draft before reviewing again.'); onConflict() }
      else setError('The complete review could not be loaded. No partial review was retained. Request the saved review again to retry.')
    } finally { if (current()) setLoading(false) }
  }
  const sourceTarget = (item: CoachCyclePreviewV2Item, role: 'name' | 'prescription' | 'instruction') => `${sourceId}-${item.item_index}-${role}`
  return <section className="ccd-library ccd-publish-preview ccd-v2-review" aria-label="Bounded saved cycle review">
    <h2>Saved cycle review</h2><p>Every page is checked against the same saved revision and review hash. Review the full cycle before confirming publication.</p>
    <button disabled={disabled || loading} onClick={() => void load()}>Review saved cycle details</button>
    {!commitApi && <><button disabled aria-describedby={`${sourceId}-closed`}>Publish reviewed cycle</button><p id={`${sourceId}-closed`}>Publication is closed pending the separate activation gates.</p></>}
    {disabled && <p>Open a saved draft, save and verify any edits, and resolve pending changes before reviewing.</p>}
    <p role="status" aria-live="polite">{message}</p>{error && <p role="alert">{error}</p>}
    {review && <section aria-label="Complete saved cycle details">
      <h3>{review.summary.name} · saved revision {review.summary.draft_revision}</h3>
      <p>{review.summary.start_on} to {review.summary.end_on} · default unit {review.summary.unit}</p>
      <dl className="ccd-preview-totals">{Object.entries({ Weeks: review.summary.week_count, Exercises: review.summary.totals.exercises, 'Explicit skips': review.summary.totals.skipped, 'Set groups': review.summary.totals.groups, 'Physical sets': review.summary.totals.sets, 'Cells accounted for': review.summary.coverage_count }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {Array.from({ length: review.summary.week_count }, (_, index) => index + 1).map(week => <section key={week} aria-label={`Review week ${week}`}><h3>Week {week}</h3>
        {review.summary.schedule.filter(day => day.week === week).map(day => <section key={day.weekday} className="ccd-preview-day" aria-label={`${day.day} week ${week}`}>
          <h4>{day.day} · {day.scheduled_date}</h4>{day.marked_rest && <p>Explicit rest: all exercise blocks skipped.</p>}
          <ol>{review.items.filter(item => item.week === week && item.weekday === day.weekday).map(item => <li key={item.item_index}>
            <strong>{item.name}</strong> · <a href={`#${sourceTarget(item, 'name')}`}>Name source: cycle!{item.source.name.address}</a>
            <p>{item.status === 'skipped' ? 'SKIP · explicitly skipped' : `Coach prescription: ${item.prescription}`} · <a href={`#${sourceTarget(item, 'prescription')}`}>Prescription source: cycle!{item.source.prescription.address}</a></p>
            <ol>{item.set_groups.map(group => <li key={group.ordinal}>{describeGroup(group, review.summary.unit)} · <a href={`#${sourceTarget(item, 'prescription')}`}>Group {group.ordinal} source: {item.group_source[group.ordinal - 1].raw}</a></li>)}</ol>
            <p>Coach instructions: {item.instruction || 'None'} · <a href={`#${sourceTarget(item, 'instruction')}`}>Instruction source: cycle!{item.source.instruction.address}</a></p>
          </li>)}</ol>
        </section>)}
      </section>)}
      <section aria-label="Saved source references"><h3>Saved source references</h3><p>Exact source text returned by the server for this review.</p><dl>{review.items.flatMap(item => (['name', 'prescription', 'instruction'] as const).map(role => <div key={`${item.item_index}-${role}`} id={sourceTarget(item, role)} tabIndex={-1}><dt>Week {item.week} · {item.day} · {role} · cycle!{item.source[role].address}</dt><dd>{item[role] || '(blank)'}</dd></div>))}</dl></section>
    </section>}
    {commitApi && <CoachCycleV2Publish api={commitApi} openPending={openPending} onPendingStored={onPendingStored} scope={{ owner: ownerSubject, gym: input.gym, athlete: input.athlete, draft: input.draft }} review={review?.summary ?? null} disabled={disabled || loading} onReviewInvalidated={() => setReview(null)} onAccessEnded={onAccessEnded} />}
  </section>
}
