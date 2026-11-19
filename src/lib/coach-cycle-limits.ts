// Shared browser review and Worker response-admission limits. The publisher SQL
// enforces the same bounds before it creates or replaces athlete-visible rows.
export const COACH_CYCLE_PUBLISH_LIMITS = { authoredDays: 32, exercises: 192, groups: 768, sets: 768 } as const
