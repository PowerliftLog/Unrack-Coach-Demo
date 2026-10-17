import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CoachApiError, type OwnerOnboardingApi, type WorkspaceSettingsV1 } from './lib/coach-api'

export function WorkspaceSettings({ api, gym, onSaved, onBusyChange, onDirtyChange }: {
  api: OwnerOnboardingApi; gym: string; onSaved(value: WorkspaceSettingsV1): void
  onBusyChange(value: boolean): void; onDirtyChange(value: boolean): void
}) {
  const [record, setRecord] = useState<WorkspaceSettingsV1 | null>(null)
  const [name, setName] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'coach' | 'workspace' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [needsReview, setNeedsReview] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)
  const workspaceInput = useRef<HTMLInputElement>(null)
  const savedField = useRef<'coach' | 'workspace'>('coach')
  useEffect(() => { if (notice && !busy) (savedField.current === 'coach' ? nameInput : workspaceInput).current?.focus() }, [notice, busy])
  const epoch = useRef(0)
  const read = async () => {
    const generation = ++epoch.current
    setLoading(true); setError(null); setNotice(null)
    try {
      const next = await api.getWorkspaceSettingsV1({ target_gym: gym })
      if (generation !== epoch.current) return
      setRecord(next); setName(next.coach.display_name); setWorkspace(next.workspace.name)
      setNeedsReview(false)
    } catch { if (generation === epoch.current) setError('Could not load these details. Check your connection and try again.') }
    finally { if (generation === epoch.current) setLoading(false) }
  }
  useEffect(() => { void read(); return () => { epoch.current += 1 } }, [api, gym])
  useEffect(() => { onDirtyChange(Boolean(record && (name !== record.coach.display_name || workspace !== record.workspace.name))) }, [name, workspace, record, onDirtyChange])
  const acceptSaved = (next: WorkspaceSettingsV1, kind: 'coach' | 'workspace') => {
    if (!record) return
    savedField.current = kind
    const otherDirty = kind === 'coach' ? workspace !== record.workspace.name : name !== record.coach.display_name
    setRecord({ ...next,
      coach: kind === 'workspace' && otherDirty ? record.coach : next.coach,
      workspace: kind === 'coach' && otherDirty ? { ...record.workspace, can_rename: next.workspace.can_rename } : next.workspace,
    })
    if (kind === 'coach' || !otherDirty) setName(next.coach.display_name)
    if (kind === 'workspace' || !otherDirty) setWorkspace(next.workspace.name)
    onSaved(next)
  }
  const save = async (event: FormEvent, kind: 'coach' | 'workspace') => {
    event.preventDefault()
    if (!record || busy || needsReview) return
    const desired = (kind === 'coach' ? name : workspace).trim()
    if (!desired || [...desired].length > 120 || /[\u0000-\u001f\u007f]/u.test(desired)) { setError('Enter a name of 1–120 characters without line breaks.'); return }
    const generation = epoch.current
    setBusy(kind); onBusyChange(true); setError(null); setNotice(null)
    try {
      const next = kind === 'coach'
        ? await api.saveCoachNameV1({ target_gym: gym, expected_name_version: record.coach.name_version, display_name: desired })
        : await api.saveWorkspaceNameV1({ target_gym: gym, expected_name_version: record.workspace.name_version, workspace_name: desired })
      if (generation !== epoch.current) return
      // A dirty other form keeps its original CAS token until explicit review.
      acceptSaved(next, kind)
      setNotice(kind === 'coach' ? 'Your name is saved.' : 'Workspace name is saved.')
    } catch (cause) {
      if (generation !== epoch.current) return
      // Reconcile uncertain success without issuing another mutation.
      try {
        const latest = await api.getWorkspaceSettingsV1({ target_gym: gym })
        if (generation !== epoch.current) return
        if ((kind === 'coach' ? latest.coach.display_name : latest.workspace.name) === desired) {
          acceptSaved(latest, kind)
          setNotice('Your saved details were confirmed.')
          return
        }
      } catch { /* Retain the draft and require an authoritative read. */ }
      if (generation !== epoch.current) return
      setNeedsReview(true)
      setError(cause instanceof CoachApiError && cause.code === 'settings_changed'
        ? 'These details changed in another session. Your entries are kept. Load the latest details before saving again.'
        : 'We could not confirm the save. Your entries are kept. Load the latest details before saving again.')
    } finally { if (generation === epoch.current) { setBusy(null); onBusyChange(false) } }
  }
  return <div className="workspace-settings">
    <h2>Workspace settings</h2><p>Keep your name and business details up to date.</p>
    {loading && <p role="status">Loading details…</p>}
    {record && !loading && <>
      <form onSubmit={event => void save(event, 'coach')}>
        <label>Your name<input ref={nameInput} required maxLength={120} autoComplete="name" value={name} disabled={Boolean(busy)} onChange={event => setName(event.target.value)} /></label>
        <button className="button primary" disabled={Boolean(busy) || needsReview || !name.trim() || name === record.coach.display_name}>{busy === 'coach' ? 'Saving…' : 'Save your name'}</button>
      </form>
      <form onSubmit={event => void save(event, 'workspace')}>
        <label>Business or workspace name<input ref={workspaceInput} required maxLength={120} autoComplete="organization" value={workspace} disabled={Boolean(busy) || !record.workspace.can_rename} onChange={event => setWorkspace(event.target.value)} /></label>
        {record.workspace.can_rename ? <button className="button primary" disabled={Boolean(busy) || needsReview || !workspace.trim() || workspace === record.workspace.name}>{busy === 'workspace' ? 'Saving…' : 'Save workspace name'}</button>
          : <p>Workspace names can be changed by an owner or admin.</p>}
      </form>
    </>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="workspace-error">{error}</p>}
    {!loading && (needsReview || (!record && error)) && <button className="button outline" disabled={Boolean(busy)} onClick={() => void read()}>{record ? 'Load latest details' : 'Try again'}</button>}
    {needsReview && <p>Loading the latest details replaces the entries shown here.</p>}
  </div>
}
