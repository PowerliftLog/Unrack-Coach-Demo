import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react'
import type { Cell, Sheet, Hooks } from '@fortune-sheet/core'
import { CoachCycleInterpretationPanel } from '../CoachCycleInterpretationPanel'
import { ModalDialog } from '../ModalDialog'
import { interpretCoachSheetDraft, type CoachGeneratedSheetInterpretation } from '../lib/coach-sheet-interpret-generated'
import { compileCoachCycleDestination, compileCoachCycleDestinationV2, compileCoachCycleSchedule, compileCoachCycleScheduleV2, type CoachCycleDestinationIssue, type CoachCycleDestinationScheduleV2 } from '../lib/coach-cycle-destination'
import { COACH_CYCLE_PUBLISH_LIMITS } from '../lib/coach-cycle-limits'
import { prescriptionAdvice } from '../lib/coach-prescription-advice'
import { maxTypeLabel, percentConversionLabel, percentExerciseKey, percentLoads, rewritePercentPrescription, type PercentMax, type PercentMaxResolver } from '../lib/coach-percent-resolution'
import type { PercentCell, PercentConversionRequest } from '../CoachConvertPercentDialog'
import '@fortune-sheet/react/dist/index.css'
import {
  cell, editableCell, generate, initialBlockIds, initialCounts, nameStarts, resolveBlockIds, runFills, sheetMatrix,
  startsOf, validStructure, weekdays, type BlockIds, type CoachSheetDraft, type Intake, type NameStarts, type Switches,
} from '../lib/coach-sheet-layout'
import { addDay, addDayBlocked, addWeek, addWeekBlocked, dayHasContent, removeDay, removeWeek, sourceWeeks, weekHasContent, type WeekOperation } from '../lib/coach-sheet-structure'
import './coach-sheet-editor-proof.css'

export { editableCell, generate, nameStarts, runFills, validStructure } from '../lib/coach-sheet-layout'
export type { BlockIds, CoachSheetDraft, Intake, NameStarts, Switches } from '../lib/coach-sheet-layout'

const key = 'unrack-coach-sheet-editor-proof-v6'
function todayLocal(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function nextMondayLocal(): string {
  const date = new Date()
  const days = (8 - date.getDay()) % 7
  date.setDate(date.getDate() + days)
  return dateKey(date)
}
const sample: Intake = { client: '', name: 'New training cycle', weeks: 4, days: ['Monday', 'Wednesday', 'Friday', 'Saturday'], start: todayLocal(), unit: 'lb' }

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function StartDatePicker({ value, onChange, disabled }: { value: string; onChange(value: string): void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => { const selected = localDate(value || todayLocal()); return new Date(selected.getFullYear(), selected.getMonth(), 1) })
  const firstDay = month.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const selected = localDate(value || todayLocal())
  return <div className="cse-date-picker">
    <button type="button" className="cse-date-trigger" aria-label="Start date" disabled={disabled} aria-expanded={open && !disabled} onClick={() => { const date = localDate(value || todayLocal()); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setOpen(!open) }}>{selected.toLocaleDateString()} <span aria-hidden="true">▦</span></button>
    {open && !disabled && <div className="cse-calendar" role="dialog" aria-label="Choose start date">
      <div className="cse-calendar-head"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
      <div className="cse-calendar-grid">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className="cse-calendar-weekday">{day}</span>)}{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const date = new Date(month.getFullYear(), month.getMonth(), index + 1); const key = dateKey(date); return <button type="button" key={key} className={key === value ? 'selected' : ''} aria-label={date.toDateString()} aria-pressed={key === value} onClick={() => { onChange(key); setOpen(false) }}>{index + 1}</button> })}</div>
      <button type="button" className="cse-calendar-today" onClick={() => { const now = todayLocal(); onChange(now); setOpen(false) }}>Today</button>
    </div>}
  </div>
}

// Display-only layer. Everything below changes how the grid looks, never the saved source:
// acceptChange removes it again (displayOnly → savedShape) before anything is stored.
const inactiveFill = '#e7ecea'
function lastRow(intake: Intake, counts: Record<string, number>, day: string) { return (counts[day] || 0) * (intake.weeks + 1) }
// Each lane is bordered only down to its last exercise, so a shorter day visibly ends.
function laneBorders(intake: Intake, counts: Record<string, number>, sheet: Sheet) {
  const columns = sheet.column || 0
  return intake.days.map((day, index) => ({ rangeType: 'range', borderType: 'border-all', style: '1', color: '#000000',
    range: [{ row: [0, lastRow(intake, counts, day)], column: [index * 5, Math.min(index * 5 + 3, columns - 1)] }] }))
}
function inactiveCell(row: number, column: number, intake: Intake, counts: Record<string, number>): boolean {
  const day = intake.days[Math.floor(column / 5)]
  return Boolean(day) && column % 5 !== 4 && row > lastRow(intake, counts, day)
}
let measure: CanvasRenderingContext2D | null | undefined
// Lines a cell needs at the engine's 16pt Times New Roman, word-wrapped like the canvas renderer.
export function wrappedLines(text: string, width: number): number {
  if (measure === undefined) { try { measure = /jsdom/i.test(navigator.userAgent) ? null : document.createElement('canvas').getContext('2d') } catch { measure = null } if (measure) measure.font = '16pt "Times New Roman"' }
  const usable = Math.max(40, width - 8)
  const textWidth = (value: string) => measure ? measure.measureText(value).width : value.length * 9.6
  return text.split('\n').reduce((total, paragraph) => {
    let lines = 1, line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && textWidth(next) <= usable) { line = next; continue }
      if (line) lines++
      // A word wider than the cell breaks across lines on its own.
      lines += Math.max(0, Math.ceil(textWidth(word) / usable) - 1)
      line = word
    }
    return total + lines
  }, 0)
}
/** Week rows grow to show every wrapped line of their prescription and instructions. */
export function contentHeights(intake: Intake, counts: Record<string, number>, sheet: Sheet): Record<string, number> {
  const matrix = sheetMatrix(sheet), widths = sheet.config?.columnlen || {}, heights: Record<string, number> = {}
  intake.days.forEach((day, index) => {
    const base = index * 5
    for (let block = 0; block < (counts[day] || 0); block++) for (let week = 0; week < intake.weeks; week++) {
      const row = 2 + block * (intake.weeks + 1) + week
      const lines = Math.max(...[2, 3].map(offset => wrappedLines(String(matrix[row]?.[base + offset]?.v ?? ''), Number(widths[String(base + offset)] ?? 300))))
      heights[String(row)] = Math.max(heights[String(row)] ?? 44, 44, lines * 26 + 10)
    }
  })
  return heights
}
const lockedFill = '#dde2e0'
function forEditor(sheets: Sheet[], zoom: number, intake: Intake, counts: Record<string, number>, locked?: (row: number, column: number) => boolean): Sheet[] {
  return sheets.map((sheet, index) => {
    const matrix = sheetMatrix(sheet)
    // Finished workouts (a running program): greyed, read-only rows. Display only, like the flags.
    const shown = (value: Cell, r: number, c: number): Cell => index === 0 && locked?.(r, c) ? { ...value, bg: lockedFill, fc: '#6f7a75' } : withoutFlagFill(value)
    const celldata = matrix.flatMap((line, r) => line.flatMap((value, c) => value ? [{ r, c, v: shown(value, r, c) }] : []))
    if (index !== 0) return { ...sheet, celldata }
    for (let r = 0; r < (sheet.row || 0); r++) for (let c = 0; c < (sheet.column || 0); c++) {
      if (inactiveCell(r, c, intake, counts) && !matrix[r]?.[c]) celldata.push({ r, c, v: { bg: inactiveFill } })
    }
    const { data: _data, ...rest } = sheet
    return { ...rest, celldata, zoomRatio: zoom, config: { ...sheet.config, borderInfo: laneBorders(intake, counts, sheet),
      rowlen: { ...sheet.config?.rowlen, ...contentHeights(intake, counts, sheet) } } }
  })
}
/** Whitelist: the saved source changes only where an editable cell's text changed. Everything
 * else the engine reports (display borders, inactive fill, grown row heights, view zoom, column
 * drags, hydration-time cell normalisation) stays exactly as in the previous source. */
export function savedShape(updated: Sheet[], previous: Sheet[], intake: Intake, counts: Record<string, number>, starts?: NameStarts): Sheet[] {
  const base = previous[0]
  if (!base) return updated
  const engine = sheetMatrix(updated[0])
  const changes: [number, number, Cell | null][] = []
  const before = sheetMatrix(base)
  for (let r = 0; r < (base.row || 0); r++) for (let c = 0; c < (base.column || 0); c++) {
    if (!editableCell(intake, counts, r, c, starts)) continue
    const now = engine[r]?.[c] ?? null, was = before[r]?.[c] ?? null
    if (String(now?.v ?? '') !== String(was?.v ?? '') || Boolean(now?.f) !== Boolean(was?.f)) changes.push([r, c, now])
  }
  if (!changes.length) return previous
  const next = structuredClone(base)
  for (const [r, c, engineValue] of changes) {
    // Store the text, never the engine's display fill: a flagged cell is painted, and keeping that
    // paint made a fixed cell stay yellow or red after its flag cleared (Joe, Nov 18).
    let value = engineValue
    if (engineValue) { const { bg: _shown, ...rest } = engineValue; const kept = sourceFill(before[r]?.[c]?.bg); value = kept ? { ...rest, bg: kept } : rest }
    if (next.data) { next.data[r][c] = value; continue }
    const cells = next.celldata || (next.celldata = [])
    const index = cells.findIndex(item => item.r === r && item.c === c)
    if (index >= 0) { if (value) cells[index] = { r, c, v: value }; else cells.splice(index, 1) }
    else if (value) cells.push({ r, c, v: value })
  }
  return [next, ...previous.slice(1)]
}
export type BlockSelection = { day: string; block: number; week: number }
/** Maps a grid cell to the exercise block it belongs to; week is 0-based. */
export function blockAt(intake: Intake, counts: Record<string, number>, row: number, column: number): BlockSelection | null {
  const day = intake.days[Math.floor(column / 5)]
  if (!day || column < 0 || column % 5 === 4 || row < 1) return null
  const block = Math.floor((row - 1) / (intake.weeks + 1)), position = (row - 1) % (intake.weeks + 1)
  return block < (counts[day] || 0) ? { day, block, week: Math.max(0, position - 1) } : null
}

export type SheetFlag = { row: number; column: number; kind: 'bad' | 'missing' | 'unclear' | 'yellow'; label: string; message: string; suggestion?: string; percent?: 'ready' | 'missing'; explanation?: string; suggestedMax?: PercentMax }
export type SheetFlags = { flags: SheetFlag[]; emptySlots: number; other: string[]; percentCells: PercentCell[]; hasPrescriptions: boolean }
type CellPosition = { row: number; column: number }
function cellIndex(address: string): CellPosition | null {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(address)
  if (!match) return null
  let column = 0
  for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64
  return { row: Number(match[2]) - 1, column: column - 1 }
}
/** Live sheet check (Joe, Nov 16 review 3): what the interpreter cannot read, by cell.
 * Text it can't read is "bad"; a blank cell in an exercise that has other content is "missing";
 * an exercise slot with nothing in it is counted, not painted, so a fresh sheet stays clean. */
