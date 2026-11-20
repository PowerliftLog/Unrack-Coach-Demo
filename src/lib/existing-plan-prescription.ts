import type { RichProgramSet } from './coach-api'
import { amrapMinimumFromNote } from './coach-sheet-interpret'

export const range = (min: number | null, max: number | null) => min === null ? 'Unspecified' : max === null || min === max ? String(min) : `${min}–${max}`
const effort = { L: 'Light', M: 'Medium', MH: 'Medium-heavy', H: 'Heavy' }

export function existingPlanPrescription(set: RichProgramSet, unit: 'lb' | 'kg', basisName?: string): string {
  const sets = set.sets_mode === 'range' ? range(set.sets_min, set.sets_max) : String(set.sets_min)
  const minimum = set.dose_mode === 'amrap' ? amrapMinimumFromNote(set.note) : null
  const dose = set.dose_mode === 'amrap' ? (minimum === null ? 'AMRAP' : `${minimum}+`) : set.dose_mode === 'reps' && set.reps_mode === 'athlete_choice' ? 'lifter chooses reps'
    : `${range(set.dose_min, set.dose_max)} ${set.dose_mode === 'time' ? 'sec' : set.dose_mode === 'distance' ? set.distance_unit ?? 'distance' : set.dose_mode}`
  const weightUnit = set.unit_override ?? unit
  const load = set.load_mode === 'exact' ? `${set.exact_weight ?? 'Unspecified'} ${weightUnit}`
    : set.load_mode === 'percent' ? `${set.percent ?? 'Unspecified'}% ${basisName ? `${basisName} ` : ''}${set.percent_basis_max_type === 'training_max' ? 'training max' : set.percent_basis_max_type === 'tested_1rm' ? 'tested 1RM' : 'max'}${set.resolved_weight === null ? '' : ` (${set.resolved_weight} ${weightUnit} resolved)`}${set.manual_override === null ? '' : ` (${set.manual_override} ${weightUnit} override)`}`
    : set.load_mode === 'rpe' ? `RPE ${range(set.rpe_min, set.rpe_max)}`
    : set.load_mode === 'qualitative' ? set.qualitative ? effort[set.qualitative] : 'Unspecified effort'
    : set.load_mode === 'athlete_choice' ? 'Lifter chooses load'
    : set.load_mode === 'bodyweight' ? 'Bodyweight' : set.load_mode === 'tbd' ? 'Load TBD' : 'No load'
  return [`${sets} × ${dose}`, load,
    set.laterality === 'each_side' ? 'each side' : set.laterality === 'alternating' ? 'alternating' : null,
    set.load_basis === 'per_hand' ? 'per hand' : set.load_basis === 'added_to_bodyweight' ? 'added to bodyweight' : null,
    set.load_mode !== 'rpe' && set.rpe_min !== null ? `RPE ${range(set.rpe_min, set.rpe_max)}` : null,
    set.rest_seconds === null ? null : `Rest ${set.rest_seconds} sec`,
  ].filter(Boolean).join(' · ')
}
