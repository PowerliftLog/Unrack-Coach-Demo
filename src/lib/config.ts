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
// The generated-cycle draft transport and SQL grants ship separately. Absent
// or any value other than the exact opt-in keeps the connected builder hidden.
export const coachCycleDraftsEnabled = import.meta.env.VITE_COACH_CYCLE_DRAFTS_ENABLED === 'enabled'
// Beta activation is independent of the closed /1 UI and pins a reviewed gate epoch.
const excelBetaEpoch = import.meta.env.VITE_COACH_EXCEL_BETA_GATE_EPOCH
export const coachExcelBetaGateEpoch = typeof excelBetaEpoch === 'string' && /^[1-9][0-9]*$/.test(excelBetaEpoch) && Number.isSafeInteger(Number(excelBetaEpoch)) ? Number(excelBetaEpoch) : null
export const coachExcelBetaEnabled = import.meta.env.VITE_COACH_EXCEL_BETA_ENABLED === 'enabled' && coachCycleDraftsEnabled && coachExcelBetaGateEpoch !== null
// Next-cycle UI is a separate exact opt-in; absent keeps the v1 review path.
export const coachExcelNextCycleEnabled = import.meta.env.VITE_COACH_EXCEL_NEXT_CYCLE_ENABLED === 'enabled' && coachExcelBetaEnabled
// Managed-membership Excel drafts are independent of the owner-enrolled pilot.
export const coachExcelDraftEnabled = import.meta.env.VITE_COACH_EXCEL_DRAFT_ENABLED === 'enabled' && coachCycleDraftsEnabled
export const coachExcelPreviewEnabled = import.meta.env.VITE_COACH_EXCEL_PREVIEW_ENABLED === 'enabled' && coachExcelDraftEnabled
// Publication and historical status require their separate exact opt-in.
export const coachExcelPublishEnabled = import.meta.env.VITE_COACH_EXCEL_PUBLISH_ENABLED === 'enabled' && coachExcelPreviewEnabled
// The first live authoring scope uses owner-enrolled pilot wrappers, never the
// broad v1 draft RPCs. Both the editor and this exact capability must opt in.
const authoringV2Version = import.meta.env.VITE_COACH_CYCLE_AUTHORING_V2_CAPABILITY_VERSION
export const coachCycleAuthoringV2CapabilityVersion = typeof authoringV2Version === 'string' && /^[1-9][0-9]*$/.test(authoringV2Version) && Number.isSafeInteger(Number(authoringV2Version)) ? Number(authoringV2Version) : null
export const coachCycleAuthoringV2Enabled = import.meta.env.VITE_COACH_CYCLE_AUTHORING_V2_ENABLED === 'enabled' && coachCycleDraftsEnabled && coachCycleAuthoringV2CapabilityVersion !== null
// Template storage/copy is an independent grant-closed capability.
export const coachCycleTemplatesEnabled = import.meta.env.VITE_COACH_CYCLE_TEMPLATES_ENABLED === 'enabled'
// Preview is independently gated and never enables publication. Root also
// requires the draft capability before constructing this read-only client.
export const coachCyclePublishPreviewEnabled = import.meta.env.VITE_COACH_CYCLE_PUBLISH_PREVIEW_ENABLED === 'enabled'
// Separate bounded v2 review; activation must pin an explicitly reviewed admission.
const previewV2Admission = import.meta.env.VITE_COACH_CYCLE_PREVIEW_V2_ADMISSION_VERSION
export const coachCyclePreviewV2AdmissionVersion = typeof previewV2Admission === 'string' && /^[1-9][0-9]*$/.test(previewV2Admission) && Number.isSafeInteger(Number(previewV2Admission)) ? Number(previewV2Admission) : null
export const coachCyclePreviewV2Enabled = import.meta.env.VITE_COACH_CYCLE_PREVIEW_V2_ENABLED === 'enabled' && coachCyclePreviewV2AdmissionVersion !== null


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

// A separate exact opt-in; review visibility alone never enables publication.
export const coachCyclePublishV2Enabled = import.meta.env.VITE_COACH_CYCLE_PUBLISH_V2_ENABLED === 'enabled' && coachCyclePreviewV2Enabled
