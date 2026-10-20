import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { ExerciseOptionV1, RichPercentBasisOption, RichProgramDay, RichTemplateDay, RichProgramDaySave, RichTemplateDaySave, RichSetFields } from './lib/coach-api'
import { createWorkoutRecoveryWriter, listWorkoutRecovery, readWorkoutRecovery, discardWorkoutRecovery, subscribeWorkoutRecovery, workoutRecoveryFingerprint, type WorkoutRecoveryCandidate, type WorkoutRecoveryController, type WorkoutRecoveryScope, type WorkoutRecoveryState } from './lib/workout-recovery'
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
type NumberInputDraft = { raw: string; invalid: boolean }
type LoadInputDraft = { raw: string; mode: 'exact' | 'percent' }
export type ApprovedWorkoutEditorProps = {
  recovery?: { scope: WorkoutRecoveryScope; revision: number; epoch?: string | null }
  registerRecovery?(controller: WorkoutRecoveryController | null): void
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
const exercisesOf = (day: Draft) => [...day.movement_groups.flatMap(group => group.exercises), ...day.ungrouped_exercises].sort((a, b) => a.ordinal - b.ordinal)
const countOf = (exercise: Exercise) => exercise.set_groups.reduce((sum, row) => sum + row.sets_min, 0)
/** Only structural edits renumber; legacy global order can interleave grouped and ungrouped exercises. */
const normalize = (day: Draft) => {
  exercisesOf(day).forEach((exercise, index) => { exercise.ordinal = index + 1 })
  day.movement_groups.forEach((group, i) => {
    group.ordinal = i + 1
    group.exercises.sort((a, b) => a.ordinal - b.ordinal).forEach((exercise, n) => { exercise.group_ordinal = n + 1 })
  })
  day.ungrouped_exercises.sort((a, b) => a.ordinal - b.ordinal).forEach(exercise => { exercise.group_ordinal = null })
  exercisesOf(day).forEach(exercise => exercise.set_groups.forEach((row, index) => { row.ordinal = index + 1 }))
}
const physicalRows = (exercise: Exercise) => exercise.set_groups.flatMap((row, groupIndex) => Array.from({ length: row.sets_mode === 'exact' ? Math.max(1, Math.min(20, Number.isFinite(row.sets_min) ? Math.floor(row.sets_min) : 1)) : 1 }, (_, physicalIndex) => ({ row, groupIndex, physicalIndex })))
/** Compare complete physical prescriptions, including unknown future metadata. Rest is retained but is no longer authored. */
export function approvedPrescriptionKey(row: SetRow) {
  const { id: _id, identity_token: _identity, ordinal: _ordinal, rest_seconds: _rest, ...prescription } = row
  return JSON.stringify({ ...prescription, ...(row.sets_mode === 'exact' ? { sets_min: 1 } : {}) })
}
export function approvedEditPhysicalSet(exercise: Exercise, groupIndex: number, physicalIndex: number, patch: Partial<SetRow>, _template: boolean): Exercise {
  const next = clone(exercise), row = next.set_groups[groupIndex]
  // Repair an invalid count through Sets before splitting. Raw authoring facts stay intact.
  if (!row || row.sets_mode === 'exact' && (!Number.isSafeInteger(row.sets_min) || row.sets_min < 1 || row.sets_min > 20)) return next
  if (row.sets_mode === 'exact' && row.sets_min > 1) {
    const split = Array.from({ length: row.sets_min }, (_, index) => ({ ...row, sets_min: 1, ordinal: groupIndex + index + 1, ...(index === 0 ? {} : { id: null, identity_token: null }) }))
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
function LoadCell({ row, label, unit, options, exerciseOptions, exerciseId, disabled, template, update, input, onInput, clearInput, showError, onBlur }: { row: SetRow; label: string; unit: 'lb' | 'kg'; options: Basis[]; exerciseOptions: ExerciseOptionV1[]; exerciseId?: string | null; disabled: boolean; template: boolean; update(patch: Partial<SetRow>): void; input?: LoadInputDraft; onInput(raw: string): void; clearInput(): void; showError: boolean; onBlur(): void }) {
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
      clearInput()
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
  const numericLoad = row.load_mode === 'percent' ? row.percent : row.exact_weight
  // Keep coach-entered decimal text through our own numeric rerenders. Saved zero alone starts as a ghost.
  const buffered = input?.mode === row.load_mode && approvedParseLoad(input.raw, input.mode) === numericLoad ? input.raw : undefined
  const invalid = showError && buffered !== undefined && approvedParseLoad(buffered, input!.mode) === null
  const errorId = `${id}-load-error`
  return <div className="aw-load-cell">{row.load_mode === 'exact' || row.load_mode === 'percent' ? <><input aria-label={`${label} load`} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} type="text" inputMode="decimal" onBlur={onBlur} disabled={disabled} placeholder={row.load_mode === 'exact' ? '0' : undefined} value={buffered ?? (row.load_mode === 'exact' && numericLoad === 0 ? '' : numericLoad ?? '')} onChange={event => onInput(event.target.value)} />{invalid && <span id={errorId} className="aw-sr">{loadRepair}</span>}</> : row.load_mode === 'qualitative' ? <select aria-label={`${label} effort`} disabled={disabled} value={row.qualitative ?? ''} onChange={event => update({ qualitative: event.target.value as SetRow['qualitative'] })}>{[['L', 'Light'], ['M', 'Moderate'], ['MH', 'Moderately heavy'], ['H', 'Heavy']].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select> : <span className="aw-no-load">—</span>}<button ref={anchor} type="button" className="aw-load-trigger" disabled={disabled} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" aria-label={`${label} Load / Intensity: ${loadChoices.find(choice => choice.value === selected)?.title}`} onClick={() => { setSearch(''); setPercent(row.load_mode === 'percent'); setOpen(old => !old) }}>{short}<span aria-hidden="true">⌄</span></button>{open && <LoadPanel anchor={anchor} close={() => setOpen(false)} focusKey={percent ? 'percent' : 'modes'} id={id}>{percent ? <><button type="button" onClick={() => setPercent(false)}>← Change load type</button><PercentFields row={row} options={options} exerciseOptions={exerciseOptions} update={update} disabled={disabled} template={template} /><button type="button" onClick={finish}>Done</button></> : <><label>Search load options<input data-aw-focus value={search} onChange={event => setSearch(event.target.value)} placeholder="Weight, RPE, bodyweight…" /></label>{['Weight', 'Intensity', 'Other'].map(group => {
    const choices = loadChoices.filter(choice => choice.group === group && `${choice.title} ${choice.group}`.toLowerCase().includes(search.toLowerCase()))
    return choices.length > 0 && <section key={group}><h4>{group}</h4>{choices.map(choice => <button type="button" className="aw-load-option" key={choice.value} aria-pressed={selected === choice.value} disabled={disabled} onClick={() => choose(choice.value)}>{choice.title}<span aria-hidden="true">{selected === choice.value ? '✓' : '→'}</span></button>)}</section>
  })}<p>RPE stays optional for other load types. Percentage sets show assigned load.</p></>}</LoadPanel>}</div>
}

