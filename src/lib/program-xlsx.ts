import type { CoachAssignmentDayV4, CoachAssignmentDayV5, CoachAssignmentDayV6, CoachAssignmentDetailV4, CoachAssignmentDetailV5, CoachSetGroupV3, CoachSetGroupV5, RichProgramSet } from './coach-api'

export type ExportDay = CoachAssignmentDayV4['day'] | CoachAssignmentDayV5['day'] | CoachAssignmentDayV6['day']
type Value = string | number | null
export type ProgramExportSheet = { name: string; rows: Value[][]; widths: number[]; headers: number[]; separators: number[]; inputCells: [number, number][]; merges: [number, number, number, number][]; freezeRows: number }
type Set = RichProgramSet | CoachSetGroupV3 | CoachSetGroupV5
type Exercise = { name: string; notes: string; sets: Set[] }
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const effort = { L: 'Light', M: 'Moderate', MH: 'Moderately heavy', H: 'Heavy' }
const text = (v: string | number | null | undefined) => v == null ? '' : String(v)
// A4 landscape pages cannot print an arbitrarily tall spreadsheet row. Twelve
// wrapped lines stay well below one page, including the repeated Cycle header.
const maxPrintableLines = 12
// Excel column widths are based on the default digit glyph. Arial W can take
// nearly twice that space in LibreOffice, so budget half the nominal width.
const printableLineWidth = (width: number) => Math.max(8, Math.floor(width * 0.5))
const printedLines = (value: Value, width: number) => text(value).split('\n').reduce(
  (sum, line) => sum + Math.max(1, Math.ceil(line.length / printableLineWidth(width))), 0)
function printableChunks(value: Value, width: number, linesPerChunk = maxPrintableLines - 4): Value[] {
  if (typeof value !== 'string' || printedLines(value, width) <= maxPrintableLines) return [value]
  const lineWidth = printableLineWidth(width)
  const parts: string[] = []
  for (const line of value.match(/[^\n]*\n|[^\n]+$/g) ?? ['']) {
    let remaining = line
    while (remaining.length > lineWidth) {
      const space = remaining.lastIndexOf(' ', lineWidth - 1)
      let cut = space > lineWidth / 2 ? space + 1 : lineWidth
      // XLSX writes each chunk as an independent string. Never leave half of
      // a UTF-16 surrogate pair in either cell (Excel would replace it).
      if (cut < remaining.length && cut > 0 && /[\uD800-\uDBFF]/.test(remaining[cut - 1])
        && /[\uDC00-\uDFFF]/.test(remaining[cut])) cut--
      parts.push(remaining.slice(0, cut))
      remaining = remaining.slice(cut)
    }
    if (remaining) parts.push(remaining)
  }
  const chunks: string[] = []
  // Prescription continuations need more room for the week/exercise identity.
  for (let i = 0; i < parts.length; i += linesPerChunk) chunks.push(parts.slice(i, i + linesPerChunk).join(''))
  return chunks
}
const range = (min: number | null, max: number | null) => max == null || min === max ? text(min) : `${text(min)}–${max}`
const notes = (...values: (string | null | undefined)[]) => values.filter(Boolean).join('\n')
const setCount = (s: Set) => 'sets' in s ? s.sets ?? s.sets_min : s.sets_min
const loadMode = (s: Set) => s.load_mode ?? ('load_kind' in s ? s.load_kind : 'none')
const unitFor = (s: Set, unit: 'lb' | 'kg') => ('effective_unit' in s ? s.effective_unit : null) ?? s.unit_override ?? unit

