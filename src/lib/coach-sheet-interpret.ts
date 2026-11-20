/** Semantic parsing only: this module does not grant publication or resolve athlete maxes. */
export const COACH_SHEET_PARSER_VERSION = 'coach-sheet-prescription/1' as const

/** Coach effort cue spellings (case-insensitive) → stored L/M/MH/H codes. */
const EFFORT_CUE_PATTERN = String.raw`(?:medium[\s-]*heavy|med[\s-]*heavy|med[\s-]*hvy|m\s*[-/]\s*h|mh|light|lite|lt|medium|med|heavy|hvy|l|m|h)`
export function coachEffortCue(text: string): 'L' | 'M' | 'MH' | 'H' | null {
  const value = text.trim().toLowerCase().replace(/[\s/-]+/g, '')
  if (['l', 'light', 'lite', 'lt'].includes(value)) return 'L'
  if (['m', 'med', 'medium'].includes(value)) return 'M'
  if (['mh', 'medheavy', 'medhvy', 'mediumheavy'].includes(value)) return 'MH'
  if (['h', 'heavy', 'hvy'].includes(value)) return 'H'
  return null
}

export type CoachWeightUnit = 'lb' | 'kg'
export type CoachSheetSource = { sheetId: string; address: string; cellId?: string }
export type CoachSheetText = { source: CoachSheetSource; text: string }
export type CoachSheetIssueCode =
  | 'blank_prescription' | 'unsupported_expression' | 'invalid_number' | 'invalid_range'
  | 'invalid_rpe' | 'contradictory_modifiers' | 'ambiguous_chain' | 'ambiguous_numeric_rpe'
  | 'duration_shorthand_review_required' | 'laterality_review_required' | 'measure_range_unsupported'
  | 'percentage_resolution_required' | 'invalid_cycle' | 'duplicate_identity' | 'missing_exercise_name'
  | 'missing_week' | 'duplicate_week' | 'unexpected_week' | 'invalid_source' | 'source_collision'
  | 'unaccounted_cell' | 'source_value_mismatch' | 'missing_source_cell' | 'invalid_instructions' | 'destination_limit'
export type CoachSheetIssue = {
  code: CoachSheetIssueCode
  severity: 'blocking'
  message: string
  source?: CoachSheetSource
  start?: number
  end?: number
  position?: number
}
export type CoachSheetDose =
  | { kind: 'reps'; min: number; max: number }
  | { kind: 'time'; value: number; unit: 'sec' | 'min' }
  | { kind: 'distance'; value: number; unit: 'm' | 'km' | 'ft' | 'yd' | 'mi' }
  /** As many reps as possible. `min` comes from `N+` and reaches the athlete as the set note "At least N reps". */
  | { kind: 'amrap'; min: number | null }
export type CoachSheetLoad =
  | { kind: 'optional' }
  | { kind: 'exact'; weight: number; unit: CoachWeightUnit; unitSource: 'cycle' | 'explicit' }
  | { kind: 'qualitative'; value: 'L' | 'M' | 'MH' | 'H' }
  | { kind: 'percentage'; percent: number }
  | { kind: 'none' }
  | { kind: 'bodyweight' }
export type CoachSheetSetGroup = {
  position: number
  count: number
  dose: CoachSheetDose
  load: CoachSheetLoad
  rpe?: { min: number; max: number }
  laterality: 'unspecified' | 'each_side'
  /** Exact substring and UTF-16 offsets into the untouched prescription cell. */
  raw: string
  start: number
  end: number
  source?: CoachSheetSource
}
export type CoachPrescriptionParse = {
  parserVersion: typeof COACH_SHEET_PARSER_VERSION
  raw: string
  status: 'parsed' | 'skipped' | 'blocked'
  /** Fully understood groups only. A known percentage retains groups but blocks resolution. */
  groups: CoachSheetSetGroup[]
  issues: CoachSheetIssue[]
  /** Exact dependency token, deliberately not a collision-prone hash or publication credential. */
  reviewKey: string
}