export function sheetFlags(intake: Intake, counts: Record<string, number>, blockIds: BlockIds, sheets: Sheet[], cycleId: string, switches?: Switches, percent?: {
  resolver: PercentMaxResolver
  basis: ReadonlyMap<string, string>
  locked(row: number, column: number): boolean
}, cellActions = false): SheetFlags {
  const result = interpretCoachSheetDraft({ intake, counts, blockIds, sheets: cloneSheets(sheets), ...(switches && Object.keys(switches).length ? { switches } : {}) }, { cycleId })
  const compiled = result.status === 'ready_for_review' ? compileCoachCycleDestination(result, intake) : null
  const issues = [...result.issues, ...(compiled?.issues ?? [])]
  const matrix = sheetMatrix(sheets[0])
  const text = (row: number, column: number) => String(matrix[row]?.[column]?.v ?? '').trim()
  // The exercise a week runs: the nearest name at or above it in the block, so a lift swapped
  // mid-cycle (W1–2 Bench Press, W3–4 Close-Grip Bench) labels its own weeks (Joe, Nov 18).
  const nameFor = (first: number, row: number, column: number) => { for (let at = row; at >= first; at--) if (text(at, column)) return text(at, column); return '' }
  const flags: SheetFlag[] = [], other: string[] = [], empty = new Set<string>(), seen = new Set<string>()
  const percentages = new Map<string, { cell: PercentCell; flag: SheetFlag }>()
  if (percent) for (const day of result.days) for (const exercise of day.exercises) {
    let name = exercise.name.trim()
    for (const slot of exercise.weeks) {
      if (slot.renamed) name = slot.renamed.name.trim()
      const group = slot.prescription.groups.find(item => item.load.kind === 'percentage')
      const source = group?.source
      const at = source && cellIndex(source.address)
      if (!source || !at || matrix[at.row]?.[at.column]?.f) continue
      const block = blockAt(intake, counts, at.row, at.column)
      if (!block) continue
      const label = flagLabel(intake, block, at.row, at.column, name)
      const displayName = name || `Exercise ${block.block + 1}`
      const cell = { ...at, day: day.name, exercise: displayName, week: slot.week, raw: slot.prescription.raw }
      const basisId = percent.basis.get(percentExerciseKey(name))
      const max = percent.resolver.resolve(name, basisId)
      if (percent.locked(at.row, at.column)) {
        percentages.set(source.address, { cell: { ...cell, reason: 'workout is locked' }, flag: { ...at, label, kind: 'bad', message: 'Workout is locked.' } })
      } else if (max) {
        const loads = percentLoads(slot.prescription.groups, max, intake.unit)
        if (!loads.length) continue
        const basis = cellActions
          ? `${max.name} · ${max.value} ${max.unit} ${maxTypeLabel(max.max_type).replace(/^[A-Z]/, letter => letter.toLowerCase())}`
          : `${max.value} ${max.unit}`
        const equation = loads.map(load => `${load.percent}% of ${basis} = ${load.weight} ${intake.unit}`).join(cellActions ? '. ' : ' · ')
        const match = max.matchedByAlias ? ` ${displayName} matched to ${max.name} automatically.` : ''
        percentages.set(source.address, { cell: { ...cell, loads }, flag: {
          ...at, label, kind: 'yellow', percent: 'ready',
          message: `${max.name} max ${max.value} ${max.unit} found. Use ${percentConversionLabel(intake.unit)} to apply.`,
          explanation: cellActions ? `${equation}.${match}` : `${equation}. Press ${percentConversionLabel(intake.unit)} to apply.`,
        } })
      } else {
        const suggestedMax = cellActions ? percent.resolver.suggest(name, basisId) : undefined
        const missing = `No max for ${displayName}`
        percentages.set(source.address, { cell: { ...cell, reason: 'no max found' }, flag: {
          ...at, label, kind: 'bad', percent: 'missing',
          message: "No max found. Set one in Profile → Maxes, or pick 'Based on' in the exercise card.",
          ...(cellActions && { suggestedMax, explanation: suggestedMax
            ? `${missing}. Use ${suggestedMax.name} · ${suggestedMax.value} ${suggestedMax.unit}?` : `${missing} yet.` }),
        } })
      }
    }
  }
  for (const issue of issues) {
    const at = issue.source ? cellIndex(issue.source.address) : null
    const block = at ? blockAt(intake, counts, at.row, at.column) : null
    if (!at || !block) { if (!other.includes(issue.message)) other.push(issue.message); continue }
    const percentage = issue.source && percentages.get(issue.source.address)
    if (percentage) {
      if ('code' in issue && issue.code === 'percentage_resolution_required') continue
      const message = `${percentage.flag.label}: ${issue.message}`
      if (!other.includes(message)) other.push(message)
      continue
    }
    const key = `${at.row}:${at.column}`
    if (seen.has(key)) continue
    seen.add(key)
    const base = intake.days.indexOf(block.day) * 5, first = 2 + block.block * (intake.weeks + 1)
    const name = text(first, base + 1)
    const content = Boolean(name) || Array.from({ length: intake.weeks }, (_, week) => text(first + week, base + 2) || text(first + week, base + 3)).some(Boolean)
    if (!text(at.row, at.column) && !content) { empty.add(`${block.day}:${block.block}`); continue }
    const value = text(at.row, at.column)
    flags.push({ row: at.row, column: at.column, kind: value ? 'bad' : 'missing', label: flagLabel(intake, block, at.row, at.column, nameFor(first, at.row, base + 1)), message: value ? issue.message : `Empty. ${issue.message}` })
  }
  // Prescription advice: a clearer message and a suggested rewrite for rejected cells, and a flag for
  // accepted cells whose meaning is unclear (a bare @ 1–5). It never makes a cell publishable.
  const percentCells = [...percentages.values()].map(({ cell }) => cell)
  const percentPositions = new Set(percentCells.map(({ row, column }) => `${row}:${column}`))
  let hasPrescriptions = false
  for (const [dayIndex, day] of intake.days.entries()) for (let block = 0; block < (counts[day] || 0); block++) for (let week = 0; week < intake.weeks; week++) {
    const row = 2 + block * (intake.weeks + 1) + week, column = dayIndex * 5 + 2, value = text(row, column)
    if (value || matrix[row]?.[column]?.f) hasPrescriptions = true
    if (percentPositions.has(`${row}:${column}`)) continue
    const advice = value ? prescriptionAdvice(value, intake.unit) : null
    if (!advice) continue
    const existing = flags.find(flag => flag.row === row && flag.column === column)
    if (existing) Object.assign(existing, { kind: advice.kind, message: advice.message, suggestion: advice.suggestion })
    else flags.push({ row, column, kind: advice.kind, label: flagLabel(intake, { day, block, week }, row, column, nameFor(2 + block * (intake.weeks + 1), row, dayIndex * 5 + 1)), message: advice.message, suggestion: advice.suggestion })
  }
  for (const { flag } of percentages.values()) flags.push(flag)
  flags.sort((a, b) => a.column - b.column || a.row - b.row)
  return { flags, emptySlots: empty.size, other, percentCells, hasPrescriptions }
}
function flagLabel(intake: Intake, block: BlockSelection, row: number, column: number, name: string) {
  const first = 2 + block.block * (intake.weeks + 1)
  return `${block.day.slice(0, 3)} · ${name || `Exercise ${block.block + 1}`} · ${column % 5 === 1 ? 'name' : `W${row - first + 1}`}`
}
export const flagFill = { bad: '#ffd3cc', missing: '#fff0b8', unclear: '#fff0b8', yellow: '#fff0b8' } as const
// Drafts saved before Nov 18 can carry a flag's paint as a cell fill; it is never a real source fill.
const flagFills = new Set<string>(Object.values(flagFill))
const percentFill = '#ede4fa'
function sourceFill(bg: unknown): string | undefined { return typeof bg === 'string' && !flagFills.has(bg.toLowerCase()) ? bg : undefined }
function withoutFlagFill(value: Cell): Cell { if (sourceFill(value.bg) || value.bg == null) return value; const { bg: _flag, ...rest } = value; return rest }
const flagTitle = { bad: "Can't read", missing: 'Empty', unclear: 'Unclear', yellow: 'Ready to convert' } as const
const flagClassName = (flag: SheetFlag) => flag.kind === 'yellow' ? 'yellow unclear' : flag.kind
/** Why the selected cell's exercise is flagged, in the flag's own colour (Joe, Nov 18). */
export function FlagExplanation({ flag, onGo }: { flag: SheetFlag; onGo(): void }) {
  const message = flag.kind === 'missing' ? flag.message.replace(/^Empty\.\s*/, '') : flag.message
  return <span className={`cse-hint-flag ${flagClassName(flag)}`} role="status" aria-live="polite">
    {!flag.percent && <b>{flagTitle[flag.kind]} </b>}<button type="button" onClick={onGo}>{flag.label}</button>: {flag.explanation ?? message}
    {flag.suggestion && <> Try <code>{flag.suggestion}</code>.</>}
  </span>
}

const prescriptionExamples = <> <code>3x8 @ 225</code> · <code>3x8 @ 7</code> (RPE) · <code>3x12 each @ 5 lb</code> · <code>1x8+</code> or <code>AMRAP</code> · <code>SKIP</code> leaves a week out.</>

function FlagMaxForm({ unit, onSave, onClose }: { unit: Intake['unit']; onSave(value: number): Promise<void>; onClose(): void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  return <form className="cse-flag-actions" onSubmit={async event => {
    event.preventDefault()
    if (saving) return
    const weight = new FormData(event.currentTarget).get('weight')
    setSaving(true)
    setError('')
    try {
      await onSave(Number(weight))
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t save the max. Try again.')
    } finally { setSaving(false) }
  }}>
    <label>Training max ({unit}) <input type="number" name="weight" min="0.001" max="3000" step="0.001" required disabled={saving} /></label>
    <button type="submit" className="cse-primary" disabled={saving}>{saving ? 'Saving max…' : 'Save max'}</button>
    {error && <span role="alert">{error}</span>}
  </form>
}

function cloneSheets(sheets: Sheet[]): Sheet[] { return structuredClone(sheets) }
function readDraft(): CoachSheetDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null') as CoachSheetDraft | null
    return value?.intake && value.counts && Array.isArray(value.sheets) && validStructure(value.intake, value.counts, value.sheets, value.blockIds ? nameStarts(value.intake, value.blockIds, value.switches) : undefined) ? { ...value, format: 'unrack-generated-cycle-v1' } : null
  } catch { return null }
}

export type CoachSheetEditorProps = {
  initialDraft?: CoachSheetDraft
  cycleId?: string
  initialClientId?: string
  onDraftChange?: (draft: CoachSheetDraft) => void
  onSaveDraft?: (draft: CoachSheetDraft) => void | Promise<void>
  clientOptions?: { id: string; name: string }[]
  localPersistence?: boolean
  serverClean?: boolean
  /** Called once the saved worksheet passes Review cycle and should be previewed for publishing.
   * Its presence shows the Publish button; the host renders the publish panel below the worksheet. */
  onPublishReady?: () => void
  /** Workspace: the parent is publishing (Publish shows Publishing… and stays disabled). */
  publishBusy?: boolean
  /** Reference for the selected exercise (e.g. the athlete's past performance), shown in the sidebar. */
  exerciseReference?: (exerciseName: string) => ReactNode
  percentMaxes?: PercentMaxResolver
  onConvertPercent?: (request: PercentConversionRequest) => void
  onSaveMax?: (exerciseId: string, value: number, unit: Intake['unit']) => Promise<void>
  /** A running program: workouts already done, by day and 1-based week. Their rows are read-only,
   * and renaming an exercise that has done weeks changes only the weeks still to come. */
  completedWorkouts?: { day: string; week: number }[]
  /** Show the per-week exercise names control (needs server support for `switches`). */
  exerciseByWeek?: boolean
  /** 'workspace' (the connected Coach builder): full-width sheet, cycle settings folded away, the
   * selected exercise in a corner card instead of a sidebar, and one Check & publish button. */
  layout?: 'classic' | 'workspace' | 'two-screen'
  toolbarRef?: Ref<CoachSheetActions>
  onToolbarState?: (state: CoachSheetToolbarState | null) => void
  readOnly?: boolean
  shapeLocked?: string
  onBuildDraft?: (draft: CoachSheetDraft) => void
  intakeDisabled?: boolean
}

