export type WeightUnit = 'lb' | 'kg'
export const poundsToKilograms = 0.45359237

/** Keep full precision in the draft; only submission rounds edited values. */
export function convertProfileWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value
  return from === 'lb' ? value * poundsToKilograms : value / poundsToKilograms
}

export function testedMaxForSubmission(raw: string, edited: boolean, lift: string, unit: WeightUnit): number | null {
  if (!raw.trim()) return null
  const value = Number(raw)
  // Validate before rounding: an out-of-bounds conversion must not be rounded into range.
  if (!Number.isFinite(value) || value < 0.001 || value > 3000) {
    throw new ProfileMaxValidationError(`${lift} must convert to between 0.001 and 3000 ${unit}, the saved and synced 1RM unit.`)
  }
  return edited ? Math.round((value + Number.EPSILON) * 1000) / 1000 : value
}

export class ProfileMaxValidationError extends Error {}