function prescription(s: Set, unit: 'lb' | 'kg', count = setCount(s)) {
  const sets = s.sets_mode === 'range' ? range(s.sets_min, s.sets_max) : text(count)
  const legacyReps = 'reps' in s ? s.reps : null
  const min = legacyReps && typeof legacyReps === 'object' ? legacyReps.mode === 'range' ? legacyReps.min : legacyReps.value : typeof legacyReps === 'number' ? legacyReps : s.dose_min
  const max = legacyReps && typeof legacyReps === 'object' ? legacyReps.mode === 'range' ? legacyReps.max : null : s.dose_max
  const reps = s.reps_mode === 'athlete_choice' ? 'your choice' : range(min, max)
  const dose = s.dose_mode === 'amrap' ? 'AMRAP' : s.dose_mode === 'reps' ? reps : `${range(s.dose_min, s.dose_max)} ${s.dose_mode === 'time' ? 'sec' : s.dose_mode === 'distance' ? s.distance_unit ?? 'distance' : 'steps'}`
  const mode = loadMode(s), weightUnit = unitFor(s, unit)
  const legacyLoad = 'load_value' in s ? s.load_value : null
  const qualitative = s.qualitative ?? (typeof legacyLoad === 'string' ? legacyLoad : null)
  const load = mode === 'exact' ? `${text(s.exact_weight ?? legacyLoad)} ${weightUnit}`
    : mode === 'qualitative' ? qualitative && qualitative in effort ? effort[qualitative as keyof typeof effort] : text(qualitative)
    : mode === 'bodyweight' ? 'BW' : mode === 'none' ? '' : mode === 'tbd' ? 'TBD'
    : mode === 'rpe' ? `RPE ${range(s.rpe_min, s.rpe_max)}`
    : `${text(s.percent ?? legacyLoad)}% ${s.percent_basis_max_type === 'training_max' ? 'training max' : s.percent_basis_max_type === 'tested_1rm' ? 'tested 1RM' : 'max'}${s.resolved_weight == null ? '' : ` (${s.resolved_weight} ${weightUnit} resolved)`}${s.manual_override == null ? '' : ` (${s.manual_override} ${weightUnit} override)`}`
  return `${sets}x${dose}${load ? ` @ ${load}` : ''}${s.laterality === 'each_side' ? ' · each side' : s.laterality === 'alternating' ? ' · alternating' : ''}${s.load_basis === 'per_hand' ? ' · per hand' : s.load_basis === 'added_to_bodyweight' ? ' · added to bodyweight' : ''}${mode !== 'rpe' && s.rpe_min != null ? ` · RPE ${range(s.rpe_min, s.rpe_max)}` : ''}${s.rest_seconds == null ? '' : ` · rest ${s.rest_seconds} sec`}`
}

// Only adjacent, otherwise identical exact-count prescriptions can be combined.
function prescriptions(sets: Set[], unit: 'lb' | 'kg') {
  const compact: { set: Set; count: number; signature: string }[] = []
  for (const set of sets) {
    const signature = `${prescription(set, unit, 1)}\n${set.note ?? ''}`
    const prior = compact.at(-1)
    if (prior && set.sets_mode === 'exact' && prior.set.sets_mode === 'exact' && prior.signature === signature) prior.count += setCount(set)
    else compact.push({ set, count: setCount(set), signature })
  }
  return compact.map(item => prescription(item.set, unit, item.count)).join(', ')
}

function exercises(day: ExportDay | undefined): Exercise[] {
  if (!day) return []
  if (day.mode === 'legacy_oversize') throw new Error('A view-only legacy workout cannot be fully exported. Its detailed prescriptions are unavailable.')
  const content = day.content
  const result: Exercise[] = []
  const add = (e: { name: string; note: string | null; protocol: string | null; instruction?: string | null; set_groups: Set[]; status?: string }, group = '') => {
    result.push({ name: e.name, sets: e.set_groups, notes: notes(group, e.instruction, e.note, e.protocol, e.status === 'not_programmed' ? 'Not programmed' : null, ...e.set_groups.map((s, i) => s.note ? `Prescription ${i + 1}: ${s.note}` : null)) })
  }
  if ('movement_groups' in content) {
    for (const g of content.movement_groups) for (const e of g.exercises) add(e, notes(g.group_type === 'sequence' ? g.title : `${g.group_type === 'superset' ? 'Superset' : 'Circuit'} ${g.ordinal}${g.title ? `: ${g.title}` : ''}${g.rounds_min == null ? '' : ` · ${range(g.rounds_min, g.rounds_max)} rounds`}`))
    for (const e of content.ungrouped_exercises) add(e)
  } else for (const e of content.exercises) add(e)
  return result
}
function blankSheet(name: string, widths: number[]): ProgramExportSheet {
  return { name, rows: [], widths, headers: [], separators: [], inputCells: [], merges: [], freezeRows: 3 }
}

