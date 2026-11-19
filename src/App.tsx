import { FormEvent, useEffect, useRef, useState } from 'react'
import { appMode, configMessage } from './lib/config'
import { demoAthletes, type Athlete } from './lib/coach-service'
import { applyTheme, type Theme } from './lib/theme'

type Screen = 'roster' | 'signin'

function Icon({ children }: { children: string }) { return <span aria-hidden="true" className="icon">{children}</span> }

export default function App({ onSignOut }: { onSignOut?: () => void } = {}) {
  const [screen, setScreen] = useState<Screen>('roster')
  const [athletes, setAthletes] = useState<Athlete[]>(demoAthletes)
  const [showAthleteDialog, setShowAthleteDialog] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  const previousFocus = useRef<HTMLElement | null>(null)

  const addAthlete = (name: string, focus: string) => {
    const next = { id: name.toLowerCase().replace(/\s+/g, '-'), name, focus, initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), status: 'Active' as const }
    setAthletes((current) => [...current, next]); setShowAthleteDialog(false); setScreen('roster')
  }

  useEffect(() => {
    if (showAthleteDialog) return
    previousFocus.current?.focus()
    previousFocus.current = null
  }, [showAthleteDialog])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (showAthleteDialog) setShowAthleteDialog(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showAthleteDialog])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next, document.documentElement, window.localStorage)
    setTheme(next)
  }
  const rememberFocus = () => { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }
  const openAthleteDialog = () => { rememberFocus(); setShowAthleteDialog(true) }
  return <main className="app-shell">
    <aside className="sidebar" aria-label="Coach navigation">
      <div className="brand"><span>UNRACK</span><small>COACH</small></div>
      <div className="mobile-nav" aria-label="Mobile coach navigation">
        <button className={screen === 'roster' ? 'active' : ''} onClick={() => setScreen('roster')}>Athletes <b>{athletes.length}</b></button>
      </div>
      <nav aria-label="Primary coach navigation">
        <button className={screen === 'roster' ? 'nav-item active' : 'nav-item'} onClick={() => setScreen('roster')}><Icon>◉</Icon>Athletes <b>{athletes.length}</b></button>
      </nav>
      <div className="sidebar-section"><p>ACTIVE ROSTER</p>{athletes.map((athlete) => <div key={athlete.id} className="athlete-chip"><span>{athlete.initials}</span><i>{athlete.name}</i></div>)}</div>
      <div className="sidebar-bottom"><div className="coach-avatar">JM</div><div><strong>Joe McGannon</strong><small>Owner · Unrack</small></div><button aria-label={onSignOut ? 'Sign out' : 'Preview sign in'} onClick={() => onSignOut ? onSignOut() : setScreen('signin')}>•••</button></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className={'mode-badge ' + appMode}><span></span>{appMode === 'demo' ? 'LOCAL DEMO' : 'CONFIGURED'}</div><p>{configMessage}</p><ThemeToggle theme={theme} onToggle={toggleTheme} /><button className="help" aria-label="Help">?</button></header>
      {screen === 'roster' && <Roster athletes={athletes} onAdd={openAthleteDialog} />}
      {screen === 'signin' && <SignIn />}
    </section>
    {showAthleteDialog && <AddAthleteDialog onCancel={() => setShowAthleteDialog(false)} onAdd={addAthlete} />}
  </main>
}

// Coach has a single working theme, so there is nothing to toggle.
export function ThemeToggle(_props: { theme: Theme; onToggle: () => void }) {
  return null
}

function Roster({ athletes, onAdd }: { athletes: Athlete[]; onAdd: () => void }) { return <div className="roster-page"><div className="page-heading"><div><p className="eyebrow">ATHLETES</p><h1>Your roster</h1><p className="subcopy">Active lifters, their focus, and what needs your attention.</p></div><button className="button primary" onClick={onAdd}>＋ Add athlete</button></div><div className="roster-grid">{athletes.map((athlete) => <article className="roster-card" key={athlete.id}><span className="large-initials">{athlete.initials}</span><div><h2>{athlete.name}</h2><p>{athlete.focus}</p><small className={athlete.status.replace(/\s/g, '-').toLowerCase()}>{athlete.status}</small></div></article>)}<button className="new-athlete-card" onClick={onAdd}>＋<span>Add athlete</span></button></div></div> }

function SignIn() { return <div className="signin"><div className="signin-panel"><div className="brand"><span>UNRACK</span><small>COACH</small></div><p className="eyebrow">OWNER ACCESS</p><h1>Build better training.</h1><p>Sign in with the invite email tied to your gym.</p><label>Email<input type="email" placeholder="you@gym.com" /></label><button className="button primary">Continue with email →</button><small>Owner sign-in will be connected to Supabase Auth after deployment setup.</small></div></div> }

function AddAthleteDialog({ onCancel, onAdd }: { onCancel: () => void; onAdd: (name: string, focus: string) => void }) { const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); onAdd(String(form.get('name')), String(form.get('focus'))) }; return <div className="modal-backdrop" role="presentation"><form className="dialog" role="dialog" aria-modal="true" onSubmit={submit} aria-labelledby="add-athlete-title" aria-describedby="add-athlete-description"><button className="close" type="button" onClick={onCancel} aria-label="Close add athlete dialog">×</button><p className="eyebrow">ROSTER</p><h2 id="add-athlete-title">Add an athlete</h2><p id="add-athlete-description">This local-demo athlete is not saved to a gym or invited to an app.</p><label>Name<input required name="name" placeholder="Athlete name" autoFocus /></label><label>Training focus<input required name="focus" placeholder="e.g. Powerlifting · 83 kg" /></label><div className="dialog-actions"><button type="button" className="button quiet" onClick={onCancel}>Cancel</button><button className="button primary">Add to demo roster</button></div></form></div> }
