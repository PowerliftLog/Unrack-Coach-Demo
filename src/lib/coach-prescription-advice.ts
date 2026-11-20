import { parseCoachPrescription, type CoachWeightUnit } from './coach-sheet-interpret'

/**
 * Coach-facing advice for a prescription cell (Joe, Nov 17 prescription audit).
 *
 * The database parser that runs at publish accepts exactly what the sheet accepts (words like
 * "3 sets of 10 reps" and per-side spellings like "ea" or "/leg" are part of that grammar).
 * Advice only explains a rejected cell better, offers a rewrite in the accepted grammar, or
 * flags an accepted cell whose meaning is unclear. A suggestion is offered
 * only when the parser reads it cleanly, so a coach who copies it always gets a publishable cell.
 */
export type PrescriptionAdvice = { kind: 'bad' | 'missing' | 'unclear'; message: string; suggestion?: string }

const PLACEHOLDER = /^(?:[-–—x×?.*/]+|n\/?a|tbd|none)$/i
const UNIT = String.raw`(?:lbs?|kgs?|pounds?|kilograms?)`

function readable(text: string, unit: CoachWeightUnit): boolean {
  const parsed = parseCoachPrescription(text, { defaultUnit: unit })
  const understood = parsed.status === 'parsed' && parsed.issues.length === 0
    || parsed.status === 'blocked' && parsed.groups.length > 0 && parsed.issues.every(issue => issue.code === 'percentage_resolution_required')
  return understood && parsed.groups.every(group => group.count <= 20) && !unclearRpe(text, unit)
}

/** Weight written first: `225x5 @7`, `100kgx5`, ladders `135x8, 225x6`. Only a unit or a number over 20 counts as a weight. */
function loadFirst(text: string): string | null {
  const parts = text.split(',')
  let changed = false
  const out = parts.map(part => {
    const match = new RegExp(String.raw`^\s*(\d+(?:\.\d+)?)\s*(${UNIT})?\s*[x×]\s*(\d+)(?![\d.]|\s*[x×])\s*(.*?)\s*$`, 'i').exec(part)
    if (!match) return part.trim()
    const [, weight, unit, reps, rest] = match
    if (!unit && Number(weight) <= 20) return part.trim()
    changed = true
    return `1x${reps} @ ${weight}${unit ? ` ${unit.toLowerCase()}` : ''}${rest ? ` ${rest}` : ''}`
  })
  return changed ? out.join(', ') : null
}

const REWRITES: { lead: string; rewrite(text: string): string | null }[] = [
  { lead: 'Use a single @.', rewrite: t => { const n = t.replace(/@(?:\s*@)+/g, '@'); return n === t ? null : n } },
  { lead: 'Sets come first.', rewrite: loadFirst },
  { lead: 'Put RPE before the number.', rewrite: text => {
    const next = text.replace(/@\s*(\d+(?:\.\d+)?)\s*rpe\b/gi, (_m, value: string) => `@ RPE ${value}`)
    return next === text ? null : next
  } },
]

/** A bare `@ 1`–`@ 5` or `@ 10` is read as RPE, but coaches also write light weights that way (`@ 5` for 5 lb). */
function unclearRpe(text: string, unit: CoachWeightUnit): number | null {
  const parsed = parseCoachPrescription(text, { defaultUnit: unit })
  if (parsed.status !== 'parsed') return null
  for (const group of parsed.groups) {
    if (!group.rpe || group.rpe.min !== group.rpe.max || /rpe/i.test(group.raw)) continue
    const match = /@\s*(\d+(?:\.\d+)?)(?![\d.])(?!\s*(?:[-–]|lbs?|kgs?|%))/i.exec(group.raw)
    if (match && (Number(match[1]) <= 5 || Number(match[1]) === 10)) return Number(match[1])
  }
  return null
}

export function prescriptionAdvice(raw: string, unit: CoachWeightUnit): PrescriptionAdvice | null {
  const text = raw.trim()
  if (!text || /^skip$/i.test(text)) return null
  if (PLACEHOLDER.test(text)) return { kind: 'missing', message: 'Placeholder, not a prescription. Enter one, or write SKIP to leave this week out.' }
  const parsed = parseCoachPrescription(text, { defaultUnit: unit })
  const tooMany = parsed.groups.some(group => group.count > 20)
  const unclear = unclearRpe(text, unit)
  if (unclear !== null) return { kind: 'unclear', message: `Did you mean ${unclear} ${unit} or RPE ${unclear}? Write @ ${unclear} ${unit} or @ RPE ${unclear}.` }
  if (!tooMany && readable(text, unit)) return null
  // One rewrite at a time, then all of them together; offer the first the parser accepts.
  const candidates = REWRITES.map(rule => ({ lead: rule.lead, next: rule.rewrite(text) }))
  let combined = text; const leads: string[] = []
  for (const rule of REWRITES) { const next = rule.rewrite(combined); if (next) { combined = next; leads.push(rule.lead) } }
  if (leads.length > 1) candidates.push({ lead: leads.join(' '), next: combined })
  for (const candidate of candidates) {
    if (candidate.next && candidate.next !== text && readable(candidate.next, unit)) return { kind: 'bad', message: `${candidate.lead} Did you mean ${candidate.next}?`, suggestion: candidate.next }
  }
  if (tooMany) return { kind: 'bad', message: 'Sets come first, and the limit is 20 sets. Write sets x reps @ load, for example 1x5 @ 225.' }
  return null
}
