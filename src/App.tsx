import { FormEvent, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { appMode, configMessage } from './lib/config'
import { demoAthletes, demoProgram, type Athlete } from './lib/coach-service'
import { applyTheme, type Theme } from './lib/theme'

type Screen = 'builder' | 'roster' | 'signin'
type SaveState = 'Saved' | 'Saving…' | 'Unsaved changes'

function Icon({ children }: { children: string }) { return <span aria-hidden="true" className="icon">{children}</span> }

export default function App({ onSignOut }: { onSignOut?: () => void } = {}) {
  const [screen, setScreen] = useState<Screen>('builder')
  const [athletes, setAthletes] = useState<Athlete[]>(demoAthletes)
  const [activeAthlete, setActiveAthlete] = useState(demoAthletes[0])
  const [week, setWeek] = useState(2)
  const [saveState, setSaveState] = useState<SaveState>('Saved')
  const [showAthleteDialog, setShowAthleteDialog] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [published, setPublished] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  const previousFocus = useRef<HTMLElement | null>(null)

  const markChanged = () => setSaveState('Unsaved changes')
  const save = () => { setSaveState('Saving…'); window.setTimeout(() => setSaveState('Saved'), 550) }
  const addAthlete = (name: string, focus: string) => {
    const next = { id: name.toLowerCase().replace(/\s+/g, '-'), name, focus, initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), status: 'Active' as const }
    setAthletes((current) => [...current, next]); setActiveAthlete(next); setShowAthleteDialog(false); setScreen('roster')
  }
  const confirmPublish = () => { setPublished(true); setShowPublishDialog(false); setSaveState('Saved') }

  useEffect(() => {
    if (showAthleteDialog || showPublishDialog) return
    previousFocus.current?.focus()
    previousFocus.current = null
  }, [showAthleteDialog, showPublishDialog])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (showAthleteDialog) setShowAthleteDialog(false)
      if (showPublishDialog) setShowPublishDialog(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showAthleteDialog, showPublishDialog])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next, document.documentElement, window.localStorage)
    setTheme(next)
  }
  const rememberFocus = () => { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }
  const openAthleteDialog = () => { rememberFocus(); setShowAthleteDialog(true) }
  const openPublishDialog = () => { rememberFocus(); setShowPublishDialog(true) }

  return <main className="app-shell">
    <aside className="sidebar" aria-label="Coach navigation">
      <div className="brand"><span>UNRACK</span><small>COACH</small></div>
      <div className="mobile-nav" aria-label="Mobile coach navigation">
        <button className={screen === 'builder' ? 'active' : ''} onClick={() => setScreen('builder')}>Builder</button>
        <button className={screen === 'roster' ? 'active' : ''} onClick={() => setScreen('roster')}>Athletes <b>{athletes.length}</b></button>
      </div>
      <nav aria-label="Primary coach navigation">
        <button className={screen === 'builder' ? 'nav-item active' : 'nav-item'} onClick={() => setScreen('builder')}><Icon>▦</Icon>Program builder</button>
        <button className={screen === 'roster' ? 'nav-item active' : 'nav-item'} onClick={() => setScreen('roster')}><Icon>◉</Icon>Athletes <b>{athletes.length}</b></button>
        <button className="nav-item muted"><Icon>◫</Icon>Library</button>
        <button className="nav-item muted"><Icon>◌</Icon>Check-ins</button>
      </nav>
      <div className="sidebar-section"><p>ACTIVE ROSTER</p>{athletes.map((athlete) => <button key={athlete.id} onClick={() => { setActiveAthlete(athlete); setScreen('builder') }} className={activeAthlete.id === athlete.id ? 'athlete-chip selected' : 'athlete-chip'}><span>{athlete.initials}</span><i>{athlete.name}</i></button>)}</div>
      <div className="sidebar-bottom"><div className="coach-avatar">JM</div><div><strong>Joe McGannon</strong><small>Owner · Unrack</small></div><button aria-label={onSignOut ? 'Sign out' : 'Preview sign in'} onClick={() => onSignOut ? onSignOut() : setScreen('signin')}>•••</button></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className={'mode-badge ' + appMode}><span></span>{appMode === 'demo' ? 'LOCAL DEMO' : 'CONFIGURED'}</div><p>{configMessage}</p><ThemeToggle theme={theme} onToggle={toggleTheme} /><button className="help" aria-label="Help">?</button></header>
      {screen === 'builder' && <Builder activeAthlete={activeAthlete} week={week} setWeek={setWeek} saveState={saveState} onSave={save} onChange={markChanged} published={published} onPublish={openPublishDialog} />}
      {screen === 'roster' && <Roster athletes={athletes} onAdd={openAthleteDialog} onSelect={(athlete) => { setActiveAthlete(athlete); setScreen('builder') }} />}
      {screen === 'signin' && <SignIn />}
    </section>
    {showAthleteDialog && <AddAthleteDialog onCancel={() => setShowAthleteDialog(false)} onAdd={addAthlete} />}
    {showPublishDialog && <PublishDialog programName={demoProgram.name} onCancel={() => setShowPublishDialog(false)} onConfirm={confirmPublish} />}
  </main>
}

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  // Historical local studies retain their comparisons; shipped coach is light-only.
  if (!__LOCAL_REVIEW__) return null
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  return <button className="theme-toggle" type="button" onClick={onToggle} aria-label={`Switch to ${nextTheme} theme`} title={`Switch to ${nextTheme} theme`}>
    <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
  </button>
}

