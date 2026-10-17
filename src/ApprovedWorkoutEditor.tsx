import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { ExerciseOptionV1, RichPercentBasisOption, RichProgramDay, RichTemplateDay, RichProgramDaySave, RichTemplateDaySave, RichSetFields } from './lib/coach-api'
import { supersetIssue, supersetIssueMessage } from './lib/superset'
import './approved-workout-editor.css'

type Day = RichProgramDay | RichTemplateDay
type Payload = RichProgramDaySave | RichTemplateDaySave
type SetRow = RichSetFields & { mode: 'replace'; id?: string | null; identity_token?: string | null; manual_override?: number | null; of_max_id?: string | null; resolved_weight?: number | null; resolved_max_effective_from?: string | null; resolved_at?: string | null }
type Exercise = { mode: 'replace'; id?: string | null; identity_token?: string | null; ordinal: number; group_ordinal: number | null; status: 'programmed' | 'not_programmed'; name: string; instruction: string | null; note: string | null; protocol: string | null; exercise_id?: string | null; track_in_metrics?: boolean; set_groups: SetRow[] }
type Group = { mode: 'replace'; id?: string | null; identity_token?: string | null; ordinal: number; group_type: 'sequence' | 'superset' | 'circuit'; title: string | null; rounds_min: number | null; rounds_max: number | null; exercises: Exercise[] }
type Draft = Omit<RichProgramDay, 'movement_groups' | 'ungrouped_exercises'> & { movement_groups: Group[]; ungrouped_exercises: Exercise[] }
type Basis = RichPercentBasisOption & { max_type?: 'tested_1rm' | 'training_max'; value?: number; unit?: 'lb' | 'kg'; effective_from?: string }
type Location = { group: number | null; exercise: number }
export type ApprovedWorkoutEditorProps = {
  day: Day; template?: boolean; percentBasisOptions: Basis[]; exerciseOptions?: ExerciseOptionV1[]; historySuggestions?: string[]; defaultUnit: 'lb' | 'kg'; plateIncrement?: number; disabled: boolean
  buildPayload(draft: Day, original: Day): Payload
  onSave(payload: Payload): Promise<void>
  onDirtyChange?(dirty: boolean): void
  onSaveReadinessChange?(canSave: boolean): void
  registerSave?(save: () => Promise<boolean>): void
  onEnsureExercise?(name: string): Promise<ExerciseOptionV1>
  onSetExerciseTracking?(exerciseId: string, tracked: boolean): Promise<void>
  trackingSupported?: boolean
  onHistoryQuery?(query: string): void
  onCopyPrevious?(): void | Promise<Day | null>
  copyPreviousDisabled?: boolean
}
const clone = <T,>(value: T): T => structuredClone(value)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const nodeId = (row: { id?: string | null; identity_token?: string | null }) => row.identity_token ?? row.id ?? null
const exercisesOf = (day: Draft) => [...day.movement_groups.flatMap(group => group.exercises), ...day.ungrouped_exercises]
const countOf = (exercise: Exercise) => exercise.set_groups.reduce((sum, row) => sum + row.sets_min, 0)
const normalize = (day: Draft) => {
  let ordinal = 0
  day.movement_groups.forEach((group, i) => { group.ordinal = i + 1; group.exercises.forEach((exercise, n) => { exercise.ordinal = ++ordinal; exercise.group_ordinal = n + 1; exercise.set_groups.forEach((row, j) => { row.ordinal = j + 1 }) }) })
  day.ungrouped_exercises.forEach(exercise => { exercise.ordinal = ++ordinal; exercise.group_ordinal = null; exercise.set_groups.forEach((row, j) => { row.ordinal = j + 1 }) })
}
const physicalRows = (exercise: Exercise) => exercise.set_groups.flatMap((row, groupIndex) => Array.from({ length: row.sets_mode === 'exact' ? row.sets_min : 1 }, (_, physicalIndex) => ({ row, groupIndex, physicalIndex })))
/** Compare complete physical prescriptions, including unknown future metadata. Rest is retained but is no longer authored. */
export function approvedPrescriptionKey(row: SetRow) {
  const { id: _id, identity_token: _identity, ordinal: _ordinal, rest_seconds: _rest, ...prescription } = row
  return JSON.stringify({ ...prescription, ...(row.sets_mode === 'exact' ? { sets_min: 1 } : {}) })
}
export function approvedEditPhysicalSet(exercise: Exercise, groupIndex: number, physicalIndex: number, patch: Partial<SetRow>, template: boolean): Exercise {
  const next = clone(exercise), row = next.set_groups[groupIndex]
  if (row.sets_mode === 'exact' && row.sets_min > 1) {
    const split = Array.from({ length: row.sets_min }, (_, index) => ({ ...row, sets_min: 1, ordinal: groupIndex + index + 1, [template ? 'id' : 'identity_token']: index === 0 ? nodeId(row) : null }))
    Object.assign(split[physicalIndex], patch)
    next.set_groups.splice(groupIndex, 1, ...split)
  } else Object.assign(row, patch)
  next.set_groups.forEach((item, i) => { item.ordinal = i + 1 })
  return next
}
function Modal({ title, children, close, fallback }: { title: string; children: ReactNode; close(): void; fallback?: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId(), opener = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal(); else dialog?.setAttribute('open', '')
    dialog?.querySelector<HTMLElement>('[data-aw-focus]')?.focus()
    return () => { if (dialog && typeof dialog.close === 'function') dialog.close(); (opener.current?.isConnected ? opener.current : fallback?.current)?.focus() }
  }, [])
  return <dialog ref={ref} className="aw-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target !== event.currentTarget) return; const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close() }}><header><h2 id={id}>{title}</h2><button type="button" onClick={close}>Close ×</button></header>{children}</dialog>
}
function LoadPanel({ anchor, close, children, focusKey, id }: { anchor: RefObject<HTMLButtonElement | null>; close(): void; children: ReactNode; focusKey: string; id: string }) {
  const panel = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null), closeRef = useRef(close)
  closeRef.current = close
  const [position, setPosition] = useState({ left: 10, top: 10, maxHeight: Math.max(0, innerHeight - 20) })
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect(); if (!rect) return
      if (rect.right < 0 || rect.left > innerWidth || rect.bottom < 0 || rect.top > innerHeight) { closeRef.current(); return }
      const maxHeight = Math.max(0, innerHeight - 20), height = Math.min((panel.current?.scrollHeight ?? 0) + 2, maxHeight)
      const next = { left: Math.max(10, Math.min(rect.left, innerWidth - 326)), top: Math.max(10, Math.min((rect.top + rect.bottom - height) / 2, innerHeight - height - 10)), maxHeight }
      setPosition(old => same(old, next) ? old : next)
    }
    place()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    if (content.current) observer?.observe(content.current)
    const outside = (event: Event) => { if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) closeRef.current() }
    const key = (event: KeyboardEvent) => {
      const focusable = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)') ?? [])]
      if (event.key === 'Escape' || event.key === 'Tab' && (event.shiftKey ? document.activeElement === focusable[0] : document.activeElement === focusable.at(-1))) { event.preventDefault(); event.stopPropagation(); closeRef.current(); anchor.current?.focus() }
    }
    document.addEventListener('pointerdown', outside); document.addEventListener('focusin', outside); document.addEventListener('keydown', key, true)
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { observer?.disconnect(); document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', key, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [anchor])
  useLayoutEffect(() => { panel.current?.querySelector<HTMLElement>('[data-aw-focus]')?.focus() }, [focusKey])
  return createPortal(<div ref={panel} className="aw-load-panel" id={id} role="dialog" aria-label="Load / Intensity" style={position}><header><h3>Load / Intensity</h3><button type="button" aria-label="Close load picker" onClick={() => { close(); anchor.current?.focus() }}>×</button></header><div ref={content}>{children}</div></div>, document.body)
}
const loadChoices = [
  { value: 'lb', title: 'Weight · lb', group: 'Weight' }, { value: 'kg', title: 'Weight · kg', group: 'Weight' }, { value: 'percent', title: 'Percentage of max', group: 'Weight' },
  { value: 'rpe', title: 'RPE', group: 'Intensity' }, { value: 'qualitative', title: 'Effort cue', group: 'Intensity' },
  { value: 'bodyweight', title: 'Bodyweight', group: 'Other' }, { value: 'none', title: 'No load', group: 'Other' }, { value: 'tbd', title: 'Decide later', group: 'Other' },
] as const
const preferredBasis = (options: Basis[], exerciseId: string | null | undefined) => options.find(option => option.exercise_id === exerciseId && option.max_type === 'training_max') ?? options.find(option => option.exercise_id === exerciseId && option.max_type === 'tested_1rm')
function PercentFields({ row, options, exerciseOptions, update, disabled, template }: { row: SetRow; options: Basis[]; exerciseOptions: ExerciseOptionV1[]; update(patch: Partial<SetRow>): void; disabled: boolean; template: boolean }) {
  const unique = [...options, ...exerciseOptions].filter((option, i, all) => all.findIndex(other => other.exercise_id === option.exercise_id) === i)
  const basis = preferredBasis(options, row.percent_basis_exercise_id)
  return <><label>Based on exercise<select data-aw-focus disabled={disabled} value={row.percent_basis_exercise_id ?? ''} onChange={event => update({ percent_basis_exercise_id: event.target.value || null })}><option value="">Choose basis exercise</option>{unique.map(option => <option value={option.exercise_id} key={option.exercise_id}>{option.name}</option>)}{row.percent_basis_exercise_id && !unique.some(option => option.exercise_id === row.percent_basis_exercise_id) && <option value={row.percent_basis_exercise_id}>Existing selected basis</option>}</select></label><label>Max source<span>Training max first · Approved tested 1RM fallback</span></label><p>{template ? 'Templates keep the percentage and basis. Assigned loads resolve for the athlete.' : basis ? `Based on ${basis.name} · ${basis.value} ${basis.unit}. Assigned loads resolve automatically when saved.` : 'No approved max available. Save this draft now; add a training max or approve a tested 1RM before publishing.'} Estimated 1RMs are never used.</p></>
}
function AssignedLoad({ row, options, unit, increment, template }: { row: SetRow; options: Basis[]; unit: 'lb' | 'kg'; increment: number; template: boolean }) {
  const basis = preferredBasis(options, row.percent_basis_exercise_id), effectiveUnit = row.unit_override ?? unit
  const maxType = row.resolved_weight != null ? row.percent_basis_max_type : basis?.max_type
  const suffix = maxType === 'tested_1rm' ? '1RM' : 'TM'
  const converted = basis?.value === undefined ? null : basis.value * (basis.unit === effectiveUnit ? 1 : basis.unit === 'kg' ? 2.2046226218487757 : 1 / 2.2046226218487757)
  const weight = row.manual_override ?? row.resolved_weight ?? (converted !== null && row.percent !== null ? Math.round(converted * row.percent / 100 / increment) * increment : null)
  return <span className="aw-assigned-load" aria-label="Assigned load"><strong>{template ? '—' : weight === null ? 'Unresolved' : `${Number(weight.toFixed(3))} ${effectiveUnit}`}</strong><small>{row.percent ?? '—'}% {suffix}</small></span>
}
function LoadCell({ row, label, unit, options, exerciseOptions, exerciseId, disabled, template, update }: { row: SetRow; label: string; unit: 'lb' | 'kg'; options: Basis[]; exerciseOptions: ExerciseOptionV1[]; exerciseId?: string | null; disabled: boolean; template: boolean; update(patch: Partial<SetRow>): void }) {
  const anchor = useRef<HTMLButtonElement>(null), id = useId()
  const [open, setOpen] = useState(false), [search, setSearch] = useState(''), [percent, setPercent] = useState(false)
  const selected = row.load_mode === 'exact' ? row.unit_override ?? unit : row.load_mode
  const short = { lb: 'lb', kg: 'kg', percent: '%', rpe: 'RPE', qualitative: 'Effort', bodyweight: 'BW', none: 'None', tbd: 'Later' }[selected]
  const finish = () => { setOpen(false); anchor.current?.focus() }
  const choose = (value: typeof loadChoices[number]['value']) => {
    const mode = value === 'lb' || value === 'kg' ? 'exact' : value
    const patch: Partial<SetRow> = { load_mode: mode }
    if (mode === 'exact') patch.unit_override = value as 'lb' | 'kg'
    if (mode !== row.load_mode) {
      Object.assign(patch, { exact_weight: mode === 'exact' || mode === 'bodyweight' ? 0 : null, percent: mode === 'percent' ? 75 : null, percent_basis_exercise_id: null, percent_basis_max_type: null, qualitative: mode === 'qualitative' ? 'M' : null })
      if ('manual_override' in row) patch.manual_override = null
      if (mode === 'rpe' && row.rpe_min === null) patch.rpe_min = 7
      if (mode === 'percent') {
        patch.unit_override = null
        const candidate = exerciseOptions.find(option => option.exercise_id === exerciseId)?.default_basis_exercise_id ?? exerciseId
        const basis = preferredBasis(options, candidate)
        patch.percent_basis_exercise_id = candidate ?? null; patch.percent_basis_max_type = basis?.max_type ?? 'training_max'
      }
    }
    update(patch)
    if (mode === 'percent') setPercent(true); else finish()
  }
  return <div className="aw-load-cell">{row.load_mode === 'exact' || row.load_mode === 'percent' ? <input aria-label={`${label} load`} type="number" min="0" step="0.001" disabled={disabled} value={(row.load_mode === 'exact' ? row.exact_weight : row.percent) ?? ''} onChange={event => update({ [row.load_mode === 'exact' ? 'exact_weight' : 'percent']: event.target.value === '' ? null : Number(event.target.value) })} /> : row.load_mode === 'qualitative' ? <select aria-label={`${label} effort`} disabled={disabled} value={row.qualitative ?? ''} onChange={event => update({ qualitative: event.target.value as SetRow['qualitative'] })}>{[['L', 'Light'], ['M', 'Moderate'], ['MH', 'Moderately hard'], ['H', 'Hard']].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select> : <span className="aw-no-load">—</span>}<button ref={anchor} type="button" className="aw-load-trigger" disabled={disabled} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" aria-label={`${label} Load / Intensity: ${loadChoices.find(choice => choice.value === selected)?.title}`} onClick={() => { setSearch(''); setPercent(row.load_mode === 'percent'); setOpen(old => !old) }}>{short}<span aria-hidden="true">⌄</span></button>{open && <LoadPanel anchor={anchor} close={() => setOpen(false)} focusKey={percent ? 'percent' : 'modes'} id={id}>{percent ? <><button type="button" onClick={() => setPercent(false)}>← Change load type</button><PercentFields row={row} options={options} exerciseOptions={exerciseOptions} update={update} disabled={disabled} template={template} /><button type="button" onClick={finish}>Done</button></> : <><label>Search load options<input data-aw-focus value={search} onChange={event => setSearch(event.target.value)} placeholder="Weight, RPE, bodyweight…" /></label>{['Weight', 'Intensity', 'Other'].map(group => {
    const choices = loadChoices.filter(choice => choice.group === group && `${choice.title} ${choice.group}`.toLowerCase().includes(search.toLowerCase()))
    return choices.length > 0 && <section key={group}><h4>{group}</h4>{choices.map(choice => <button type="button" className="aw-load-option" key={choice.value} aria-pressed={selected === choice.value} disabled={disabled} onClick={() => choose(choice.value)}>{choice.title}<span aria-hidden="true">{selected === choice.value ? '✓' : '→'}</span></button>)}</section>
  })}<p>RPE stays optional for other load types. Percentage sets show assigned load.</p></>}</LoadPanel>}</div>
}