export type CoachSheetActions = {
  openSettings(options?: { focusName?: boolean }): void
  jumpToDay(index: number): void
  zoom(direction: -1 | 1): void
  openPastWeights(): void
  openConvert(): void
  save(): Promise<boolean>
  publish(): Promise<void>
}

export type CoachSheetToolbarState = {
  zoom: number
  days: string[]
  unit: Intake['unit']
  settingsOpen: boolean
  dirty: boolean
  saving: boolean
  publishing: boolean
  problemCount: number
  readyCount: number
  hasPercentCells: boolean
  selectedExercise: string
  pastWeightsOpen: boolean
  canPublish: boolean
  publishBlocked: boolean
}

type StructureSnapshot = {
  draft: CoachSheetDraft
  intake: Intake
  skipped: Record<string, string>
}
type StructureRemoval = { week: number } | { day: string }

export default function CoachSheetEditorProof({ initialDraft, cycleId, initialClientId, onDraftChange, onSaveDraft, clientOptions, localPersistence = true, serverClean, onPublishReady, exerciseReference, percentMaxes, onConvertPercent, onSaveMax, layout = 'classic', publishBusy = false, completedWorkouts, exerciseByWeek = false, toolbarRef, onToolbarState, readOnly: locked = false, shapeLocked, onBuildDraft, intakeDisabled = false }: CoachSheetEditorProps = {}) {
  const twoScreen = layout === 'two-screen'
  const workspace = layout !== 'classic'
  const readOnly = twoScreen && locked
  const statusRef = useRef<HTMLDivElement>(null)
  const [publishing, setPublishing] = useState(false)
  // A mounted editor owns one draft. Remount with a new key to switch clients/drafts.
  const previous = useRef(initialDraft || (localPersistence ? readDraft() : null))
  const [intake, setIntake] = useState<Intake>(previous.current?.intake || { ...sample, start: localPersistence ? sample.start : nextMondayLocal(), client: initialClientId || '' })
  const [activeIntake, setActiveIntake] = useState<Intake>(previous.current?.intake || { ...sample, start: localPersistence ? sample.start : nextMondayLocal(), client: initialClientId || '' })
  const [counts, setCounts] = useState<Record<string, number>>(previous.current?.counts || initialCounts(sample))
  const [sheets, setSheets] = useState<Sheet[] | null>(previous.current?.sheets || null)
  const liveCycleName = twoScreen && Boolean(sheets)
  const editSettings = liveCycleName && !onBuildDraft
  const showStructure = liveCycleName && !readOnly
  const structureLocked = Boolean(shapeLocked)
  const dayReason = showStructure && !structureLocked ? addDayBlocked({ intake: activeIntake }) : null
  const canAddDay = showStructure && !structureLocked && !dayReason
  const [blockIds, setBlockIds] = useState<BlockIds>(() => resolveBlockIds(
    previous.current?.intake || sample, previous.current?.counts || initialCounts(sample), previous.current?.blockIds,
  ))
  const [switches, setSwitches] = useState<Switches>(() => previous.current?.switches ?? {})
  const [percentBasis, setPercentBasis] = useState(() => new Map<string, string>())
  const starts = useMemo(() => nameStarts(activeIntake, blockIds, switches), [activeIntake, blockIds, switches])
  const doneWeeks = useMemo(() => new Set((completedWorkouts ?? []).map(item => `${item.day}:${item.week}`)), [completedWorkouts])
  const weekDone = (day: string, week: number) => doneWeeks.has(`${day}:${week}`)
  function lockedCell(row: number, column: number): boolean {
    if (!doneWeeks.size || column % 5 === 4) return false
    const at = blockAt(activeIntake, counts, row, column)
    if (!at || (row - 1) % (activeIntake.weeks + 1) === 0) return false
    if (column % 5 !== 1) return weekDone(at.day, at.week + 1)
    // A name covers a run of weeks: it locks only when every week of its run is done.
    const runs = startsOf(starts, at.day, at.block), start = runs.filter(week => week <= at.week + 1).at(-1)!
    const end = (runs[runs.indexOf(start) + 1] ?? activeIntake.weeks + 1) - 1
    return Array.from({ length: end - start + 1 }, (_, offset) => start + offset).every(week => weekDone(at.day, week))
  }
  const [selection, setSelection] = useState<BlockSelection | null>(null)
  // The selected cell, so the toolbar can explain a flag on it (Joe, Nov 18).
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null)
  const lastCell = useRef<CellPosition | null>(null)
  const [maxSetupCell, setMaxSetupCell] = useState<string | null>(null)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const basisSelect = useRef<HTMLSelectElement>(null)
  const focusBasis = useRef(false)
  // Workspace card: shows on every selection change, hides while the coach types or on ×.
  const [cardOpen, setCardOpen] = useState(false)
  useEffect(() => {
    if (cardOpen && focusBasis.current) {
      focusBasis.current = false
      basisSelect.current?.focus()
    }
  }, [cardOpen])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const cycleNameInput = useRef<HTMLInputElement>(null)
  const focusNameOnOpen = useRef(false)
  const focusCycleName = useCallback(() => {
    cycleNameInput.current?.focus()
    cycleNameInput.current?.select()
  }, [])
  useLayoutEffect(() => {
    if (!settingsOpen || !focusNameOnOpen.current) return
    focusNameOnOpen.current = false
    focusCycleName()
  }, [settingsOpen, focusCycleName])
  // Unskip restores the prescription that was in place before Skip, keyed by block id and week.
  const skippedPrescriptions = useRef<Record<string, string>>({})
  const [structureHistory, setStructureHistory] = useState<(StructureSnapshot & { action: string })[]>([])
  const [removal, setRemoval] = useState<StructureRemoval | null>(null)
  const [addDayOpen, setAddDayOpen] = useState(false)
  const addDayControl = useRef<HTMLDivElement>(null)
  const addDayTrigger = useRef<HTMLButtonElement>(null)
  const removalTitle = useId()
  const removalBody = useId()
  useEffect(() => {
    if (!addDayOpen || !canAddDay) return
    const dismissOutside = (event: MouseEvent) => {
      if (!addDayControl.current?.contains(event.target as Node)) setAddDayOpen(false)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setAddDayOpen(false)
      addDayTrigger.current?.focus()
    }
    document.addEventListener('click', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape, true)
    return () => {
      document.removeEventListener('click', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape, true)
    }
  }, [addDayOpen, canAddDay])
  const [revision, setRevision] = useState(0)
  const [sourceRevision, setSourceRevision] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [review, setReview] = useState<CoachGeneratedSheetInterpretation | null>(null)
  const [reviewSchedule, setReviewSchedule] = useState<CoachCycleDestinationScheduleV2 | null>(null)
  const [destinationIssues, setDestinationIssues] = useState<CoachCycleDestinationIssue[]>([])
  const [message, setMessage] = useState(previous.current ? (localPersistence ? 'Saved draft reopened from this browser.' : 'Saved draft reopened from Coach storage.') : '')
  const [zoom, setZoom] = useState(twoScreen ? 1 : 0.6)
  const workbook = useRef<WorkbookInstance>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // Block actions and zoom remount the engine. Restore the scroll position or reveal an inserted exercise.
  const pendingView = useRef<{ top: number; left: number } | CellPosition | null>(null)
  function keepView(scale = 1) {
    const bar = (axis: 'x' | 'y') => gridRef.current?.querySelector<HTMLElement>(`.luckysheet-scrollbar-${axis}`)
    pendingView.current = { top: (bar('y')?.scrollTop ?? 0) * scale, left: (bar('x')?.scrollLeft ?? 0) * scale }
  }
  useEffect(() => {
    const view = pendingView.current
    if (!view) return
    pendingView.current = null
    // The remounted engine may take several frames to size its scroll area.
    const deadline = performance.now() + 3000
    let applied = false
    // The engine has no ready hook, so poll each frame. The coach's own wheel, click or key wins.
    const listening = new AbortController()
    const stop = () => { cancelAnimationFrame(frame); listening.abort() }
    for (const name of ['wheel', 'pointerdown', 'keydown']) gridRef.current?.addEventListener(name, stop, { capture: true, passive: true, signal: listening.signal })
    const restore = () => {
      const late = performance.now() >= deadline
      try {
        const x = gridRef.current?.querySelector<HTMLElement>('.luckysheet-scrollbar-x')
        const y = gridRef.current?.querySelector<HTMLElement>('.luckysheet-scrollbar-y')
        if (x && y && workbook.current) {
          if ('row' in view) {
            // FortuneSheet sizes these spacers when the row and column coordinates are ready.
            const width = Number.parseFloat(x.querySelector('div')?.style.width ?? '')
            const height = Number.parseFloat(y.querySelector('div')?.style.height ?? '')
            if (width > 0 && height > 0) {
              goToCell(view.row, view.column)
              return stop()
            }
          } else {
            const top = Math.round(view.top), left = Math.round(view.left)
            if (applied && Math.abs(y.scrollTop - top) <= 1 && Math.abs(x.scrollLeft - left) <= 1) return stop()
            applied = false
            // At the deadline the sheet may simply be shorter now: go as far as it reaches.
            if (late || (top === 0 || y.scrollHeight - y.clientHeight >= top)
              && (left === 0 || x.scrollWidth - x.clientWidth >= left)) {
              workbook.current.scroll({ scrollTop: Math.min(top, Math.max(0, y.scrollHeight - y.clientHeight)), scrollLeft: Math.min(left, Math.max(0, x.scrollWidth - x.clientWidth)) })
              // The engine redraws from its scroll handler; a programmatic scrollTop alone may not reach it.
              x.dispatchEvent(new Event('scroll'))
              y.dispatchEvent(new Event('scroll'))
              applied = true
              if (late) return stop()
            }
          }
        }
      } catch { /* A view restore never blocks editing. */ }
      if (late) return stop()
      frame = requestAnimationFrame(restore)
    }
    let frame = requestAnimationFrame(restore)
    return stop
  }, [revision])
  // Scrolling: the engine steps one row per wheel tick, moves sideways only on a trackpad and
  // traps the wheel even when the sheet has nowhere to go. Scroll by pixels instead (Shift+wheel
  // goes sideways, like Excel) and hand the wheel back to the page at the sheet's edges.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      const x = grid.querySelector<HTMLElement>('.luckysheet-scrollbar-x'), y = grid.querySelector<HTMLElement>('.luckysheet-scrollbar-y')
      if (!x || !y) return
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? grid.clientHeight : 1
      let dx = event.deltaX * unit, dy = event.deltaY * unit
      if (event.shiftKey && !dx) { dx = dy; dy = 0 }
      event.stopPropagation()
      const canY = dy < 0 ? y.scrollTop > 0 : dy > 0 && y.scrollTop + y.clientHeight < y.scrollHeight - 1
      if (dy && !canY && Math.abs(dy) >= Math.abs(dx)) return // Let the page scroll on.
      event.preventDefault()
      if (dx) x.scrollLeft += dx
      if (dy && canY) y.scrollTop += dy
    }
    grid.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => grid.removeEventListener('wheel', onWheel, { capture: true })
  }, [])
  // Workspace: fit the sheet to the space left on screen so both scrollbars stay in view.
  const [gridHeight, setGridHeight] = useState<number | null>(null)
  useEffect(() => {
    if (!workspace) return
    const fit = () => {
      const grid = gridRef.current
      if (!grid) return
      const top = grid.getBoundingClientRect().top + window.scrollY
      setGridHeight(Math.max(380, Math.round(window.innerHeight - top - 44)))
    }
    fit()
    window.addEventListener('resize', fit)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    observer?.observe(document.body)
    return () => { window.removeEventListener('resize', fit); observer?.disconnect() }
  }, [workspace, Boolean(sheets)]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const grid = gridRef.current
    if (!twoScreen || !grid || typeof ResizeObserver === 'undefined') return
    let width = grid.getBoundingClientRect().width
    let frame = 0
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === width) return
      width = entry.contentRect.width
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0
        // FortuneSheet listens for window resize to remeasure and repaint its canvas.
        window.dispatchEvent(new Event('resize'))
      })
    })
    observer.observe(grid)
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [twoScreen, Boolean(sheets)]) // eslint-disable-line react-hooks/exhaustive-deps
  function jumpToDay(index: number) {
    try { workbook.current?.scroll({ targetColumn: index * 5 }) } catch { /* Jumping never blocks editing. */ }
  }
  const current = useRef<Sheet[]>(cloneSheets(previous.current?.sheets || []))
  const [check, setCheck] = useState<SheetFlags>({ flags: [], emptySlots: 0, other: [], percentCells: [], hasPrescriptions: true })
  const loadPreviews = useMemo(() => new Map(check.percentCells.flatMap(cell => 'loads' in cell
    ? [[`${cell.row}:${cell.column}`, { raw: cell.raw, text: cell.loads.map(load => `≈ ${load.weight} ${activeIntake.unit}`).join(' · ') }] as const]
    : [])), [check.percentCells, activeIntake.unit])
  const displayFlags = useMemo(() => new Map(check.flags.map(flag => [
    `${flag.row}:${flag.column}`, flag.percent === 'ready' ? percentFill : flagFill[flag.kind],
  ])), [check.flags])
  const annotations = useRef({ displayFlags, loadPreviews, zoom })
  annotations.current = { displayFlags, loadPreviews, zoom }
  const annotationsKey = useMemo(() => displayFlags.size || loadPreviews.size
    ? JSON.stringify([[...displayFlags].sort(), [...loadPreviews].sort()])
    : '', [displayFlags, loadPreviews])
  const lastRepaintKey = useRef('')
  useEffect(() => {
    if (!twoScreen || annotationsKey === lastRepaintKey.current) return
    lastRepaintKey.current = annotationsKey
    window.dispatchEvent(new Event('resize'))
  }, [twoScreen, annotationsKey])
  // The engine mounts with the display layer for its current shape.
  const editorSheets = useMemo(() => sheets ? forEditor(sheets, zoom, activeIntake, counts, lockedCell) : [], [sheets, zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  // Row heights the engine is currently showing, so an edit that needs a taller (or shorter) row resizes only that row.
  const shownHeights = useRef<Record<string, number>>({})
  useEffect(() => { shownHeights.current = editorSheets[0]?.config?.rowlen ? { ...editorSheets[0].config.rowlen } : {} }, [editorSheets])
  function growRows(sheet: Sheet) {
    const wanted = contentHeights(activeIntake, counts, sheet), changed: Record<string, number> = {}
    for (const [row, height] of Object.entries(wanted)) if (shownHeights.current[row] !== height) changed[row] = height
    if (!Object.keys(changed).length) return
    shownHeights.current = { ...shownHeights.current, ...changed }
    try { workbook.current?.setRowHeight(changed) } catch { /* Heights catch up on the next remount. */ }
  }
  const draftChange = useRef(onDraftChange)
  draftChange.current = onDraftChange
  useEffect(() => {
    if (current.current.length) draftChange.current?.({ format: 'unrack-generated-cycle-v1', intake: activeIntake, counts, blockIds, ...(Object.keys(switches).length ? { switches } : {}), sheets: cloneSheets(current.current) })
  }, [activeIntake, counts, blockIds, switches, sheets, sourceRevision])

  // FortuneSheet effects depend on both callback identities. Keep these stable
  // across status/source-state renders to avoid an onChange feedback loop.
  const editorHooks = useMemo<Hooks>(() => ({
        beforeUpdateCell: (row, column) => !readOnly && editableCell(activeIntake, counts, row, column, starts) && !lockedCell(row, column),
        beforePaste: (selection, content) => {
          const range = selection?.[0]
          if (readOnly || !range || typeof content !== 'string') return false
          const lines = content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
          const height = Math.max(lines.length, range.row[1] - range.row[0] + 1)
          const width = Math.max(...lines.map(line => line.split('\t').length), range.column[1] - range.column[0] + 1)
          for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
            if (!editableCell(activeIntake, counts, range.row[0] + row, range.column[0] + column, starts) || lockedCell(range.row[0] + row, range.column[0] + column)) return false
          }
          return true
        },
        beforeAddSheet: () => false, beforeDeleteSheet: () => false, beforeUpdateSheetName: () => false,
        ...(twoScreen && {
          // FortuneSheet records formatting API calls in Undo. Paint directly on the canvas so
          // clearing a flag after a quick fix doesn't put a formatting step above the text edit.
          beforeRenderCell: (_value, { row, column }, ctx) => {
            const fill = annotations.current.displayFlags.get(`${row}:${column}`)
            if (fill) ctx.fillStyle = fill
            return true
          },
          afterRenderCell: (value, { row, column, startX, endX, startY, endY }, ctx) => {
            const { loadPreviews, zoom } = annotations.current
            const preview = loadPreviews.get(`${row}:${column}`)
            if (!preview || String(value?.v ?? '').trim() !== preview.raw.trim()) return
            ctx.save()
            ctx.font = `${(value?.fs || 16) * zoom}pt "Times New Roman", serif`
            const width = ctx.measureText(preview.raw).width
            ctx.font = `${12 * zoom}pt "Times New Roman", serif`
            ctx.fillStyle = '#5d6d69'
            ctx.textBaseline = 'middle'
            ctx.textAlign = 'left'
            const left = startX + 4, right = endX - 4
            const inline = !preview.raw.includes('\n') && left + width + 8 + ctx.measureText(preview.text).width <= right
            const x = inline ? left + width + 8 : left
            const y = inline ? (startY + endY) / 2 : endY - 8 * zoom
            if (x < right) ctx.fillText(preview.text, x, y, right - x)
            ctx.restore()
          },
        }),
        afterSelectionChange: (_sheet, range) => {
          const row = range?.row?.[0], column = range?.column?.[0]
          if (row == null || column == null) return
          // Remounts after block actions report an empty selection; keep the panel on its exercise.
          const next = blockAt(activeIntake, counts, row, column)
          queueMicrotask(() => {
            const sameCell = lastCell.current?.row === row && lastCell.current.column === column
            const position = { row, column }
            lastCell.current = position
            if (twoScreen && !sameCell) setMaxSetupCell(null)
            if (!sameCell) setActiveCell(position)
            if (next) {
              setSelection(next)
              // A canvas redraw reports the same selection again. Keep a card opened by
              // “Use a different max” on that prescription cell while its preview updates.
              if (!twoScreen || !sameCell || column % 5 === 1) setCardOpen(column % 5 === 1)
            } else if (twoScreen) {
              setSelection(null)
              setCardOpen(false)
            }
          })
        },
      }), [activeIntake, counts, starts, readOnly, twoScreen]) // eslint-disable-line react-hooks/exhaustive-deps

  function commitCycleName(restoreBlank = false) {
    if (!liveCycleName) return intake.name
    const trimmed = intake.name.trim()
    const name = trimmed || activeIntake.name
    if ((trimmed || restoreBlank) && name !== intake.name) setIntake(staged => ({ ...staged, name }))
    if (trimmed && name !== activeIntake.name) {
      const next = cloneSheets(current.current)
      next[0].name = name
      setActiveIntake(active => ({ ...active, name }))
      replaceSheet(next, `Renamed to “${name}”.`)
    }
    return name
  }

  function closeSettings() {
    if (editSettings) setIntake(activeIntake)
    else commitCycleName(true)
    setSettingsOpen(false)
  }

  function saveSettings() {
    if (readOnly || intakeDisabled) return
    const name = intake.name.trim() || activeIntake.name
    const nextIntake = {
      ...activeIntake, name,
      start: structureLocked ? activeIntake.start : intake.start,
      unit: structureLocked ? activeIntake.unit : intake.unit,
    }
    const next = cloneSheets(current.current)
    if (name !== activeIntake.name) next[0].name = name
    setIntake(nextIntake)
    setActiveIntake(nextIntake)
    setSettingsOpen(false)
    replaceSheet(next, 'Cycle settings saved.')
  }

  function start() {
    if (readOnly || (twoScreen && intakeDisabled)) return
    const buildIntake = { ...intake, name: commitCycleName(true) }
    if (twoScreen && onBuildDraft) {
      const counts = initialCounts(buildIntake)
      onBuildDraft({ format: 'unrack-generated-cycle-v1', intake: buildIntake, counts, blockIds: initialBlockIds(buildIntake, counts), sheets: generate(buildIntake, counts) })
      return
    }
    if (sheets && !window.confirm('Replace this worksheet with a blank template? Save your current draft first to keep it.')) return
    setReview(null)
    setDestinationIssues([])
    const newCounts = initialCounts(buildIntake)
    const next = generate(buildIntake, newCounts)
    clearStructureHistory()
    current.current = cloneSheets(next)
    setSheets(next)
    setCounts(newCounts)
    setBlockIds(initialBlockIds(buildIntake, newCounts))
    setSwitches({})
    setSelection(null)
    skippedPrescriptions.current = {}
    setActiveIntake(buildIntake)
    setRevision(value => value + 1)
    setDirty(true)
    setMessage('Blank worksheet created. Select a cell and type or paste.')
  }

  function clearStructureHistory() {
    setStructureHistory(history => history.length ? [] : history)
  }

  function applySheet(next: Sheet[], status: string, focus?: CellPosition) {
    if (focus) pendingView.current = focus
    else keepView()
    setReview(null)
    setDestinationIssues([])
    current.current = cloneSheets(next)
    setSheets(next)
    setRevision(value => value + 1)
    setDirty(true)
    setMessage(status)
  }

  function replaceSheet(next: Sheet[], status: string, { focus }: { focus?: CellPosition } = {}) {
    applySheet(next, status, focus)
    clearStructureHistory()
  }

  function structureDraft(): CoachSheetDraft {
    return { format: 'unrack-generated-cycle-v1', intake: activeIntake, counts, blockIds, switches, sheets: current.current }
  }

  function restoreStructure({ draft, intake, skipped }: StructureSnapshot, status: string) {
    setIntake(intake)
    setActiveIntake(draft.intake)
    setCounts(draft.counts)
    setBlockIds(draft.blockIds!)
    setSwitches(draft.switches ?? {})
    skippedPrescriptions.current = skipped
    setSelection(null)
    setActiveCell(null)
    lastCell.current = null
    setMaxSetupCell(null)
    setCardOpen(false)
    applySheet(draft.sheets, status)
  }

  function applyStructure(next: CoachSheetDraft, action: string, status: string, weekOperation?: WeekOperation) {
    const { sheets, ...draft } = structureDraft()
    const before = {
      draft: { ...structuredClone(draft), sheets },
      intake: structuredClone(intake),
      skipped: { ...skippedPrescriptions.current },
      action,
    }
    setStructureHistory(history => [...history.slice(-19), before])
    const { days, weeks } = next.intake
    const skipped: Record<string, string> = {}
    const weekSources = sourceWeeks(activeIntake.weeks, weekOperation)
    // Unskip follows the same source weeks as the worksheet. Its keys are 0-based.
    for (const id of Object.values(next.blockIds!).flat()) for (const [week, sourceWeek] of weekSources.entries()) {
      const prescription = skippedPrescriptions.current[`${id}:${sourceWeek - 1}`]
      if (prescription !== undefined) skipped[`${id}:${week}`] = prescription
    }
    restoreStructure({ draft: next, intake: { ...intake, days, weeks }, skipped }, status)
  }

  function requestRemoval(target: StructureRemoval) {
    const draft = structureDraft()
    if ('week' in target ? weekHasContent(draft, target.week) : dayHasContent(draft, target.day)) setRemoval(target)
    else confirmRemoval(target)
  }

  function confirmRemoval(target: StructureRemoval) {
    setRemoval(null)
    if (structureLocked || !showStructure) return
    const draft = structureDraft()
    if ('week' in target) {
      const { week } = target
      applyStructure(removeWeek(draft, week), `remove week ${week}`, `Week ${week} removed.`, { remove: week })
    } else {
      const { day } = target
      applyStructure(removeDay(draft, day), `remove ${day}`, `${day} removed.`)
    }
  }

  function structureBar() {
    const { weeks, days } = activeIntake
    const weekReason = structureLocked ? null : addWeekBlocked({ intake: activeIntake })
    const last = structureHistory.at(-1)
    const removeLabel = removal && ('week' in removal ? `Remove week ${removal.week}` : `Remove ${removal.day}`)
    return <div className="cse-structure">
      <div className="cse-structure-group" role="group" aria-label="Weeks">
        <button type="button" disabled={structureLocked || Boolean(weekReason)} title={weekReason ?? shapeLocked} onClick={() => {
          applyStructure(addWeek(structureDraft()), `add week ${weeks + 1}`, `Week ${weeks + 1} added. It copies week ${weeks}.`, 'add')
        }}>+ Add week (copies W{weeks})</button>
        {weekReason && <span className="cse-structure-reason">{weekReason}</span>}
        {Array.from({ length: weeks }, (_, index) => index + 1).map(week => <span className="cse-structure-item" key={week}>
          W{week}<button type="button" disabled={structureLocked || weeks === 1} aria-label={`Remove week ${week}`} onClick={() => requestRemoval({ week })}>×</button>
        </span>)}
        {last && <button type="button" disabled={structureLocked} aria-label={`Undo ${last.action}`} onClick={() => {
          setStructureHistory(history => history.slice(0, -1))
          restoreStructure(last, `Undid ${last.action}.`)
        }}>Undo</button>}
      </div>
      <div className="cse-structure-group cse-structure-days" role="group" aria-label="Training days">
        {days.map(day => <span className="cse-structure-item" key={day}>
          {day.slice(0, 3)}<button type="button" disabled={structureLocked || days.length === 1} aria-label={`Remove ${day}`} onClick={() => requestRemoval({ day })}>×</button>
        </span>)}
        <div className="cse-add-day" ref={addDayControl}>
          <button type="button" ref={addDayTrigger} disabled={!canAddDay} title={dayReason ?? shapeLocked}
            aria-expanded={addDayOpen && canAddDay} onClick={() => setAddDayOpen(open => !open)}>+ Add day</button>
          {addDayOpen && canAddDay && <div className="cse-day-popover" role="group" aria-label="Unused weekdays">
            {weekdays.filter(day => !days.includes(day)).map(day => <button type="button" key={day} onClick={() => {
              setAddDayOpen(false)
              addDayTrigger.current?.focus()
              applyStructure(addDay(structureDraft(), day), `add ${day}`, `${day} added.`)
            }}>{day}</button>)}
          </div>}
        </div>
        {dayReason && <span className="cse-structure-reason">{dayReason}</span>}
      </div>
      {shapeLocked && <p className="cse-structure-reason cse-structure-lock">{shapeLocked}</p>}
      {removal && removeLabel && !structureLocked && <ModalDialog className="dialog ccb-confirm" box
        labelledBy={removalTitle} describedBy={removalBody} initialFocus="[data-cancel-removal]"
        onEscape={() => setRemoval(null)} onBackdropClick={() => setRemoval(null)}>
        <h2 id={removalTitle}>{removeLabel}?</h2>
        <p id={removalBody}>Its exercises, prescriptions and notes {'week' in removal ? 'on every day' : 'in every week'} go too. You can undo this.</p>
        <div className="dialog-actions">
          <button type="button" className="button outline" data-cancel-removal onClick={() => setRemoval(null)}>Cancel</button>
          <button type="button" className="button danger" onClick={() => confirmRemoval(removal)}>{removeLabel}</button>
        </div>
      </ModalDialog>}
    </div>
  }
  function changeBlock(day: string, block: number, action: 'add' | 'remove' | 'up' | 'down') {
    const ids = blockIds[day]
    const index = Math.min(block, ids.length - 1)
    const nextIds = [...ids]
    if (action === 'add') {
      if (ids.length >= 12) return
      nextIds.splice(index + 1, 0, crypto.randomUUID())
    } else if (action === 'remove') {
      if (ids.length <= 1) return
      const matrix = sheetMatrix(current.current[0]), base = activeIntake.days.indexOf(day) * 5
      const occupied = Array.from({ length: activeIntake.weeks }, (_, week) => [1, 2, 3].some(column => String(matrix[2 + index * (activeIntake.weeks + 1) + week]?.[base + column]?.v ?? '').trim())).some(Boolean)
      if (occupied && !window.confirm(`Remove ${blockName(day, index)} from ${day}, with all its weekly entries?`)) return
      nextIds.splice(index, 1)
    } else {
      const destination = index + (action === 'up' ? -1 : 1)
      if (destination < 0 || destination >= ids.length) return
      ;[nextIds[index], nextIds[destination]] = [nextIds[destination], nextIds[index]]
    }
    const nextBlocks = { ...blockIds, [day]: nextIds }, nextCounts = { ...counts, [day]: nextIds.length }
    const rowMap = Object.fromEntries(activeIntake.days.map(name => [name, nextBlocks[name].map(id => blockIds[name].indexOf(id))]))
    const next = generate(activeIntake, nextCounts, current.current[0], rowMap, nameStarts(activeIntake, nextBlocks, switches))
    setBlockIds(nextBlocks)
    setCounts(nextCounts)
    const target = action === 'add' ? index + 1 : action === 'up' ? index - 1 : action === 'down' ? index + 1 : Math.min(index, nextIds.length - 1)
    const focus = action === 'add' ? { row: blockRow(day, target, 0), column: activeIntake.days.indexOf(day) * 5 + 1 } : undefined
    setSelection({ day, block: target, week: focus ? 0 : selection?.week ?? 0 })
    replaceSheet(next, `${day} exercise ${action === 'add' ? 'added' : action === 'remove' ? 'removed' : 'moved'}. All week entries stay with their exercise.`, { focus })
  }
  function blockRow(day: string, block: number, week: number) { return 2 + block * (activeIntake.weeks + 1) + week }
  function blockName(day: string, block: number) {
    const name = String(sheetMatrix(current.current[0])[blockRow(day, block, 0)]?.[activeIntake.days.indexOf(day) * 5 + 1]?.v ?? '').trim()
    return name || `Unnamed exercise · position ${block + 1}`
  }
  /** The exercise each week of a block is named, following its name runs. */
  function weekNames(day: string, block: number, matrix = sheetMatrix(current.current[0]), runs = startsOf(starts, day, block)): string[] {
    const base = activeIntake.days.indexOf(day) * 5
    return Array.from({ length: activeIntake.weeks }, (_, index) => {
      const start = runs.filter(week => week <= index + 1).at(-1)!
      return String(matrix[blockRow(day, block, start - 1)]?.[base + 1]?.v ?? '').trim()
    })
  }
  /** Re-lay a block's name column for new runs; names land on each run's first week. */
  function relayNames(day: string, block: number, runs: number[], names: string[], status: string) {
    const id = blockIds[day][block], base = activeIntake.days.indexOf(day) * 5
    const nextSwitches = { ...switches }
    if (runs.length > 1) nextSwitches[id] = runs.slice(1); else delete nextSwitches[id]
    const sheet = cloneSheets(current.current)[0], matrix = sheetMatrix(sheet)
    runs.forEach(week => { const row = blockRow(day, block, week - 1); matrix[row][base + 1] = { ...(matrix[row][base + 1] ?? cell('')), v: names[week - 1] || '', m: names[week - 1] || '' } as Cell })
    const next = generate(activeIntake, counts, { ...sheet, data: matrix, celldata: undefined }, undefined, nameStarts(activeIntake, blockIds, nextSwitches))
    setSwitches(nextSwitches)
    replaceSheet(next, status)
  }
  function nameEachWeek(day: string, block: number) {
    const names = weekNames(day, block)
    relayNames(day, block, names.map((_, index) => index + 1), names, `${names[0] || 'This exercise'}: each week now has its own name cell. Type a different exercise in any week that isn't done.`)
  }
  function combineWeeks(day: string, block: number) {
    const names = weekNames(day, block)
    const runs = names.flatMap((name, index) => index === 0 || name !== names[index - 1] ? [index + 1] : [])
    relayNames(day, block, runs, names, runs.length === 1 ? `${names[0] || 'This exercise'} now uses one name for every week.` : 'Weeks with the same exercise are combined.')
  }
  /** Running program: a new name typed over weeks that are done applies from the first open week on. */
  function renameAroundDoneWeeks(next: Sheet[]): boolean {
    const before = sheetMatrix(current.current[0]), after = sheetMatrix(next[0])
    for (const [dayIndex, day] of activeIntake.days.entries()) for (let block = 0; block < (counts[day] || 0); block++) {
      const base = dayIndex * 5, runs = startsOf(starts, day, block)
      for (const [index, start] of runs.entries()) {
        const row = blockRow(day, block, start - 1)
        const was = String(before[row]?.[base + 1]?.v ?? ''), now = String(after[row]?.[base + 1]?.v ?? '')
        if (was === now) continue
        const end = (runs[index + 1] ?? activeIntake.weeks + 1) - 1
        if (!weekDone(day, start)) continue
        const open = Array.from({ length: end - start + 1 }, (_, offset) => start + offset).find(week => !weekDone(day, week))
        if (!open) {
          queueMicrotask(() => { keepView(); setSheets(cloneSheets(current.current)); setRevision(value => value + 1); setMessage(`Every week of ${was || 'this exercise'} in this run is done, so its name can't change.`) })
          return true
        }
        const names = weekNames(day, block, before, runs).map((name, week) => week + 1 >= open && week + 1 <= end ? now : name)
        const nextRuns = [...new Set([...runs, open])].sort((a, b) => a - b)
        queueMicrotask(() => relayNames(day, block, nextRuns, names, `${was} stays on the finished weeks (W${start}–W${open - 1}). ${now || 'The new exercise'} starts in W${open}.`))
        return true
      }
    }
    return false
  }
  function toggleSkip(day: string, block: number, week: number) {
    const row = blockRow(day, block, week), column = activeIntake.days.indexOf(day) * 5 + 2
    const next = cloneSheets(current.current), matrix = sheetMatrix(next[0])
    const existing = String(matrix[row]?.[column]?.v ?? '').trim(), slot = `${blockIds[day][block]}:${week}`
    if (existing === 'SKIP') {
      const restored = skippedPrescriptions.current[slot] ?? ''
      delete skippedPrescriptions.current[slot]
      matrix[row][column] = cell(restored)
      next[0] = { ...next[0], data: matrix, celldata: undefined }
      replaceSheet(next, restored ? `${blockName(day, block)} W${week + 1} restored to ${restored}.` : `${blockName(day, block)} W${week + 1} unskipped. Enter its prescription.`)
      return
    }
    skippedPrescriptions.current[slot] = existing
    matrix[row][column] = cell('SKIP')
    next[0] = { ...next[0], data: matrix, celldata: undefined }
    replaceSheet(next, `${blockName(day, block)} W${week + 1} skipped. Instructions kept; Unskip restores the prescription.`)
  }
  const acceptChange = useCallback((updated: Sheet[]) => {
    if (readOnly) return
    if (!validStructure(activeIntake, counts, updated, starts)) {
      queueMicrotask(() => {
        keepView()
        setSheets(cloneSheets(current.current))
        setRevision(value => value + 1)
        setMessage('Change refused: day headings, week labels, exercise merges and sheet dimensions are fixed. Use the exercise controls to change blocks.')
      })
      return
    }
    const next = savedShape(updated, current.current, activeIntake, counts, starts)
    // Hydration, display-only and view changes return the previous source unchanged: not an edit.
    if (next === current.current) return
    if (doneWeeks.size && renameAroundDoneWeeks(next)) return
    // A typed name can start or end a real switch: keep the amber fill on the runs that change exercise.
    const shown = sheetMatrix(next[0])
    for (const [row, column, fill] of runFills(activeIntake, counts, starts, shown)) {
      if (shown[row]?.[column]?.bg === fill) continue
      const target = next[0].data?.[row]?.[column] ?? next[0].celldata?.find(item => item.r === row && item.c === column)?.v
      if (target) target.bg = fill
      if (!painted.current.has(`${row}:${column}`)) try { workbook.current?.setCellFormat(row, column, 'bg', fill) } catch { /* Paint never blocks editing. */ }
    }
    current.current = cloneSheets(next)
    queueMicrotask(() => {
      clearStructureHistory()
      setDirty(true)
      setReview(null)
      setDestinationIssues([])
      setSourceRevision(value => value + 1)
    })
    queueMicrotask(() => growRows(next[0]))
  }, [activeIntake, counts, starts, doneWeeks, blockIds, switches, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Workspace: check the sheet every time an edit lands (the engine reports edits when the coach
  // leaves a cell) and paint what can't be read. Paint is display-only: savedShape ignores fills.
  const latestFlags = useRef(check.flags)
  latestFlags.current = check.flags
  const painted = useRef(new Map<string, string>())
  const readCheck = useCallback(() => sheetFlags(activeIntake, counts, blockIds, current.current, cycleId || 'local-preview-cycle', switches,
    percentMaxes && onConvertPercent ? { resolver: percentMaxes, basis: percentBasis, locked: (row, column) => {
      const block = blockAt(activeIntake, counts, row, column)
      return Boolean(block && doneWeeks.has(`${block.day}:${block.week + 1}`))
    } } : undefined, twoScreen),
  [activeIntake, counts, blockIds, cycleId, switches, percentMaxes, percentBasis, doneWeeks, onConvertPercent, twoScreen])
  useEffect(() => {
    if (!workspace || !sheets || readOnly) return
    setCheck(readCheck())
  }, [workspace, sheets, sourceRevision, readCheck, readOnly])
  function paintFlags(flags: SheetFlag[]) {
    const engine = workbook.current
    if (!engine) return
    const want = new Map<string, string>(flags.map(flag => [`${flag.row}:${flag.column}`, flagFill[flag.kind]]))
    const source = sheetMatrix(current.current[0])
    for (const key of [...painted.current.keys()]) if (!want.has(key)) {
      const [row, column] = key.split(':').map(Number)
      try { engine.setCellFormat(row, column, 'bg', sourceFill(source[row]?.[column]?.bg) ?? null) } catch { /* Paint never blocks editing. */ }
      painted.current.delete(key)
    }
    for (const [key, fill] of want) if (painted.current.get(key) !== fill) {
      const [row, column] = key.split(':').map(Number)
      try { engine.setCellFormat(row, column, 'bg', fill); painted.current.set(key, fill) } catch { /* Paint never blocks editing. */ }
    }
  }
  useEffect(() => { if (workspace && !twoScreen) queueMicrotask(() => paintFlags(check.flags)) }, [check]) // eslint-disable-line react-hooks/exhaustive-deps
  // A remount redraws from the source, which has no flag fills: paint again once it is up.
  useEffect(() => {
    if (!workspace || twoScreen) return
    painted.current.clear()
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => paintFlags(latestFlags.current)) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [revision]) // eslint-disable-line react-hooks/exhaustive-deps
  function goToCell(row: number, column: number) {
    try {
      const engine = workbook.current
      if (!engine) return
      engine.scroll({ targetRow: Math.max(0, row - 2), targetColumn: Math.max(0, column - 1) })
      engine.batchCallApis([{
        name: 'setSelection',
        // The batch reads args inside its Immer updater. Each replay needs its own range
        // because setSelection normalizes it in place and Immer freezes the result.
        get args() { return [[{ row: [row, row], column: [column, column] }]] },
      }])
    } catch { /* Navigation never blocks editing. */ }
  }
  const problemCount = check.flags.length + check.emptySlots + check.other.length
  const readyCount = check.flags.filter(flag => flag.percent === 'ready').length
  const missingMaxCount = check.flags.filter(flag => flag.percent === 'missing').length
  const otherCount = problemCount - readyCount - missingMaxCount
  const percentHeader = twoScreen
    ? [readyCount > 0 && `${readyCount} ready to convert`, missingMaxCount > 0 && `${missingMaxCount} ${missingMaxCount === 1 ? 'needs' : 'need'} a max`, otherCount > 0 && `${otherCount} other`].filter(Boolean).join(' · ')
    : `${readyCount} ready to convert · ${missingMaxCount} need a max${otherCount ? ` · ${otherCount} other` : ''}`
  const publishBlocked = workspace && problemCount > 0 && readyCount === 0
  // Toolbar explanation: the flag on the selected cell, else the first flag in the selected exercise.
  const activeBlock = activeCell ? blockAt(activeIntake, counts, activeCell.row, activeCell.column) : null
  const focusFlag = activeCell ? check.flags.find(flag => flag.row === activeCell.row && flag.column === activeCell.column)
    ?? (!twoScreen && activeBlock ? check.flags.find(flag => { const block = blockAt(activeIntake, counts, flag.row, flag.column); return block?.day === activeBlock.day && block.block === activeBlock.block }) : undefined) : undefined

  function changeZoom(direction: -1 | 1) {
    const nextZoom = Math.max(0.5, Math.min(1.5, Math.round((zoom + direction * 0.1) * 10) / 10))
    if (nextZoom === zoom) return
    // Remount from the latest source so in-cell edits survive the zoom change.
    keepView(nextZoom / zoom)
    setSheets(cloneSheets(current.current))
    setRevision(value => value + 1)
    setZoom(nextZoom)
  }

  async function save(): Promise<boolean> {
    if (readOnly || !sheets || saving) return false
    try {
      setSaving(true)
      const draft: CoachSheetDraft = { format: 'unrack-generated-cycle-v1', intake: activeIntake, counts, blockIds, ...(Object.keys(switches).length ? { switches } : {}), sheets: cloneSheets(current.current) }
      if (localPersistence) localStorage.setItem(key, JSON.stringify(draft))
      await onSaveDraft?.(draft)
      setDirty(false)
      setMessage(localPersistence ? 'Draft saved in this browser. Reload to check it reopens.' : 'Draft saved to Coach storage.')
      return true
    } catch { setDirty(true); setMessage(localPersistence ? 'Draft could not be saved in this browser.' : 'Draft could not be saved to Coach storage. Your edits remain here; retry Save draft.'); return false }
    finally { setSaving(false) }
  }

  function reveal(target: { current: HTMLElement | null }) {
    requestAnimationFrame(() => target.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
  }

  // Publish = save if needed, Review cycle, then (when clean) the server preview and
  // its explicit confirmation in the publish panel. Publication itself is unchanged.
  function openConvert(cells = readCheck().percentCells) {
    if (readOnly || !cells.length || !onConvertPercent) return
    const source = current.current
    onConvertPercent({
      cells,
      unit: activeIntake.unit,
      ...(!twoScreen && { legacyCopy: true }),
      apply(conversions) {
        if (!conversions.length) return
        if (current.current !== source) {
          setMessage(`The worksheet changed. Open ${percentConversionLabel(activeIntake.unit)} again to review the latest cells.`)
          return
        }
        const matrix = sheetMatrix(structuredClone(source[0]))
        for (const { row, column, text } of conversions) {
          matrix[row][column] = { ...matrix[row][column], v: text, m: text }
        }
        const next = savedShape([{ ...source[0], data: matrix, celldata: undefined }], source, activeIntake, counts, starts)
        replaceSheet(next, `Converted ${conversions.length} ${conversions.length === 1 ? 'prescription' : 'prescriptions'} to ${activeIntake.unit}. Save draft to keep the changes.`)
      },
    })
  }

  function editFlagCell(flag: SheetFlag, text: string) {
    if (readOnly || lockedCell(flag.row, flag.column) || !editableCell(activeIntake, counts, flag.row, flag.column, starts)) return
    workbook.current?.setCellValue(flag.row, flag.column, text)
    gridRef.current?.querySelector<HTMLElement>('.fortune-sheet-overlay')?.focus({ preventScroll: true })
  }

  function pickPercentBasis(name: string, id: string) {
    setPercentBasis(current => new Map(current).set(percentExerciseKey(name), id))
  }

  function openBasis() {
    if (basisSelect.current) basisSelect.current.focus()
    else {
      focusBasis.current = true
      setCardOpen(true)
    }
  }

  function selectedFlagHelp(flag: SheetFlag) {
    const cell = check.percentCells.find(item => item.row === flag.row && item.column === flag.column)
    const ready = cell && 'loads' in cell ? cell : undefined
    const canEdit = !readOnly && !lockedCell(flag.row, flag.column)
    const maxId = cell && flag.percent === 'missing' ? percentMaxes?.exerciseId(cell.exercise) : undefined
    const saveMax = onSaveMax
    const key = `${flag.row}:${flag.column}`
    const canSetMax = maxId && saveMax
    const setupRequested = canEdit && maxSetupCell === key
    const mode = flag.percent !== 'missing' || !cell ? undefined
      : setupRequested ? canSetMax ? 'form' : 'profile'
      : flag.suggestedMax ? 'suggest' : canSetMax ? 'can-set' : 'profile'
    const explanation = mode === 'profile' && cell
      ? `No max for ${cell.exercise} yet. Add one in Profile → Maxes, or pick Based on in the exercise card.`
      : flag.explanation ?? flag.message
    const done = cell && 'reason' in cell && cell.reason === 'workout is locked'
    const title = done ? 'Already done' : flag.percent === 'missing' ? 'Needs a max' : flagTitle[flag.kind]
    return <div className={`cse-hint-flag cse-cell-help ${flagClassName(flag)}`}>
      <div role="status"><b>{title} · {flag.label}</b>
        <div>{explanation}{flag.suggestion && !explanation.endsWith(`Did you mean ${flag.suggestion}?`) && <> Did you mean <code>{flag.suggestion}</code>?</>}</div>
      </div>
      {canEdit && <div className="cse-flag-actions">
        {flag.suggestion && <button type="button" className="cse-primary" onClick={() => editFlagCell(flag, flag.suggestion!)}>Use {flag.suggestion}</button>}
        {ready && <>
          <button type="button" className="cse-primary" onClick={() => editFlagCell(flag, rewritePercentPrescription(ready.raw, ready.loads, activeIntake.unit))}>
            Write {ready.loads.map(load => `${load.weight} ${activeIntake.unit}`).join(' · ')}
          </button>
          <button type="button" onClick={openBasis}>Use a different max…</button>
        </>}
        {mode && cell && flag.suggestedMax && <button type="button" className="cse-primary"
          onClick={() => pickPercentBasis(cell.exercise, flag.suggestedMax!.exercise_id)}>Use</button>}
        {(mode === 'suggest' || mode === 'can-set') &&
          <button type="button" onClick={() => setMaxSetupCell(key)}>Set a max</button>}
      </div>}
      {mode === 'form' && cell && canSetMax && <FlagMaxForm key={`${key}:${maxId}`} unit={activeIntake.unit}
        onSave={async value => {
          await saveMax(maxId, value, activeIntake.unit)
          // An explicit None would otherwise hide the max the coach just saved.
          const basisKey = percentExerciseKey(cell.exercise)
          const previousBasis = percentBasis.get(basisKey)
          if (previousBasis !== undefined) setPercentBasis(current =>
            current.get(basisKey) === previousBasis ? new Map(current).set(basisKey, maxId) : current)
        }} onClose={() => setMaxSetupCell(open => open === key ? null : open)} />}
    </div>
  }

  async function publish() {
    if (readOnly || !sheets || publishing || saving || (twoScreen && publishBusy) || !onPublishReady) return
    if (workspace && percentMaxes && onConvertPercent) {
      const latest = readCheck()
      if (latest.percentCells.some(cell => 'loads' in cell)) { openConvert(latest.percentCells); return }
      if (latest.percentCells.length > 0) { setCheck(latest); return }
    }
    setPublishing(true)
    try {
      if ((localPersistence || serverClean === undefined ? dirty : !serverClean) && !await save()) { reveal(statusRef); return }
      if (workspace) {
        const latest = readCheck()
        setCheck(latest)
        if (latest.flags.length + latest.emptySlots + latest.other.length) { setMessage('Fix the highlighted cells, then publish.'); return }
        setMessage('')
        onPublishReady()
        return
      }
      const count = reviewInterpretation(false)
      if (count) { reveal(statusRef); return }
      setMessage('Review passed. Check the workouts and dates in Publish below, then confirm.')
      onPublishReady()
    } finally { setPublishing(false) }
  }

  function reviewInterpretation(scroll = true): number {
    const result = interpretCoachSheetDraft({ intake: activeIntake, counts, blockIds, ...(Object.keys(switches).length ? { switches } : {}), sheets: cloneSheets(current.current) }, { cycleId: cycleId || 'local-preview-cycle' })
    // Hosted publication is still /1. Exact-start review belongs to the local
    // proof until the matching server compiler and transport are integrated.
    const schedule = localPersistence ? compileCoachCycleScheduleV2(activeIntake) : compileCoachCycleSchedule(activeIntake)
    const compiled = result.status === 'ready_for_review'
      ? localPersistence ? compileCoachCycleDestinationV2(result, activeIntake) : compileCoachCycleDestination(result, activeIntake)
      : null
    const extra = compiled?.issues ?? schedule.issues
    setReview(result)
    setReviewSchedule(compiled?.status === 'compiled' && schedule.status === 'compiled' && schedule.schedule.mode === 'exact_start' ? schedule.schedule : null)
    setDestinationIssues(extra)
    const count = result.issues.length + extra.length
    setMessage(count ? `${count} interpretation or cycle issues found. Edit the named source cells or intake, then review again.` : 'All populated cells were accounted for. Final server review is still required before publication.')
    if (scroll) reveal(statusRef)
    return count
  }

  const selectedExercise = twoScreen && selection ? weekNames(selection.day, selection.block)[selection.week]?.trim() ?? '' : ''
  const unsaved = localPersistence || serverClean === undefined ? dirty : !serverClean
  const hasSheet = Boolean(sheets)
  const hasPercentCells = check.percentCells.length > 0
  const canPublish = Boolean(onPublishReady) && !publishBlocked && !readOnly
  useImperativeHandle(twoScreen ? toolbarRef : undefined, () => ({
    openSettings: ({ focusName } = {}) => {
      if (!sheets || readOnly) return
      if (settingsOpen) {
        if (focusName) focusCycleName()
        else closeSettings()
        return
      }
      focusNameOnOpen.current = Boolean(focusName)
      setSettingsOpen(true)
    },
    jumpToDay,
    zoom: changeZoom,
    openPastWeights: () => { if (selectedExercise) setCardOpen(true) },
    openConvert,
    save,
    publish,
  }))
  useEffect(() => {
    if (!twoScreen || !onToolbarState) return
    onToolbarState(hasSheet ? {
      zoom: Math.round(zoom * 100), days: activeIntake.days, unit: activeIntake.unit, settingsOpen, dirty: unsaved,
      saving, publishing: publishing || publishBusy, problemCount, readyCount, hasPercentCells,
      selectedExercise, pastWeightsOpen: cardOpen, canPublish, publishBlocked,
    } : null)
  }, [twoScreen, onToolbarState, hasSheet, zoom, activeIntake.days, activeIntake.unit, settingsOpen, unsaved, saving, publishing,
    publishBusy, problemCount, readyCount, hasPercentCells, selectedExercise, cardOpen, canPublish, publishBlocked])

  function exerciseCard() {
    const active = selection && activeIntake.days.includes(selection.day) && selection.block < (counts[selection.day] || 0) ? selection : null
    if (!active || !cardOpen) return null
    const { day, block, week } = active, total = counts[day]
    const names = weekNames(day, block), name = names[week] || names[0] || ''
    const basisKey = percentExerciseKey(names[week])
    const showBasis = percentMaxes && basisKey && check.percentCells.some(item => percentExerciseKey(item.exercise) === basisKey)
    const runs = startsOf(starts, day, block), split = runs.length > 1
    const done = names.map((_, index) => weekDone(day, index + 1)), doneCount = done.filter(Boolean).length
    return <aside className="cse-card" aria-label="Selected exercise">
      <button className="cse-card-close" aria-label="Close exercise card" onClick={() => setCardOpen(false)}>×</button>
      <p className="cse-kicker">{day} · Exercise {block + 1} of {total}</p>
      <strong className="cse-card-name">{name || `Unnamed exercise · position ${block + 1}`}</strong>
      {!readOnly && showBasis && <label style={{ display: 'grid', gap: 4, marginBlock: 8 }}>Based on
        <select ref={twoScreen ? basisSelect : undefined} style={{ width: '100%' }} value={percentMaxes.resolve(name, percentBasis.get(basisKey))?.exercise_id ?? ''}
          onChange={event => pickPercentBasis(name, event.target.value)}>
          <option value="">None</option>
          {percentMaxes.maxes.map(max => <option key={max.exercise_id} value={max.exercise_id}>{max.name} · {max.value} {max.unit} · {maxTypeLabel(max.max_type)}</option>)}
        </select>
      </label>}
      {exerciseByWeek && <section className="cse-card-weeks" aria-label="Exercise by week">
        <div className="cse-card-weeks-head"><p className="cse-card-label">EXERCISE BY WEEK</p>
          {!readOnly && (split ? <button className="cse-link" onClick={() => combineWeeks(day, block)}>{twoScreen ? 'Same exercise every week' : new Set(names).size === 1 ? '▴ One name for all weeks' : '▴ Combine matching weeks'}</button>
            : <button className="cse-link" onClick={() => nameEachWeek(day, block)}>{twoScreen ? 'Change exercise by week' : '▾ Different exercise by week'}</button>)}</div>
        <ol>{names.map((weekName, index) => <li key={index} className={`${done[index] ? 'done' : ''}${index === week ? ' selected' : ''}${runs.includes(index + 1) && index > 0 && weekName !== names[index - 1] ? ' changed' : ''}`}>
          <span className="cse-card-w">W{index + 1}</span><span>{weekName || <em>No name</em>}</span>{done[index] && <span className="cse-card-done" title="Workout done, locked">Done</span>}</li>)}</ol>
        {!readOnly && doneCount > 0 && <p className="cse-card-hint">Done weeks are locked. Type a new name in the exercise cell to change the weeks still to come.</p>}
        {!readOnly && !doneCount && !split && <p className="cse-card-hint">One name covers every week. Expand to name each week on its own.</p>}
      </section>}
      {exerciseReference && <section className="cse-card-reference" aria-label="Past weights"><p className="cse-card-label">PAST WEIGHTS</p>{exerciseReference(name)}</section>}
      {!readOnly && <div className="cse-card-actions">
        <button aria-label="↑ Move up" disabled={block === 0} onClick={() => changeBlock(day, block, 'up')}>↑</button>
        <button aria-label="↓ Move down" disabled={block === total - 1} onClick={() => changeBlock(day, block, 'down')}>↓</button>
        <button aria-label="+ Add exercise below" disabled={total >= 12} onClick={() => changeBlock(day, block, 'add')}>+ Add below</button>
        <button className="cse-danger" disabled={total <= 1} onClick={() => changeBlock(day, block, 'remove')}>Remove exercise</button>
      </div>}
    </aside>
  }

  function exercisePanel() {
    if (workspace) return exerciseCard()
    const active = selection && activeIntake.days.includes(selection.day) && selection.block < (counts[selection.day] || 0) ? selection : null
    if (!active) return <aside className="cse-panel cse-panel-empty" aria-label="Selected exercise"><p>Select a cell to manage its exercise: all weeks, skip, move, add or remove. Type <strong>SKIP</strong> in a prescription to leave that week out.</p></aside>
    const { day, block, week } = active, base = activeIntake.days.indexOf(day) * 5, matrix = sheetMatrix(current.current[0]), total = counts[day]
    const text = (row: number, column: number) => String(matrix[row]?.[column]?.v ?? '').trim()
    const name = text(blockRow(day, block, 0), base + 1)
    return <aside className="cse-panel" aria-label="Selected exercise">
      <div className="cse-panel-title"><p className="cse-kicker">{day} · Exercise {block + 1} of {total}</p><strong>{blockName(day, block)}</strong><button className="cse-link" onClick={() => setSelection(null)}>Clear selection</button></div>
      <div className="cse-panel-weeks">{Array.from({ length: activeIntake.weeks }, (_, index) => {
        const rx = text(blockRow(day, block, index), base + 2), note = text(blockRow(day, block, index), base + 3), skipped = rx === 'SKIP'
        return <div key={index} className={`cse-panel-week${index === week ? ' selected' : ''}${skipped ? ' skipped' : ''}`} onClick={() => setSelection({ ...active, week: index })}>
          <span className="cse-panel-w">W{index + 1}</span>
          <button className={skipped ? 'on' : ''} aria-label={`${skipped ? 'Unskip' : 'Skip'} week ${index + 1} of ${blockName(day, block)}`} onClick={event => { event.stopPropagation(); toggleSkip(day, block, index) }}>{skipped ? 'Unskip' : 'Skip'}</button>
          <span className="cse-panel-rx">{skipped ? 'Skipped' : rx || <em>Blank</em>}</span>
          {note && <span className="cse-panel-note">{note}</span>}
        </div>
      })}</div>
      <div className="cse-panel-actions">
        <div><button disabled={block === 0} onClick={() => changeBlock(day, block, 'up')}>↑ Move up</button><button disabled={block === total - 1} onClick={() => changeBlock(day, block, 'down')}>↓ Move down</button></div>
        <button disabled={total >= 12} onClick={() => changeBlock(day, block, 'add')}>+ Add exercise below</button>
        <button className="cse-danger" disabled={total <= 1} onClick={() => changeBlock(day, block, 'remove')}>Remove exercise</button>
      </div>
      {exerciseReference && <section className="cse-panel-reference" aria-label="Past performance">{exerciseReference(name)}</section>}
    </aside>
  }

  const listedFlags = twoScreen ? check.flags.filter(flag => flag.percent !== 'missing') : check.flags
  const showIntake = !readOnly && (!workspace || !sheets || settingsOpen)
  const hint = twoScreen ? <>
    {focusFlag && selectedFlagHelp(focusFlag)}
    <div className="cse-example-control">
      <button type="button" className="cse-link" aria-expanded={examplesOpen} onClick={() => setExamplesOpen(open => !open)}>Examples</button>
      {examplesOpen && <div className="cse-examples cse-example-popover">{prescriptionExamples}</div>}
    </div>
  </> : focusFlag ? <FlagExplanation flag={focusFlag} onGo={() => goToCell(focusFlag.row, focusFlag.column)} /> : <span className="cse-hint">Prescriptions: sets x reps @ load or RPE, e.g. 3x8 @ 225, 3x8 @ 7, 3x12 each @ 5 lb, 1x8+ or AMRAP. @ 10 or less is RPE; add lb or kg for a light weight. SKIP leaves a week out. Red = can't read, yellow = empty or unclear. Click an exercise name for past weights.{check.flags.length > 0 && ' Select a red or yellow cell to see why.'}</span>
  const Page = twoScreen && onBuildDraft ? 'div' : 'main'
  const grid = sheets && <div className="cse-grid" ref={gridRef} aria-label="Coach spreadsheet editor" onKeyDownCapture={workspace ? () => setCardOpen(false) : undefined}><Workbook key={revision} ref={workbook} data={editorSheets} defaultFontSize={16} showSheetTabs={false} showToolbar={false} {...(readOnly ? { allowEdit: false } : {})} showFormulaBar={false} addRows={0} cellContextMenu={readOnly ? ['copy'] : ['copy', 'paste']} headerContextMenu={[]} sheetTabContextMenu={[]} hooks={editorHooks} onChange={acceptChange}/></div>
  return <Page className={workspace ? 'cse-page cse-page-workspace' : 'cse-page'}>
    {!workspace && <header className="cse-top"><span>UNRACK <b>COACH</b></span><span>{localPersistence ? 'LOCAL REVIEW · EMBEDDED SPREADSHEET PROOF' : 'TRAINING CYCLE BUILDER'}</span></header>}
    {twoScreen && sheets && !readOnly && <div className="ccb-hint">{hint}</div>}
    {showIntake && (editSettings ? <section inert={intakeDisabled} className="cse-intake cse-cycle-settings" aria-label="Cycle settings">
      <form onSubmit={event => { event.preventDefault(); saveSettings() }}>
        <p>Cycle settings (name, start date, unit). Saving never clears the sheet.</p>
        <div className="cse-fields">
          <label>Cycle name<input ref={cycleNameInput} value={intake.name}
            onChange={event => { const name = event.target.value; setIntake(staged => ({ ...staged, name })) }}
            onBlur={event => {
              // The builder toolbar saves the live name when focus leaves settings.
              if (!event.currentTarget.form?.contains(event.relatedTarget)) commitCycleName()
            }}
            onKeyDown={event => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              saveSettings()
            }}/></label>
          <div className="cse-field"><span>Start date</span><StartDatePicker value={intake.start} disabled={structureLocked}
            onChange={start => setIntake(staged => ({ ...staged, start }))}/></div>
          <label>Unit<select value={intake.unit} disabled={structureLocked}
            onChange={event => { const unit = event.target.value as Intake['unit']; setIntake(staged => ({ ...staged, unit })) }}><option value="lb">lb</option><option value="kg">kg</option></select></label>
          <button className="cse-primary" disabled={intakeDisabled} type="submit">Save</button>
        </div>
        {shapeLocked && <p className="cse-settings-lock">Start date and unit stay as sent on a running program.</p>}
      </form>
    </section> : <section inert={twoScreen && intakeDisabled} className="cse-intake" aria-label={workspace && sheets ? 'Cycle settings' : undefined}>
      {!(twoScreen && onBuildDraft) && (workspace && sheets ? <div><p className="cse-kicker">CYCLE SETTINGS</p><h1>Change the cycle shape</h1><p>Rebuilding replaces this sheet with a blank one in the new shape. Save first if you want to keep this version.</p></div>
      : <div><p className="cse-kicker">NEW TRAINING CYCLE</p><h1>Build in a spreadsheet</h1><p>{localPersistence ? 'Choose the cycle shape, then program directly in the cells. This local proof does not publish to athletes.' : 'Choose the cycle shape, program directly in the cells, and review every prescription before publishing.'}</p></div>)}
      <div className="cse-fields">
        <label>Client{clientOptions ? <select value={intake.client} onChange={e => setIntake({ ...intake, client: e.target.value })}><option value="">Select a client</option>{clientOptions.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select> : <input value={intake.client} placeholder="Select client in connected builder" onChange={e => setIntake({ ...intake, client: e.target.value })}/>}</label>
        <label>Cycle name<input ref={cycleNameInput} value={intake.name}
          onChange={e => { const name = e.target.value; setIntake(staged => ({ ...staged, name })) }}
          onBlur={liveCycleName ? () => { commitCycleName() } : undefined}
          onKeyDown={liveCycleName ? e => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            closeSettings()
          } : undefined}/></label>
        <label>Weeks<input type="number" min="1" max="12" value={intake.weeks} onChange={e => setIntake({ ...intake, weeks: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}/></label>
        <div className="cse-field"><span>Start date</span><StartDatePicker value={intake.start} onChange={start => setIntake({ ...intake, start })}/></div>
        <label>Default unit<select value={intake.unit} onChange={e => setIntake({ ...intake, unit: e.target.value as 'lb' | 'kg' })}><option value="lb">lb</option><option value="kg">kg</option></select></label>
      </div>
      <fieldset><legend>Training days</legend><div className="cse-days">{weekdays.map(day => <label key={day}><input type="checkbox" checked={intake.days.includes(day)} onChange={e => setIntake({ ...intake, days: e.target.checked ? weekdays.filter(value => value === day || intake.days.includes(value)) : intake.days.filter(value => value !== day) })}/>{day.slice(0, 3)}</label>)}</div></fieldset>
      <button className="cse-primary" disabled={twoScreen && intakeDisabled || !intake.days.length || intake.days.length * intake.weeks > COACH_CYCLE_PUBLISH_LIMITS.authoredDays || Boolean(clientOptions && !intake.client)} onClick={start}>{workspace && sheets ? 'Rebuild sheet with these settings' : 'Create new template'}</button>
      {intake.days.length * intake.weeks > COACH_CYCLE_PUBLISH_LIMITS.authoredDays && <p role="alert">Choose at most {COACH_CYCLE_PUBLISH_LIMITS.authoredDays} total workout days across the cycle. Reduce the weeks or selected weekdays.</p>}
      {sheets && !workspace && <p className="cse-caution">Intake changes above apply when you create another new template. That replaces this sheet; save your work first.</p>}
    </section>)}
    {sheets && <section className="cse-workspace">
      {!twoScreen && <div className="cse-workspace-head">{workspace
        ? <div className="cse-workspace-meta"><button className="cse-settings-toggle" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}>Cycle settings</button><span>{activeIntake.weeks} {activeIntake.weeks === 1 ? 'week' : 'weeks'} · {activeIntake.days.map(day => day.slice(0, 3)).join(', ')} · {activeIntake.unit}</span>{activeIntake.days.length > 1 && <span className="cse-day-jump" role="group" aria-label="Go to day">Go to {activeIntake.days.map((day, index) => <button key={day} onClick={() => jumpToDay(index)}>{day.slice(0, 3)}</button>)}</span>}{hint}</div>
        : <div><p className="cse-kicker">WORKSHEET</p><h2>{activeIntake.name}</h2><span>{activeIntake.weeks} weeks · {activeIntake.days.join(', ')} · {activeIntake.unit}</span></div>}<div className="cse-actions"><div className="cse-zoom" aria-label="Spreadsheet zoom"><button aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => changeZoom(-1)}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" disabled={zoom >= 1.5} onClick={() => changeZoom(1)}>+</button></div><span className="cse-divider" aria-hidden="true" /><button onClick={() => void save()} disabled={saving || !localPersistence && !onSaveDraft}>{saving ? 'Saving…' : 'Save draft'}</button>{workspace && percentMaxes && onConvertPercent && <button disabled={saving || publishing || publishBusy || !check.percentCells.length} onClick={() => openConvert()}>{percentConversionLabel(activeIntake.unit)}</button>}{!(workspace && onPublishReady) && <button className={onPublishReady ? undefined : 'cse-primary'} onClick={() => reviewInterpretation()}>Review cycle</button>}{onPublishReady && <button className="cse-primary" disabled={publishing || saving || publishBusy || publishBlocked} title={publishBlocked ? 'Fix the highlighted cells to publish' : undefined} onClick={() => void publish()}>{publishing || publishBusy ? 'Publishing…' : 'Publish'}</button>}</div></div>}
      {workspace && problemCount > 0 && <div className="cse-flags" role="region" aria-label="Cells to fix">
        <strong>{check.percentCells.length > 0 ? percentHeader : problemCount === 1 ? '1 thing to fix before publishing' : `${problemCount} things to fix before publishing`}</strong>
        <ul>{listedFlags.slice(0, 8).map(flag => <li key={`${flag.row}:${flag.column}`}>
          <button className={`cse-flag ${flagClassName(flag)}`} title={twoScreen ? undefined : flag.message} onClick={() => goToCell(flag.row, flag.column)}>
            <b>{flag.label}{flag.percent && !twoScreen ? ':' : ''}</b> {!twoScreen && flag.message}
          </button></li>)}
          {listedFlags.length > 8 && <li className="cse-flag-more">+{listedFlags.length - 8} more highlighted in the sheet</li>}
          {check.emptySlots > 0 && <li className="cse-flag-more">{check.emptySlots === 1 ? '1 exercise slot is empty' : `${check.emptySlots} exercise slots are empty`}: fill it in or remove it from the exercise card.</li>}
          {check.other.map(message => <li key={message} className="cse-flag-more">{message}</li>)}</ul>
      </div>}
      {twoScreen && !readOnly && message && ![
        'Saved draft reopened from Coach storage.', 'Saved draft reopened from this browser.',
        'Draft saved to Coach storage.', 'Draft saved in this browser. Reload to check it reopens.',
      ].includes(message) && <p className="ccd-toolbar-notice" ref={statusRef} role="status">{message}</p>}
      {twoScreen && !readOnly && !check.hasPrescriptions && <p className="cse-examples cse-empty-examples">{prescriptionExamples}</p>}
      <div className="cse-split" style={workspace && gridHeight ? { height: gridHeight, minHeight: 0 } : undefined}>
        {grid}
        {exercisePanel()}
      </div>
      {showStructure && structureBar()}
      {!twoScreen && !readOnly && <div className="cse-status" ref={statusRef}><span>{unsaved ? 'Unsaved changes' : 'Saved draft'}</span><span role="status">{message}</span></div>}
    </section>}
    {review && localPersistence && reviewSchedule && <section className="cycle-review" aria-label="Cycle calendar review">
      <h2>Cycle dates</h2><p>Week 1 starts {reviewSchedule.startOn}. The complete cycle ends {reviewSchedule.endOn}.</p>
      <ol>{reviewSchedule.weeks.map(week => <li key={week.ordinal}><strong>Week {week.ordinal}: </strong>{week.days.map(day => `${day.name} · ${day.plannedDate}`).join(', ')}</li>)}</ol>
    </section>}
    {review && <CoachCycleInterpretationPanel result={review} destinationIssues={destinationIssues} />}
  </Page>
}