function Builder({ activeAthlete, week, setWeek, saveState, onSave, onChange, published, onPublish }: { activeAthlete: Athlete; week: number; setWeek: (week: number) => void; saveState: SaveState; onSave: () => void; onChange: () => void; published: boolean; onPublish: () => void }) {
  const selectWeek = (nextWeek: number) => { setWeek(nextWeek); onChange() }
  const onWeekKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentWeek: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const weeks = demoProgram.weeks
    const currentIndex = weeks.indexOf(currentWeek)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? weeks.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + weeks.length) % weeks.length
    selectWeek(weeks[nextIndex])
    document.getElementById(`program-week-${weeks[nextIndex]}`)?.focus()
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">PROGRAM BUILDER <span>/ {activeAthlete.name.toUpperCase()}</span></p><h1>{demoProgram.name}</h1><div className="program-meta"><span>{demoProgram.block}</span><span>•</span><span>3 days / week</span><span>•</span><button onClick={onChange}>Edit details</button></div></div><div className="heading-actions"><span className={'save-state ' + saveState.replace(/\W/g, '')}><i></i>{saveState}</span><button className="button quiet" onClick={onSave} disabled={saveState === 'Saving…'}>Save draft</button><button className="button primary" onClick={onPublish}>{published ? 'View published' : 'Publish'} <span>→</span></button></div></div>
    {published && <div className="delivery-banner" role="status"><div><b>Program published</b><span> Week {week} is ready in the athlete’s plan.</span></div><strong>AWAITING DEVICE SYNC</strong><p>The athlete will see it when their app next connects. No delivery has been confirmed.</p></div>}
    <div className="builder-controls"><div className="week-tabs" role="tablist" aria-label="Program weeks">{demoProgram.weeks.map((item) => <button id={`program-week-${item}`} role="tab" aria-selected={week === item} aria-controls={`week-panel-${item}`} tabIndex={week === item ? 0 : -1} className={week === item ? 'week active' : 'week'} onKeyDown={(event) => onWeekKeyDown(event, item)} onClick={() => selectWeek(item)} key={item}>WEEK <b>{item}</b></button>)}</div><button className="button outline" onClick={onChange}>＋ Add training day</button></div>
    <section id={`week-panel-${week}`} role="tabpanel" aria-labelledby={`program-week-${week}`} className="week-summary"><div><span>WEEK {week} FOCUS</span><strong>{week === 4 ? 'Taper & test' : week === 3 ? 'Intensification' : 'Build competition patterns'}</strong></div><div><span>TARGET STRESS</span><strong>{week === 4 ? 'Low' : 'Moderate–high'}</strong></div><div><span>LAST EDIT</span><strong>Just now</strong></div></section>
    <section className="day-grid" aria-label="Training days">{demoProgram.days.map((day) => <article className="day-card" key={day.name}><header><div><p>{day.name} <span>{day.date}</span></p><h2>{day.focus}</h2></div><button aria-label={`Options for ${day.name}`}>•••</button></header><div className="exercise-table"><div className="table-labels"><span>EXERCISE</span><span>SETS × REPS</span><span>LOAD</span><span>RPE</span><span>REST</span></div>{day.exercises.map((exercise) => <div className="exercise-row" key={exercise.name}><div><b>{exercise.name}</b>{exercise.note && <small>{exercise.note}</small>}</div><button onClick={onChange}>{exercise.prescription}</button><button onClick={onChange}>{exercise.load}</button><button onClick={onChange}>{exercise.rpe}</button><button onClick={onChange}>{exercise.rest}</button></div>)}</div><button className="add-exercise" onClick={onChange}>＋ Add exercise</button></article>)}</section>
  </>
}

