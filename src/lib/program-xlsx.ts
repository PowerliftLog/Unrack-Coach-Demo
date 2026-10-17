import type { CoachAssignmentDayV4, CoachAssignmentDayV5, CoachAssignmentDayV6, CoachAssignmentDetailV4, CoachAssignmentDetailV5, CoachSetGroupV3, CoachSetGroupV5, RichProgramExercise, RichProgramSet } from './coach-api'

export type ExportDay = CoachAssignmentDayV4['day'] | CoachAssignmentDayV5['day'] | CoachAssignmentDayV6['day']
export type ProgramExportSheet = { name: string; rows: (string | number | null)[][] }
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const text = (value: string | number | null | undefined) => value == null ? '' : String(value)
const range = (minimum: number | null, maximum: number | null) => maximum == null ? text(minimum) : `${text(minimum)}–${maximum}`
const weekHeader = ['Date', 'Day', 'Status', 'Workout', 'Group', 'Exercise', 'Prescription', 'Load', 'Rest (sec)', 'Exercise note', 'Set note', 'Workout instruction']
const heading = (value: string | null | undefined, ordinal: number) => value && value !== weekdays[ordinal - 1] ? value : 'Workout'
const notes = (...values: (string | null | undefined)[]) => values.filter(Boolean).join(' · ')

function richPrescription(set: RichProgramSet) {
  const sets = set.sets_mode === 'range' ? range(set.sets_min, set.sets_max) : text(set.sets_min)
  const dose = set.dose_mode === 'amrap' ? 'AMRAP' : set.dose_mode === 'reps' && set.reps_mode === 'athlete_choice' ? 'athlete choice reps' : `${range(set.dose_min, set.dose_max)} ${set.dose_mode === 'reps' ? 'reps' : set.dose_mode === 'time' ? 'sec' : set.dose_mode === 'distance' ? set.distance_unit ?? 'distance' : 'steps'}`
  return `${sets} × ${dose}${set.laterality === 'bilateral' ? '' : ` · ${set.laterality.replaceAll('_', ' ')}`}`
}
function richLoad(set: RichProgramSet, defaultUnit: 'lb' | 'kg') {
  const unit = set.unit_override ?? defaultUnit
  const mode = set.load_mode
  const load = mode === 'exact' ? `${text(set.exact_weight)} ${unit}` : mode === 'percent' ? `${text(set.percent)}% ${set.percent_basis_max_type ?? 'max'}${set.resolved_weight == null ? '' : ` · ${set.resolved_weight} ${unit} resolved`}${set.manual_override == null ? '' : ` · ${set.manual_override} ${unit} override`}` : mode === 'rpe' ? `RPE ${range(set.rpe_min, set.rpe_max)}` : mode === 'qualitative' ? `Effort ${set.qualitative ?? ''}` : mode
  return `${load}${set.load_basis === 'total' ? '' : ` · ${set.load_basis.replaceAll('_', ' ')}`}`
}
function legacyPrescription(set: CoachSetGroupV3 | CoachSetGroupV5) {
  const sets = set.sets_mode === 'range' ? range(set.sets_min, set.sets_max) : text(set.sets ?? set.sets_min)
  const reps = typeof set.reps === 'object' && set.reps ? set.reps.mode === 'range' ? range(set.reps.min, set.reps.max) : text(set.reps.value) : set.reps_mode === 'athlete_choice' ? 'athlete choice' : range(set.dose_min ?? (typeof set.reps === 'number' ? set.reps : null), set.dose_max)
  const dose = set.dose_mode === 'amrap' ? 'AMRAP' : `${reps} ${set.dose_mode === 'reps' ? 'reps' : set.dose_mode === 'time' ? 'sec' : set.dose_mode === 'distance' ? set.distance_unit ?? 'distance' : 'steps'}`
  return `${sets} × ${dose}${set.laterality === 'bilateral' ? '' : ` · ${set.laterality.replaceAll('_', ' ')}`}`
}
function legacyLoad(set: CoachSetGroupV3 | CoachSetGroupV5, defaultUnit: 'lb' | 'kg') {
  const unit = set.effective_unit ?? set.unit_override ?? defaultUnit
  const mode = set.load_mode ?? set.load_kind
  const load = mode === 'exact' ? `${text(set.exact_weight ?? set.load_value)} ${unit}` : mode === 'percent' ? `${text(set.percent ?? set.load_value)}% ${set.percent_basis_max_type ?? 'max'}${set.resolved_weight == null ? '' : ` · ${set.resolved_weight} ${unit} resolved`}${set.manual_override == null ? '' : ` · ${set.manual_override} ${unit} override`}` : mode === 'rpe' ? `RPE ${range(set.rpe_min, set.rpe_max)}` : mode === 'qualitative' ? `Effort ${text(set.qualitative ?? set.load_value)}` : mode
  return `${load}${set.load_basis === 'total' ? '' : ` · ${set.load_basis.replaceAll('_', ' ')}`}`
}

