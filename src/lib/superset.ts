export type SupersetIssue = 'superset_too_small' | 'superset_duplicate_exercise'

/** Compare assigned IDs when both exist; otherwise compare names without case or spacing. */
export function supersetIssue(exercises: ReadonlyArray<{ name: string; exercise_id?: string | null }>): SupersetIssue | null {
  if (exercises.length < 2) return 'superset_too_small'
  const normalized = exercises.map(exercise => ({
    id: exercise.exercise_id ?? null,
    name: exercise.name.trim().replace(/\s+/gu, ' ').toLowerCase(),
  }))
  const repeated = normalized.some((exercise, index) => normalized.slice(index + 1).some(other =>
    exercise.id && other.id ? exercise.id === other.id : exercise.name === other.name))
  return repeated ? 'superset_duplicate_exercise' : null
}

export function supersetIssueMessage(issue: SupersetIssue): string {
  return issue === 'superset_too_small'
    ? 'Add at least 2 unique exercises, or move this exercise out of the superset.'
    : 'Remove the repeated exercise. Each exercise in a superset must be unique.'
}