const validNumber = (value: number | null, min: number, max: number, decimals = 0) => value !== null && Number.isFinite(value) && value >= min && value <= max && Math.abs(value * 10 ** decimals - Math.round(value * 10 ** decimals)) < 1e-6
const repsRepair = 'Reps must be a whole number from 1 to 9,999,999.'

function validation(day: Draft, original: Draft): string[] {
  const errors: string[] = [], exercises = exercisesOf(day), originalSets = exercisesOf(original).flatMap(exercise => exercise.set_groups)
  const text = (value: string | null, max: number, required = false) => value === null ? !required : Boolean(value.trim()) && [...value].length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
  const number = validNumber
  const optional = (value: number | null, min: number, max: number, decimals = 0) => value === null || number(value, min, max, decimals)
  if (!text(day.label, 120, true) || !text(day.subtitle, 500) || !text(day.workout_instruction, 1000)) errors.push('Complete the workout name and remove blank-only or overly long notes.')
  if (day.movement_groups.length > 12 || exercises.length > 12 || exercises.reduce((sum, exercise) => sum + countOf(exercise), 0) > 20) errors.push('A day supports up to 12 sections, 12 exercises and 20 physical sets.')
  if (day.marked_rest && exercises.length) errors.push('A recovery day cannot contain exercises.')
  for (const group of day.movement_groups) {
    const issue = group.group_type === 'superset' ? supersetIssue(group.exercises) : null
    if (issue) errors.push(supersetIssueMessage(issue))
    if (!text(group.title, 120) || group.group_type === 'circuit' && (!number(group.rounds_min, 1, 100) || !optional(group.rounds_max, group.rounds_min ?? 1, 100))) errors.push('Complete the section title and valid circuit rounds.')
  }
  for (const exercise of exercises) {
    if (!text(exercise.name, 120, true) || !text(exercise.instruction, 1000) || !text(exercise.note, 500) || !text(exercise.protocol, 1000) || !exercise.set_groups.length) errors.push('Each exercise needs a name and a prescription; notes cannot contain only spaces.')
    for (const row of exercise.set_groups) {
      if (nodeId(row) && originalSets.some(previous => nodeId(previous) === nodeId(row) && same(previous, row))) continue
      const count = number(row.sets_min, 1, 20) && (row.sets_mode === 'exact' ? row.sets_max === null : number(row.sets_max, row.sets_min, 20))
      const dose = row.dose_mode === 'amrap' ? row.reps_mode === null && row.dose_min === null && row.dose_max === null && row.distance_unit === null : row.dose_mode === 'reps' ? row.distance_unit === null && (row.reps_mode === 'athlete_choice' ? row.dose_min === null && row.dose_max === null : number(row.dose_min, 1, 9999999) && (row.reps_mode === 'exact' ? row.dose_max === null : row.reps_mode === 'range' && number(row.dose_max, row.dose_min ?? 1, 9999999))) : row.reps_mode === null && row.dose_max === null && (row.dose_mode === 'distance' ? number(row.dose_min, .001, 9999999.999, 3) && row.distance_unit !== null : number(row.dose_min, 1, 9999999) && row.distance_unit === null)
      const load = row.load_mode === 'exact' ? number(row.exact_weight, 0, 9999999.999, 3) : row.load_mode === 'bodyweight' ? row.exact_weight === 0 : row.load_mode === 'percent' ? number(row.percent, .001, 200, 3) && Boolean(row.percent_basis_exercise_id) && Boolean(row.percent_basis_max_type) && optional(row.manual_override ?? null, 0, 9999999.999, 3) : row.load_mode === 'rpe' ? number(row.rpe_min, 1, 10, 1) : row.load_mode === 'qualitative' ? ['L', 'M', 'MH', 'H'].includes(row.qualitative ?? '') : true
      const invalidExactReps = row.dose_mode === 'reps' && row.reps_mode === 'exact' && !number(row.dose_min, 1, 9999999)
      if (invalidExactReps) errors.push(`${exercise.name || 'Exercise'}: ${repsRepair}`)
      if (!count || (!dose && !invalidExactReps) || !load || !optional(row.rpe_min, 1, 10, 1) || row.rpe_min === null && row.rpe_max !== null || !optional(row.rpe_max, row.rpe_min ?? 1, 10, 1) || !text(row.note, 500)) errors.push(`Review ${exercise.name || 'exercise'} prescriptions: sets, dose, load, RPE or notes are incomplete.`)
    }
  }
  return [...new Set(errors)]
}