function Roster({ athletes, onAdd, onSelect }: { athletes: Athlete[]; onAdd: () => void; onSelect: (athlete: Athlete) => void }) { return <div className="roster-page"><div className="page-heading"><div><p className="eyebrow">ATHLETES</p><h1>Your roster</h1><p className="subcopy">Active lifters, their focus, and what needs your attention.</p></div><button className="button primary" onClick={onAdd}>＋ Add athlete</button></div><div className="roster-grid">{athletes.map((athlete) => <button onClick={() => onSelect(athlete)} className="roster-card" key={athlete.id}><span className="large-initials">{athlete.initials}</span><div><h2>{athlete.name}</h2><p>{athlete.focus}</p><small className={athlete.status.replace(/\s/g, '-').toLowerCase()}>{athlete.status}</small></div><b>→</b></button>)}<button className="new-athlete-card" onClick={onAdd}>＋<span>Add athlete</span></button></div></div> }

function SignIn() { return <div className="signin"><div className="signin-panel"><div className="brand"><span>UNRACK</span><small>COACH</small></div><p className="eyebrow">OWNER ACCESS</p><h1>Build better training.</h1><p>Sign in with the invite email tied to your gym.</p><label>Email<input type="email" placeholder="you@gym.com" /></label><button className="button primary">Continue with email →</button><small>Owner sign-in will be connected to Supabase Auth after deployment setup.</small></div></div> }

function AddAthleteDialog({ onCancel, onAdd }: { onCancel: () => void; onAdd: (name: string, focus: string) => void }) { const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); onAdd(String(form.get('name')), String(form.get('focus'))) }; return <div className="modal-backdrop" role="presentation"><form className="dialog" role="dialog" aria-modal="true" onSubmit={submit} aria-labelledby="add-athlete-title" aria-describedby="add-athlete-description"><button className="close" type="button" onClick={onCancel} aria-label="Close add athlete dialog">×</button><p className="eyebrow">ROSTER</p><h2 id="add-athlete-title">Add an athlete</h2><p id="add-athlete-description">This local-demo athlete is not saved to a gym or invited to an app.</p><label>Name<input required name="name" placeholder="Athlete name" autoFocus /></label><label>Training focus<input required name="focus" placeholder="e.g. Powerlifting · 83 kg" /></label><div className="dialog-actions"><button type="button" className="button quiet" onClick={onCancel}>Cancel</button><button className="button primary">Add to demo roster</button></div></form></div> }

function PublishDialog({ programName, onCancel, onConfirm }: { programName: string; onCancel: () => void; onConfirm: () => void }) { return <div className="modal-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="publish-title" aria-describedby="publish-description"><button className="close" onClick={onCancel} aria-label="Close publish dialog">×</button><p className="eyebrow">READY TO SEND</p><h2 id="publish-title">Publish this program?</h2><p id="publish-description"><b>{programName}</b> will become the active plan for Maya Chen. Review all training days before publishing.</p><div className="warning"><strong>Delivery note</strong><span>Publishing makes the plan available server-side. It is not proof that the athlete’s device has received or opened it.</span></div><div className="dialog-actions"><button className="button quiet" onClick={onCancel}>Keep editing</button><button className="button primary" onClick={onConfirm}>Publish program →</button></div></section></div> }
