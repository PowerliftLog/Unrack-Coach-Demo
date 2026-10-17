import type { BacklogRevisionApi, ProgramTemplateMetadataItemV1 } from './lib/coach-api'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Phase9ProgramTemplateApi, PercentageProgrammingApi, ProgramTemplateDaySummaryV1, ProgramTemplateDayV1, ProgramTemplateDayV2, ProgramTemplateDetailV1, ProgramTemplateLibraryItemV1, SaveCoachProgramDayV3, RichTemplateDay, RichTemplateDaySave, RichPercentBasisOption } from './lib/coach-api'
import { weekdayNames } from './lib/calendar'
import './program-template-workspace.css'

type TemplateWeek = ProgramTemplateDetailV1['weeks'][number]
type TemplateCursor = NonNullable<Awaited<ReturnType<Phase9ProgramTemplateApi['getCoachProgramTemplateLibraryV1']>>['next_cursor']>
export type ProgramTemplateDayEditorRenderer = (props: { day: SaveCoachProgramDayV3; defaultUnit: 'lb' | 'kg'; disabled: boolean; onDirty(value: boolean): void; onSave(day: SaveCoachProgramDayV3): Promise<void> }) => ReactNode
type ExerciseOption = { exercise_id: string; name: string; default_basis_exercise_id: string | null }
export type RichProgramTemplateDayEditorRenderer = (props: { day: RichTemplateDay; percentBasisOptions: RichPercentBasisOption[]; exerciseOptions?: ExerciseOption[]; trackingSupported?: boolean; onEnsureExercise?(name: string): Promise<ExerciseOption>; onSetExerciseTracking?(exerciseId: string, tracked: boolean): Promise<void>; defaultUnit: 'lb' | 'kg'; disabled: boolean; onDirty(value: boolean): void; onSave(day: RichTemplateDaySave): Promise<void> }) => ReactNode
type ProgramTemplateDayV3Ui = Omit<ProgramTemplateDayV2, 'contract_version' | 'supported' | 'day'> & { contract_version: 3; exercise_options: ExerciseOption[] } & ({ supported: true; day: RichTemplateDay } | { supported: false; day: null })
type TrackingProgramTemplateApi = { getCoachProgramTemplateDayV3(input: Parameters<NonNullable<Phase9ProgramTemplateApi['getCoachProgramTemplateDayV2']>>[0]): Promise<ProgramTemplateDayV3Ui>; saveCoachProgramTemplateDayV3(input: Parameters<NonNullable<Phase9ProgramTemplateApi['saveCoachProgramTemplateDayV2']>>[0]): Promise<unknown> }
type EnsureCoachExerciseApi = { ensureCoachExerciseV1(input: { target_gym: string; exercise_name: string }): Promise<ExerciseOption> }
type TemplateProgrammingApi = Pick<PercentageProgrammingApi, 'copyCoachProgramTemplateV3' | 'moveCoachProgramTemplateDayV1' | 'undoCompactProgrammingOperationV1' | 'setCoachProgramTemplateExerciseTrackingV1'>
type CopyReview = { kind: 'day' | 'week'; sourceWeekId: string; sourceDayId?: string; destinationWeekIds: string[]; requestId: string; version: number; replaceConfirmed: boolean; fromLast: boolean; serverReviewRequired: boolean }
type MoveReview = { sourceDayId: string; destinationDayId: string; requestId: string; version: number; requiresSwap: boolean }

