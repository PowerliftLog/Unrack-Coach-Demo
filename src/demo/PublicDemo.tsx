import { useMemo, useState } from 'react'
import ConnectedCoachApp from '../ConnectedCoachApp'
import { createLocalApi } from '../review/local-api'
import { seedModel } from '../review/local-model'
import './public-demo.css'

const key = 'unrack-showcase-workspace-v1'
export default function PublicDemo() {
  const [generation, setGeneration] = useState(0)
  const workspace = useMemo(() => {
    const memory = new Map<string, string>()
    let persistent = true
    const storage = {
      getItem: () => { try { return localStorage.getItem(key) } catch { persistent = false; return memory.get(key) ?? null } },
      setItem: (_: string, value: string) => { memory.set(key, value); try { localStorage.setItem(key, value) } catch { persistent = false } },
    }
    try {
      const saved = storage.getItem()
      if (!saved) storage.setItem('', JSON.stringify(seedModel()))
      return { api: createLocalApi(storage), persistent, error: null }
    } catch {
      return { api: null, persistent, error: 'Saved demo data could not be loaded. Reset the demo to restore the fictional workspace.' }
    }
  }, [generation])
  function reset() {
    if (!window.confirm('Reset the fictional athletes and discard your demo edits?')) return
    try { localStorage.removeItem(key) } catch { /* Memory-only demo. */ }
    setGeneration(value => value + 1)
  }
  return <>
    <aside className="public-demo-banner" aria-label="Interactive demo information">
      <div><strong>UNRACK Coach · Interactive demo</strong><p>Fictional athletes. Changes stay in this browser. Publication review only; no accounts, invitations or athlete sync.</p></div>
      <div className="public-demo-actions"><a href="https://github.com/PowerliftLog/Unrack-Coach-Demo" target="_blank" rel="noreferrer">View project</a><button type="button" onClick={reset}>Reset demo</button></div>
    </aside>
    <details className="public-demo-guide"><summary>Explore the coaching workflow</summary><p>Select Maya to inspect a strength program, open Workout builder, edit a workout and save it. Explore the other fictional athletes and program templates. Refresh to keep your edits, or Reset demo to start over. Use a desktop or laptop for the full authoring workspace. This showcase uses the current product components with a simplified local adapter; server validation, authentication and athlete delivery are outside this demo.</p></details>
    {!workspace.persistent && <p role="status">Browser storage is unavailable. Demo edits last for this visit only.</p>}
    {workspace.api ? <ConnectedCoachApp key={generation} api={workspace.api} onSignOut={reset} theme="light" onToggleTheme={() => {}} coachDisplayName="Demo Coach" enablePhase5Corrections enablePhase55DashboardReads enablePhase55AssignmentLifecycle enablePhase55TemplateLibrary /> : <p role="alert">{workspace.error}</p>}
  </>
}