type ParserOptions = { defaultUnit: CoachWeightUnit; source?: CoachSheetSource }
type Failure = { code: CoachSheetIssueCode; message: string; start: number; end: number }
type ParsedGroup = { group: CoachSheetSetGroup; explicitCount: boolean; bare: boolean }
const numberPattern = '(?:\\d+(?:\\.\\d+)?)'
/** Per-side spellings (Joe, Nov 17): each side/leg/arm, per side/leg/arm, each, ea, ea., /side, /leg, /arm, /ea. */
const SIDE_PATTERN = String.raw`(?:each|per)\s+(?:side|leg|arm)|each|ea\.?|\/\s*(?:side|leg|arm|ea)`
const sidePattern = new RegExp(`^(?:${SIDE_PATTERN})$`, 'i')
const measurePattern = /^(seconds?|secs?|s|minutes?|mins?|min|kilomet(?:er|re)s?|km|met(?:er|re)s?|m|feet|foot|ft|yards?|yd|miles?|mi)(?![a-z])/i
const weightPattern = /^(lbs?|kgs?|kilograms?|pounds?)(?![a-z])/i
/** AMRAP spellings (Joe, Nov 17): AMRAP, max reps, fail, failure, to failure, and N+ (at least N). */
const amrapPattern = /^(?:amrap|max\s+reps|to\s+failure|failure|fail|(\d+)\+(?:\s*reps?)?)(?![A-Za-z0-9_])/i
/** Set note for an `N+` AMRAP set; shared with the server publish parser. */
export const amrapMinimumNote = (min: number): string => `At least ${min} reps`

export function amrapMinimumFromNote(note: unknown): number | null {
  if (typeof note !== 'string') return null
  const minimum = Number(/^At least ([0-9]{1,4}) reps$/.exec(note)?.[1])
  return minimum >= 1 && minimum <= 1000 && note === amrapMinimumNote(minimum) ? minimum : null
}

