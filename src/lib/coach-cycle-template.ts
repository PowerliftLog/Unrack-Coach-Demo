import type { Cell, Sheet } from '@fortune-sheet/core'
import { generate, validStructure } from '../review/CoachSheetEditorProof'
import { isCoachCycleDraftSource, type CoachCycleDraftSource } from './coach-cycle-draft-api'

export type CoachCycleTemplate = {
  format: 'unrack-cycle-template-v1'
  name: string
  weeks: number
  unit: 'lb' | 'kg'
  days: { name: string; exercises: { name: string; weeks: { prescription: string; instructions: string }[] }[] }[]
}
export type CoachCycleTemplateTarget = {
  athleteId: string
  clientName: string
  start: string
  unit: 'lb' | 'kg'
  name?: string
}
export type CoachCycleTemplateCopy = {
  draftId: string
  athleteId: string
  source: CoachCycleDraftSource
  review: null
  requiresReview: true
  unitChanged: boolean
}
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const invalid = (): never => { throw new Error('Invalid generated cycle template source') }
const bounded = (value: unknown): boolean => new TextEncoder().encode(JSON.stringify(value)).length <= 2 * 1024 * 1024

function jsonSnapshot<T>(value: T): T {
  try {
    const encoded = JSON.stringify(value)
    if (new TextEncoder().encode(encoded).length > 2 * 1024 * 1024) invalid()
    return JSON.parse(encoded) as T
  } catch { return invalid() }
}

function matrix(sheet: Sheet): (Cell | null)[][] {
  // Accept dual engine representations only when their literal source agrees.
  // A hidden stale cache must never become a different copied prescription.
  if (sheet.data) {
    if (sheet.celldata) {
      const sparse = matrix({ ...sheet, data: undefined })
      for (let row = 0; row < Math.max(sheet.data.length, sparse.length); row++) {
        for (let column = 0; column < Math.max(sheet.data[row]?.length || 0, sparse[row]?.length || 0); column++) {
          if (raw(sheet.data[row]?.[column]) !== raw(sparse[row]?.[column])) invalid()
        }
      }
    }
    return sheet.data
  }
  const result: (Cell | null)[][] = Array.from({ length: sheet.row! }, () => Array(sheet.column!).fill(null))
  const seen = new Set<string>()
  for (const cell of sheet.celldata || []) {
    const key = `${cell.r}:${cell.c}`
    if (!Number.isInteger(cell.r) || !Number.isInteger(cell.c) || cell.r < 0 || cell.c < 0 || cell.r >= sheet.row! || cell.c >= sheet.column! || seen.has(key)) invalid()
    seen.add(key)
    result[cell.r][cell.c] = cell.v
  }
  return result
}
function raw(cell: Cell | null | undefined): string {
  // Formula results and rich text are not interchangeable with literal source.
  // Reject them instead of taking a cached display value into a reusable cycle.
  if (cell?.f || cell?.ct?.t === 'inlineStr' || (cell?.v != null && typeof cell.v !== 'string')) invalid()
  return cell?.v == null ? '' : String(cell.v)
}

/** Copy literal authoring cells only. Client/date/IDs/review and Fortune metadata never enter a template. */
export function extractCoachCycleTemplate(source: CoachCycleDraftSource): CoachCycleTemplate {
  source = jsonSnapshot(source)
  if (!isCoachCycleDraftSource(source) || !validStructure(source.intake, source.counts, source.sheets as Sheet[])) invalid()
  const sheet = source.sheets[0] as Sheet, cells = matrix(sheet)
  // Check every occupied cell, including structural cells, for unsupported computed content.
  for (const row of cells) for (const cell of row) if (cell) raw(cell)
  const result: CoachCycleTemplate = {
    format: 'unrack-cycle-template-v1', name: source.intake.name, weeks: source.intake.weeks, unit: source.intake.unit,
    days: source.intake.days.map((day, dayIndex) => ({
      name: day,
      exercises: Array.from({ length: source.counts[day] }, (_, index) => {
        const row = 2 + index * (source.intake.weeks + 1), column = dayIndex * 5
        return { name: raw(cells[row]?.[column + 1]), weeks: Array.from({ length: source.intake.weeks }, (_, week) => ({
          prescription: raw(cells[row + week]?.[column + 2]), instructions: raw(cells[row + week]?.[column + 3]),
        })) }
      }),
    })),
  }
  if (!isCoachCycleTemplate(result)) invalid()
  return result
}

