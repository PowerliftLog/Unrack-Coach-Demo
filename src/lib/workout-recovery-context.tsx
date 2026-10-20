import { createContext } from 'react'

// Only Root supplies a verified authenticated subject. Review/test/showcase
// callers must explicitly supply their own fictional principal to opt in.
export const WorkoutRecoveryPrincipalContext = createContext<string | null>(null)
// Captured at authenticated workspace entry, never adopted by an old workspace
// merely because another tab revoked that subject's backups.
export const WorkoutRecoveryEpochContext = createContext<string | null>(null)
