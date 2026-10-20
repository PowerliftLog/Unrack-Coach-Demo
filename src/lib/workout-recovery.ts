import type { RichProgramDay } from './coach-api'

export type WorkoutRecoveryScope = { principal: string; gym: string; athlete: string; assignment: string; program: string; week: string; day: string }
export type WorkoutRecoveryOperation = { commit(): void; abort(): void }
export type WorkoutRecoveryController = { begin(): WorkoutRecoveryOperation; capture(): () => void }
export type WorkoutRecoveryState = {
  draft: RichProgramDay
  exerciseKeys: string[]; sectionKeys: string[]
  expanded: Record<string, boolean>; repInputs: Record<string, string>; invalidReps: Record<string, string>
  loadInputs: Record<string, { raw: string; mode: 'exact' | 'percent' }>
  numberInputs: Record<string, { raw: string; invalid: boolean }>
  touched: Record<string, boolean>; submitted: boolean
  details: { group: number | null; exercise: number; set: number | null } | null; sectionDetails: number | null
}
type RecordV1 = { version: 1; scope: WorkoutRecoveryScope; epoch: string; writer: string; sequence: number; savedAt: number; revision: number; sourceFingerprint: string; state: WorkoutRecoveryState }
export type WorkoutRecoveryCandidate = { key: string; raw: string; record: RecordV1 }
export type WorkoutRecoveryListing = { candidates: WorkoutRecoveryCandidate[]; error: string | null }
export const WORKOUT_RECOVERY_PREFIX = 'unrack.workout-recovery:'
export const WORKOUT_RECOVERY_LIMITS = { recordCharacters: 131_072, totalCharacters: 1_000_000, records: 64, retentionMs: 30 * 24 * 60 * 60 * 1000, leaseMs: 60_000 }
const listeners = new Set<() => void>(), revoked = new Map<string, string>(), pending = new Map<string, Set<string>>()
const emit = () => listeners.forEach(listener => listener())
const id = () => typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
const subjectPrefix = (principal: string) => `${WORKOUT_RECOVERY_PREFIX}${encodeURIComponent(principal)}:`
const epochKey = (principal: string) => `${subjectPrefix(principal)}epoch`
const scopeKey = (scope: WorkoutRecoveryScope) => JSON.stringify([scope.principal, scope.gym, scope.athlete, scope.assignment, scope.program, scope.week, scope.day])
const recordPrefix = (scope: WorkoutRecoveryScope) => `${subjectPrefix(scope.principal)}record:${encodeURIComponent(scopeKey(scope))}:`
const leasePrefix = (key: string) => `${key.replace(':record:', ':pending:')}:`
const storage = () => window.localStorage
const usedCharacters = () => {
  let total = 0
  for (let n = 0; n < storage().length; n++) { const key = storage().key(n); if (key?.startsWith(WORKOUT_RECOVERY_PREFIX)) total += key.length + (storage().getItem(key)?.length ?? 0) }
  return total
}
const draftRecordCount = () => {
  let count = 0
  for (let n = 0; n < storage().length; n++) { const key = storage().key(n); if (key?.startsWith(WORKOUT_RECOVERY_PREFIX) && key.includes(':record:')) count++ }
  return count
}
const epoch = (principal: string) => {
  const persisted = storage().getItem(epochKey(principal)) ?? 'initial'
  const local = revoked.get(principal)
  if (local && local !== persisted) throw new Error('Device backup was disabled when you signed out.')
  return persisted
}
export function getWorkoutRecoveryEpoch(principal: string): string | null { try { return epoch(principal) } catch { return null } }
const scopeValid = (scope: WorkoutRecoveryScope) => ['principal', 'gym', 'athlete', 'assignment', 'program', 'week', 'day'].every(key => typeof scope[key as keyof WorkoutRecoveryScope] === 'string' && scope[key as keyof WorkoutRecoveryScope].length > 0 && scope[key as keyof WorkoutRecoveryScope].length <= 200)
export const workoutRecoveryFingerprint = (value: unknown): string => JSON.stringify(value, function (_key, item) { return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item })
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100_000_000
const nullableNumber = (value: unknown) => value === null || finite(value)
const text = (value: unknown, max = 10_000) => typeof value === 'string' && value.length <= max
const nullableText = (value: unknown) => value === null || text(value)
const oneOf = (value: unknown, choices: unknown[]) => choices.includes(value)
const index = (value: unknown, max: number) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < max
/** Structural checks deliberately allow incomplete/invalid authoring values; Save owns prescription validation. */
export function decodeWorkoutRecoveryState(value: unknown): WorkoutRecoveryState | null {
  if (!object(value) || !object(value.draft)) return null
  const day = value.draft
  if (!text(day.identity_token, 200) || !finite(day.ordinal) || !text(day.label) || !nullableText(day.subtitle) || !nullableText(day.workout_instruction) || typeof day.marked_rest !== 'boolean' || !Array.isArray(day.movement_groups) || day.movement_groups.length > 24 || !Array.isArray(day.ungrouped_exercises)) return null
  const exercises: Record<string, unknown>[] = []
  for (const group of day.movement_groups) {
    if (!object(group) || group.mode !== 'replace' || !finite(group.ordinal) || !oneOf(group.group_type, ['superset', 'circuit', 'sequence']) || !nullableText(group.title) || !nullableNumber(group.rounds_min) || !nullableNumber(group.rounds_max) || !Array.isArray(group.exercises)) return null
    if (['id', 'identity_token'].some(key => group[key] !== undefined && !nullableText(group[key]))) return null
    exercises.push(...group.exercises)
  }
  exercises.push(...day.ungrouped_exercises)
  if (exercises.length > 48) return null
  for (const exercise of exercises) {
    if (!object(exercise) || exercise.mode !== 'replace' || !finite(exercise.ordinal) || !nullableNumber(exercise.group_ordinal) || !oneOf(exercise.status, ['programmed', 'not_programmed']) || !text(exercise.name) || !['instruction', 'note', 'protocol'].every(key => nullableText(exercise[key])) || !Array.isArray(exercise.set_groups) || exercise.set_groups.length > 40) return null
    if (['id', 'identity_token', 'exercise_id'].some(key => exercise[key] !== undefined && !nullableText(exercise[key])) || exercise.track_in_metrics !== undefined && typeof exercise.track_in_metrics !== 'boolean') return null
    for (const row of exercise.set_groups) {
      if (!object(row) || row.mode !== 'replace' || !finite(row.ordinal) || !['sets_min', 'sets_max', 'dose_min', 'dose_max', 'exact_weight', 'percent', 'rpe_min', 'rpe_max', 'rest_seconds'].every(key => nullableNumber(row[key])) || !oneOf(row.sets_mode, ['exact', 'range']) || !oneOf(row.dose_mode, ['reps', 'time', 'steps', 'distance', 'amrap']) || !oneOf(row.reps_mode, ['exact', 'range', 'athlete_choice', null]) || !oneOf(row.distance_unit, ['m', 'km', 'ft', 'mi', null]) || !oneOf(row.laterality, ['bilateral', 'each_side', 'alternating']) || !oneOf(row.load_mode, ['exact', 'percent', 'rpe', 'qualitative', 'bodyweight', 'none', 'tbd']) || !oneOf(row.load_basis, ['total', 'added_to_bodyweight', 'per_hand']) || !nullableText(row.percent_basis_exercise_id) || !oneOf(row.percent_basis_max_type, ['tested_1rm', 'training_max', null]) || !oneOf(row.qualitative, ['L', 'M', 'MH', 'H', null]) || !oneOf(row.unit_override, ['lb', 'kg', null]) || !nullableText(row.note)) return null
      if (['manual_override', 'resolved_weight'].some(key => row[key] !== undefined && !nullableNumber(row[key])) || ['id', 'identity_token', 'of_max_id', 'resolved_max_effective_from', 'resolved_at'].some(key => row[key] !== undefined && !nullableText(row[key]))) return null
    }
  }
  const keys = (item: unknown, length: number, prefix: string): item is string[] => Array.isArray(item) && item.length === length && new Set(item).size === length && item.every(key => typeof key === 'string' && new RegExp(`^${prefix}-[1-9]\\d{0,7}$`).test(key))
  if (!keys(value.exerciseKeys, exercises.length, 'exercise') || !keys(value.sectionKeys, day.movement_groups.length, 'section')) return null
  const exerciseKeys = value.exerciseKeys as string[], sectionKeys = value.sectionKeys as string[]
  const position = (part: string) => part === 'all' || /^\d{1,3}$/.test(part) && Number(part) < 800
  const prescription = (key: string) => { const parts = key.split(':'); return parts.length === 2 && exerciseKeys.includes(parts[0]) && position(parts[1]) }
  const numeric = (key: string) => { const parts = key.split(':'); return parts.length === 2 && sectionKeys.includes(parts[0]) && ['rounds_min', 'rounds_max'].includes(parts[1]) || parts.length === 3 && prescription(parts.slice(0, 2).join(':')) && ['sets_min', 'sets_max', 'dose_min', 'dose_max', 'rpe_min', 'rpe_max'].includes(parts[2]) }
  const touchedField = (key: string) => { const parts = key.split(':'); return ['title', 'description', 'structure'].includes(key) || numeric(key) || parts.length === 2 && exerciseKeys.includes(parts[0]) && ['name', 'sets', 'instruction', 'note', 'protocol'].includes(parts[1]) || parts.length === 2 && sectionKeys.includes(parts[0]) && parts[1] === 'title' || parts.length === 3 && prescription(parts.slice(0, 2).join(':')) && ['reps', 'load', 'note'].includes(parts[2]) }
  const map = (item: unknown, valid: (entry: unknown) => boolean, keyValid: (key: string) => boolean) => object(item) && Object.keys(item).length <= 6000 && Object.entries(item).every(([key, entry]) => key.length < 150 && keyValid(key) && valid(entry))
  if (!map(value.expanded, item => typeof item === 'boolean', key => exerciseKeys.includes(key)) || !map(value.touched, item => typeof item === 'boolean', touchedField) || !map(value.repInputs, item => text(item), prescription) || !map(value.invalidReps, item => text(item), prescription) || !map(value.loadInputs, item => object(item) && text(item.raw) && oneOf(item.mode, ['exact', 'percent']), prescription) || !map(value.numberInputs, item => object(item) && text(item.raw) && typeof item.invalid === 'boolean', numeric) || typeof value.submitted !== 'boolean') return null
  if (value.sectionDetails !== null && !index(value.sectionDetails, day.movement_groups.length)) return null
  if (value.details !== null) {
    if (!object(value.details)) return null
    const detail = value.details
    if (detail.group !== null && !index(detail.group, day.movement_groups.length)) return null
    const list = detail.group === null ? day.ungrouped_exercises : day.movement_groups[detail.group as number].exercises
    if (!index(detail.exercise, list.length) || detail.set !== null && !index(detail.set, 800)) return null
  }
  return value as unknown as WorkoutRecoveryState
}
function decode(raw: string, key: string): WorkoutRecoveryCandidate | null {
  if (raw.length > WORKOUT_RECOVERY_LIMITS.recordCharacters) return null
  try {
    const record = JSON.parse(raw)
    if (!object(record) || record.version !== 1 || !object(record.scope) || !scopeValid(record.scope as WorkoutRecoveryScope) || !text(record.epoch, 200) || !text(record.writer, 200) || !Number.isSafeInteger(record.sequence) || (record.sequence as number) < 1 || typeof record.savedAt !== 'number' || !Number.isSafeInteger(record.savedAt) || record.savedAt < 0 || record.savedAt > Date.now() + 60_000 || !Number.isSafeInteger(record.revision) || !text(record.sourceFingerprint, WORKOUT_RECOVERY_LIMITS.recordCharacters) || !decodeWorkoutRecoveryState(record.state)) return null
    if (key !== `${recordPrefix(record.scope as WorkoutRecoveryScope)}${record.writer}:${record.sequence}` || (record.state as WorkoutRecoveryState).draft.identity_token !== record.scope.day) return null
    return { key, raw, record: record as unknown as RecordV1 }
  } catch { return null }
}
const exact = (candidate: WorkoutRecoveryCandidate) => storage().getItem(candidate.key) === candidate.raw && candidate.record.epoch === epoch(candidate.record.scope.principal)
const suppressed = (key: string) => {
  if (pending.get(key)?.size) return true
  const prefix = leasePrefix(key)
  for (let n = 0; n < storage().length; n++) {
    const lease = storage().key(n); if (!lease?.startsWith(prefix)) continue
    const until = Number(storage().getItem(lease))
    if (Number.isFinite(until) && until > Date.now() && until <= Date.now() + WORKOUT_RECOVERY_LIMITS.leaseMs) return true
  }
  return false
}
export function listWorkoutRecovery(scope: WorkoutRecoveryScope, omitWriter?: string): WorkoutRecoveryListing {
  try {
    if (!scopeValid(scope)) return { candidates: [], error: 'Device backup is unavailable for this workout.' }
    const currentEpoch = epoch(scope.principal), prefix = recordPrefix(scope), candidates: WorkoutRecoveryCandidate[] = []
    let corrupt = false
    for (let n = storage().length - 1; n >= 0; n--) {
      const key = storage().key(n); if (!key?.startsWith(prefix)) continue
      const raw = storage().getItem(key); if (!raw) continue
      const candidate = decode(raw, key)
      if (!candidate) { corrupt = true; continue }
      if (candidate.record.epoch === currentEpoch && candidate.record.writer !== omitWriter && candidate.record.savedAt > Date.now() - WORKOUT_RECOVERY_LIMITS.retentionMs && !suppressed(key)) candidates.push(candidate)
    }
    return { candidates: candidates.sort((a, b) => b.record.savedAt - a.record.savedAt), error: corrupt ? 'A device backup could not be read. Other valid backups remain available.' : null }
  } catch { return { candidates: [], error: 'Device backup is unavailable. Keep this page open and save your workout.' } }
}
export function readWorkoutRecovery(candidate: WorkoutRecoveryCandidate, scope: WorkoutRecoveryScope): WorkoutRecoveryCandidate | null {
  try { return scopeKey(candidate.record.scope) === scopeKey(scope) && exact(candidate) && !suppressed(candidate.key) ? decode(candidate.raw, candidate.key) : null } catch { return null }
}
export function discardWorkoutRecovery(candidate: WorkoutRecoveryCandidate, scope: WorkoutRecoveryScope): boolean {
  try { if (!readWorkoutRecovery(candidate, scope)) return false; storage().removeItem(candidate.key); emit(); return true } catch { return false }
}
export function subscribeWorkoutRecovery(listener: () => void): () => void {
  listeners.add(listener)
  const changed = (event: StorageEvent) => { if (event.key === null || event.key.startsWith(WORKOUT_RECOVERY_PREFIX)) listener() }
  window.addEventListener('storage', changed)
  return () => { listeners.delete(listener); window.removeEventListener('storage', changed) }
}
export function revokeWorkoutRecovery(principal: string): boolean {
  const replacement = id(); revoked.set(principal, replacement)
  let success = true, persisted = false
  try { storage().setItem(epochKey(principal), replacement); persisted = true } catch { success = false }
  try {
    const prefix = subjectPrefix(principal)
    for (let n = storage().length - 1; n >= 0; n--) { const key = storage().key(n); if (key?.startsWith(prefix) && key !== epochKey(principal)) storage().removeItem(key) }
    storage().setItem(epochKey(principal), replacement); persisted = true; success = true
  } catch { success = false }
  // Successful persistent epochs invalidate old writers themselves; only failed writes need a local tombstone.
  if (persisted) revoked.delete(principal)
  emit(); return success
}
export function countWorkoutRecovery(principal: string): number {
  try {
    const prefix = `${subjectPrefix(principal)}record:`, currentEpoch = epoch(principal)
    let count = 0
    for (let n = 0; n < storage().length; n++) { const key = storage().key(n); if (!key?.startsWith(prefix)) continue; const candidate = decode(storage().getItem(key) ?? '', key); if (candidate && candidate.record.epoch === currentEpoch && candidate.record.savedAt > Date.now() - WORKOUT_RECOVERY_LIMITS.retentionMs) count++ }
    return count
  } catch { return 0 }
}
export function createWorkoutRecoveryWriter(scope: WorkoutRecoveryScope, revision: number, source: unknown, expectedEpoch?: string | null) {
  const writer = id(), sourceFingerprint = workoutRecoveryFingerprint(source)
  const activeOperations = new Set<string>()
  let capturedEpoch: string | null = null, retired = false, sequence = 0, last: WorkoutRecoveryCandidate | null = null, restored: WorkoutRecoveryCandidate | null = null
  try { if (scopeValid(scope) && object(source) && source.identity_token === scope.day) capturedEpoch = expectedEpoch === undefined ? epoch(scope.principal) : expectedEpoch } catch { /* Editing remains available without backup. */ }
  const current = () => { try { return !retired && capturedEpoch !== null && epoch(scope.principal) === capturedEpoch } catch { return false } }
  const hasCheckpoint = () => { try { return current() && last !== null && exact(last) } catch { return false } }
  const workingState = (state: WorkoutRecoveryState) => { const { touched: _touched, submitted: _submitted, details: _details, sectionDetails: _sectionDetails, ...work } = state; return JSON.stringify(work) }
  const actualWork = (state: WorkoutRecoveryState) => JSON.stringify({ draft: state.draft, repInputs: state.repInputs, invalidReps: state.invalidReps, loadInputs: state.loadInputs, numberInputs: state.numberInputs })
  const write = (state: WorkoutRecoveryState): string | null => {
    try {
      if (!current()) return 'Device backup is unavailable. Keep this page open and save your workout.'
      if (!decodeWorkoutRecoveryState(state) || state.draft.identity_token !== scope.day || !object(source) || state.draft.ordinal !== source.ordinal) return 'This draft could not be backed up on this device. Save your workout before leaving.'
      if (last && !exact(last) && actualWork(last.record.state) === actualWork(state)) return 'Device backup was removed in another tab. Edit the workout to back it up again, or save before leaving.'
      const record: RecordV1 = { version: 1, scope, epoch: capturedEpoch!, writer, sequence: ++sequence, savedAt: Date.now(), revision, sourceFingerprint, state }
      const raw = JSON.stringify(record), key = `${recordPrefix(scope)}${writer}:${sequence}`
      if (raw.length > WORKOUT_RECOVERY_LIMITS.recordCharacters) return 'This draft is too large for device backup. Save your workout before leaving.'
      // Validation/focus changes during Save must not replace its captured immutable snapshot.
      if (last && exact(last) && (JSON.stringify(last.record.state) === JSON.stringify(state) || activeOperations.size > 0 && workingState(last.record.state) === workingState(state))) return null
      let characters = key.length + raw.length, count = 1
      for (let n = storage().length - 1; n >= 0; n--) {
        const storedKey = storage().key(n); if (!storedKey?.startsWith(WORKOUT_RECOVERY_PREFIX)) continue
        const storedRaw = storage().getItem(storedKey) ?? ''
        if (storedKey.includes(':pending:') && Number(storedRaw) <= Date.now()) { storage().removeItem(storedKey); continue }
        // Expired records are the only automatic eviction; fresh work is never sacrificed.
        const old = storedKey.includes(':record:') ? decode(storedRaw, storedKey) : null
        if (old && old.record.savedAt <= Date.now() - WORKOUT_RECOVERY_LIMITS.retentionMs) { storage().removeItem(storedKey); continue }
        characters += storedKey.length + storedRaw.length; if (storedKey.includes(':record:')) count++
      }
      if (characters > WORKOUT_RECOVERY_LIMITS.totalCharacters || count > WORKOUT_RECOVERY_LIMITS.records) return 'Device backup storage is full. Save your workout before leaving; existing backups were kept.'
      if (!current()) return 'Device backup was disabled when you signed out.'
      storage().setItem(key, raw)
      // Another tab can write between preflight and setItem. Roll back only this new immutable snapshot.
      if (usedCharacters() > WORKOUT_RECOVERY_LIMITS.totalCharacters || draftRecordCount() > WORKOUT_RECOVERY_LIMITS.records) {
        if (storage().getItem(key) === raw) storage().removeItem(key)
        return 'Device backup storage is full. Save your workout before leaving; existing backups were kept.'
      }
      if (!current()) { storage().removeItem(key); return 'Device backup was disabled when you signed out.' }
      const previous = last; last = { key, raw, record }
      if (previous && storage().getItem(previous.key) === previous.raw) storage().removeItem(previous.key)
      emit(); return null
    } catch { return 'Device backup failed. Keep this page open and save your workout.' }
  }
  const begin = (): WorkoutRecoveryOperation => {
    const snapshots = [...new Map([last, restored].filter((item): item is WorkoutRecoveryCandidate => item !== null).map(item => [item.key, item])).values()], until = Date.now() + WORKOUT_RECOVERY_LIMITS.leaseMs, operation = id()
    activeOperations.add(operation)
    snapshots.forEach(candidate => {
      const active = pending.get(candidate.key) ?? new Set<string>(); active.add(operation); pending.set(candidate.key, active)
      try {
        const marker = `${leasePrefix(candidate.key)}${operation}`, raw = String(until)
        if (exact(candidate) && usedCharacters() + marker.length + raw.length <= WORKOUT_RECOVERY_LIMITS.totalCharacters) {
          storage().setItem(marker, raw)
          if (usedCharacters() > WORKOUT_RECOVERY_LIMITS.totalCharacters && storage().getItem(marker) === raw) storage().removeItem(marker)
        }
      } catch { /* Local suppression still applies when browser storage cannot accept the cross-tab lease. */ }
    })
    emit()
    let finished = false
    const finish = (commit: boolean) => {
      if (finished) return; finished = true
      activeOperations.delete(operation)
      if (commit && (!last || snapshots.some(candidate => candidate.key === last!.key))) retired = true
      snapshots.forEach(candidate => {
        const active = pending.get(candidate.key); active?.delete(operation); if (!active?.size) pending.delete(candidate.key)
        try { if (commit && exact(candidate)) storage().removeItem(candidate.key); storage().removeItem(`${leasePrefix(candidate.key)}${operation}`) } catch { /* Never block Save on cleanup failure. */ }
      }); emit()
    }
    return { commit: () => finish(true), abort: () => finish(false) }
  }
  const clear = () => { try { if (last && exact(last)) storage().removeItem(last.key); last = null; emit() } catch { /* Editing and Save remain available. */ } }
  return { writer, current, hasCheckpoint, checkpointRemoved: () => last !== null && !hasCheckpoint(), write, clear, restore(candidate: WorkoutRecoveryCandidate) { restored = candidate }, begin, capture: () => begin().commit }
}