export function ProgramTemplateWorkspace({ api, gym, initialTemplateId = null, onClose, onApply, onDirtyChange, renderDayEditor, renderRichDayEditor }: { api: Phase9ProgramTemplateApi; gym: string; initialTemplateId?: string | null; onClose(): void; onApply?(templateId: string, builderVersion: number, name: string): void; onDirtyChange?(dirty: boolean): void; renderDayEditor?: ProgramTemplateDayEditorRenderer; renderRichDayEditor?: RichProgramTemplateDayEditorRenderer }) {
  const [library, setLibrary] = useState<Array<ProgramTemplateLibraryItemV1 & Partial<ProgramTemplateMetadataItemV1>>>([])
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const createButton = useRef<HTMLButtonElement>(null)
  const closeCreation = () => { setCreating(false); window.requestAnimationFrame(() => createButton.current?.focus()) }
  const [weekFilter, setWeekFilter] = useState('all')
  const [workoutFilter, setWorkoutFilter] = useState('all')
  const metadataApi = api as Phase9ProgramTemplateApi & Partial<BacklogRevisionApi>
  const [cursor, setCursor] = useState<TemplateCursor | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [detail, setDetail] = useState<ProgramTemplateDetailV1 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const loadLibrary = async (more = false) => {
    const generation = ++request.current
    setLoading(true); setError(null)
    try {
      const query = { gym, after_name: more ? cursor?.name ?? null : null, after_template_id: more ? cursor?.template_id ?? null : null, page_size: 30 }
      const read = (after: typeof query) => metadataApi.getCoachProgramTemplateMetadataLibraryV1 ? metadataApi.getCoachProgramTemplateMetadataLibraryV1({ ...after, week_count: weekFilter === 'all' ? null : Number(weekFilter), workouts_per_week: workoutFilter === 'all' ? null : workoutFilter === 'varies' ? 'varies' : Number(workoutFilter) }) : api.getCoachProgramTemplateLibraryV1(after)
      let page = await read(query)
      const items = [...page.items]
      const seen = new Set<string>()
      while (search.trim() && page.has_more && page.next_cursor) {
        if (generation !== request.current) return
        const key = `${page.next_cursor.name}:${page.next_cursor.template_id}`
        if (seen.has(key)) throw new Error('Template search could not finish loading. Please retry.')
        seen.add(key)
        page = await read({ ...query, after_name: page.next_cursor.name, after_template_id: page.next_cursor.template_id })
        items.push(...page.items)
      }
      if (generation !== request.current) return
      setLibrary(current => more ? [...current, ...items.filter(item => !current.some(existing => existing.template_id === item.template_id))] : items)
      setCursor(page.next_cursor); setHasMore(page.has_more)
    } catch (cause) { if (generation === request.current) setError(message(cause)) } finally { if (generation === request.current) setLoading(false) }
  }
  const open = async (templateId: string) => {
    const generation = ++request.current
    setLoading(true); setError(null)
    try { const next = await api.getCoachProgramTemplateDetailV1({ template: templateId }); if (generation === request.current) setDetail(next) }
    catch (cause) { if (generation === request.current) setError(message(cause)) } finally { if (generation === request.current) setLoading(false) }
  }
  useEffect(() => { ++request.current; setDetail(null); setLibrary([]); setCursor(null); setHasMore(false); setLoading(true); const timer = search.trim() ? window.setTimeout(() => void loadLibrary(false), 250) : null; if (timer === null) void loadLibrary(false); return () => { if (timer !== null) window.clearTimeout(timer); ++request.current } }, [gym, weekFilter, workoutFilter, search])
  useEffect(() => { if (initialTemplateId) void open(initialTemplateId) }, [initialTemplateId])
  const visibleLibrary = library.filter(item => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  if (detail) return <ProgramTemplateEditor api={api} detail={detail} onClose={() => setDetail(null)} onRefresh={() => open(detail.template_id)} onApply={onApply} onDirtyChange={onDirtyChange} renderDayEditor={renderDayEditor} renderRichDayEditor={renderRichDayEditor} />
  return <main className="program-template-workspace" data-library-kind="program" aria-label="Program template library">
    <header className="ptw-header"><div><p className="eyebrow">PROGRAM LIBRARY</p><h1>Program templates</h1><p>Build a complete program once, then use it for a client when it is ready.</p></div><button className="text-button" onClick={onClose}>Back to clients</button></header>
    <div className="ptw-library-toolbar"><label>Search program templates<input type="search" value={search} placeholder="Search existing templates" onChange={event => setSearch(event.target.value)} /></label><button ref={createButton} className="button primary" onClick={() => setCreating(true)}>Create template</button></div>
    {creating && <TemplateCreate api={api} gym={gym} onClose={closeCreation} onCreated={async id => { setCreating(false); await loadLibrary(false); await open(id) }} />}
    {metadataApi.getCoachProgramTemplateMetadataLibraryV1 && <div className="ptw-filters" role="group" aria-label="Filter program templates"><label>Program length<select value={weekFilter} onChange={event => setWeekFilter(event.target.value)}><option value="all">All lengths</option>{Array.from({ length: 12 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} {value === 1 ? 'week' : 'weeks'}</option>)}</select></label><label>Workouts per week<select value={workoutFilter} onChange={event => setWorkoutFilter(event.target.value)}><option value="all">All frequencies</option>{Array.from({ length: 8 }, (_, value) => <option key={value} value={value}>{value} per week</option>)}<option value="varies">Varies by week</option></select></label><button className="button outline" disabled={weekFilter === 'all' && workoutFilter === 'all'} onClick={() => { setWeekFilter('all'); setWorkoutFilter('all') }}>Reset filters</button><span role="status">{loading ? 'Loading templates…' : `${visibleLibrary.length}${hasMore ? '+' : ''} matching templates`}</span></div>}
    {error && <p className="workspace-error" role="alert">{error}</p>}
    <section className="ptw-library-list" aria-label="Saved program templates">{loading && !library.length ? <p role="status">Loading program templates…</p> : !visibleLibrary.length ? <p>{!search.trim() && weekFilter === 'all' && workoutFilter === 'all' ? 'No program templates yet. Create one to start building.' : 'No templates match these filters.'}</p> : visibleLibrary.map(item => <button className="ptw-library-row" key={item.template_id} onClick={() => void open(item.template_id)}><span><strong>{item.name}</strong><small>{item.week_count} {item.week_count === 1 ? 'week' : 'weeks'} · {item.archived_at ? 'Archived' : 'Saved template'}{item.weekly_workout_counts && <> · {workoutFrequency(item.weekly_workout_counts)}</>}</small>{item.created_at && <small>Created <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></small>}</span><span aria-hidden="true">→</span></button>)}{hasMore && <button className="button outline" disabled={loading} onClick={() => void loadLibrary(true)}>Load more templates</button>}</section>
  </main>
}

function TemplateCreate({ api, gym, onCreated, onClose }: { api: Phase9ProgramTemplateApi; gym: string; onCreated(id: string): Promise<void>; onClose(): void }) {
  const [name, setName] = useState('')
  const [startingLength, setStartingLength] = useState(4)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close() }, [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!name.trim()) { setError('Enter a template name.'); return }
    setBusy(true); setError(null)
    try { const created = await api.createCoachProgramTemplateV1({ gym, template_name: name.trim(), week_count: startingLength }); setName(''); await onCreated(created.template_id) }
    catch (cause) { setError(message(cause)) } finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="dialog ptw-create-dialog" aria-labelledby="new-template-title" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}><form onSubmit={event => void submit(event)}><h2 id="new-template-title">New program template</h2><label>Template name<input required autoFocus maxLength={120} value={name} disabled={busy} placeholder="Full body strength" onChange={event => setName(event.target.value)} /></label><label>Starting length<select value={startingLength} disabled={busy} onChange={event => setStartingLength(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} {value === 1 ? 'week' : 'weeks'}</option>)}</select></label><p>You can add weeks while building this template.</p>{error && <p role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button outline" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Creating…' : 'Start building'}</button></div></form></dialog>
}