export function isCoachCycleTemplate(value: unknown): value is CoachCycleTemplate {
  if (!object(value) || !exact(value, ['format', 'name', 'weeks', 'unit', 'days']) || value.format !== 'unrack-cycle-template-v1'
    || typeof value.name !== 'string' || !value.name.trim() || value.name !== value.name.trim() || [...value.name].length > 120
    || /[\u0000-\u001f\u007f-\u009f]/.test(value.name) || !Number.isInteger(value.weeks) || Number(value.weeks) < 1 || Number(value.weeks) > 16
    || !['lb', 'kg'].includes(String(value.unit)) || !Array.isArray(value.days) || value.days.length < 1 || value.days.length > 7 || !bounded(value)) return false
  const seen = new Set<string>()
  return value.days.every(day => {
    if (!object(day) || !exact(day, ['name', 'exercises']) || typeof day.name !== 'string' || !weekdays.includes(day.name) || seen.has(day.name)
      || !Array.isArray(day.exercises) || day.exercises.length < 1 || day.exercises.length > 20) return false
    seen.add(day.name)
    return day.exercises.every(exercise => object(exercise) && exact(exercise, ['name', 'weeks']) && typeof exercise.name === 'string'
      && Array.isArray(exercise.weeks) && exercise.weeks.length === value.weeks && exercise.weeks.every(week => object(week)
        && exact(week, ['prescription', 'instructions']) && typeof week.prescription === 'string' && typeof week.instructions === 'string'))
  })
}

/** Pure local copy; athleteId is a selection, never proof of authorization or publication readiness. */
export function copyCoachCycleTemplate(template: CoachCycleTemplate, target: CoachCycleTemplateTarget, options: { newId?: () => string } = {}): CoachCycleTemplateCopy {
  if (!isCoachCycleTemplate(template) || !target || !uuid(target.athleteId) || typeof target.clientName !== 'string' || !target.clientName.trim()
    || !['lb', 'kg'].includes(target.unit) || typeof target.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(target.start)
    || !Number.isFinite(Date.parse(`${target.start}T00:00:00Z`)) || new Date(`${target.start}T00:00:00Z`).toISOString().slice(0, 10) !== target.start
    || (target.name !== undefined && (typeof target.name !== 'string' || !target.name.trim()))) invalid()
  const ids = new Set<string>(), newId = options.newId || (() => crypto.randomUUID())
  const fresh = () => { const id = newId(); if (!uuid(id) || ids.has(id) || id === target.athleteId) invalid(); ids.add(id); return id }
  const draftId = fresh()
  const intake = { client: target.athleteId, name: target.name ?? template.name, weeks: template.weeks, days: template.days.map(day => day.name), start: target.start, unit: target.unit }
  const counts = Object.fromEntries(template.days.map(day => [day.name, day.exercises.length]))
  const blockIds = Object.fromEntries(template.days.map(day => [day.name, day.exercises.map(() => fresh())]))
  const sheets = generate(intake, counts)
  const cells = new Map(sheets[0].celldata!.map(cell => [`${cell.r}:${cell.c}`, cell]))
  const write = (row: number, column: number, text: string) => { const cell = cells.get(`${row}:${column}`)!; cell.v = { ...cell.v!, v: text, m: text } }
  template.days.forEach((day, dayIndex) => day.exercises.forEach((exercise, index) => {
    const row = 2 + index * (template.weeks + 1), column = dayIndex * 5
    write(row, column + 1, exercise.name)
    exercise.weeks.forEach((week, weekIndex) => { write(row + weekIndex, column + 2, week.prescription); write(row + weekIndex, column + 3, week.instructions) })
  }))
  const source: CoachCycleDraftSource = jsonSnapshot({ format: 'unrack-generated-cycle-v1', intake, counts, blockIds, sheets })
  if (!isCoachCycleDraftSource(source) || !validStructure(intake, counts, sheets)) invalid()
  return { draftId, athleteId: target.athleteId, source, review: null, requiresReview: true, unitChanged: template.unit !== target.unit }
}