export default function ApprovedWorkoutEditor({ day, template = false, percentBasisOptions, exerciseOptions = [], historySuggestions = [], defaultUnit, plateIncrement = defaultUnit === 'kg' ? 2.5 : 5, disabled, buildPayload, onSave, onDirtyChange, onSaveReadinessChange, registerSave, onEnsureExercise, trackingSupported = false, onHistoryQuery, onCopyPrevious, copyPreviousDisabled = false }: ApprovedWorkoutEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => clone(day) as Draft), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [copying, setCopying] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}), [details, setDetails] = useState<(Location & { set: number }) | null>(null), [sectionDetails, setSectionDetails] = useState<number | null>(null)
  const [adding, setAdding] = useState<{ group: number | null } | null>(null), [name, setName] = useState(''), [deleteOpen, setDeleteOpen] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null), generation = useRef(0), saveLock = useRef(false)
  useEffect(() => { generation.current++; setDraft(clone(day) as Draft); setError(null); setExpanded({}); setDetails(null); setSectionDetails(null); setAdding(null); setDeleteOpen(false); return () => { generation.current++ } }, [day])
  const dirty = !same(day, draft), locked = disabled || saving || copying, exercises = exercisesOf(draft), totalSets = exercises.reduce((sum, exercise) => sum + countOf(exercise), 0)
  const errors = validation(draft, day as Draft)
  const canSave = !locked && dirty && errors.length === 0
  const validationId = useId()
  useLayoutEffect(() => { onSaveReadinessChange?.(canSave); return () => onSaveReadinessChange?.(false) }, [canSave, onSaveReadinessChange])
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  const mutate = (change: (next: Draft) => void) => {
    if (locked) return
    setDraft(old => { const next = clone(old); change(next); normalize(next); return next })
    setError(null)
  }
  const getExercise = (source: Draft, loc: Location) => loc.group === null ? source.ungrouped_exercises[loc.exercise] : source.movement_groups[loc.group]?.exercises[loc.exercise]
  const editExercise = (loc: Location, change: (exercise: Exercise) => void) => mutate(next => { const exercise = getExercise(next, loc); if (exercise) change(exercise) })
  const prescriptionPatch = (row: SetRow, patch: Partial<SetRow>) => {
    const fields = ['load_mode', 'percent', 'percent_basis_exercise_id', 'unit_override'] as const
    if (!fields.some(field => field in patch && patch[field] !== row[field])) return patch
    const next = { ...row, ...patch }
    return { ...patch, ...(next.load_mode === 'percent' ? { percent_basis_max_type: preferredBasis(percentBasisOptions, next.percent_basis_exercise_id)?.max_type ?? 'training_max' } : {}), ...(!template ? { of_max_id: null, resolved_weight: null, resolved_max_effective_from: null, resolved_at: null, manual_override: null } : {}) }
  }
  const editSet = (loc: Location, index: number, patch: Partial<SetRow>) => editExercise(loc, exercise => { if (exercise.set_groups[index]) Object.assign(exercise.set_groups[index], prescriptionPatch(exercise.set_groups[index], patch)) })
  const newSet = (): SetRow => ({ mode: 'replace', [template ? 'id' : 'identity_token']: null, ordinal: 1, sets_mode: 'exact', sets_min: 1, sets_max: null, dose_mode: 'reps', reps_mode: 'exact', dose_min: 8, dose_max: null, distance_unit: null, laterality: 'bilateral', load_mode: 'exact', load_basis: 'total', exact_weight: 0, percent: null, percent_basis_exercise_id: null, percent_basis_max_type: null, rpe_min: null, rpe_max: null, qualitative: null, unit_override: defaultUnit, rest_seconds: null, note: null, ...(!template ? { manual_override: null, of_max_id: null, resolved_weight: null, resolved_max_effective_from: null, resolved_at: null } : {}) })
  const newSection = (): Group => ({ mode: 'replace', [template ? 'id' : 'identity_token']: null, ordinal: draft.movement_groups.length + 1, group_type: 'sequence', title: draft.movement_groups.length ? `Section ${draft.movement_groups.length + 1}` : 'Main work', rounds_min: null, rounds_max: null, exercises: [] })
  const save = async () => {
    if (saveLock.current || locked || !dirty || errors.length) return false
    saveLock.current = true; setSaving(true); setError(null)
    const currentGeneration = generation.current, snapshot = clone(draft), original = day
    try {
      // Identity creation is deferred until an explicit save, never a free-text addition.
      for (const exercise of exercisesOf(snapshot)) if (exercise.track_in_metrics && !exercise.exercise_id) {
        if (!onEnsureExercise) throw new Error('Choose a library exercise before saving tracked exercise requirements.')
        const option = await onEnsureExercise(exercise.name)
        if (generation.current !== currentGeneration) return false
        exercise.exercise_id = option.exercise_id
      }
      const payload = buildPayload(snapshot as Day, original)
      await onSave(payload)
      return true
    } catch (cause) { if (generation.current === currentGeneration) setError(cause instanceof Error ? cause.message : 'Save was not confirmed. Your draft is retained.'); return false }
    finally { saveLock.current = false; setSaving(false) }
  }
  useEffect(() => { registerSave?.(save) })
  const copyPrevious = async () => {
    if (locked || copyPreviousDisabled || !onCopyPrevious) return
    const currentGeneration = generation.current
    setCopying(true); setError(null)
    try {
      const copied = await onCopyPrevious()
      if (copied && currentGeneration === generation.current) {
        if (copied.identity_token !== day.identity_token || copied.ordinal !== day.ordinal) throw new Error('Copy destination changed. Review this day again before copying.')
        setDraft(clone(copied) as Draft); setExpanded({}); setDetails(null); titleRef.current?.focus()
      }
    } catch (cause) { if (currentGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'Copy was not confirmed. The draft is unchanged.') }
    finally { setCopying(false) }
  }
  const setCount = (loc: Location, count: number) => editExercise(loc, exercise => {
    if (exercise.set_groups.some(row => row.sets_mode !== 'exact')) return
    while (countOf(exercise) > count) { const row = exercise.set_groups.at(-1)!; if (row.sets_min > 1) row.sets_min--; else exercise.set_groups.pop() }
    if (countOf(exercise) < count) { const last = exercise.set_groups.at(-1) ?? newSet(); exercise.set_groups.push({ ...clone(last), [template ? 'id' : 'identity_token']: null, sets_min: count - countOf(exercise), sets_max: null }) }
  })
  const openDetails = (loc: Location, set: number) => setDetails({ ...loc, set })
  const renderExercise = (exercise: Exercise, loc: Location) => {
    const key = nodeId(exercise) ?? `${loc.group ?? 'ungrouped'}:${loc.exercise}`, rows = physicalRows(exercise), hasRange = exercise.set_groups.some(row => row.sets_mode !== 'exact')
    const identical = !hasRange && rows.length > 0 && rows.every(item => approvedPrescriptionKey(item.row) === approvedPrescriptionKey(rows[0].row))
    const isExpanded = expanded[key] ?? !identical, compact = identical && !isExpanded, shown = compact ? rows.slice(0, 1) : rows
    const update = (groupIndex: number, physicalIndex: number, patch: Partial<SetRow>) => {
      if (!compact) setExpanded(old => ({ ...old, [key]: true }))
      editExercise(loc, current => { if (compact) current.set_groups.forEach(row => Object.assign(row, prescriptionPatch(row, patch))); else Object.assign(current, approvedEditPhysicalSet(current, groupIndex, physicalIndex, prescriptionPatch(current.set_groups[groupIndex], patch), template)) })
    }
    return <tbody key={key}>{shown.map(({ row, groupIndex, physicalIndex }, index) => {
      const label = `${exercise.name || 'Exercise'} ${compact ? 'all sets' : `set ${index + 1}`}`
      const preserved = nodeId(row) && exercisesOf(day as Draft).some(item => item.set_groups.some(previous => nodeId(previous) === nodeId(row) && same(previous, row)))
      const repsInvalid = dirty && !preserved && row.dose_mode === 'reps' && row.reps_mode === 'exact' && !validNumber(row.dose_min, 1, 9999999)
      const repsErrorId = `${validationId}-${exercise.ordinal}-${index}-reps-error`
      return <Fragment key={index}><tr><td>{index === 0 && <div className="aw-exercise-name"><input aria-label={`Exercise ${exercise.ordinal} name`} maxLength={120} disabled={locked} value={exercise.name} onChange={event => editExercise(loc, item => { item.name = event.target.value })} /><button type="button" className="aw-expand" disabled={locked || !identical || rows.length < 2} onClick={() => setExpanded(old => ({ ...old, [key]: !isExpanded }))}>{hasRange ? 'Set range' : !identical ? 'Varied sets' : compact ? 'Show all sets' : 'Compact sets'}</button></div>}</td><td>{index === 0 ? hasRange ? <button type="button" className="aw-dose-detail" onClick={() => openDetails(loc, 0)} disabled={locked}>{exercise.set_groups.map(item => item.sets_mode === 'range' ? `${item.sets_min}–${item.sets_max}` : item.sets_min).join('+')}</button> : <select aria-label={`${exercise.name} set count`} value={countOf(exercise)} disabled={locked} onChange={event => setCount(loc, Number(event.target.value))}>{Array.from({ length: Math.max(countOf(exercise), 20 - totalSets + countOf(exercise)) }, (_, i) => <option value={i + 1} key={i}>{i + 1}</option>)}</select> : <span className="aw-set-index">{index + 1}</span>}</td><td>{row.dose_mode === 'reps' && row.reps_mode === 'exact' ? <input aria-label={`${label} reps`} aria-invalid={repsInvalid || undefined} aria-describedby={repsInvalid ? repsErrorId : undefined} type="number" min="1" max="9999999" step="1" disabled={locked} value={row.dose_min ?? ''} onChange={event => update(groupIndex, physicalIndex, { dose_min: event.target.value === '' ? null : Number(event.target.value) })} /> : <button type="button" className="aw-dose-detail" disabled={locked} onClick={() => openDetails(loc, groupIndex)}>{row.dose_mode === 'amrap' ? 'AMRAP' : row.reps_mode === 'athlete_choice' ? 'Choice' : row.reps_mode === 'range' ? `${row.dose_min}–${row.dose_max}` : `${row.dose_min ?? '—'} ${row.distance_unit ?? row.dose_mode}`}</button>}</td><td><LoadCell row={row} label={label} unit={defaultUnit} options={percentBasisOptions} exerciseOptions={exerciseOptions} exerciseId={exercise.exercise_id} disabled={locked} template={template} update={patch => update(groupIndex, physicalIndex, patch)} /></td><td>{row.load_mode === 'percent' ? <AssignedLoad row={row} options={percentBasisOptions} unit={defaultUnit} increment={plateIncrement} template={template} /> : <input aria-label={`${label} RPE optional`} type="number" min="1" max="10" step="0.1" disabled={locked} placeholder="—" value={row.rpe_min ?? ''} onChange={event => update(groupIndex, physicalIndex, { rpe_min: event.target.value === '' ? null : Number(event.target.value), rpe_max: null, ...(event.target.value === '' && row.load_mode === 'rpe' ? { load_mode: 'tbd' } : {}) })} />}</td><td><button type="button" className="aw-details-trigger" aria-label={`${label} details`} disabled={locked} onClick={() => openDetails(loc, groupIndex)}>•••</button></td></tr>{repsInvalid && <tr><td colSpan={6}><span id={repsErrorId} className="aw-error">{label}: {repsRepair}</span></td></tr>}</Fragment>
    })}</tbody>
  }
  const renderSection = (group: number | null) => {
    const section = group === null ? null : draft.movement_groups[group], list = section?.exercises ?? draft.ungrouped_exercises
    const loads = list.flatMap(exercise => exercise.set_groups), hasPercent = loads.some(row => row.load_mode === 'percent'), onlyPercent = loads.length > 0 && loads.every(row => row.load_mode === 'percent')
    return <section className="aw-section" key={section ? nodeId(section) ?? group : 'ungrouped'}><header>{section ? <><input aria-label={`Section ${group! + 1} title`} maxLength={120} value={section.title ?? ''} disabled={locked} onChange={event => mutate(next => { next.movement_groups[group!].title = event.target.value || null })} /><span>{section.group_type === 'sequence' ? '' : section.group_type === 'superset' ? 'Superset' : 'Circuit'}</span><button type="button" disabled={locked} onClick={() => setSectionDetails(group)}>Section details</button></> : <h2>Exercises</h2>}</header><div className="aw-sheet-scroll" role="region" aria-label={`${section?.title ?? 'Exercises'} worksheet`} tabIndex={0}><table className="aw-sheet"><caption className="aw-sr">Identical sets can share a row. Expanded sets keep their individual prescriptions.</caption><colgroup><col className="aw-col-exercise"/><col className="aw-col-sets"/><col className="aw-col-reps"/><col className="aw-col-load"/><col className="aw-col-rpe"/><col className="aw-col-details"/></colgroup><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Load</th><th>{onlyPercent ? "Assigned load" : hasPercent ? "RPE / Load" : "RPE"}</th><th><span className="aw-sr">Details</span></th></tr></thead>{list.map((exercise, index) => renderExercise(exercise, { group, exercise: index }))}</table></div>{!list.length && <p className="aw-muted">Add the first exercise to this section.</p>}<button type="button" className="aw-add" disabled={locked || exercises.length >= 12 || totalSets >= 20} onClick={() => { setAdding({ group }); setName(''); onHistoryQuery?.('') }}>＋ Add exercise to {section?.title ?? 'workout'}</button></section>
  }
  const detailExercise = details ? getExercise(draft, details) : undefined, detailSet = detailExercise?.set_groups[Math.min(details?.set ?? 0, (detailExercise?.set_groups.length ?? 1) - 1)]
  const detailSetIndex = Math.min(details?.set ?? 0, (detailExercise?.set_groups.length ?? 1) - 1)
  const patchDetail = (patch: Partial<SetRow>) => { if (details) { const key = nodeId(detailExercise!) ?? `${details.group ?? 'ungrouped'}:${details.exercise}`; setExpanded(old => ({ ...old, [key]: true })); editSet(details, detailSetIndex, patch) } }
  const numberField = (label: string, field: keyof SetRow, min: number, step = '1') => detailSet && <label>{label}<input type="number" min={min} step={step} disabled={locked} value={(detailSet[field] as number | null) ?? ''} onChange={event => patchDetail({ [field]: event.target.value === '' ? null : Number(event.target.value) })} /></label>
  const hasWorkoutTitle = Boolean((draft.subtitle ?? (draft.label !== weekdays[draft.ordinal - 1] ? draft.label : '')).trim())
  const empty = exercises.length === 0 && (draft.marked_rest || (!hasWorkoutTitle && draft.movement_groups.length === 0))
  const suggestions = historySuggestions.filter((item, index, list) => list.findIndex(other => other.trim().toLowerCase() === item.trim().toLowerCase()) === index && item.toLowerCase().includes(name.trim().toLowerCase())).slice(0, 8)
  return <section className="approved-workout-editor" aria-label="Workout editor">{dirty && errors.length > 0 && <div className="aw-error" role="status" tabIndex={0} aria-label="Workout needs corrections"><strong>Correct these fields before saving.</strong><ul>{errors.map(message => <li key={message}>{message}</li>)}</ul></div>}<header className="aw-workout-head"><label>Workout title<input ref={titleRef} aria-label="Workout title" value={draft.subtitle ?? (draft.label !== weekdays[draft.ordinal - 1] ? draft.label : '')} maxLength={500} disabled={locked} onChange={event => mutate(next => { next.subtitle = event.target.value || null; next.label = weekdays[next.ordinal - 1] ?? next.label })} /></label><label>Workout description<textarea maxLength={1000} disabled={locked} value={draft.workout_instruction ?? ''} onChange={event => mutate(next => { next.workout_instruction = event.target.value || null })} /></label></header>{empty ? <div className="aw-empty"><h2>No workout assigned</h2><p>Add a workout to begin programming this day.</p><button type="button" className="aw-primary" disabled={locked} onClick={() => mutate(next => { next.marked_rest = false; if (!next.subtitle) next.subtitle = 'New workout'; next.movement_groups.push(newSection()) })}>＋ Add workout</button>{onCopyPrevious && <button type="button" disabled={locked || copyPreviousDisabled} onClick={() => void copyPrevious()}>{copying ? 'Loading copy…' : 'Copy from previous week'}</button>}</div> : <>{draft.movement_groups.map((_, index) => renderSection(index))}{(draft.ungrouped_exercises.length > 0 || draft.movement_groups.length === 0) && renderSection(null)}<div className="aw-workout-actions"><button type="button" disabled={locked || draft.movement_groups.length >= 12} onClick={() => mutate(next => { next.movement_groups.push(newSection()) })}>＋ Add workout section</button><button type="button" className="aw-delete" disabled={locked} onClick={() => setDeleteOpen(true)}>Delete workout</button></div></>}{error && <p role="alert" className="aw-error">{error}</p>}<footer className="aw-save-row"><span>{dirty ? 'Unsaved changes' : 'Saved workout'} · {exercises.length} exercises · {totalSets} sets</span><div><button type="button" disabled={!canSave} onClick={() => void save()}>{saving ? 'Saving…' : 'Save workout'}</button></div></footer>
    {adding && <Modal title="Add exercise" close={() => setAdding(null)} fallback={titleRef}><form onSubmit={event => { event.preventDefault(); if (locked || !name.trim() || exercises.length >= 12 || totalSets >= 20) return; const canonical = historySuggestions.find(item => item.trim().toLowerCase() === name.trim().toLowerCase())?.trim() ?? name.trim(); mutate(next => { const list = adding.group === null ? next.ungrouped_exercises : next.movement_groups[adding.group].exercises; list.push({ mode: 'replace', [template ? 'id' : 'identity_token']: null, ordinal: exercises.length + 1, group_ordinal: null, status: 'programmed', name: canonical, instruction: null, note: null, protocol: null, ...(trackingSupported ? { exercise_id: exerciseOptions.find(option => option.name.trim().toLowerCase() === canonical.toLowerCase())?.exercise_id ?? null, track_in_metrics: false } : {}), set_groups: [{ ...newSet(), sets_min: Math.min(3, 20 - totalSets) }] }) }); setAdding(null) }}><label>Exercise name<input data-aw-focus maxLength={120} value={name} disabled={locked} onChange={event => { setName(event.target.value); onHistoryQuery?.(event.target.value) }} /></label><p>Suggestions from previously saved workouts and programs. You can enter a new name.</p><div className="aw-suggestions">{suggestions.map(item => <button type="button" key={item} onClick={() => setName(item)}>{item}</button>)}</div>{name.trim() && !suggestions.some(item => item.toLowerCase() === name.trim().toLowerCase()) && <p>Use this new name: <strong>{name.trim()}</strong></p>}<button type="submit" className="aw-primary" disabled={locked || !name.trim()}>Add {name.trim() ? `“${name.trim()}”` : 'exercise'}</button></form></Modal>}
    {deleteOpen && <Modal title="Delete workout?" close={() => setDeleteOpen(false)} fallback={titleRef}><p>This clears the workout title, description, sections and exercises from this draft. Save workout to persist it.</p><div className="aw-dialog-actions"><button type="button" onClick={() => setDeleteOpen(false)}>Cancel</button><button type="button" disabled={locked} onClick={() => { mutate(next => { next.subtitle = null; next.label = weekdays[next.ordinal - 1] ?? next.label; next.workout_instruction = null; next.movement_groups = []; next.ungrouped_exercises = []; next.marked_rest = true }); setDeleteOpen(false) }}>Delete workout from draft</button></div></Modal>}
    {sectionDetails !== null && draft.movement_groups[sectionDetails] && <Modal title="Section details" close={() => setSectionDetails(null)} fallback={titleRef}><label>Section type<select disabled={locked} value={draft.movement_groups[sectionDetails].group_type} onChange={event => mutate(next => { const group = next.movement_groups[sectionDetails]; group.group_type = event.target.value as Group['group_type']; group.rounds_min = group.group_type === 'circuit' ? group.rounds_min ?? 3 : null; group.rounds_max = group.group_type === 'circuit' ? group.rounds_max : null })}><option value="sequence">Workout section</option><option value="superset">Superset</option><option value="circuit">Circuit</option></select></label>{draft.movement_groups[sectionDetails].group_type === 'circuit' && <>{(['rounds_min', 'rounds_max'] as const).map(field => <label key={field}>{field === 'rounds_min' ? 'Rounds minimum' : 'Rounds maximum'}<input type="number" min="1" max="100" disabled={locked} value={draft.movement_groups[sectionDetails][field] ?? ''} onChange={event => mutate(next => { next.movement_groups[sectionDetails][field] = event.target.value === '' ? null : Number(event.target.value) })} /></label>)}</>}<p>Removing a section keeps its exercises and moves them to Exercises.</p><button type="button" disabled={locked} onClick={() => { mutate(next => { const [group] = next.movement_groups.splice(sectionDetails, 1); next.ungrouped_exercises.push(...group.exercises) }); setSectionDetails(null) }}>Remove section and keep exercises</button></Modal>}
    {details && detailExercise && detailSet && <Modal title={`${detailExercise.name} details`} close={() => setDetails(null)} fallback={titleRef}><div className="aw-fields"><label>Move to<select disabled={locked} value={details.group ?? 'ungrouped'} onChange={event => { const destination = event.target.value === 'ungrouped' ? null : Number(event.target.value); mutate(next => { const source = details.group === null ? next.ungrouped_exercises : next.movement_groups[details.group].exercises; const [exercise] = source.splice(details.exercise, 1); const target = destination === null ? next.ungrouped_exercises : next.movement_groups[destination].exercises; target.push(exercise) }); setDetails(null) }}><option value="ungrouped">Exercises</option>{draft.movement_groups.map((group, index) => <option key={index} value={index}>{group.title ?? `Section ${index + 1}`}</option>)}</select></label><label>Exercise status<select disabled={locked} value={detailExercise.status} onChange={event => editExercise(details, exercise => { exercise.status = event.target.value as Exercise['status'] })}><option value="programmed">Programmed</option><option value="not_programmed">Not programmed</option></select></label>{(['instruction', 'note', 'protocol'] as const).map(field => <label className="aw-wide" key={field}>Exercise {field}<textarea disabled={locked} maxLength={field === 'note' ? 500 : 1000} value={detailExercise[field] ?? ''} onChange={event => editExercise(details, exercise => { exercise[field] = event.target.value || null })} /></label>)}{trackingSupported && <><label>Library identity<select disabled={locked} value={detailExercise.exercise_id ?? ''} onChange={event => editExercise(details, exercise => { exercise.exercise_id = event.target.value || null })}><option value="">Unlinked exercise name</option>{exerciseOptions.map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}</select></label><label className="aw-check"><input type="checkbox" disabled={locked || !detailExercise.exercise_id && !onEnsureExercise} checked={detailExercise.track_in_metrics ?? false} onChange={event => editExercise(details, exercise => { exercise.track_in_metrics = event.target.checked })} />Require metrics tracking when saved</label></>}<label>Prescription to edit<select disabled={locked} value={detailSetIndex} onChange={event => setDetails({ ...details, set: Number(event.target.value) })}>{detailExercise.set_groups.map((row, index) => <option key={index} value={index}>Prescription {index + 1} · {row.sets_mode === 'range' ? `${row.sets_min}–${row.sets_max}` : row.sets_min} sets</option>)}</select></label><label>Set count type<select disabled={locked} value={detailSet.sets_mode} onChange={event => patchDetail({ sets_mode: event.target.value as SetRow['sets_mode'], sets_max: event.target.value === 'range' ? detailSet.sets_min : null })}><option value="exact">Exact</option><option value="range">Range</option></select></label>{numberField('Sets minimum', 'sets_min', 1)}{detailSet.sets_mode === 'range' && numberField('Sets maximum', 'sets_max', 1)}<label>Dose<select disabled={locked} value={detailSet.dose_mode} onChange={event => { const mode = event.target.value as SetRow['dose_mode']; patchDetail({ dose_mode: mode, reps_mode: mode === 'reps' ? 'exact' : null, dose_min: mode === 'amrap' ? null : 8, dose_max: null, distance_unit: mode === 'distance' ? 'm' : null }) }}>{[['reps', 'Repetitions'], ['time', 'Time (seconds)'], ['steps', 'Steps'], ['distance', 'Distance'], ['amrap', 'AMRAP']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{detailSet.dose_mode === 'reps' && <label>Reps type<select disabled={locked} value={detailSet.reps_mode ?? 'exact'} onChange={event => { const mode = event.target.value as SetRow['reps_mode']; patchDetail({ reps_mode: mode, dose_min: mode === 'athlete_choice' ? null : detailSet.dose_min ?? 8, dose_max: mode === 'range' ? detailSet.dose_min ?? 8 : null }) }}><option value="exact">Exact</option><option value="range">Range</option><option value="athlete_choice">Athlete choice</option></select></label>}{detailSet.dose_mode !== 'amrap' && detailSet.reps_mode !== 'athlete_choice' && numberField('Dose minimum', 'dose_min', detailSet.dose_mode === 'distance' ? .001 : 1, detailSet.dose_mode === 'distance' ? '.001' : '1')}{detailSet.reps_mode === 'range' && numberField('Dose maximum', 'dose_max', 1)}{detailSet.dose_mode === 'distance' && <label>Distance unit<select disabled={locked} value={detailSet.distance_unit ?? 'm'} onChange={event => patchDetail({ distance_unit: event.target.value as SetRow['distance_unit'] })}>{['m', 'km', 'ft', 'mi'].map(unit => <option key={unit}>{unit}</option>)}</select></label>}<label>Laterality<select disabled={locked} value={detailSet.laterality} onChange={event => patchDetail({ laterality: event.target.value as SetRow['laterality'] })}><option value="bilateral">Bilateral</option><option value="each_side">Each side</option><option value="alternating">Alternating</option></select></label><label>Load basis<select disabled={locked} value={detailSet.load_basis} onChange={event => patchDetail({ load_basis: event.target.value as SetRow['load_basis'] })}><option value="total">Total</option><option value="added_to_bodyweight">Added to bodyweight</option><option value="per_hand">Per hand</option></select></label>{detailSet.load_mode !== 'percent' && <>{numberField('RPE minimum', 'rpe_min', 1, '.1')}{numberField('RPE maximum', 'rpe_max', 1, '.1')}</>}{detailSet.load_mode === 'percent' && <div className="aw-wide"><PercentFields row={detailSet} options={percentBasisOptions} exerciseOptions={exerciseOptions} update={patchDetail} disabled={locked} template={template} /></div>}<label className="aw-wide">Set note<textarea maxLength={500} disabled={locked} value={detailSet.note ?? ''} onChange={event => patchDetail({ note: event.target.value || null })} /></label></div><div className="aw-dialog-actions"><button type="button" disabled={locked || detailExercise.set_groups.length < 2} onClick={() => { editExercise(details, exercise => { exercise.set_groups.splice(detailSetIndex, 1) }); setDetails({ ...details, set: 0 }) }}>Remove prescription</button><button type="button" disabled={locked || totalSets >= 20} onClick={() => editExercise(details, exercise => { exercise.set_groups.push(newSet()) })}>Add prescription</button><button type="button" disabled={locked} onClick={() => { mutate(next => { const list = details.group === null ? next.ungrouped_exercises : next.movement_groups[details.group].exercises; list.splice(details.exercise, 1) }); setDetails(null) }}>Remove exercise</button></div></Modal>}
  </section>
}

export { ApprovedWorkoutEditor }