function ProgramTemplateEditor({ api, detail, onClose, onRefresh, onApply, onDirtyChange, renderDayEditor, renderRichDayEditor }: { api: Phase9ProgramTemplateApi; detail: ProgramTemplateDetailV1; onClose(): void; onRefresh(): Promise<void>; onApply?(templateId: string, builderVersion: number, name: string): void; onDirtyChange?(dirty: boolean): void; renderDayEditor?: ProgramTemplateDayEditorRenderer; renderRichDayEditor?: RichProgramTemplateDayEditorRenderer }) {
  const revisionApi = api as Phase9ProgramTemplateApi & Partial<BacklogRevisionApi>
  const [templateMeta, setTemplateMeta] = useState<{ created_at: string; weekly_workout_counts: number[] } | null>(null)
  const [metadataError, setMetadataError] = useState(false)
  useEffect(() => { let active = true; setTemplateMeta(null); setMetadataError(false); if (revisionApi.getCoachProgramTemplateMetadataV1) void revisionApi.getCoachProgramTemplateMetadataV1({ template: detail.template_id }).then(value => { if (active) setTemplateMeta(value) }, () => { if (active) setMetadataError(true) }); return () => { active = false } }, [api, detail.template_id, detail.builder_version])
  const orderedWeeks = useMemo(() => [...detail.weeks].sort((a, b) => a.week_ordinal - b.week_ordinal), [detail.weeks])
  const [view, setView] = useState<'Day' | 'Week' | 'Plan'>('Week')
  const [weekId, setWeekId] = useState(orderedWeeks[0]?.week_id ?? '')
  const [dayId, setDayId] = useState(orderedWeeks[0]?.days[0]?.day_id ?? '')
  const [dayRead, setDayRead] = useState<ProgramTemplateDayV1 | ProgramTemplateDayV2 | ProgramTemplateDayV3Ui | null>(null)
  const trackingApi = api as Phase9ProgramTemplateApi & Partial<TrackingProgramTemplateApi> & Partial<EnsureCoachExerciseApi> & Partial<TemplateProgrammingApi>
  const [loadingDay, setLoadingDay] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [copyWeek, setCopyWeek] = useState<{ sourceId: string; requestId: string } | null>(null)
  const [copyReview, setCopyReview] = useState<CopyReview | null>(null)
  const [moveReview, setMoveReview] = useState<MoveReview | null>(null)
  const [undo, setUndo] = useState<{ undo_id: string; expires_at: string; requestId: string } | null>(null)
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  const generation = useRef(0)
  const week = orderedWeeks.find(item => item.week_id === weekId) ?? orderedWeeks[0]
  const selectedDay = week?.days.find(item => item.day_id === dayId)
  const previousWeek = orderedWeeks.find(item => item.week_ordinal === (week?.week_ordinal ?? 0) - 1)
  const previousDay = previousWeek?.days.find(item => item.day_ordinal === selectedDay?.day_ordinal)
  const editable = !detail.archived_at && !mutating
  const canCopyDays = Boolean(trackingApi.copyCoachProgramTemplateV3)
  const canCopyWeeks = Boolean(trackingApi.copyCoachProgramTemplateV3)
  const guardDirty = (next: () => void) => { if (dirty && !window.confirm('Discard unsaved changes to this day?')) return; setDirty(false); next() }
  const chooseDay = async (nextWeekId: string, nextDayId: string, nextView: 'Day' | 'Week' | 'Plan' = 'Day') => {
    if (mutating) return
    guardDirty(() => { setDayRead(null); setWeekId(nextWeekId); setDayId(nextDayId); setView(nextView) })
  }
  useEffect(() => { if (view !== 'Day' || !dayId) return; const current = ++generation.current; setDayRead(null); setLoadingDay(true); setError(null); const input = { template: detail.template_id, day_id: dayId }; const read = trackingApi.getCoachProgramTemplateDayV3 && trackingApi.saveCoachProgramTemplateDayV3 && renderRichDayEditor ? trackingApi.getCoachProgramTemplateDayV3(input) : api.getCoachProgramTemplateDayV2 && api.saveCoachProgramTemplateDayV2 && renderRichDayEditor ? api.getCoachProgramTemplateDayV2(input) : api.getCoachProgramTemplateDayV1(input); void read.then(result => { if (current === generation.current) setDayRead(result) }).catch(cause => { if (current === generation.current) setError(message(cause)) }).finally(() => { if (current === generation.current) setLoadingDay(false) }) }, [api, detail.template_id, detail.builder_version, dayId, view, renderRichDayEditor])
  const appendWeek = async () => {
    if (detail.archived_at || mutating) return
    if (dirty && !window.confirm('Discard unsaved changes to this day?')) return
    setMutating(true); setError(null)
    try { await api.appendCoachProgramTemplateWeekV1({ template: detail.template_id, expected_builder_version: detail.builder_version }); setDirty(false); setUndo(null); await onRefresh() }
    catch (cause) { setError(message(cause)) } finally { setMutating(false) }
  }
  const saveDay = async (draft: SaveCoachProgramDayV3) => {
    if (detail.archived_at || mutating) throw new Error('Template is not editable right now.')
    setMutating(true); setError(null)
    try { await api.saveCoachProgramTemplateDayV1({ template: detail.template_id, expected_builder_version: detail.builder_version, day: draft }); setUndo(null); await onRefresh(); setDirty(false) }
    catch (cause) { setError(message(cause)); throw cause } finally { setMutating(false) }
  }
  const saveRichDay = async (draft: RichTemplateDaySave) => {
    if (detail.archived_at || mutating || !(api.saveCoachProgramTemplateDayV2 || trackingApi.saveCoachProgramTemplateDayV3)) throw new Error('Template is not editable right now.')
    setMutating(true); setError(null)
    try { const input = { template: detail.template_id, day_id: dayId, expected_builder_version: detail.builder_version, day: draft }; if (dayRead?.contract_version === 3 && trackingApi.saveCoachProgramTemplateDayV3) await trackingApi.saveCoachProgramTemplateDayV3(input); else await api.saveCoachProgramTemplateDayV2!(input); setUndo(null); await onRefresh(); setDirty(false) }
    catch (cause) { setError(message(cause)); throw cause } finally { setMutating(false) }
  }
  const copySelectedWeek = async () => {
    if (!copyWeek || !week || detail.archived_at || mutating) return
    setMutating(true); setError(null)
    try {
      await api.copyCoachProgramTemplateWeekV2({ request_id: copyWeek.requestId, template: detail.template_id,
        source_week_id: copyWeek.sourceId, destination_week_id: week.week_id, expected_builder_version: detail.builder_version })
      await onRefresh(); setCopyWeek(null)
    } catch (cause) { setError(message(cause)) } finally { setMutating(false) }
  }
  const selectWeek = (next: TemplateWeek, nextView: 'Day' | 'Week' = view === 'Day' ? 'Day' : 'Week') => {
    if (mutating) return
    guardDirty(() => { setDayRead(null); setWeekId(next.week_id);
      setDayId(next.days.find(day => day.day_ordinal === selectedDay?.day_ordinal)?.day_id ?? next.days[0]?.day_id ?? ''); setView(nextView) })
  }
  const openCopy = (kind: CopyReview['kind'], source: TemplateWeek, sourceDay?: ProgramTemplateDaySummaryV1, destination?: TemplateWeek) => {
    guardDirty(() => {
      setError(null)
      const nextWeek = orderedWeeks.find(item => item.week_ordinal > source.week_ordinal)
      setCopyReview({ kind, sourceWeekId: source.week_id, sourceDayId: sourceDay?.day_id,
        destinationWeekIds: destination ? [destination.week_id] : nextWeek ? [nextWeek.week_id] : [],
        requestId: crypto.randomUUID(), version: detail.builder_version, replaceConfirmed: false, fromLast: Boolean(destination), serverReviewRequired: false })
    })
  }
  const reviewSource = orderedWeeks.find(item => item.week_id === copyReview?.sourceWeekId)
  const reviewSourceDay = reviewSource?.days.find(item => item.day_id === copyReview?.sourceDayId)
  const reviewDestinations = orderedWeeks.filter(item => copyReview?.destinationWeekIds.includes(item.week_id))
  const overwrittenDays = reviewDestinations.flatMap(destination => destination.days
    .filter(day => (hasTemplateDayContent(day) || copyReview?.serverReviewRequired) && (copyReview?.kind === 'week' || day.day_ordinal === reviewSourceDay?.day_ordinal))
    .map(day => `Week ${destination.week_ordinal} · ${weekdayNames[day.day_ordinal - 1]}${day.subtitle ? ` · ${day.subtitle}` : ''}`))
  const copyReady = Boolean(copyReview && reviewSource && reviewDestinations.length
    && (copyReview.kind === 'week' || reviewSourceDay)
    && (!overwrittenDays.length || copyReview.replaceConfirmed))
  const applyCopy = async () => {
    if (!copyReview || !copyReady || !editable) return
    setMutating(true); setError(null)
    try {
      const input = { request_id: copyReview.requestId, template: detail.template_id, expected_builder_version: copyReview.version }
      const result = await trackingApi.copyCoachProgramTemplateV3!({ ...input,
        copy_kind: copyReview.kind, source_week_id: copyReview.sourceWeekId,
        source_day_id: copyReview.sourceDayId ?? null, destination_week_ids: reviewDestinations.map(item => item.week_id),
        replace_reviewed: copyReview.replaceConfirmed })
      setUndo(result.undo ? { ...result.undo, requestId: crypto.randomUUID() } : null); setCopyReview(null); setDirty(false); await onRefresh()
    } catch (cause) {
      if (requiresDestinationReview(cause, 'copy')) {
        setCopyReview({ ...copyReview, serverReviewRequired: true, replaceConfirmed: false, requestId: crypto.randomUUID() })
        setError('The destination includes existing notes or programming. Review the listed days and confirm replacement before copying.')
      } else setError(message(cause))
    } finally { setMutating(false) }
  }
  const openMove = () => {
    if (!week || !selectedDay) return
    guardDirty(() => {
      const destination = week.days.find(item => item.day_id !== selectedDay.day_id && !hasTemplateDayContent(item))
        ?? week.days.find(item => item.day_id !== selectedDay.day_id)
      if (destination) { setError(null); setMoveReview({ sourceDayId: selectedDay.day_id,
        destinationDayId: destination.day_id, requestId: crypto.randomUUID(), version: detail.builder_version, requiresSwap: false }) }
    })
  }
  const moveDestination = week?.days.find(item => item.day_id === moveReview?.destinationDayId)
  const moveNeedsSwap = Boolean(moveDestination && (hasTemplateDayContent(moveDestination) || moveReview?.requiresSwap))
  const applyMove = async () => {
    if (!moveReview || !moveDestination || !editable || !trackingApi.moveCoachProgramTemplateDayV1) return
    setMutating(true); setError(null)
    try {
      const result = await trackingApi.moveCoachProgramTemplateDayV1({ request_id: moveReview.requestId,
        template: detail.template_id, source_day_id: moveReview.sourceDayId,
        destination_day_id: moveReview.destinationDayId, swap: moveNeedsSwap,
        expected_builder_version: moveReview.version })
      setUndo(result.undo ? { ...result.undo, requestId: crypto.randomUUID() } : null); setDayRead(null); setDayId(moveReview.destinationDayId);
      setMoveReview(null); setDirty(false); await onRefresh()
    } catch (cause) {
      if (requiresDestinationReview(cause, 'move')) {
        setMoveReview({ ...moveReview, requiresSwap: true, requestId: crypto.randomUUID() })
        setError('The destination includes existing notes or programming. Choose Swap workouts to preserve both days.')
      } else setError(message(cause))
    } finally { setMutating(false) }
  }
  const applyUndo = async () => {
    if (!undo || !editable || dirty || !trackingApi.undoCompactProgrammingOperationV1) return
    setMutating(true); setError(null)
    try {
      await trackingApi.undoCompactProgrammingOperationV1({ request_id: undo.requestId, root_kind: 'template',
        root_id: detail.template_id, assignment: null, undo_id: undo.undo_id, expected_builder_version: detail.builder_version })
      setUndo(null); await onRefresh()
    } catch (cause) { setError(message(cause)) } finally { setMutating(false) }
  }
  const setExerciseTracking = async (exerciseId: string, tracked: boolean) => {
    if (dirty) throw new Error('Save this workout before changing tracking across the program.')
    if (!editable || !trackingApi.setCoachProgramTemplateExerciseTrackingV1) throw new Error('Tracking is not available right now.')
    setMutating(true); setError(null)
    try {
      await trackingApi.setCoachProgramTemplateExerciseTrackingV1({ request_id: crypto.randomUUID(),
        template: detail.template_id, exercise_id: exerciseId, tracked, expected_builder_version: detail.builder_version })
      setUndo(null); await onRefresh()
    } catch (cause) { setError(message(cause)); throw cause } finally { setMutating(false) }
  }
  return <main className="program-template-workspace" data-library-kind="program" aria-label="Program template editor">
    <header className="ptw-header"><div><button className="text-button" disabled={mutating} onClick={() => guardDirty(onClose)}>← Program library</button><p className="eyebrow">PROGRAM TEMPLATE</p><h1>{detail.name}</h1><p>{detail.archived_at ? 'Archived template' : `Saved template · version ${detail.builder_version}`}</p>{templateMeta && <p>Created <time dateTime={templateMeta.created_at}>{new Date(templateMeta.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time> · {workoutFrequency(templateMeta.weekly_workout_counts)}</p>}{metadataError && <p role="alert">Template dates could not be loaded.</p>}</div><div className="ptw-header-actions">{onApply && <button className="button primary" disabled={!editable} onClick={() => guardDirty(() => onApply(detail.template_id, detail.builder_version, detail.name))}>Use for client</button>}</div></header>
    {error && !copyWeek && !copyReview && !moveReview && <p className="workspace-error" role="alert">{error} <button className="text-button" onClick={() => guardDirty(() => { setUndo(null); void onRefresh() })}>Refresh template</button></p>}
    <nav className="ptw-nav" aria-label="Program editor navigation">
      <div role="tablist" aria-label="Program view">{(['Day', 'Week', 'Plan'] as const).map(item => <button key={item} role="tab" disabled={mutating} aria-selected={view === item} onClick={() => guardDirty(() => setView(item))}>{item}</button>)}</div>
      <div className="ptw-week-tabs" aria-label="Template weeks">{orderedWeeks.map(item => <button key={item.week_id} disabled={mutating} className={item.week_id === week?.week_id ? 'selected' : ''} onClick={() => selectWeek(item)}>Week {item.week_ordinal}</button>)}<button className="ptw-add-week" disabled={!editable || orderedWeeks.length >= 12} onClick={() => void appendWeek()}>Add week</button></div>
    </nav>
    {undo && trackingApi.undoCompactProgrammingOperationV1 && <div className="ptw-operation-status" role="status"><span>Program updated.</span><button className="text-button" disabled={!editable || dirty} onClick={() => void applyUndo()}>Undo</button></div>}
    {view === 'Week' && week && orderedWeeks.length > 1 && !detail.archived_at && <div className="ptw-week-actions">
      {canCopyWeeks && !week.days.some(day => day.exercise_count) && previousWeek?.days.some(day => day.exercise_count) && <button className="button outline" disabled={!editable} onClick={() => openCopy('week', previousWeek, undefined, week)}>Copy from last week</button>}
      <button className="button outline" disabled={!editable || (canCopyWeeks && !orderedWeeks.some(item => item.week_ordinal > week.week_ordinal))} onClick={() => canCopyWeeks ? openCopy('week', week) : guardDirty(() => { setError(null); setCopyWeek({ sourceId: previousWeek?.week_id ?? orderedWeeks.find(item => item.week_id !== week.week_id)!.week_id, requestId: crypto.randomUUID() }) })}>Copy week</button>
    </div>}
    {view === 'Plan' && <PlanView weeks={orderedWeeks} onOpenWeek={next => selectWeek(next, 'Week')} onOpenDay={(selectedWeek, selectedDay) => void chooseDay(selectedWeek.week_id, selectedDay.day_id)} onCopyWeek={canCopyWeeks && !detail.archived_at ? source => openCopy('week', source) : undefined} copyingDisabled={mutating} />}
    {view === 'Week' && week && <WeekView week={week} onOpenDay={day => void chooseDay(week.week_id, day.day_id)} disabled={mutating} />}
    {view === 'Day' && week && <section className="ptw-day-shell">
      <div className="ptw-day-tabs" role="tablist" aria-label="Days of the week">{week.days.map(day => <button key={day.day_id} role="tab" disabled={mutating} aria-selected={day.day_id === dayId} onClick={() => void chooseDay(week.week_id, day.day_id)}><strong>{weekdayNames[day.day_ordinal - 1].slice(0, 3)}</strong><span>{day.subtitle ?? (day.marked_rest ? 'Rest day' : day.exercise_count ? 'Workout' : 'Add workout')}</span></button>)}</div>
      <div className="ptw-day-actions"><h2>{weekdayNames[(selectedDay?.day_ordinal ?? 1) - 1]}{selectedDay?.subtitle ? ` · ${selectedDay.subtitle}` : ''}</h2><div>
        {canCopyDays && !selectedDay?.exercise_count && previousDay && previousDay.exercise_count > 0 && previousWeek && <button className="button outline" disabled={!editable} onClick={() => openCopy('day', previousWeek, previousDay, week)}>Copy from last week</button>}
        {trackingApi.moveCoachProgramTemplateDayV1 && Boolean(selectedDay?.exercise_count) && <button className="button outline" disabled={!editable} onClick={openMove}>Move workout</button>}
        {canCopyDays && selectedDay && <button className="button outline" disabled={!editable || !selectedDay.exercise_count || !orderedWeeks.some(item => item.week_ordinal > week.week_ordinal)} onClick={() => openCopy('day', week, selectedDay)}>Copy workout</button>}
      </div></div>
      {loadingDay ? <p role="status">Loading day…</p> : dayRead && (dayRead.contract_version === 2 || dayRead.contract_version === 3) ? !dayRead.supported ? <AdvancedTemplateDay onBack={() => setView('Week')} /> : renderRichDayEditor ? renderRichDayEditor({ day: dayRead.day, percentBasisOptions: dayRead.percent_basis_options, exerciseOptions: dayRead.contract_version === 3 ? dayRead.exercise_options : [], trackingSupported: dayRead.contract_version === 3, onEnsureExercise: trackingApi.ensureCoachExerciseV1 ? name => trackingApi.ensureCoachExerciseV1!({ target_gym: detail.gym_id, exercise_name: name }) : undefined, onSetExerciseTracking: trackingApi.setCoachProgramTemplateExerciseTrackingV1 ? setExerciseTracking : undefined, defaultUnit: detail.default_unit, disabled: Boolean(detail.archived_at) || mutating, onDirty: setDirty, onSave: saveRichDay }) : <p role="status">The rich day editor is loading.</p> : dayRead?.supported ? renderDayEditor ? renderDayEditor({ day: dayRead.day, defaultUnit: detail.default_unit, disabled: Boolean(detail.archived_at) || mutating, onDirty: setDirty, onSave: saveDay }) : <p role="status">The full day editor is loading.</p> : dayRead?.advanced ? <AdvancedTemplateDay onBack={() => setView('Week')} /> : renderDayEditor ? renderDayEditor({ day: blankDay(dayId, week.days.find(item => item.day_id === dayId)?.day_ordinal ?? 1), defaultUnit: detail.default_unit, disabled: Boolean(detail.archived_at) || mutating, onDirty: setDirty, onSave: saveDay }) : <p role="status">The full day editor is loading.</p>}
    </section>}
    {copyReview && reviewSource && <div className="ptw-copy-overlay"><section role="dialog" aria-modal="true" aria-label={copyReview.kind === 'week' ? 'Copy template weeks' : 'Copy template workout'} className="ptw-copy-dialog" onKeyDown={event => { if (event.key === 'Escape' && !mutating) setCopyReview(null) }}>
      <h2>{copyReview.fromLast ? 'Copy from last week' : copyReview.kind === 'week' ? 'Copy week' : 'Copy workout'}</h2>
      <p>Copy {copyReview.kind === 'week' ? `all seven days from Week ${reviewSource.week_ordinal}` : `${weekdayNames[(reviewSourceDay?.day_ordinal ?? 1) - 1]} from Week ${reviewSource.week_ordinal}`} into the selected weeks. Each copy can be edited independently.</p>
      <fieldset className="ptw-copy-destinations" disabled={mutating}><legend>Destination weeks</legend>{orderedWeeks.filter(item => item.week_ordinal > reviewSource.week_ordinal && (!copyReview.fromLast || item.week_ordinal === reviewSource.week_ordinal + 1)).map(destination => <label key={destination.week_id}><input type="checkbox" checked={copyReview.destinationWeekIds.includes(destination.week_id)} onChange={event => setCopyReview({ ...copyReview, destinationWeekIds: event.target.checked ? [...copyReview.destinationWeekIds, destination.week_id] : copyReview.destinationWeekIds.filter(id => id !== destination.week_id), replaceConfirmed: false, requestId: crypto.randomUUID() })} /><span>Week {destination.week_ordinal}</span></label>)}</fieldset>
      {overwrittenDays.length > 0 && <div className="ptw-replacement-review"><p>Programming and notes in these days will be replaced:</p><ul>{overwrittenDays.map(label => <li key={label}>{label}</li>)}</ul><label><input type="checkbox" disabled={mutating} checked={copyReview.replaceConfirmed} onChange={event => setCopyReview({ ...copyReview, replaceConfirmed: event.target.checked, requestId: crypto.randomUUID() })} /><span>Replace the listed workouts</span></label></div>}
      {error && <p className="workspace-error" role="alert">{error}</p>}
      <div className="ptw-copy-actions"><button autoFocus className="button outline" disabled={mutating} onClick={() => setCopyReview(null)}>Cancel</button><button className="button primary" disabled={mutating || !copyReady} onClick={() => void applyCopy()}>{mutating ? 'Copying…' : copyReview.kind === 'week' ? 'Copy selected weeks' : 'Copy workout'}</button></div>
    </section></div>}
    {moveReview && week && <div className="ptw-copy-overlay"><section role="dialog" aria-modal="true" aria-label="Move template workout" className="ptw-copy-dialog" onKeyDown={event => { if (event.key === 'Escape' && !mutating) setMoveReview(null) }}>
      <h2>Move workout</h2><p>Move the whole workout, including its exercises, sets, loads and notes.</p>
      <label>Move to<select value={moveReview.destinationDayId} disabled={mutating} onChange={event => { setMoveReview({ ...moveReview, destinationDayId: event.target.value, requiresSwap: false, requestId: crypto.randomUUID() }); setError(null) }}>{week.days.filter(day => day.day_id !== moveReview.sourceDayId).map(day => <option key={day.day_id} value={day.day_id}>{weekdayNames[day.day_ordinal - 1]} · {day.subtitle ?? (day.exercise_count ? 'Workout' : day.marked_rest ? 'Rest day' : 'Empty day')}</option>)}</select></label>
      <p className="ptw-move-review">{moveNeedsSwap && moveDestination ? `${weekdayNames[moveDestination.day_ordinal - 1]} already has ${moveDestination.exercise_count ? 'a workout' : 'programming or notes'}. Swap both days to preserve all programming and notes.` : 'The original day will become a rest day.'}</p>
      {error && <p className="workspace-error" role="alert">{error}</p>}<div className="ptw-copy-actions"><button autoFocus className="button outline" disabled={mutating} onClick={() => setMoveReview(null)}>Cancel</button><button className="button primary" disabled={mutating || !moveDestination} onClick={() => void applyMove()}>{mutating ? 'Moving…' : moveNeedsSwap ? 'Swap workouts' : 'Move workout'}</button></div>
    </section></div>}
    {copyWeek && week && <div className="ptw-copy-overlay"><section role="dialog" aria-modal="true" aria-label="Copy template week" className="ptw-copy-dialog" onKeyDown={event => { if (event.key === 'Escape' && !mutating) setCopyWeek(null) }}><h2>Copy into Week {week.week_ordinal}</h2><p>This replaces all seven days in Week {week.week_ordinal} with an independent copy of the source week.</p><label>Source week<select aria-label="Source week" disabled={mutating} value={copyWeek.sourceId} onChange={event => setCopyWeek({ sourceId: event.target.value, requestId: crypto.randomUUID() })}>{orderedWeeks.filter(item => item.week_id !== week.week_id).map(item => <option key={item.week_id} value={item.week_id}>Week {item.week_ordinal}</option>)}</select></label>{error && <p className="workspace-error" role="alert">{error}</p>}<div className="ptw-copy-actions"><button autoFocus className="button outline" disabled={mutating} onClick={() => setCopyWeek(null)}>Cancel</button><button className="button primary" disabled={mutating} onClick={() => void copySelectedWeek()}>{mutating ? 'Copying…' : 'Replace week'}</button></div></section></div>}
  </main>
}

function PlanView({ weeks, onOpenWeek, onOpenDay, onCopyWeek, copyingDisabled }: { weeks: TemplateWeek[]; onOpenWeek(week: TemplateWeek): void; onOpenDay(week: TemplateWeek, day: ProgramTemplateDaySummaryV1): void; onCopyWeek?(week: TemplateWeek): void; copyingDisabled?: boolean }) {
  return <section className="ptw-plan" aria-label="Template plan outline"><p className="eyebrow">PROGRAM OUTLINE</p><h2>{weeks.length} {weeks.length === 1 ? 'week' : 'weeks'}</h2>{weeks.map(week => { const training = week.days.filter(day => day.exercise_count > 0).length; const rest = week.days.filter(day => day.marked_rest).length; return <article key={week.week_id} className="ptw-plan-week"><header><div><p className="eyebrow">WEEK {week.week_ordinal}</p><h3>Week {week.week_ordinal}</h3><p>{training} training {training === 1 ? 'day' : 'days'} · {rest} rest {rest === 1 ? 'day' : 'days'} · {7 - training - rest} open days</p></div><div className="ptw-plan-actions">{onCopyWeek && <button className="button outline" disabled={copyingDisabled || !weeks.some(item => item.week_ordinal > week.week_ordinal)} onClick={() => onCopyWeek(week)}>Copy week</button>}<button className="button outline" disabled={copyingDisabled} onClick={() => onOpenWeek(week)}>Open week</button></div></header><div>{week.days.map(day => <button className="ptw-plan-day" key={day.day_id} disabled={copyingDisabled} onClick={() => onOpenDay(week, day)}><strong>{weekdayNames[day.day_ordinal - 1]}</strong><span>{day.marked_rest ? 'Rest day' : day.exercise_count ? `${day.exercise_count} exercises · ${day.set_count} sets` : 'Add workout'}</span><span aria-hidden="true">→</span></button>)}</div></article> })}</section>
}

function WeekView({ week, onOpenDay, disabled }: { week: TemplateWeek; onOpenDay(day: ProgramTemplateDaySummaryV1): void; disabled?: boolean }) {
  return <section className="ptw-week" aria-label={`Week ${week.week_ordinal}`}><header><p className="eyebrow">WEEK {week.week_ordinal}</p><h2>Week {week.week_ordinal}</h2><p>Choose a day to add a workout, edit it, or mark it as rest.</p></header><div className="ptw-week-grid">{week.days.map(day => <article key={day.day_id} className={`ptw-week-card ${day.marked_rest ? 'rest' : day.exercise_count ? 'training' : 'empty'}`}><div><strong>{weekdayNames[day.day_ordinal - 1]}</strong><small>DAY {day.day_ordinal}</small></div><section><span>{day.marked_rest ? 'REST DAY' : day.exercise_count ? 'TRAINING' : 'OPEN DAY'}</span><h3>{day.subtitle ?? (day.marked_rest ? 'No training assigned' : day.exercise_count ? 'Workout' : 'Add a workout')}</h3><p>{day.marked_rest ? 'Change this day if the plan changes.' : day.exercise_count ? `${day.exercise_count} exercises · ${day.set_count} sets` : 'Create a workout or mark rest.'}</p></section><button className="button outline" disabled={disabled} onClick={() => onOpenDay(day)}>{day.marked_rest || !day.exercise_count ? 'Add training day' : 'Open workout'}</button></article>)}</div></section>
}

function AdvancedTemplateDay({ onBack }: { onBack(): void }) { return <section className="ptw-advanced" role="status"><h2>This day uses an advanced prescription</h2><p>It will stay intact when this template is used, but this editor cannot safely change it yet.</p><button className="button outline" onClick={onBack}>Back to week</button></section> }

function blankDay(dayId: string, ordinal: number): SaveCoachProgramDayV3 { return { identity_token: dayId, ordinal, label: weekdayNames[ordinal - 1], subtitle: null, marked_rest: false, workout_instruction: null, exercises: [] } }

function hasTemplateDayContent(day: ProgramTemplateDaySummaryV1): boolean { return day.exercise_count > 0 || Boolean(day.subtitle?.trim()) }

function requiresDestinationReview(cause: unknown, operation: 'copy' | 'move'): boolean {
  if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'copy_collision_review_required') return true
  const names = operation === 'copy' ? ['COMPACT_COPY_REVIEW_REQUIRED'] : ['COMPACT_MOVE_SWAP_REQUIRED', 'COMPACT_SWAP_REVIEW_REQUIRED']
  return cause instanceof Error && names.some(name => cause.message.includes(name))
}

function message(cause: unknown): string { return cause instanceof Error && cause.message ? cause.message : 'The template request could not be completed. Try again.' }

export function workoutFrequency(counts: number[]): string {
  if (!counts.length) return '0 workouts/week'
  const min = Math.min(...counts); const max = Math.max(...counts)
  return min === max ? `${min} ${min === 1 ? 'workout' : 'workouts'}/week` : `${min}–${max} workouts/week · varies`
}