export function buildProgramExportSheets(detail: CoachAssignmentDetailV4 | CoachAssignmentDetailV5, days: ReadonlyMap<string, ExportDay>, athleteName: string): ProgramExportSheet[] {
  const summary: ProgramExportSheet = { name: 'Program', rows: [
    ['Program', detail.program_name], ['Athlete', athleteName], ['Program status', detail.program_status], ['Assignment status', detail.assignment_status], ['Weeks', detail.weeks.length], ['Default weight unit', detail.default_unit], [],
    ['Week', 'Date', 'Day', 'Status', 'Workout', 'Exercises', 'Set rows'],
  ] }
  const sheets = [summary]
  for (const week of detail.weeks) {
    const rows: ProgramExportSheet['rows'] = [[`Week ${week.week_ordinal}`, detail.program_name], [], weekHeader]
    for (const slot of week.days.slice().sort((a, b) => a.day_ordinal - b.day_ordinal)) {
      const dayName = 'system_weekday' in slot && typeof slot.system_weekday === 'string' ? slot.system_weekday : weekdays[slot.day_ordinal - 1] ?? `Day ${slot.day_ordinal}`
      const title = 'workout_title' in slot && typeof slot.workout_title === 'string' ? slot.workout_title : heading(slot.label, slot.day_ordinal)
      summary.rows.push([week.week_ordinal, slot.planned_date, dayName, slot.status, slot.status === 'workout' ? title : slot.label ?? '', slot.exercise_count, slot.set_row_count])
      const prefix = [slot.planned_date, dayName, slot.status, slot.status === 'workout' ? title : slot.label ?? '']
      const day = slot.day_identity_token ? days.get(slot.day_identity_token) : undefined
      if (slot.day_identity_token && !day) throw new Error('A scheduled day was missing from the Excel export.')
      if (!day || day.mode === 'legacy_oversize') { rows.push([...prefix, '', '', day?.mode === 'legacy_oversize' ? 'View-only legacy day; detailed sets unavailable' : '', '', '', '', '', '']); continue }
      const content = day.content
      const instruction = notes(content.subtitle, content.workout_instruction)
      let wroteExercise = false
      const addRich = (exercise: RichProgramExercise, group: string) => {
        wroteExercise = true
        if (!exercise.set_groups.length) rows.push([...prefix, group, exercise.name, exercise.status === 'not_programmed' ? 'Not programmed' : '', '', '', notes(exercise.instruction, exercise.note, exercise.protocol), '', instruction])
        for (const set of exercise.set_groups) rows.push([...prefix, group, exercise.name, richPrescription(set), richLoad(set, detail.default_unit), set.rest_seconds, notes(exercise.instruction, exercise.note, exercise.protocol), set.note ?? '', instruction])
      }
      if ('movement_groups' in content) {
        for (const group of content.movement_groups) for (const exercise of group.exercises) addRich(exercise, `${group.group_type} ${group.ordinal}${group.title ? ` · ${group.title}` : ''}${group.rounds_min == null ? '' : ` · ${range(group.rounds_min, group.rounds_max)} rounds`}`)
        for (const exercise of content.ungrouped_exercises) addRich(exercise, '')
      } else {
        for (const exercise of content.exercises) {
          wroteExercise = true
          if (!exercise.set_groups.length) rows.push([...prefix, '', exercise.name, '', '', '', notes(exercise.note, exercise.protocol), '', instruction])
          for (const set of exercise.set_groups) rows.push([...prefix, '', exercise.name, legacyPrescription(set), legacyLoad(set, detail.default_unit), set.rest_seconds, notes(exercise.note, exercise.protocol), set.note ?? '', instruction])
        }
      }
      if (!wroteExercise) rows.push([...prefix, '', '', content.marked_rest ? 'Rest day' : '', '', '', '', '', instruction])
    }
    sheets.push({ name: `Week ${week.week_ordinal}`, rows })
  }
  return sheets
}

type XlsxRuntime = { utils: { aoa_to_sheet(rows: ProgramExportSheet['rows']): unknown; book_new(): unknown; book_append_sheet(book: unknown, sheet: unknown, name: string): void }; writeFile(book: unknown, fileName: string): void }
export function downloadProgramXlsx(sheets: ProgramExportSheet[], programName: string) {
  const xlsx = (window as Window & { XLSX?: XlsxRuntime }).XLSX
  if (!xlsx) throw new Error('Excel export is unavailable. Reload the coach app and try again.')
  const book = xlsx.utils.book_new()
  for (const sheet of sheets) {
    const worksheet = xlsx.utils.aoa_to_sheet(sheet.rows) as { '!cols'?: { wch: number }[] }
    worksheet['!cols'] = sheet.name === 'Program' ? [{ wch: 20 }, { wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 16 }] : [14, 14, 16, 28, 24, 28, 24, 32, 14, 32, 32, 36].map(wch => ({ wch }))
    xlsx.utils.book_append_sheet(book, worksheet, sheet.name)
  }
  const safeName = programName.normalize('NFKC').replace(/[^\p{L}\p{N}._ -]/gu, '').trim().slice(0, 80) || 'Workout Program'
  xlsx.writeFile(book, `${safeName}.xlsx`)
}
