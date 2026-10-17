import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type AppMode = 'demo' | 'connected'

type PersistentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function supportsPersistentAuthStorage(storage?: PersistentStorage): boolean {
  const key = `__unrack_auth_storage_probe__${Date.now()}`
  let candidate = storage
  try {
    candidate ??= typeof window === 'undefined' ? undefined : window.localStorage
    if (!candidate) return false
    candidate.setItem(key, key)
    const writable = candidate.getItem(key) === key
    candidate.removeItem(key)
    return writable
  } catch {
    try { candidate?.removeItem(key) } catch { /* Storage is unavailable. */ }
    return false
  }
}

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const appMode: AppMode = url && anonKey ? 'connected' : 'demo'
export const authStorageAvailable = appMode !== 'connected'
  || supportsPersistentAuthStorage()

// Keep client calls to Phase 5 correction routes disabled until migration 0018
// and its matching Worker are separately approved and deployed.
export const phase5CorrectionBackendEnabled = import.meta.env.VITE_PHASE5_CORRECTION_BACKEND === 'enabled'
export const phase55DashboardReadsEnabled = import.meta.env.VITE_PHASE55_DASHBOARD_READS === 'enabled'
// The dashboard is only safe to enable with the matching 0022 mutation
// contracts: V1 constructors fail closed once that migration is live.
export const phase55AssignmentLifecycleEnabled = import.meta.env.VITE_PHASE55_ASSIGNMENT_LIFECYCLE === 'enabled'
// Templates are additive to the complete calendar workspace. They must never
// reopen a legacy writer when the dedicated RPC surface is unavailable.
export const phase55WorkoutTemplateLibraryEnabled = import.meta.env.VITE_PHASE55_TEMPLATE_LIBRARY === 'enabled'
// Program removal is archival only and requires the complete V2 read plus
// archive/restore RPC boundary. A partial rollout keeps the Phase 6A Plans UI.
export const phase6ProgramArchiveEnabled = import.meta.env.VITE_PHASE6_PROGRAM_ARCHIVE === 'enabled'
// P9-29 remains dark until the reviewed database gate, Worker, and athlete
// origin are activated together for the pilot gym.
export const pwaPairingEnabled = import.meta.env.VITE_P9_29_PWA_PAIRING === 'enabled'

export type Phase55CapabilityMode = 'legacy' | 'complete' | 'unavailable'

/**
 * V4 is safe only before the lifecycle migration, when both switches are
 * deliberately off. A partial flag rollout must not reveal V1 constructors
 * that 0022 has closed.
 */
export const phase55CapabilityMode = (dashboardEnabled: boolean, lifecycleEnabled: boolean): Phase55CapabilityMode =>
  dashboardEnabled && lifecycleEnabled ? 'complete' : !dashboardEnabled && !lifecycleEnabled ? 'legacy' : 'unavailable'

/**
 * Read-only client boundary. Coach mutations belong behind a Worker endpoint;
 * this browser app must never receive a Supabase service-role key.
 */
export const supabase: SupabaseClient | null = appMode === 'connected'
  && authStorageAvailable
  ? createClient(url, anonKey, { auth: { persistSession: true } })
  : null

export const configMessage = appMode === 'demo'
  ? 'Demo data — connect Supabase after the owner invite and Worker API are ready.'
  : 'Connected configuration detected. Mutations remain disabled until the Worker API is configured.'
