// Matches coach_athlete_metrics_v1 in migration 0039: Epley, 1–10 reps,
// kg normalized to lb, and a result rounded to one decimal.
export function estimatedOneRepMax(set: { weight: number | null; reps: number | null; unit: 'lb' | 'kg' | null; completed: boolean }): number | null {
  if (!set.completed || set.weight === null || !Number.isFinite(set.weight) || set.weight < 0
    || set.reps === null || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 10
    || (set.unit !== 'lb' && set.unit !== 'kg')) return null
  const pounds = set.unit === 'kg' ? set.weight * 2.2046226218487757 : set.weight
  return Math.round(pounds * (1 + set.reps / 30) * 10) / 10
}

export function bestSessionEstimatedOneRepMax(sets: Parameters<typeof estimatedOneRepMax>[0][]): number | null {
  const estimates = sets.map(estimatedOneRepMax).filter((value): value is number => value !== null)
  return estimates.length ? Math.max(...estimates) : null
}