const validNumber = (value: number | null, min: number, max: number, decimals = 0) => value !== null && Number.isFinite(value) && value >= min && value <= max && Math.abs(value * 10 ** decimals - Math.round(value * 10 ** decimals)) < 1e-6
const loadRepair = 'Enter a valid load with up to 3 decimal places. Weight accepts 0–9,999,999.999; percentage accepts 0.001–200.'
export function approvedParseLoad(raw: string, mode: 'exact' | 'percent'): number | null {
  if (!/^(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(raw.trim())) return null
  const value = Number(raw)
  return validNumber(value, mode === 'percent' ? .001 : 0, mode === 'percent' ? 200 : 9999999.999, 3) ? value : null
}
const repsRepair = 'Enter whole reps from 1 to 9,999,999, or an ordered range such as 8–10.'
export function approvedParseReps(raw: string): Partial<SetRow> | null {
  const match = /^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/.exec(raw)
  if (!match) return null
  const min = Number(match[1]), max = match[2] === undefined ? null : Number(match[2])
  if (!validNumber(min, 1, 9999999) || max !== null && !validNumber(max, min, 9999999)) return null
  return { reps_mode: max === null ? 'exact' : 'range', dose_min: min, dose_max: max }
}
const bufferedReps = (row: SetRow, raw: string | undefined) => {
  if (raw === undefined) return undefined
  const parsed = approvedParseReps(raw)
  return !parsed || parsed.reps_mode === row.reps_mode && parsed.dose_min === row.dose_min && parsed.dose_max === row.dose_max ? raw : undefined
}
const repsText = (row: SetRow) => row.reps_mode === 'range' ? `${row.dose_min ?? ''}–${row.dose_max ?? ''}` : `${row.dose_min ?? ''}`


function validation(day: Draft, original: Draft, keyOf: (exercise: Exercise) => string, touched?: Record<string, boolean>, sectionKey: (group: Group) => string = group => `section:${group.ordinal}`): string[] {
  const errors: string[] = [], exercises = exercisesOf(day), originalSets = exercisesOf(original).flatMap(exercise => exercise.set_groups)
  const report = (fields: string[], message: string) => { if (!touched || fields.some(field => touched[field])) errors.push(message) }
  const text = (value: string | null, max: number, required = false) => value === null ? !required : Boolean(value.trim()) && [...value].length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
  const number = validNumber
  const optional = (value: number | null, min: number, max: number, decimals = 0) => value === null || number(value, min, max, decimals)
  if (!text(day.label, 120, true) || !text(day.subtitle, 500)) report(['title'], 'Complete the workout name and remove blank-only or overly long notes.')
  if (!text(day.workout_instruction, 1000)) report(['description'], 'Remove blank-only or overly long workout descriptions.')
  if (day.movement_groups.length > 12 || exercises.length > 12) report(['structure'], 'A day supports up to 12 sections and 12 exercises.')
  const clearingWorkout = exercisesOf(original).length > 0 && !day.subtitle?.trim() && !day.workout_instruction?.trim() && day.movement_groups.length === 0 && day.label === weekdays[day.ordinal - 1]
  if (!exercises.length && !day.marked_rest && !clearingWorkout) report(['title', 'structure'], 'Add at least one exercise before saving a workout.')
  if (day.marked_rest && exercises.length) report(['structure'], 'A recovery day cannot contain exercises.')
  for (const group of day.movement_groups) {
    const issue = group.group_type === 'superset' ? supersetIssue(group.exercises) : null
    if (issue) report([`${sectionKey(group)}:title`, ...group.exercises.map(exercise => `${keyOf(exercise)}:name`)], supersetIssueMessage(issue))
    if (!text(group.title, 120)) report([`${sectionKey(group)}:title`], 'Complete the section title.')
    if (group.group_type === 'circuit' && !number(group.rounds_min, 1, 100)) report([`${sectionKey(group)}:rounds_min`], 'Enter circuit rounds from 1 to 100.')
    if (group.group_type === 'circuit' && !optional(group.rounds_max, group.rounds_min ?? 1, 100)) report([`${sectionKey(group)}:rounds_max`], 'Enter an ordered circuit round range from 1 to 100.')
  }
  for (const exercise of exercises) {
    if (!text(exercise.name, 120, true) || !exercise.set_groups.length) report([`${keyOf(exercise)}:name`], 'Each exercise needs a name and a prescription.')
    for (const field of ['instruction', 'note', 'protocol'] as const) if (!text(exercise[field], field === 'note' ? 500 : 1000)) report([`${keyOf(exercise)}:${field}`], `Review ${exercise.name || 'exercise'} ${field}: remove blank-only or overly long text.`)
    if (exercise.set_groups.reduce((sum, row) => sum + (row.sets_max ?? row.sets_min), 0) > 20) report([`${keyOf(exercise)}:sets`, ...physicalRows(exercise).flatMap((_, index) => [`${keyOf(exercise)}:${index}:sets_min`, `${keyOf(exercise)}:${index}:sets_max`]), `${keyOf(exercise)}:all:sets_min`, `${keyOf(exercise)}:all:sets_max`], `${exercise.name || 'Exercise'} supports up to 20 physical sets.`)
    for (const row of exercise.set_groups) {
      const rowKeys = physicalRows(exercise).flatMap((physical, index) => physical.row === row ? [`${keyOf(exercise)}:${index}`, `${keyOf(exercise)}:all`] : [])
      const fields = (field: string) => rowKeys.map(key => `${key}:${field}`)
      if (nodeId(row) && originalSets.some(previous => nodeId(previous) === nodeId(row) && same(previous, row))) continue
      const count = number(row.sets_min, 1, 20) && (row.sets_mode === 'exact' ? row.sets_max === null : number(row.sets_max, row.sets_min, 20))
      const dose = row.dose_mode === 'amrap' ? row.reps_mode === null && row.dose_min === null && row.dose_max === null && row.distance_unit === null : row.dose_mode === 'reps' ? row.distance_unit === null && (row.reps_mode === 'athlete_choice' ? row.dose_min === null && row.dose_max === null : number(row.dose_min, 1, 9999999) && (row.reps_mode === 'exact' ? row.dose_max === null : row.reps_mode === 'range' && number(row.dose_max, row.dose_min ?? 1, 9999999))) : row.reps_mode === null && row.dose_max === null && (row.dose_mode === 'distance' ? number(row.dose_min, .001, 9999999.999, 3) && row.distance_unit !== null : number(row.dose_min, 1, 9999999) && row.distance_unit === null)
      const load = row.load_mode === 'exact' ? number(row.exact_weight, 0, 9999999.999, 3) : row.load_mode === 'bodyweight' ? row.exact_weight === 0 : row.load_mode === 'percent' ? number(row.percent, .001, 200, 3) && Boolean(row.percent_basis_exercise_id) && Boolean(row.percent_basis_max_type) && optional(row.manual_override ?? null, 0, 9999999.999, 3) : row.load_mode === 'rpe' ? number(row.rpe_min, 1, 10, 1) : row.load_mode === 'qualitative' ? ['L', 'M', 'MH', 'H'].includes(row.qualitative ?? '') : true
      const invalidExactReps = row.dose_mode === 'reps' && row.reps_mode === 'exact' && !number(row.dose_min, 1, 9999999)
      if (invalidExactReps) report(fields('reps'), `${exercise.name || 'Exercise'}: ${repsRepair}`)
      if (!count) report([`${keyOf(exercise)}:sets`, ...fields('sets_min'), ...fields('sets_max')], `Review ${exercise.name || 'exercise'} set counts.`)
      if (!dose && !invalidExactReps) report([...fields('reps'), ...fields('dose_min'), ...fields('dose_max')], `${exercise.name || 'Exercise'}: ${repsRepair}`)
      if (!load) report(fields('load'), `Review ${exercise.name || 'exercise'} load.`)
      if (!optional(row.rpe_min, 1, 10, 1)) report(fields('rpe_min'), `Review ${exercise.name || 'exercise'} RPE: enter 1–10 with up to one decimal.`)
      if (row.rpe_min === null && row.rpe_max !== null || !optional(row.rpe_max, row.rpe_min ?? 1, 10, 1)) report(fields('rpe_max'), `Review ${exercise.name || 'exercise'} RPE: enter 1–10 with up to one decimal and an ordered range.`)
      if (!text(row.note, 500)) report(fields('note'), `Remove blank-only or overly long set notes for ${exercise.name || 'exercise'}.`)
    }
  }
  return [...new Set(errors)]
}


function readableRecovery(state: WorkoutRecoveryState): string {
  const day = state.draft, lines = [`Workout: ${day.subtitle ?? day.label}`, `Day: ${day.label}`, `Description: ${day.workout_instruction ?? '—'}`, `Rest day: ${day.marked_rest ? 'Yes' : 'No'}`]
  const exercises = [...day.movement_groups.flatMap(group => group.exercises), ...day.ungrouped_exercises].sort((a, b) => a.ordinal - b.ordinal)
  const names = new Map(state.exerciseKeys.map((key, i) => [key, `Exercise ${exercises[i]?.ordinal}: ${exercises[i]?.name || '(unnamed)'}`]))
  state.sectionKeys.forEach((key, i) => names.set(key, `Section ${i + 1}: ${day.movement_groups[i]?.title ?? '(untitled)'}`))
  for (const group of day.movement_groups) lines.push('', `Section ${group.ordinal}: ${group.title ?? '(untitled)'}`, `Type: ${group.group_type}`, `Rounds: ${group.rounds_min ?? '—'} to ${group.rounds_max ?? '—'}`)
  for (const exercise of exercises) {
    const group = day.movement_groups.find(group => group.exercises.includes(exercise))
    lines.push('', `Exercise ${exercise.ordinal}: ${exercise.name || '(unnamed)'}`, `Section: ${group?.title ?? 'Exercises'}`)
    for (const [key, value] of Object.entries(exercise)) if (!['set_groups', 'mode', 'ordinal', 'name'].includes(key)) lines.push(`${key.replaceAll('_', ' ')}: ${value ?? '—'}`)
    exercise.set_groups.forEach((row, i) => { lines.push(`Prescription ${i + 1}:`); for (const [key, value] of Object.entries(row)) if (key !== 'mode') lines.push(`  ${key.replaceAll('_', ' ')}: ${value ?? '—'}`) })
  }
  lines.push('', 'Typed field values (including incomplete inputs):')
  const fieldLabel = (key: string) => { const [identity, ...parts] = key.split(':'); return `${names.get(identity) ?? identity} · ${parts.map(part => /^\d+$/.test(part) ? `set ${Number(part) + 1}` : part === 'all' ? 'all sets' : part.replaceAll('_', ' ')).join(' · ')}` }
  for (const [key, raw] of Object.entries(state.repInputs)) lines.push(`${fieldLabel(key)} · reps: ${raw}`)
  for (const [key, input] of Object.entries(state.loadInputs)) lines.push(`${fieldLabel(key)} · ${input.mode} load: ${input.raw}`)
  for (const [key, input] of Object.entries(state.numberInputs)) lines.push(`${fieldLabel(key)}: ${input.raw}${input.invalid ? ' (needs correction)' : ''}`)
  return lines.join('\n')
}

export default function ApprovedWorkoutEditor({ recovery, registerRecovery, day, template = false, percentBasisOptions, exerciseOptions = [], historySuggestions = [], defaultUnit, plateIncrement = defaultUnit === 'kg' ? 2.5 : 5, disabled, buildPayload, onSave, onDirtyChange, onSaveReadinessChange, registerSave, onEnsureExercise, trackingSupported = false, onHistoryQuery, onCopyPrevious, copyPreviousDisabled = false }: ApprovedWorkoutEditorProps) {
  const recoveryIdentity = recovery && !template ? JSON.stringify([recovery.scope, recovery.epoch]) : ''
  const [draftOwner, setDraftOwner] = useState(day), [recoveryOwner, setRecoveryOwner] = useState(recoveryIdentity), [restoredDirty, setRestoredDirty] = useState(false)
  const recoverySession = useRef<{ owner: Day; identity: string; value: ReturnType<typeof createWorkoutRecoveryWriter> } | null>(null)
  const [candidates, setCandidates] = useState<WorkoutRecoveryCandidate[]>([]), [backupError, setBackupError] = useState<string | null>(null), [backedUp, setBackedUp] = useState(false), [reviewBackup, setReviewBackup] = useState<WorkoutRecoveryCandidate | null>(null)
  const [draft, setDraft] = useState<Draft>(() => clone(day) as Draft), [error, setError] = useState<string | null>(null), [saving, setSaving] = useState(false), [copying, setCopying] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}), [details, setDetails] = useState<(Location & { set: number | null }) | null>(null), [sectionDetails, setSectionDetails] = useState<number | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({}), [submitted, setSubmitted] = useState(false)
  const [numberInputs, setNumberInputs] = useState<Record<string, NumberInputDraft>>({})
  const touch = (field: string) => setTouched(old => ({ ...old, [field]: true }))
  const [loadInputs, setLoadInputs] = useState<Record<string, LoadInputDraft>>({})
  const [repInputs, setRepInputs] = useState<Record<string, string>>({})
  const [invalidReps, setInvalidReps] = useState<Record<string, string>>({}), [deleteOpen, setDeleteOpen] = useState(false)
  const editorKeys = useRef(new WeakMap<Exercise, string>()), nextEditorKey = useRef(0), focusExercise = useRef<string | null>(null), nameInputs = useRef(new Map<string, HTMLInputElement>())
  const exerciseKey = (exercise: Exercise) => {
    let key = editorKeys.current.get(exercise)
    if (!key) { key = `exercise-${++nextEditorKey.current}`; editorKeys.current.set(exercise, key) }
    return key
  }
  const sectionKeys = useRef(new WeakMap<Group, string>()), nextSectionKey = useRef(0)
  const sectionKey = (group: Group) => { let key = sectionKeys.current.get(group); if (!key) { key = `section-${++nextSectionKey.current}`; sectionKeys.current.set(group, key) }; return key }
  useLayoutEffect(() => { if (focusExercise.current) { const input = nameInputs.current.get(focusExercise.current); if (input) { input.focus(); focusExercise.current = null } } })
  const titleRef = useRef<HTMLInputElement>(null), generation = useRef(0), saveLock = useRef(false)
  useLayoutEffect(() => { generation.current++; setDraftOwner(day); setRecoveryOwner(recoveryIdentity); setRestoredDirty(false); setDraft(clone(day) as Draft); setError(null); setExpanded({}); setDetails(null); setSectionDetails(null); setInvalidReps({}); setRepInputs({}); setLoadInputs({}); setNumberInputs({}); setTouched({}); setSubmitted(false); setDeleteOpen(false); return () => { generation.current++ } }, [day, template, recoveryIdentity])
  const hasInvalidReps = Object.keys(invalidReps).length > 0, hasInvalidLoad = Object.values(loadInputs).some(input => approvedParseLoad(input.raw, input.mode) === null)
  const hasInvalidNumber = Object.values(numberInputs).some(input => input.invalid)
  const dirty = restoredDirty || !same(day, draft) || hasInvalidReps || hasInvalidLoad || hasInvalidNumber, locked = disabled || saving || copying, exercises = exercisesOf(draft), totalSets = exercises.reduce((sum, exercise) => sum + countOf(exercise), 0)
  const currentDirty = useRef(dirty)
  currentDirty.current = dirty
  const errors = [...validation(draft, day as Draft, exerciseKey, undefined, sectionKey), ...(hasInvalidReps ? [repsRepair] : []), ...(hasInvalidLoad ? [loadRepair] : []), ...(hasInvalidNumber ? ['Enter a valid number.'] : [])]
  const visibleErrors = submitted ? errors : [...validation(draft, day as Draft, exerciseKey, touched, sectionKey), ...Object.keys(invalidReps).filter(key => touched[`${key}:reps`]).map(() => repsRepair), ...Object.entries(loadInputs).filter(([key, input]) => touched[`${key}:load`] && approvedParseLoad(input.raw, input.mode) === null).map(() => loadRepair), ...Object.entries(numberInputs).filter(([key, input]) => touched[key] && input.invalid).map(() => 'Enter a valid number.')]
  const canSave = !locked && dirty && errors.length === 0
  const validationId = useId()
  useLayoutEffect(() => { onSaveReadinessChange?.(canSave); return () => onSaveReadinessChange?.(false) }, [canSave, onSaveReadinessChange])
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useLayoutEffect(() => {
    setReviewBackup(null); setBackedUp(false); setBackupError(null)
    if (!recovery || template) { recoverySession.current = null; setCandidates([]); return }
    const session = { owner: day, identity: recoveryIdentity, value: createWorkoutRecoveryWriter(recovery.scope, recovery.revision, day, recovery.epoch) }
    recoverySession.current = session
    const refresh = () => {
      if (recoverySession.current !== session) return
      const result = listWorkoutRecovery(recovery.scope, session.value.writer)
      setCandidates(session.value.current() ? result.candidates : [])
      if (!session.value.current()) setReviewBackup(null)
      if (result.error || !session.value.current()) { setBackedUp(false); setBackupError(result.error ?? 'Device backup was disabled when you signed out.') }
      else if (currentDirty.current && session.value.checkpointRemoved()) { setBackedUp(false); setBackupError('Device backup was removed in another tab. Edit the workout to back it up again, or save before leaving.') }
    }
    refresh()
    const unsubscribe = subscribeWorkoutRecovery(refresh), interval = window.setInterval(refresh, 15_000)
    return () => { unsubscribe(); window.clearInterval(interval) }
  }, [day, template, recoveryIdentity])
  useLayoutEffect(() => {
    const session = recoverySession.current
    if (!session || session.owner !== day || draftOwner !== day || session.identity !== recoveryIdentity || recoveryOwner !== recoveryIdentity) return
    if (!dirty) { session.value.clear(); setBackedUp(false); return }
    const state: WorkoutRecoveryState = { draft: draft as RichProgramDay, exerciseKeys: exercisesOf(draft).map(exerciseKey), sectionKeys: draft.movement_groups.map(sectionKey), expanded, repInputs, invalidReps, loadInputs, numberInputs, touched, submitted, details, sectionDetails }
    const failure = session.value.write(state)
    setBackupError(failure); setBackedUp(failure === null)
  }, [draft, draftOwner, recoveryOwner, recoveryIdentity, day, dirty, expanded, repInputs, invalidReps, loadInputs, numberInputs, touched, submitted, details, sectionDetails])
  useLayoutEffect(() => {
    if (!recovery || template) { registerRecovery?.(null); return }
    const session = recoverySession.current
    if (!session) return
    registerRecovery?.(session.value)
    return () => registerRecovery?.(null)
  }, [day, template, recoveryIdentity, registerRecovery])
  const checkedCandidate = (candidate: WorkoutRecoveryCandidate, requireEditable = false) => {
    const session = recoverySession.current
    return recovery && !template && !saving && !copying && (!requireEditable || !locked) && session?.owner === day && session.identity === recoveryIdentity && session.value.current() ? readWorkoutRecovery(candidate, recovery.scope) : null
  }
  const restoreBackup = (candidate: WorkoutRecoveryCandidate) => {
    const checked = checkedCandidate(candidate, true)
    if (!checked || dirty || recovery?.scope.day !== day.identity_token || checked.record.state.draft.identity_token !== day.identity_token || checked.record.state.draft.ordinal !== day.ordinal || checked.record.sourceFingerprint !== workoutRecoveryFingerprint(day)) { setBackupError('This backup cannot replace the current workout. Review it and copy any changes you need.'); return }
    const state = clone(checked.record.state), restored = state.draft as Draft
    exercisesOf(restored).forEach((exercise, i) => editorKeys.current.set(exercise, state.exerciseKeys[i]))
    restored.movement_groups.forEach((group, i) => sectionKeys.current.set(group, state.sectionKeys[i]))
    nextEditorKey.current = Math.max(nextEditorKey.current, ...state.exerciseKeys.map(key => Number(key.split('-')[1])), 0)
    nextSectionKey.current = Math.max(nextSectionKey.current, ...state.sectionKeys.map(key => Number(key.split('-')[1])), 0)
    const expanded = { ...state.expanded }
    for (const key of state.exerciseKeys) if ([...Object.keys(state.repInputs), ...Object.keys(state.loadInputs), ...Object.keys(state.numberInputs)].some(field => new RegExp(`^${key}:\\d+:`).test(`${field}:`))) expanded[key] = true
    recoverySession.current!.value.restore(checked)
    setDraft(restored); setExpanded(expanded); setRepInputs(state.repInputs); setInvalidReps(state.invalidReps); setLoadInputs(state.loadInputs); setNumberInputs(state.numberInputs); setTouched(state.touched); setSubmitted(true); setDetails(state.details); setSectionDetails(state.sectionDetails); setRestoredDirty(true); setReviewBackup(null); setError(null)
  }
  const recoverySurface = recovery && !template && <aside className="aw-recovery" aria-label="Device workout backup"><p role="status">{backupError ?? (backedUp ? 'Backed up on this device. Save workout to update the saved plan.' : 'Unfinished changes are backed up on this browser and device. Save workout to update the saved plan.')}</p>{candidates.map(candidate => {
    const stale = candidate.record.sourceFingerprint !== workoutRecoveryFingerprint(day)
    return <div className="aw-recovery-candidate" key={candidate.key}><div><strong>Unfinished workout backup</strong><span>{new Date(candidate.record.savedAt).toLocaleString()}</span><p>{stale ? 'The saved workout has changed. Review this backup and copy any changes you need into the current workout.' : dirty ? 'Review this backup while you have unsaved changes. Restore is available when the editor is clean.' : 'Your saved workout is shown below. Restore this backup to continue editing.'}</p></div><div><button type="button" disabled={saving || copying} onClick={() => { const checked = checkedCandidate(candidate); if (checked) setReviewBackup(checked); else setBackupError('This backup is no longer available. Review the current workout.') }}>Review backup</button>{!stale && <button type="button" disabled={locked || dirty} onClick={() => restoreBackup(candidate)}>Restore draft</button>}<button type="button" disabled={saving || copying} onClick={() => { const checked = checkedCandidate(candidate); if (!checked || !discardWorkoutRecovery(checked, recovery.scope)) setBackupError('The backup could not be discarded. Try again after reviewing this workout.') }}>Discard draft</button></div></div>
  })}</aside>
  const mutate = (change: (next: Draft) => void, structural = false) => {
    if (locked) return
    setDraft(old => {
      const next = clone(old), previousExercises = exercisesOf(old)
      exercisesOf(next).forEach((exercise, index) => editorKeys.current.set(exercise, exerciseKey(previousExercises[index])))
      next.movement_groups.forEach((group, index) => sectionKeys.current.set(group, sectionKey(old.movement_groups[index])))
      change(next)
      if (structural) normalize(next)
      return next
    })
    setError(null)
  }
  const getExercise = (source: Draft, loc: Location) => loc.group === null ? source.ungrouped_exercises[loc.exercise] : source.movement_groups[loc.group]?.exercises[loc.exercise]
  const editExercise = (loc: Location, change: (exercise: Exercise) => void, structural = false) => mutate(next => { const exercise = getExercise(next, loc); if (exercise) change(exercise) }, structural)
  const prescriptionPatch = (row: SetRow, patch: Partial<SetRow>) => {
    const fields = ['load_mode', 'percent', 'percent_basis_exercise_id', 'unit_override'] as const
    if (!fields.some(field => field in patch && patch[field] !== row[field])) return patch
    const next = { ...row, ...patch }
    return { ...patch, ...(next.load_mode === 'percent' ? { percent_basis_max_type: preferredBasis(percentBasisOptions, next.percent_basis_exercise_id)?.max_type ?? 'training_max' } : {}), ...(!template ? { of_max_id: null, resolved_weight: null, resolved_max_effective_from: null, resolved_at: null, manual_override: null } : {}) }
  }
  const newSet = (): SetRow => ({ mode: 'replace', [template ? 'id' : 'identity_token']: null, ordinal: 1, sets_mode: 'exact', sets_min: 1, sets_max: null, dose_mode: 'reps', reps_mode: 'exact', dose_min: 8, dose_max: null, distance_unit: null, laterality: 'bilateral', load_mode: 'exact', load_basis: 'total', exact_weight: 0, percent: null, percent_basis_exercise_id: null, percent_basis_max_type: null, rpe_min: null, rpe_max: null, qualitative: null, unit_override: defaultUnit, rest_seconds: null, note: null, ...(!template ? { manual_override: null, of_max_id: null, resolved_weight: null, resolved_max_effective_from: null, resolved_at: null } : {}) })
  const newSection = (): Group => ({ mode: 'replace', [template ? 'id' : 'identity_token']: null, ordinal: draft.movement_groups.length + 1, group_type: 'superset', title: 'Superset', rounds_min: null, rounds_max: null, exercises: [] })
  const save = async () => {
    setSubmitted(true)
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
        setDraft(clone(copied) as Draft); setExpanded({}); setInvalidReps({}); setRepInputs({}); setLoadInputs({}); setNumberInputs({}); setTouched({}); setSubmitted(false); setDetails(null); titleRef.current?.focus()
      }
    } catch (cause) { if (currentGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'Copy was not confirmed. The draft is unchanged.') }
    finally { setCopying(false) }
  }
  const setCount = (loc: Location, count: number) => editExercise(loc, exercise => {
    if (exercise.set_groups.some(row => row.sets_mode !== 'exact')) return
    if (!Number.isSafeInteger(count) || count < 1 || count > 20) return
    let remaining = count
    const kept: SetRow[] = []
    for (const row of exercise.set_groups) {
      if (!remaining) break
      const take = Math.min(remaining, Number.isFinite(row.sets_min) ? Math.max(1, Math.floor(row.sets_min)) : remaining)
      row.sets_min = take; row.sets_max = null; kept.push(row); remaining -= take
    }
    if (remaining) { const last = kept.at(-1) ?? newSet(); kept.push({ ...clone(last), id: null, identity_token: null, sets_min: remaining, sets_max: null }) }
    exercise.set_groups = kept
  }, true)
  const openDetails = (loc: Location, set: number | null) => setDetails({ ...loc, set })
  const clearRepErrors = (key: string) => {
    setInvalidReps(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(`${key}:`))))
    setRepInputs(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(`${key}:`))))
  }
  const clearLoadInputs = (key: string) => setLoadInputs(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(`${key}:`))))
  const removeExercise = (loc: Location) => {
    const exercise = getExercise(draft, loc)
    if (exercise) { const key = exerciseKey(exercise); setExpanded(old => { const next = { ...old }; delete next[key]; return next }); clearRepErrors(key); clearLoadInputs(key); setNumberInputs(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(`${key}:`)))); setTouched(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(`${key}:`)))) }
    mutate(next => { const list = loc.group === null ? next.ungrouped_exercises : next.movement_groups[loc.group].exercises; list.splice(loc.exercise, 1) }, true)
    setDetails(null)
  }
  const addExercise = (group: number | null) => {
    if (locked || exercises.length >= 12) return
    mutate(next => {
      const exercise: Exercise = { mode: 'replace', [template ? 'id' : 'identity_token']: null, ordinal: Math.max(0, ...exercisesOf(next).map(item => item.ordinal)) + 1, group_ordinal: null, status: 'programmed', name: '', instruction: null, note: null, protocol: null, ...(trackingSupported ? { exercise_id: null, track_in_metrics: false } : {}), set_groups: [{ ...newSet(), sets_min: 3 }] }
      const list = group === null ? next.ungrouped_exercises : next.movement_groups[group].exercises
      list.push(exercise); focusExercise.current = exerciseKey(exercise)
    }, true)
    onHistoryQuery?.('')
  }
  const numericInput = (field: string, value: number | null, update: (value: number | null) => void, label?: string, optional = false, min = 1, max = 9999999, decimals = 0) => {
    const stored = numberInputs[field]
    const buffered = stored && (stored.invalid || stored.raw === '' && value === null || Number(stored.raw) === value) ? stored : undefined
    const invalid = buffered?.invalid ?? false
    const showInvalid = (submitted || touched[field]) && invalid
    return <input aria-label={label} type="text" inputMode="decimal" disabled={locked} placeholder={optional ? '—' : undefined} aria-invalid={showInvalid || undefined} value={buffered?.raw ?? value ?? ''} onBlur={() => touch(field)} onChange={event => {
      const raw = event.target.value, syntaxValid = /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw.trim()), parsed = syntaxValid ? Number(raw) : null, valid = validNumber(parsed, min, max, decimals)
      setNumberInputs(old => ({ ...old, [field]: { raw, invalid: !(optional && raw === '') && !valid } }))
      update(parsed)
    }} />
  }
  const renderExercise = (exercise: Exercise, loc: Location) => {
    const key = exerciseKey(exercise), rows = physicalRows(exercise), hasRange = exercise.set_groups.some(row => row.sets_mode !== 'exact')
    const invalidForExercise = Object.keys(invalidReps).some(field => field.startsWith(`${key}:`)) || Object.entries(loadInputs).some(([field, input]) => field.startsWith(`${key}:`) && approvedParseLoad(input.raw, input.mode) === null) || Object.entries(numberInputs).some(([field, input]) => field.startsWith(`${key}:`) && input.invalid)
    const identical = !hasRange && rows.length > 0 && rows.every(item => approvedPrescriptionKey(item.row) === approvedPrescriptionKey(rows[0].row))
    const isExpanded = expanded[key] ?? !identical, compact = identical && !isExpanded, shown = compact ? rows.slice(0, 1) : rows
    const suggestionsId = `${validationId}-${key}-history`
    const suggestions = historySuggestions.filter((item, index, list) => list.findIndex(other => other.trim().toLowerCase() === item.trim().toLowerCase()) === index && item.toLowerCase().includes(exercise.name.trim().toLowerCase())).slice(0, 8)
    const update = (groupIndex: number, physicalIndex: number, patch: Partial<SetRow>) => {
      if (!compact) setExpanded(old => ({ ...old, [key]: true }))
      editExercise(loc, current => { if (compact) current.set_groups.forEach(row => Object.assign(row, prescriptionPatch(row, patch))); else Object.assign(current, approvedEditPhysicalSet(current, groupIndex, physicalIndex, prescriptionPatch(current.set_groups[groupIndex], patch), template)) })
    }
    const countControl = <span className="aw-count-control">{hasRange ? <button type="button" className="aw-count-range" onClick={() => openDetails(loc, 0)} disabled={locked}>{exercise.set_groups.map(item => item.sets_mode === 'range' ? `${item.sets_min}–${item.sets_max}` : item.sets_min).join('+')} sets</button> : <label>Sets<select aria-label={`${exercise.name || 'Exercise'} set count`} value={countOf(exercise)} onBlur={() => touch(`${key}:sets`)} disabled={locked || invalidForExercise} onChange={event => setCount(loc, Number(event.target.value))}>{Array.from({ length: (countOf(exercise) > 10 ? 20 : 10) }, (_, i) => <option value={i + 1} key={i}>{i + 1}</option>)}</select></label>}</span>
    return <tbody key={key}>{!compact && <tr className="aw-count-row"><td className="aw-count-label"><span className="aw-count-caption">Total sets</span></td><td>{countControl}</td><td colSpan={4} /></tr>}{shown.map(({ row, groupIndex, physicalIndex }, index) => {
      const label = `${exercise.name || 'Exercise'} ${compact ? 'all sets' : `set ${index + 1}`}`, repKey = `${key}:${compact ? 'all' : index}`
      const preserved = nodeId(row) && exercisesOf(day as Draft).some(item => item.set_groups.some(previous => nodeId(previous) === nodeId(row) && same(previous, row)))
      const repsInvalid = (submitted || touched[`${repKey}:reps`]) && (invalidReps[repKey] !== undefined || dirty && !preserved && row.dose_mode === 'reps' && (row.reps_mode === 'exact' || row.reps_mode === 'range') && (!validNumber(row.dose_min, 1, 9999999) || row.reps_mode === 'range' && !validNumber(row.dose_max, row.dose_min ?? 1, 9999999)))
      const repsErrorId = `${validationId}-${key}-${index}-reps-error`
      return <Fragment key={index}><tr><td>{index === 0 && <div className="aw-exercise-name"><div className="aw-exercise-entry"><input ref={input => { if (input) nameInputs.current.set(key, input); else nameInputs.current.delete(key) }} aria-label={`Exercise ${exercise.ordinal} name`} list={suggestionsId} autoComplete="off" maxLength={120} disabled={locked} value={exercise.name} onBlur={() => touch(`${key}:name`)} onFocus={() => onHistoryQuery?.(exercise.name)} onChange={event => { editExercise(loc, item => { item.name = event.target.value }); onHistoryQuery?.(event.target.value) }} /><datalist id={suggestionsId}>{suggestions.map(item => <option key={item} value={item} />)}</datalist><div className="aw-exercise-tools"><button type="button" className="aw-expand" disabled={locked || invalidForExercise || !identical || rows.length < 2} onClick={() => setExpanded(old => ({ ...old, [key]: !isExpanded }))}>{hasRange ? 'Set range' : !identical ? 'Varied sets' : compact ? 'Show all sets' : 'Compact sets'}</button>{(exercise.note || exercise.instruction || exercise.protocol) && <button type="button" className="aw-note" aria-label={`${exercise.name || 'Exercise'} exercise notes`} title={[exercise.instruction, exercise.note, exercise.protocol].filter(Boolean).join(' · ')} disabled={locked} onClick={() => openDetails(loc, compact ? null : 0)}>Notes</button>}{!nodeId(exercise) && !exercise.name.trim() && <button type="button" disabled={locked} onClick={() => removeExercise(loc)}>Remove blank exercise</button>}</div></div></div>}</td><td>{compact ? countControl : <span className="aw-set-index">{ row.sets_mode === 'range' ? `${row.sets_min}–${row.sets_max}` : `Set ${index + 1}`}</span>}</td><td>{row.dose_mode === 'reps' && (row.reps_mode === 'exact' || row.reps_mode === 'range') ? <input aria-label={`${label} reps`} onBlur={() => touch(`${repKey}:reps`)} aria-invalid={repsInvalid || undefined} aria-describedby={repsInvalid ? repsErrorId : undefined} type="text" inputMode="text" disabled={locked} value={bufferedReps(row, repInputs[repKey]) ?? repsText(row)} onChange={event => {
        const raw = event.target.value, patch = approvedParseReps(raw)
        setRepInputs(old => ({ ...old, [repKey]: raw }))
        setInvalidReps(old => { const next = { ...old }; if (patch) delete next[repKey]; else next[repKey] = raw; return next })
        if (patch) update(groupIndex, physicalIndex, patch)
      }} /> : <button type="button" className="aw-dose-detail" disabled={locked} onClick={() => openDetails(loc, compact ? null : index)}>{row.dose_mode === 'amrap' ? 'AMRAP' : row.reps_mode === 'athlete_choice' ? 'Choice' : `${row.dose_min ?? '—'} ${row.distance_unit ?? row.dose_mode}`}</button>}</td><td><LoadCell row={row} label={label} unit={defaultUnit} options={percentBasisOptions} exerciseOptions={exerciseOptions} exerciseId={exercise.exercise_id} disabled={locked} template={template} showError={submitted || !!touched[`${repKey}:load`]} onBlur={() => touch(`${repKey}:load`)} input={loadInputs[repKey]} onInput={raw => {
        const mode = row.load_mode === 'percent' ? 'percent' : 'exact'
        setLoadInputs(old => ({ ...old, [repKey]: { raw, mode } }))
        update(groupIndex, physicalIndex, { [mode === 'exact' ? 'exact_weight' : 'percent']: approvedParseLoad(raw, mode) })
      }} clearInput={() => { setLoadInputs(old => { const next = { ...old }; delete next[repKey]; return next }); setTouched(old => { const next = { ...old }; delete next[`${repKey}:load`]; return next }) }} update={patch => update(groupIndex, physicalIndex, patch)} /></td><td>{row.load_mode === 'percent' ? <AssignedLoad row={row} options={percentBasisOptions} unit={defaultUnit} increment={plateIncrement} template={template} /> : numericInput(`${repKey}:rpe_min`, row.rpe_min, value => update(groupIndex, physicalIndex, { rpe_min: value, rpe_max: null, ...(value === null && row.load_mode === 'rpe' ? { load_mode: 'tbd' } : {}) }), `${label} RPE optional`, true, 1, 10, 1)}</td><td><button type="button" className="aw-details-trigger" aria-label={`${label} details`} disabled={locked} onClick={() => openDetails(loc, compact ? null : index)}>•••</button></td></tr>{repsInvalid && <tr><td colSpan={6}><span id={repsErrorId} className="aw-error">{label}: {repsRepair}</span></td></tr>}</Fragment>
    })}</tbody>
  }
  const renderSection = (group: number | null, sourceIndexes?: number[], blockKey?: string, continued = false) => {
    const section = group === null ? null : draft.movement_groups[group], list = section?.exercises ?? draft.ungrouped_exercises
    const indexes = sourceIndexes ?? list.map((_, index) => index), entries = indexes.map(index => ({ exercise: list[index], index }))
    const loads = entries.flatMap(({ exercise }) => exercise.set_groups), hasPercent = loads.some(row => row.load_mode === 'percent'), onlyPercent = loads.length > 0 && loads.every(row => row.load_mode === 'percent')
    return <section className="aw-section" key={blockKey ?? (section ? nodeId(section) ?? group : 'ungrouped')}><header>{section ? <>{continued ? <h2>{section.title ?? 'Exercises'} · continued</h2> : <input aria-label={`Section ${group! + 1} title`} onBlur={() => touch(`${sectionKey(section)}:title`)} maxLength={120} value={section.title ?? ''} disabled={locked} onChange={event => mutate(next => { next.movement_groups[group!].title = event.target.value || null })} />}<span>{section.group_type === 'sequence' ? '' : section.group_type === 'superset' ? 'Superset' : 'Circuit'}</span><button type="button" disabled={locked} onClick={() => setSectionDetails(group)}>Section details</button></> : <h2>Exercises</h2>}</header><div className="aw-sheet-scroll" role="region" aria-label={`${section?.title ?? 'Exercises'} worksheet`} tabIndex={0}><table className="aw-sheet"><caption className="aw-sr">Identical sets can share a row. Expanded sets keep their individual prescriptions.</caption><colgroup><col className="aw-col-exercise"/><col className="aw-col-sets"/><col className="aw-col-reps"/><col className="aw-col-load"/><col className="aw-col-rpe"/><col className="aw-col-details"/></colgroup><thead><tr><th>Exercise</th><th>Set</th><th>Reps</th><th>Load</th><th>{onlyPercent ? 'Assigned load' : hasPercent ? 'RPE / Load' : 'RPE'}</th><th><span className="aw-sr">Details</span></th></tr></thead>{entries.map(({ exercise, index }) => renderExercise(exercise, { group, exercise: index }))}</table></div>{!entries.length && <p className="aw-muted">{section ? 'Add exercises to this group.' : 'Add an exercise to begin programming.'}</p>}<button type="button" className="aw-add" disabled={locked || exercises.length >= 12} onClick={() => addExercise(group)}>＋ Add exercise{section ? ` to ${section.title ?? 'group'}` : ''}</button></section>
  }
  // Render legacy grouped and ungrouped exercises in their saved global order without flattening groups.
  const blocks: { group: number | null; indexes: number[]; key: string; continued?: boolean }[] = [], seenGroups = new Set<number>()
  for (const exercise of exercises) {
    const groupIndex = draft.movement_groups.findIndex(item => item.exercises.includes(exercise)), group = groupIndex < 0 ? null : groupIndex
    let block = blocks.at(-1)
    if (!block || block.group !== group) {
      block = { group, indexes: [], key: `block-${exerciseKey(exercise)}`, continued: group !== null && seenGroups.has(group) }
      blocks.push(block)
    }
    if (group !== null) seenGroups.add(group)
    block.indexes.push((group === null ? draft.ungrouped_exercises : draft.movement_groups[group].exercises).indexOf(exercise))
  }
  draft.movement_groups.forEach((_, group) => { if (!seenGroups.has(group)) blocks.push({ group, indexes: [], key: `group-${group}` }) })
  if (!blocks.length || !blocks.some(block => block.group === null)) blocks.push({ group: null, indexes: [], key: 'ungrouped' })
  const detailExercise = details ? getExercise(draft, details) : undefined
  const detailRows = detailExercise ? physicalRows(detailExercise) : []
  const detailPhysicalIndex = Math.min(details?.set ?? 0, detailRows.length - 1), detailTarget = detailRows[detailPhysicalIndex], detailSet = detailTarget?.row
  const patchDetail = (patch: Partial<SetRow>) => {
    if (!details || !detailExercise || !detailTarget) return
    if (['dose_mode', 'reps_mode', 'dose_min', 'dose_max'].some(field => field in patch)) {
      const key = exerciseKey(detailExercise)
      const replaced = (field: string) => (details.set === null ? field.startsWith(`${key}:`) : field.startsWith(`${key}:${detailPhysicalIndex}:`)) && /:(dose_min|dose_max|reps)$/.test(field)
      if ('dose_mode' in patch || 'reps_mode' in patch) setNumberInputs(old => Object.fromEntries(Object.entries(old).filter(([field]) => !replaced(field))))
      if ('dose_mode' in patch || 'reps_mode' in patch) setTouched(old => Object.fromEntries(Object.entries(old).filter(([field]) => !replaced(field))))
      if (details.set === null) clearRepErrors(key)
      else {
        setInvalidReps(old => Object.fromEntries(Object.entries(old).filter(([field]) => field !== `${key}:${detailPhysicalIndex}`)))
        setRepInputs(old => Object.fromEntries(Object.entries(old).filter(([field]) => field !== `${key}:${detailPhysicalIndex}`)))
      }
    }
    editExercise(details, exercise => {
      if (details.set === null) exercise.set_groups.forEach(row => Object.assign(row, prescriptionPatch(row, patch)))
      else Object.assign(exercise, approvedEditPhysicalSet(exercise, detailTarget.groupIndex, detailTarget.physicalIndex, prescriptionPatch(detailTarget.row, patch), template))
    })
  }
  const numberField = (label: string, field: keyof SetRow, min: number, step = '1') => detailSet && detailExercise && <label>{label}{numericInput(`${exerciseKey(detailExercise)}:${details?.set === null ? 'all' : detailPhysicalIndex}:${field}`, detailSet[field] as number | null, value => patchDetail({ [field]: value }), undefined, field === 'rpe_min' || field === 'rpe_max', min, field.startsWith('rpe_') ? 10 : field.startsWith('sets_') ? 20 : 9999999.999, step === '.1' ? 1 : step === '.001' ? 3 : 0)}</label>
  const hasWorkoutTitle = Boolean((draft.subtitle ?? (draft.label !== weekdays[draft.ordinal - 1] ? draft.label : '')).trim())
  const empty = exercises.length === 0 && (draft.marked_rest || (!hasWorkoutTitle && draft.movement_groups.length === 0))
  return <section className="approved-workout-editor" aria-label="Workout editor">{recoverySurface}{dirty && visibleErrors.length > 0 && <div className="aw-error" role="status" tabIndex={0} aria-label="Workout needs corrections"><strong>Correct these fields before saving.</strong><ul>{[...new Set(visibleErrors)].map(message => <li key={message}>{message}</li>)}</ul></div>}<header className="aw-workout-head"><label>Workout title<input ref={titleRef} aria-label="Workout title" onBlur={() => touch('title')} value={draft.subtitle ?? (draft.label !== weekdays[draft.ordinal - 1] ? draft.label : '')} maxLength={500} disabled={locked} onChange={event => mutate(next => { next.subtitle = event.target.value || null; next.label = weekdays[next.ordinal - 1] ?? next.label })} /></label><label>Workout description<textarea onBlur={() => touch('description')} maxLength={1000} disabled={locked} value={draft.workout_instruction ?? ''} onChange={event => mutate(next => { next.workout_instruction = event.target.value || null })} /></label></header>{empty ? <div className="aw-empty"><h2>No workout assigned</h2><p>Add a workout to begin programming this day.</p><button type="button" className="aw-primary" disabled={locked} onClick={() => mutate(next => { next.marked_rest = false; if (!next.subtitle) next.subtitle = 'New workout' })}>＋ Add workout</button>{onCopyPrevious && <button type="button" disabled={locked || copyPreviousDisabled} onClick={() => void copyPrevious()}>{copying ? 'Loading copy…' : 'Copy from previous week'}</button>}</div> : <>{blocks.map(block => renderSection(block.group, block.indexes, block.key, block.continued))}<div className="aw-workout-actions"><button type="button" disabled={locked || draft.movement_groups.length >= 12} onClick={() => { const group = draft.movement_groups.length; mutate(next => { next.movement_groups.push(newSection()) }, true); setSectionDetails(group) }}>＋ Add superset/circuit</button><button type="button" className="aw-delete" disabled={locked} onClick={() => setDeleteOpen(true)}>Delete workout</button></div></>}{error && <p role="alert" className="aw-error">{error}</p>}<footer className="aw-save-row"><span>{dirty ? 'Unsaved changes' : 'Saved workout'} · {exercises.length} exercises · {totalSets} sets</span><div><button type="button" disabled={!canSave} onClick={() => void save()}>{saving ? 'Saving…' : 'Save workout'}</button></div></footer>
    {reviewBackup && recovery && <Modal title="Review workout backup" close={() => setReviewBackup(null)} fallback={titleRef}><p>This copy is for review. Select and copy any values you need into the current workout.</p><label>Workout backup<textarea className="aw-backup-review" aria-label="Workout backup" readOnly value={readableRecovery(reviewBackup.record.state)} /></label></Modal>}
    {deleteOpen && <Modal title="Delete workout?" close={() => setDeleteOpen(false)} fallback={titleRef}><p>This clears the workout title, description, sections and exercises from this draft. Save workout to persist it.</p><div className="aw-dialog-actions"><button type="button" onClick={() => setDeleteOpen(false)}>Cancel</button><button type="button" disabled={locked} onClick={() => { mutate(next => { next.subtitle = null; next.label = weekdays[next.ordinal - 1] ?? next.label; next.workout_instruction = null; next.movement_groups = []; next.ungrouped_exercises = []; next.marked_rest = true }, true); setExpanded({}); setInvalidReps({}); setRepInputs({}); setLoadInputs({}); setNumberInputs({}); setTouched({}); setSubmitted(false); setDeleteOpen(false) }}>Delete workout from draft</button></div></Modal>}
    {sectionDetails !== null && draft.movement_groups[sectionDetails] && <Modal title="Section details" close={() => setSectionDetails(null)} fallback={titleRef}><label>Section type<select disabled={locked} value={draft.movement_groups[sectionDetails].group_type} onChange={event => { const prefix = `${sectionKey(draft.movement_groups[sectionDetails])}:rounds_`; setNumberInputs(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(prefix)))); setTouched(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(prefix)))); mutate(next => { const group = next.movement_groups[sectionDetails]; group.group_type = event.target.value as Group['group_type']; group.rounds_min = group.group_type === 'circuit' ? group.rounds_min ?? 3 : null; group.rounds_max = group.group_type === 'circuit' ? group.rounds_max : null }) }}>{draft.movement_groups[sectionDetails].group_type === 'sequence' && <option value="sequence">Workout section</option>}<option value="superset">Superset</option><option value="circuit">Circuit</option></select></label>{draft.movement_groups[sectionDetails].group_type === 'circuit' && <>{(['rounds_min', 'rounds_max'] as const).map(field => <label key={field}>{field === 'rounds_min' ? 'Rounds minimum' : 'Rounds maximum'}{numericInput(`${sectionKey(draft.movement_groups[sectionDetails])}:${field}`, draft.movement_groups[sectionDetails][field], value => mutate(next => { next.movement_groups[sectionDetails][field] = value }), undefined, field === 'rounds_max', 1, 100)}</label>)}</>}<p>Removing a section keeps its exercises and moves them to Exercises.</p><button type="button" disabled={locked} onClick={() => { const prefix = `${sectionKey(draft.movement_groups[sectionDetails])}:`; setNumberInputs(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(prefix)))); setTouched(old => Object.fromEntries(Object.entries(old).filter(([field]) => !field.startsWith(prefix)))); mutate(next => { const [group] = next.movement_groups.splice(sectionDetails, 1); next.ungrouped_exercises.push(...group.exercises) }, true); setSectionDetails(null) }}>Remove section and keep exercises</button></Modal>}
    {details && detailExercise && detailSet && <Modal title={`${detailExercise.name} details`} close={() => setDetails(null)} fallback={titleRef}><div className="aw-fields"><label>Move to<select disabled={locked} value={details.group ?? 'ungrouped'} onChange={event => { const destination = event.target.value === 'ungrouped' ? null : Number(event.target.value); mutate(next => { const source = details.group === null ? next.ungrouped_exercises : next.movement_groups[details.group].exercises; const [exercise] = source.splice(details.exercise, 1); const target = destination === null ? next.ungrouped_exercises : next.movement_groups[destination].exercises; target.push(exercise) }, true); setDetails(null) }}><option value="ungrouped">Exercises</option>{draft.movement_groups.map((group, index) => <option key={index} value={index}>{group.title ?? `Section ${index + 1}`}</option>)}</select></label><label>Exercise status<select disabled={locked} value={detailExercise.status} onChange={event => editExercise(details, exercise => { exercise.status = event.target.value as Exercise['status'] })}><option value="programmed">Programmed</option><option value="not_programmed">Not programmed</option></select></label>{(['instruction', 'note', 'protocol'] as const).map(field => <label className="aw-wide" key={field}>Exercise {field}<textarea onBlur={() => touch(`${exerciseKey(detailExercise)}:${field}`)} disabled={locked} maxLength={field === 'note' ? 500 : 1000} value={detailExercise[field] ?? ''} onChange={event => editExercise(details, exercise => { exercise[field] = event.target.value || null })} /></label>)}{trackingSupported && <><label>Library identity<select disabled={locked} value={detailExercise.exercise_id ?? ''} onChange={event => editExercise(details, exercise => { exercise.exercise_id = event.target.value || null })}><option value="">Unlinked exercise name</option>{exerciseOptions.map(option => <option key={option.exercise_id} value={option.exercise_id}>{option.name}</option>)}</select></label><label className="aw-check"><input type="checkbox" disabled={locked || !detailExercise.exercise_id && !onEnsureExercise} checked={detailExercise.track_in_metrics ?? false} onChange={event => editExercise(details, exercise => { exercise.track_in_metrics = event.target.checked })} />Require metrics tracking when saved</label></>}<p className="aw-wide aw-detail-scope">{detailSet.sets_mode === 'range' ? `Prescription changes apply to this range of ${detailSet.sets_min}–${detailSet.sets_max} sets.` : details.set === null ? `Prescription changes apply to all ${countOf(detailExercise)} sets.` : `Prescription changes apply to set ${detailPhysicalIndex + 1} only.`}</p><p className="aw-wide aw-muted">Change total sets in the Sets column.</p>{(detailSet.sets_mode === 'range' || details.set === null && detailExercise.set_groups.length === 1) && <label>Set count type<select disabled={locked || (Object.keys(invalidReps).some(field => field.startsWith(`${exerciseKey(detailExercise)}:`)) || Object.entries(loadInputs).some(([field, input]) => field.startsWith(`${exerciseKey(detailExercise)}:`) && approvedParseLoad(input.raw, input.mode) === null))} value={detailSet.sets_mode} onChange={event => patchDetail({ sets_mode: event.target.value as SetRow['sets_mode'], sets_max: event.target.value === 'range' ? detailSet.sets_min : null })}><option value="exact">Exact</option><option value="range">Range</option></select></label>}{detailSet.sets_mode === 'range' && <>{numberField('Sets minimum', 'sets_min', 1)}{numberField('Sets maximum', 'sets_max', 1)}</>}<label>Dose<select disabled={locked} value={detailSet.dose_mode} onChange={event => { const mode = event.target.value as SetRow['dose_mode']; patchDetail({ dose_mode: mode, reps_mode: mode === 'reps' ? 'exact' : null, dose_min: mode === 'amrap' ? null : 8, dose_max: null, distance_unit: mode === 'distance' ? 'm' : null }) }}>{[['reps', 'Repetitions'], ['time', 'Time (seconds)'], ['steps', 'Steps'], ['distance', 'Distance'], ['amrap', 'AMRAP']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{detailSet.dose_mode === 'reps' && <label>Reps type<select disabled={locked} value={detailSet.reps_mode ?? 'exact'} onChange={event => { const mode = event.target.value as SetRow['reps_mode']; patchDetail({ reps_mode: mode, dose_min: mode === 'athlete_choice' ? null : detailSet.dose_min ?? 8, dose_max: mode === 'range' ? detailSet.dose_min ?? 8 : null }) }}><option value="exact">Exact</option><option value="range">Range</option><option value="athlete_choice">Athlete choice</option></select></label>}{detailSet.dose_mode !== 'amrap' && detailSet.reps_mode !== 'athlete_choice' && numberField('Dose minimum', 'dose_min', detailSet.dose_mode === 'distance' ? .001 : 1, detailSet.dose_mode === 'distance' ? '.001' : '1')}{detailSet.reps_mode === 'range' && numberField('Dose maximum', 'dose_max', 1)}{detailSet.dose_mode === 'distance' && <label>Distance unit<select disabled={locked} value={detailSet.distance_unit ?? 'm'} onChange={event => patchDetail({ distance_unit: event.target.value as SetRow['distance_unit'] })}>{['m', 'km', 'ft', 'mi'].map(unit => <option key={unit}>{unit}</option>)}</select></label>}<label>Laterality<select disabled={locked} value={detailSet.laterality} onChange={event => patchDetail({ laterality: event.target.value as SetRow['laterality'] })}><option value="bilateral">Bilateral</option><option value="each_side">Each side</option><option value="alternating">Alternating</option></select></label><label>Load basis<select disabled={locked} value={detailSet.load_basis} onChange={event => patchDetail({ load_basis: event.target.value as SetRow['load_basis'] })}><option value="total">Total</option><option value="added_to_bodyweight">Added to bodyweight</option><option value="per_hand">Per hand</option></select></label>{detailSet.load_mode !== 'percent' && <>{numberField('RPE minimum', 'rpe_min', 1, '.1')}{numberField('RPE maximum', 'rpe_max', 1, '.1')}</>}{detailSet.load_mode === 'percent' && <div className="aw-wide"><PercentFields row={detailSet} options={percentBasisOptions} exerciseOptions={exerciseOptions} update={patchDetail} disabled={locked} template={template} /></div>}<label className="aw-wide">Set note<textarea onBlur={() => touch(`${exerciseKey(detailExercise)}:${details.set === null ? 'all' : detailPhysicalIndex}:note`)} maxLength={500} disabled={locked} value={detailSet.note ?? ''} onChange={event => patchDetail({ note: event.target.value || null })} /></label></div><div className="aw-dialog-actions"><button type="button" disabled={locked} onClick={() => removeExercise(details)}>Remove exercise</button><button type="button" className="aw-primary" onClick={() => setDetails(null)}>Done</button></div></Modal>}
  </section>
}

export { ApprovedWorkoutEditor }