function finite(value: string, allowZero = false): number | null {
  const number = Number(value)
  // Comparing decimal spellings catches significant-digit loss such as 9007199254740991.1.
  const decimal = (text: string): string => {
    const [mantissa, exponent] = text.toLowerCase().split('e')
    const [whole, fraction = ''] = mantissa.split('.')
    const digits = whole + fraction
    const point = whole.length + Number(exponent ?? 0)
    const expanded = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`
    const [integer, decimals = ''] = expanded.split('.')
    const trimmed = decimals.replace(/0+$/, '')
    return `${integer.replace(/^0+(?=\d)/, '')}${trimmed ? `.${trimmed}` : ''}`
  }
  return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER && (allowZero ? number >= 0 : number > 0) && decimal(value) === decimal(String(number)) ? number : null
}

function range(minimum: string, maximum?: string): { min: number; max: number } | null {
  const min = finite(minimum)
  const max = finite(maximum ?? minimum)
  return min !== null && max !== null && min <= max ? { min, max } : null
}

function weightUnit(value: string): CoachWeightUnit {
  return /^(?:k|kilogram)/i.test(value) ? 'kg' : 'lb'
}

function measureUnit(value: string): 'sec' | 'min' | 'm' | 'km' | 'ft' | 'yd' | 'mi' {
  if (/^(?:s|sec|second)/i.test(value)) return 'sec'
  if (/^(?:min|minute)/i.test(value)) return 'min'
  if (/^(?:km|kilomet)/i.test(value)) return 'km'
  if (/^(?:ft|feet|foot)/i.test(value)) return 'ft'
  if (/^(?:yd|yard)/i.test(value)) return 'yd'
  if (/^(?:mi|mile)/i.test(value)) return 'mi'
  return 'm'
}

/**
 * Accepts complete ordered sets/reps expressions, explicit loads, effort, RPE and exact measures.
 * Separators are whitespace, comma, semicolon or newline. Bare single values need a comma/newline
 * when chained, so `3x5 225` cannot silently turn a possible weight into a second rep group.
 * `SKIP` is the sole whole-cell skip marker. Unknown text invalidates the entire cell.
 */
export function parseCoachPrescription(raw: string, options: ParserOptions): CoachPrescriptionParse {
  const reviewKey = JSON.stringify([COACH_SHEET_PARSER_VERSION, options.defaultUnit, options.source ?? null, raw])
  const base = { parserVersion: COACH_SHEET_PARSER_VERSION, raw, reviewKey }
  const issue = (failure: Failure, position?: number): CoachSheetIssue => ({ ...failure, severity: 'blocking', ...(options.source ? { source: { ...options.source } } : {}), ...(position ? { position } : {}) })
  const fail = (code: CoachSheetIssueCode, message: string, start = 0, end = raw.length): CoachPrescriptionParse => ({ ...base, status: 'blocked', groups: [], issues: [issue({ code, message, start, end })] })
  if (options.defaultUnit !== 'lb' && options.defaultUnit !== 'kg') return fail('invalid_cycle', 'Choose a cycle weight unit before interpreting prescriptions.')
  if (!raw.trim()) return fail('blank_prescription', 'Enter a prescription or write SKIP for this exercise and week.')
  if (/^skip$/i.test(raw.trim())) return { ...base, status: 'skipped', groups: [], issues: [] }
  if (/(?:^|\s|[x×]):\d/i.test(raw)) return fail('duration_shorthand_review_required', 'Colon duration shorthand needs an explicit duration and side scope. Write an exact dose such as 3x20 sec(no load) per side.')
  if (/\bboth\s+sides\b/i.test(raw)) return fail('laterality_review_required', 'Confirm whether the dose is per side or shared across both sides. Write per side when each side receives the stated dose.')

  let cursor = 0
  let failure: Failure | undefined
  const reject = (code: CoachSheetIssueCode, message: string, start: number, end = raw.length): null => {
    failure = { code, message, start, end }
    return null
  }
  const groups: CoachSheetSetGroup[] = []
  const details: ParsedGroup[] = []

  function parseGroup(position: number): ParsedGroup | null {
    const start = cursor
    let count = 1
    const countMatch = raw.slice(cursor).match(/^(\d+)\s*(?:sets?\s*(?:x|×|of)|[x×])\s*/i)
    if (countMatch) {
      const parsed = finite(countMatch[1])
      if (parsed === null || !Number.isSafeInteger(parsed)) return reject('invalid_number', 'Set counts must be positive safe whole numbers.', cursor)
      count = parsed
      cursor += countMatch[0].length
    }
    const amrapMatch = raw.slice(cursor).match(amrapPattern)
    const doseMatch = amrapMatch ? null : raw.slice(cursor).match(new RegExp(`^(${numberPattern})(?:\\s*[-–]\\s*(${numberPattern}))?`))
    let dose: CoachSheetDose
    if (amrapMatch) {
      const min = amrapMatch[1] === undefined ? null : finite(amrapMatch[1])
      if (amrapMatch[1] !== undefined && (min === null || !Number.isSafeInteger(min) || min > 1000)) return reject('invalid_number', 'An N+ set needs a whole number of reps from 1 to 1000.', cursor, cursor + amrapMatch[0].length)
      dose = { kind: 'amrap', min }
      cursor += amrapMatch[0].length
    } else {
    if (!doseMatch) return reject('unsupported_expression', 'Expected a set count and reps, or an exact time or distance. The whole cell must use supported syntax.', cursor)
    const bounds = range(doseMatch[1], doseMatch[2])
    if (!bounds) return reject('invalid_range', 'Dose values must be positive and ranges must run from lower to higher.', cursor, cursor + doseMatch[0].length)
    cursor += doseMatch[0].length
    const afterNumber = cursor
    const measureStart = cursor + (raw.slice(cursor).match(/^\s*/)?.[0].length ?? 0)
    const measureMatch = raw.slice(measureStart).match(measurePattern)
    if (measureMatch) {
      if (doseMatch[2]) return reject('measure_range_unsupported', 'Time and distance ranges need an explicit reviewed meaning. Enter an exact time or distance.', start, measureStart + measureMatch[0].length)
      const unit = measureUnit(measureMatch[1])
      if (measureMatch[1] === 'M') return reject('unsupported_expression', 'Uppercase M could mean qualitative effort or meters. Write (M) for effort or m/meters for distance.', measureStart, measureStart + 1)
      dose = unit === 'sec' || unit === 'min' ? { kind: 'time', value: bounds.min, unit } : { kind: 'distance', value: bounds.min, unit }
      cursor = measureStart + measureMatch[0].length
    } else {
      if (!Number.isSafeInteger(bounds.min) || !Number.isSafeInteger(bounds.max)) return reject('invalid_number', 'Reps must be positive safe whole numbers. Add a supported unit for a time or distance dose.', start, afterNumber)
      dose = { kind: 'reps', ...bounds }
      // "10 reps", "3 sets of 8-12 reps": the word is optional.
      const repsWord = raw.slice(cursor).match(/^\s*reps?(?![a-z])/i)
      if (repsWord) cursor += repsWord[0].length
    }
    }

    let load: CoachSheetLoad = { kind: 'optional' }
    let rpe: { min: number; max: number } | undefined
    let laterality: CoachSheetSetGroup['laterality'] = 'unspecified'
    let end = cursor
    let hasModifier = false
    function setLoad(next: CoachSheetLoad, at: number): boolean {
      if (load.kind !== 'optional') { reject('contradictory_modifiers', 'Each set group may have only one load meaning. Separate different loads into ordered set groups.', at); return false }
      load = next
      return true
    }
    function setRpe(minimum: string, maximum: string | undefined, at: number): boolean {
      const min = finite(minimum, true)
      const max = finite(maximum ?? minimum, true)
      if (min === null || max === null || min < 1 || min > max || max > 10 || !/^\d+(?:\.\d)?$/.test(String(min)) || !/^\d+(?:\.\d)?$/.test(String(max))) { reject('invalid_rpe', 'RPE must be between 1 and 10 with at most one decimal place, with lower bound first.', at); return false }
      if (rpe) { reject('contradictory_modifiers', 'Each set group may have only one RPE or RPE range.', at); return false }
      rpe = { min, max }
      return true
    }
    function modifier(token: string, at: number, atSign = false): boolean {
      const text = token.trim()
      if (sidePattern.test(text)) {
        if (laterality !== 'unspecified') { reject('contradictory_modifiers', 'Specify the side scope only once.', at); return false }
        laterality = 'each_side'
        return true
      }
      const cue = coachEffortCue(text)
      if (cue) return setLoad({ kind: 'qualitative', value: cue }, at)
      if (/^(?:no[ -]load|none)$/i.test(text)) return setLoad({ kind: 'none' }, at)
      if (/^(?:body\s?weight|bw)$/i.test(text)) return setLoad({ kind: 'bodyweight' }, at)
      const effort = text.match(new RegExp(`^(?:RPE\\s*)?(${numberPattern})(?:\\s*[-–]\\s*(${numberPattern}))?$`, 'i'))
      // After @, a bare number over 10 is a weight in the cycle unit; 10 and under is RPE
      // (Joe, Nov 17). The sheet flags bare @ 1-5 and @ 10 as unclear.
      if (effort && atSign && !/^RPE/i.test(text) && effort[2] === undefined && (finite(effort[1], true) ?? 0) > 10)
        return setLoad({ kind: 'exact', weight: finite(effort[1], true)!, unit: options.defaultUnit, unitSource: 'cycle' }, at)
      if (effort && (atSign || /^RPE/i.test(text))) {
        if (!countMatch && dose.kind === 'reps' && dose.min >= 100) { reject('ambiguous_numeric_rpe', 'A large single value followed by RPE may mean reps or weight. Write an explicit set count for reps, or put a weight after a clear reps dose.', start); return false }
        return setRpe(effort[1], effort[2], at)
      }
      const percent = text.match(new RegExp(`^(${numberPattern})\\s*%$`))
      if (percent) {
        const value = finite(percent[1])
        if (value === null || value > 200) { reject('invalid_number', 'A percentage must be greater than 0 and at most 200.', at); return false }
        return setLoad({ kind: 'percentage', percent: value }, at)
      }
      const exact = text.match(new RegExp(`^(${numberPattern})(?:\\s*([a-z]+))?$`, 'i'))
      if (exact && (!atSign || exact[2])) {
        const value = finite(exact[1], true)
        const unit = exact[2]?.match(weightPattern)
        if (value === null || (exact[2] && (!unit || unit[0].length !== exact[2].length))) { reject('invalid_number', 'Use a finite nonnegative weight and lb or kg.', at); return false }
        return setLoad({ kind: 'exact', weight: value, unit: unit ? weightUnit(unit[1]) : options.defaultUnit, unitSource: unit ? 'explicit' : 'cycle' }, at)
      }
      reject('unsupported_expression', `Unsupported prescription modifier: ${text}. Keep coach instructions in their separate cell.`, at)
      return false
    }

    while (cursor < raw.length) {
      const next = cursor + (raw.slice(cursor).match(/^\s*/)?.[0].length ?? 0)
      const tail = raw.slice(next)
      let token: string | undefined
      let length = 0
      let atSign = false
      if (tail.startsWith('(')) {
        const close = tail.indexOf(')')
        if (close < 0 || tail.slice(1, close).includes('(')) return reject('unsupported_expression', 'Use one complete supported modifier inside each pair of parentheses.', next)
        token = tail.slice(1, close)
        length = close + 1
      } else if (tail.startsWith('@')) {
        // Coach effort cues read naturally after @ ("3x10 @ MH"); after @ the token is
        // always a load, so uppercase M is effort here, never meters.
        const match = tail.match(new RegExp(`^@\\s*((?:RPE\\s*)?${numberPattern}(?:\\s*[-–]\\s*${numberPattern})?(?:\\s*%|\\s*(?:lbs?|kgs?|pounds?|kilograms?))?|${EFFORT_CUE_PATTERN}(?![A-Za-z0-9]))`, 'i'))
        if (!match) return reject('unsupported_expression', 'After @, use an effort (L, M, MH, H or Light, Medium, Medium-heavy, Heavy), an RPE, a percentage, or a weight.', next)
        token = match[1]
        length = match[0].length
        atSign = true
      } else {
        const match = tail.match(new RegExp(`^((?:RPE\\s*${numberPattern}(?:\\s*[-–]\\s*${numberPattern})?)|(?:${numberPattern}\\s*(?:%|lbs?\\b|kgs?\\b|pounds?\\b|kilograms?\\b))|(?:no[ -]load|body\\s?weight|bw|none|MH|L|M|H)\\b|(?:${SIDE_PATTERN})(?![A-Za-z0-9_]))`, 'i'))
        if (match) { token = match[1]; length = match[0].length }
      }
      if (token === undefined) break
      if (!modifier(token, next, atSign)) return null
      hasModifier = true
      cursor = next + length
      end = cursor
    }
    return {
      group: { position, count, dose, load, ...(rpe ? { rpe } : {}), laterality, raw: raw.slice(start, end), start, end, ...(options.source ? { source: { ...options.source } } : {}) },
      explicitCount: Boolean(countMatch),
      // A count-less AMRAP is bare too: `3x5 to failure` needs a comma to read as a separate set.
      bare: !countMatch && !hasModifier && (dose.kind === 'reps' || dose.kind === 'amrap'),
    }
  }

  cursor = raw.match(/^\s*/)?.[0].length ?? 0
  let explicitSeparator = true
  while (cursor < raw.length) {
    const parsed = parseGroup(groups.length + 1)
    if (!parsed) return fail(failure!.code, failure!.message, failure!.start, failure!.end)
    const previous = details.at(-1)
    if (previous && !explicitSeparator && (previous.bare || parsed.bare)) return fail('ambiguous_chain', 'Separate bare rep groups with commas or write explicit set counts. A trailing number might otherwise be mistaken for a load.', parsed.group.start)
    groups.push(parsed.group)
    details.push(parsed)
    const gap = raw.slice(cursor).match(/^\s*/)?.[0] ?? ''
    cursor += gap.length
    if (cursor === raw.length) break
    explicitSeparator = /[\r\n]/.test(gap)
    if (raw[cursor] === ',' || raw[cursor] === ';') {
      explicitSeparator = true
      cursor++
      cursor += raw.slice(cursor).match(/^\s*/)?.[0].length ?? 0
      if (cursor === raw.length) return fail('unsupported_expression', 'A set-group separator must be followed by another complete set group.', cursor - 1)
    } else if (!gap) return fail('unsupported_expression', 'Separate ordered set groups with whitespace, commas, semicolons or newlines.', cursor)
  }
  const issues = groups.filter(group => group.load.kind === 'percentage').map(group => issue({ code: 'percentage_resolution_required', message: 'Choose a basis exercise and max type, then approve a current max and resolved load before publication.', start: group.start, end: group.end }, group.position))
  return { ...base, status: issues.length ? 'blocked' : 'parsed', groups, issues }
}

/** Display helper only. Does not erase the distinction between optional and explicitly absent weight. */
export function coachSheetWeightField(load: CoachSheetLoad): 'optional' | 'prescribed' | 'hidden' | 'unresolved' {
  if (load.kind === 'none' || load.kind === 'bodyweight') return 'hidden'
  if (load.kind === 'exact') return 'prescribed'
  if (load.kind === 'percentage') return 'unresolved'
  return 'optional'
}

/** Destination vocabulary only; a percent still needs resolution and is not publishable. */
export function coachSheetLoadMode(load: CoachSheetLoad): 'athlete_choice' | 'exact' | 'qualitative' | 'percent' | 'none' | 'bodyweight' {
  if (load.kind === 'optional') return 'athlete_choice'
  if (load.kind === 'percentage') return 'percent'
  return load.kind
}