export function buildProgramExportSheets(detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5, days: ReadonlyMap<string, ExportDay>, athleteName: string): ProgramExportSheet[] {
  const weeks = detail.weeks.slice().sort((a, b) => a.week_ordinal - b.week_ordinal)
  const slots = weeks.flatMap(w => w.days.map(slot => {
    const day = slot.day_identity_token ? days.get(slot.day_identity_token) : undefined
    if (slot.day_identity_token && !day) throw new Error('A scheduled day was missing from the Excel export.')
    return { week: w.week_ordinal, slot, day, exercises: exercises(day) }
  }))
  const sheets: ProgramExportSheet[] = []
  const title = `${athleteName} — ${detail.program_name}`
  const calendarDate = (offset: number) => {
    if (!detail.calendar?.start_on) return null
    const date = new Date(`${detail.calendar.start_on}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
  }
  for (let start = 0; start < weeks.length; start += 4) {
    const block = weeks.slice(start, start + 4)
    const selected = slots.filter(s => block.some(w => w.week_ordinal === s.week))
    const lanes = [...new Set(selected.filter(s => s.exercises.length > 0).map(s => s.slot.day_ordinal))].sort((a, b) => a - b)
    if (!lanes.length) continue
    const sheet = blankSheet(`Cycle ${Math.floor(start / 4) + 1}`, lanes.flatMap(() => [39, 25, 29]))
    const count = lanes.length * 3
    const height = Math.max(...selected.map(s => s.exercises.length))
    const prepared = lanes.map((ordinal, lane) => {
      const col = lane * 3, scheduled = selected.filter(s => s.slot.day_ordinal === ordinal)
      const titles = [...new Set(scheduled.filter(s => s.exercises.length).map(s => s.day?.mode === 'editable' ? s.day.content.subtitle : null).filter(Boolean))]
      const exercises = Array.from({ length: height }, (_, index) => {
        const names = [...new Set(scheduled.map(s => s.exercises[index]?.name).filter(Boolean))]
        const weeks = block.map(week => {
          const entry = scheduled.find(s => s.week === week.week_ordinal), exercise = entry?.exercises[index]
          if (!exercise) return { prescription: `W${week.week_ordinal} —`, note: null, name: names.join(' / '), hasExercise: false }
          const content = entry!.day?.mode === 'editable' ? entry!.day.content : null
          return {
            prescription: `W${entry!.week} ${names.length > 1 ? `${exercise.name}: ` : ''}${exercise.sets.length ? prescriptions(exercise.sets, detail.default_unit) : 'Not programmed'}`,
            note: notes(index === 0 ? content?.workout_instruction : null, index === 0 && titles.length > 1 ? content?.subtitle : null, exercise.notes) || null,
            name: exercise.name,
            hasExercise: true,
          }
        })
        return { names, weeks }
      })
      return { col, ordinal, titles, exercises }
    })
    const rowHeights = Array.from({ length: height }, (_, index) => block.map((_, weekIndex) => Math.max(1,
      ...prepared.map(lane => {
        const item = lane.exercises[index].weeks[weekIndex]
        return Math.max(printableChunks(item.prescription, sheet.widths[lane.col], 4).length,
          printableChunks(item.note, sheet.widths[lane.col + 2]).length)
      }))))
    const blockStarts: number[] = []
    let nextRow = 3
    for (const heights of rowHeights) { blockStarts.push(nextRow); nextRow += 2 + heights.reduce((a, b) => a + b, 0) }
    sheet.rows = Array.from({ length: nextRow }, () => Array<Value>(count).fill(null))
    sheet.rows[0][0] = title
    const dates = selected.map(s => s.slot.planned_date).filter((date): date is string => !!date).sort()
    sheet.rows[1][0] = `${calendarDate((block[0].week_ordinal - 1) * 7) ?? dates[0] ?? ''} – ${calendarDate(block.at(-1)!.week_ordinal * 7 - 1) ?? dates.at(-1) ?? ''}     Weeks ${block[0].week_ordinal}–${block.at(-1)!.week_ordinal}     Weights in ${detail.default_unit} unless shown otherwise`
    sheet.merges = [[0, 0, 0, count - 1], [1, 0, 1, count - 1]]
    sheet.headers = [0, 2]
    prepared.forEach(lane => {
      const { col, ordinal, titles } = lane
      sheet.rows[2][col] = `${weekdays[ordinal - 1] ?? `Day ${ordinal}`}${titles.length === 1 ? `\n${titles[0]}` : ''}`
      sheet.rows[2][col + 1] = 'Weight Tracking / Notes'; sheet.rows[2][col + 2] = 'Coach Notes'
      for (let index = 0; index < lane.exercises.length; index++) {
        const row = blockStarts[index], { names, weeks } = lane.exercises[index]
        if (!names.length) continue
        sheet.rows[row][col] = names.join(' / ')
        sheet.headers.push(row)
        for (let weekIndex = 0; weekIndex < block.length; weekIndex++) {
          const r = row + 1 + rowHeights[index].slice(0, weekIndex).reduce((a, b) => a + b, 0)
          const item = weeks[weekIndex]
          const prescriptionParts = printableChunks(item.prescription, sheet.widths[col], 4)
          const noteParts = printableChunks(item.note, sheet.widths[col + 2])
          for (let part = 0; part < rowHeights[index][weekIndex]; part++) {
            if (part < prescriptionParts.length) sheet.rows[r + part][col] = part === 0
              ? prescriptionParts[part] : `W${block[weekIndex].week_ordinal} ${item.name} (continued): ${prescriptionParts[part]}`
            else if (part < noteParts.length && item.hasExercise) sheet.rows[r + part][col] = `W${block[weekIndex].week_ordinal} ${item.name} (continued)`
            if (part < noteParts.length) sheet.rows[r + part][col + 2] = noteParts[part]
          }
          if (item.hasExercise) sheet.inputCells.push([r, col + 1])
        }
        sheet.separators.push(row + 1 + rowHeights[index].reduce((a, b) => a + b, 0))
      }
    })
    sheet.headers = [...new Set(sheet.headers)]; sheet.separators = [...new Set(sheet.separators)]
    sheets.push(sheet)
  }
  const activeDays = [...new Set(slots.filter(s => s.exercises.length).map(s => s.slot.day_ordinal))].sort((a, b) => a - b)
  const overview = blankSheet('Program Overview', [22, ...activeDays.map(() => 18), 12, 12])
  const lastCol = overview.widths.length - 1
  const allDates = slots.map(s => s.slot.planned_date).filter((d): d is string => !!d).sort()
  overview.rows = [[title], [allDates.length ? `${calendarDate(0) ?? allDates[0]} – ${calendarDate((weeks.at(-1)?.week_ordinal ?? 1) * 7 - 1) ?? allDates.at(-1)}` : ''], [],
    ['Schedule', activeDays.map(d => weekdays[d - 1] ?? `Day ${d}`).join(', ')],
    ['Using this workbook', 'Each Cycle sheet contains up to four weeks. Record actual weights, reps or comments in the shaded Weight Tracking / Notes cells.'],
    ['Prescriptions', 'W labels identify program weeks. Comma-separated entries are successive prescriptions.'],
    ['Bodyweight', 'BW means bodyweight.'],
    ['Effort', 'Light, Moderate, Moderately heavy and Heavy are the effort cues saved in your program.'], [],
    ['Week', ...activeDays.map(d => weekdays[d - 1] ?? `Day ${d}`), 'Workouts', 'Sets']]
  overview.merges = [[0, 0, 0, lastCol], [1, 0, 1, lastCol], ...[3, 4, 5, 6, 7].map(r => [r, 1, r, lastCol] as [number, number, number, number])]
  overview.headers = [0, 9]; overview.freezeRows = 10
  let minimum = 0, maximum = 0
  for (const week of weeks) {
    const entries = slots.filter(s => s.week === week.week_ordinal)
    let min = 0, max = 0
    for (const entry of entries) for (const e of entry.exercises) for (const set of e.sets) { min += setCount(set); max += set.sets_mode === 'range' ? set.sets_max ?? setCount(set) : setCount(set) }
    minimum += min; maximum += max
    overview.rows.push([week.week_ordinal, ...activeDays.map(d => entries.find(s => s.slot.day_ordinal === d && s.exercises.length)?.slot.planned_date ?? '—'), entries.filter(s => s.exercises.length).length, min === max ? min : `${min}–${max}`])
  }
  overview.rows.push(['Total', ...activeDays.map(() => null), slots.filter(s => s.exercises.length).length, minimum === maximum ? minimum : `${minimum}–${maximum}`])
  overview.headers.push(overview.rows.length - 1)
  // An empty day can still carry a coach's calendar note; retain it outside training lanes.
  for (const entry of slots) if (!entry.exercises.length && entry.day?.mode === 'editable') {
    const content = entry.day.content, note = notes(content.subtitle, content.workout_instruction)
    if (note) overview.rows.push([`W${entry.week} ${weekdays[entry.slot.day_ordinal - 1]}`, note])
  }
  sheets.push(overview)
  return sheets
}

/** Lazy-loaded: the workbook writer is downloaded only when Excel export is used. */
export async function programXlsxBuffer(sheets: ProgramExportSheet[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs')
  const book = new ExcelJS.Workbook()
  book.creator = 'UNRACK'; book.views = [{ activeTab: 0, firstSheet: 0, visibility: 'visible', x: 0, y: 0, width: 1200, height: 800 }]
  for (const sheet of sheets) {
    const ws = book.addWorksheet(sheet.name, { properties: { tabColor: { argb: 'FF4A86E8' } }, views: [{ state: 'frozen', ySplit: sheet.freezeRows, showGridLines: false }] })
    ws.columns = sheet.widths.map(width => ({ width }))
    sheet.rows.forEach((values, r) => {
      const row = ws.getRow(r + 1)
      values.forEach((value, c) => {
        const cell = row.getCell(c + 1)
        if (typeof value === 'string' && value.length > 32767) throw new Error('A workout note is too long for an Excel cell. Shorten the note and export again.')
        cell.value = value // Text values remain text, including names beginning with =, +, -, or @.
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF111111' } }
        cell.alignment = { vertical: 'middle', wrapText: true }
        if (sheet.name !== 'Program Overview' && r >= 3) cell.border = { top: { style: 'thin', color: { argb: 'FFA6A6A6' } }, bottom: { style: 'thin', color: { argb: 'FFA6A6A6' } }, left: { style: 'thin', color: { argb: 'FFA6A6A6' } }, right: { style: 'thin', color: { argb: 'FFA6A6A6' } } }
      })
      const lines = Math.max(1, ...values.map((value, c) => printedLines(value, sheet.widths[c])))
      row.height = Math.max(24, lines * 15 + 8)
    })
    for (const [r1, c1, r2, c2] of sheet.merges) ws.mergeCells(r1 + 1, c1 + 1, r2 + 1, c2 + 1)
    for (const r of sheet.headers) {
      const row = ws.getRow(r + 1)
      for (let c = 1; c <= sheet.widths.length; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9DAF8' } }
        row.getCell(c).font = { name: 'Arial', size: r === 0 ? 15 : 10, bold: true }
      }
      row.height = Math.max(r === 0 ? 30 : 25, r === 0 ? 30 : row.height ?? 25)
    }
    // Merged titles and help text use their combined width when fitting rows.
    for (const [r1, c1, , c2] of sheet.merges) {
      const width = sheet.widths.slice(c1, c2 + 1).reduce((a, b) => a + b, 0)
      const lines = text(sheet.rows[r1]?.[c1]).split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / width)), 0)
      ws.getRow(r1 + 1).height = Math.max(r1 === 0 ? 30 : 25, lines * 15 + 8)
    }
    for (const r of sheet.separators) {
      const row = ws.getRow(r + 1); row.height = 10
      for (let c = 1; c <= sheet.widths.length; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A86E8' } }
    }
    for (const [r, c] of sheet.inputCells) ws.getCell(r + 1, c + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F7FD' } }
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, ...(sheet.name.startsWith('Cycle ') ? { printTitlesRow: '1:3' } : {}) }
  }
  return await book.xlsx.writeBuffer() as ArrayBuffer
}

export async function downloadProgramXlsx(sheets: ProgramExportSheet[], programName: string, isCurrent: () => boolean = () => true) {
  const buffer = await programXlsxBuffer(sheets)
  if (!isCurrent()) throw new Error('The program changed while exporting. Refresh the program and export again.')
  const safeName = programName.normalize('NFKC').replace(/[^\p{L}\p{N}._ -]/gu, '').trim().slice(0, 80) || 'Workout Program'
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a'); link.href = url; link.download = `${safeName}.xlsx`
  document.body.appendChild(link)
  try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
