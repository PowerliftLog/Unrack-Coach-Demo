import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ManualTabList } from './ManualTabList'
import { MaxReportInbox } from './MaxReportInbox'
import type { BacklogRevisionApi, CoachDashboardRosterPageV1, CoachMaxReportV1 } from './lib/coach-api'
import './coach-shell.css'

type Tab = 'athletes' | 'builder'
export type CoachShellRoute = { tab: Tab; athlete: string | null }

const AthleteBuilderContext = createContext<((route: CoachShellRoute) => void) | null>(null)

export function AthleteBuilderLink({ athlete, children }: { athlete: string; children: ReactNode }) {
  const onNavigate = useContext(AthleteBuilderContext)
  if (!onNavigate) return null
  const route = { tab: 'builder' as const, athlete }
  const url = new URL(window.location.href)
  url.searchParams.set('tab', route.tab)
  url.searchParams.set('athlete', athlete)
  return <a className="ah-builder-link" href={url.search} onClick={event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(route)
  }}>{children}</a>
}

function readRoute(): CoachShellRoute {
  const params = new URLSearchParams(window.location.search)
  return { tab: params.get('tab') === 'builder' ? 'builder' : 'athletes', athlete: params.get('athlete') || null }
}

const sameRoute = (a: CoachShellRoute, b: CoachShellRoute) => a.tab === b.tab && a.athlete === b.athlete
const historyPosition = () => Number(window.history.state?.coachShellPosition ?? 0)

function writeRoute(route: CoachShellRoute, position: number, replace: boolean) {
  const url = new URL(window.location.href)
  url.searchParams.set('tab', route.tab)
  if (route.athlete) url.searchParams.set('athlete', route.athlete)
  else url.searchParams.delete('athlete')
  window.history[replace ? 'replaceState' : 'pushState']({ ...window.history.state, coachShellPosition: position }, '', url)
}

type HistoryEntry = { route: CoachShellRoute; position: number }
type LeaveDecision = boolean | (() => Promise<boolean>)

export function useCoachShellRoute(enabled: boolean, leaveScreen: () => LeaveDecision) {
  const [route, setRoute] = useState<CoachShellRoute>(() => enabled ? readRoute() : { tab: 'athletes', athlete: null })
  const current = useRef({ route, position: 0 })
  const guard = useRef(leaveScreen)
  const pending = useRef(false)
  const traversal = useRef<(HistoryEntry & { done: Promise<boolean>; finish(reached: boolean): void }) | null>(null)
  useLayoutEffect(() => { guard.current = leaveScreen }, [leaveScreen])

  const applyRoute = useCallback((route: CoachShellRoute, position: number, replace: boolean) => {
    writeRoute(route, position, replace)
    current.current = { route, position }
    setRoute(route)
  }, [])

  const withLeaveGuard = useCallback((proceed: () => void | Promise<void>, restore?: () => void) => {
    const decision = pending.current || traversal.current ? false : guard.current()
    if (decision === true) {
      void proceed()
      return
    }
    if (decision === false) {
      restore?.()
      return
    }
    pending.current = true
    restore?.()
    // Restore the current entry before opening a dialog for a browser traversal.
    const restoring = traversal.current
    const answer = restoring ? restoring.done.then(reached => reached && decision()) : decision()
    void answer.then(async allowed => {
      if (!allowed) return
      // Back or Forward may also have been pressed during a tab or athlete switch.
      if (await traversal.current?.done === false) return
      return proceed()
    }, () => {}).finally(() => { pending.current = false })
  }, [])

  useEffect(() => {
    if (!enabled) return
    let active = true
    current.current.position = historyPosition()
    writeRoute(current.current.route, current.current.position, true)

    function moveHistory(entry: HistoryEntry, offset: number) {
      let finish!: (reached: boolean) => void
      const done = new Promise<boolean>(resolve => { finish = resolve })
      traversal.current = { ...entry, done, finish }
      window.history.go(offset)
      return done
    }

    const onPop = () => {
      const next = readRoute()
      const position = historyPosition()
      const move = traversal.current
      if (move) {
        if (move.position === position && sameRoute(move.route, next)) {
          traversal.current = null
          move.finish(true)
        }
        return
      }
      const previous = current.current
      if (!pending.current && sameRoute(next, previous.route)) {
        previous.position = position
        return
      }
      const offset = window.history.state?.coachShellPosition != null ? position - previous.position : 0
      let restored = false
      withLeaveGuard(() => {
        if (!active) return
        if (!restored || !offset) {
          applyRoute(next, restored ? previous.position : position, true)
          return
        }
        // Replay the original traversal after restoration so Forward entries survive.
        return (async () => {
          await moveHistory({ route: next, position }, offset)
          if (active) applyRoute(next, position, true)
        })()
      }, () => {
        restored = true
        if (offset) void moveHistory(previous, -offset)
        else writeRoute(previous.route, previous.position, true)
      })
    }
    window.addEventListener('popstate', onPop)
    return () => {
      active = false
      window.removeEventListener('popstate', onPop)
      traversal.current?.finish(false)
      traversal.current = null
    }
  }, [enabled, applyRoute, withLeaveGuard])

  function goTo(next: CoachShellRoute, replace = false) {
    if (sameRoute(current.current.route, next)) return
    const position = current.current.position + (replace ? 0 : 1)
    applyRoute(next, position, replace)
  }
  return [route, goTo, withLeaveGuard] as const
}

const filters = [
  ['all', 'All'], ['needs_programming', 'Needs program'], ['draft', 'Draft'], ['programmed', 'Programmed'],
] as const
type Filter = typeof filters[number][0]
export type ShellAthlete = {
  item: CoachDashboardRosterPageV1['items'][number]
  status: { key: Exclude<Filter, 'all'>; label: string }
  program: string | null
}

function StatusBadge({ status }: { status: ShellAthlete['status'] }) {
  return <span className={`phase8-status ${status.key}`}>{status.label}</span>
}

export function CoachShell({ route, athletes, selected, loading, workspacePicker, pagination, onNavigate, onAdd, onRemoved, onSettings, onSignOut, children }: {
  route: CoachShellRoute
  athletes: ShellAthlete[]
  selected: ShellAthlete | null
  loading: boolean
  workspacePicker?: ReactNode
  pagination?: { needs?: { busy: boolean; load(): void }; current?: { busy: boolean; load(): void } }
  onNavigate(route: CoachShellRoute): void
  onAdd?(): void
  onRemoved?(): void
  onSettings?(): void
  onSignOut(): void
  children: ReactNode
}) {
  const panelId = useId()
  const railId = useId()
  const [railOpen, setRailOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const query = search.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US')
  const counts = { all: athletes.length, needs_programming: 0, draft: 0, programmed: 0 }
  for (const { status } of athletes) counts[status.key]++
  const shown = athletes.filter(({ item, status }) => (filter === 'all' || status.key === filter)
    && item.roster_name.toLocaleLowerCase('en-US').includes(query))

  function toggleRail() {
    setRailOpen(open => !open)
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  }

  return <div className="csh-shell">
    <header className="csh-top">
      <button className="csh-icon csh-rail-toggle" aria-expanded={railOpen} aria-controls={railId} onClick={toggleRail}>
        {railOpen ? '‹ Hide athletes' : '› Athletes'}
      </button>
      <button className="brand csh-brand" aria-label="Athletes home" onClick={() => onNavigate({ tab: 'athletes', athlete: null })}>UNRACK <small>COACH</small></button>
      <ManualTabList className="csh-tabs" aria-label="Coach screens" panelId={panelId}>
        <button role="tab" aria-selected={route.tab === 'athletes'} onClick={() => onNavigate({ ...route, tab: 'athletes' })}>Athletes</button>
        <button role="tab" aria-selected={route.tab === 'builder'} onClick={() => onNavigate({ ...route, tab: 'builder' })}>Build Workouts</button>
      </ManualTabList>
      <div className="csh-top-actions">
        {onSettings && <button className="csh-icon" onClick={onSettings}>Workspace settings</button>}
        <button className="csh-icon" onClick={onSignOut}>Sign out</button>
      </div>
    </header>
    <div className={`csh-body${railOpen ? '' : ' csh-rail-collapsed'}`}>
      <aside id={railId} className="csh-rail approved-client-rail" aria-label="Athletes" hidden={!railOpen}>
        {workspacePicker}
        {onAdd && <button className="csh-add" onClick={onAdd}>+ Add athlete</button>}
        <input type="search" aria-label="Search athletes" placeholder="Search athletes" value={search} onChange={event => setSearch(event.target.value)} />
        <div className="csh-chips" role="group" aria-label="Filter athletes">
          {filters.map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label} <span>{counts[key]}</span>
          </button>)}
        </div>
        <nav className="csh-list" aria-label="Athlete list">
          {shown.map(athlete => <button key={athlete.item.athlete_id}
            aria-current={athlete.item.athlete_id === selected?.item.athlete_id ? 'page' : undefined}
            onClick={() => onNavigate({ ...route, athlete: athlete.item.athlete_id })}>
            <span>{athlete.item.roster_name}</span><StatusBadge status={athlete.status} />
          </button>)}
          {shown.length === 0 && (loading ? <p role="status">Loading athletes…</p> : <p>No athletes match.</p>)}
          {filter !== 'programmed' && pagination?.needs && <button disabled={pagination.needs.busy} onClick={pagination.needs.load}>Load more clients needing programming</button>}
          {(filter === 'all' || filter === 'programmed') && pagination?.current && <button disabled={pagination.current.busy} onClick={pagination.current.load}>Load more programmed clients</button>}
        </nav>
        {onRemoved && <button className="csh-removed" onClick={onRemoved}>Removed clients →</button>}
      </aside>
      <div className="csh-main" role={route.tab === 'athletes' || !selected ? 'main' : undefined}>
        <div id={panelId} role="tabpanel">
          <AthleteBuilderContext.Provider value={onNavigate}>
            {children}
          </AthleteBuilderContext.Provider>
        </div>
      </div>
    </div>
  </div>
}

export function CoachShellAthleteHeader({ athlete, programLine, nextProgramLine, profileOpen, onProfile, onConnect, onRemove, onErase }: {
  athlete: ShellAthlete
  programLine?: ReactNode
  nextProgramLine?: ReactNode
  profileOpen: boolean
  onProfile(): void
  onConnect?(): void
  onRemove?(): void
  onErase?(): void
}) {
  const [menu, setMenu] = useState(false)
  const profileButton = useRef<HTMLButtonElement>(null)
  const wasProfileOpen = useRef(false)
  useEffect(() => {
    if (!profileOpen && wasProfileOpen.current) profileButton.current?.focus()
    wasProfileOpen.current = profileOpen
  }, [profileOpen])
  const actions = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menu) return
    actions.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !actions.current?.contains(event.target)) setMenu(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenu(false)
      trigger.current?.focus()
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('click', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('click', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [menu])

  return <header className="csh-athlete-head">
    <div>
      <p className="eyebrow">ATHLETE</p>
      <h1>{athlete.item.roster_name}</h1>
      <p>{programLine ?? athlete.program ?? 'No current program'} <StatusBadge status={athlete.status} /></p>
      {nextProgramLine && <p>{nextProgramLine}</p>}
    </div>
    <nav aria-label="Athlete actions">
      <button ref={profileButton} className="button outline" aria-expanded={profileOpen} onClick={onProfile}>Profile</button>
      {onConnect && <button className="button outline" onClick={onConnect}>Connect app</button>}
      {onRemove && <span className="csh-menu-wrap" ref={actions}>
        <button ref={trigger} className="button outline" aria-expanded={menu} aria-haspopup="menu" aria-label="More athlete actions" onClick={() => setMenu(open => !open)}>⋯</button>
        {menu && <span className="csh-menu" role="menu" aria-label="More athlete actions" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
          const index = items.findIndex(item => item === document.activeElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          items[next]?.focus()
        }}>
          <button role="menuitem" onClick={() => { setMenu(false); trigger.current?.focus(); onRemove() }}>Remove client</button>
          {onErase && <button role="menuitem" className="csh-danger" onClick={() => { setMenu(false); trigger.current?.focus(); onErase() }}>Delete athlete's data</button>}
        </span>}
      </span>}
    </nav>
  </header>
}

export function CoachShellHome({ athletes, today, recentActivity, api, gym, reportRevision, onPick, onReport }: {
  athletes: ShellAthlete[]
  today: string
  recentActivity: ReactNode
  api: Partial<BacklogRevisionApi>
  gym: string | null
  reportRevision: number
  onPick(athlete: string): void
  onReport(report: CoachMaxReportV1): void
}) {
  const lastDay = new Date(`${today}T00:00:00Z`)
  lastDay.setUTCDate(lastDay.getUTCDate() + 7)
  const through = lastDay.toISOString().slice(0, 10)
  const needsProgram = athletes.filter(({ status }) => status.key === 'needs_programming')
  const endingSoon = athletes.flatMap(athlete => {
    const end = athlete.item.current_assignment?.end_on
    return end && end >= today && end <= through ? [{ athlete, end }] : []
  })
  const row = ({ item, status }: ShellAthlete, reason: ReactNode) => <button key={item.athlete_id} className="csh-row" onClick={() => onPick(item.athlete_id)}>
    <StatusBadge status={status} /><span><strong>{item.roster_name}</strong><small>{reason}</small></span><span aria-hidden="true">→</span>
  </button>
  return <>
    <header className="csh-page-head"><p className="eyebrow">ATHLETES</p><h1>Today</h1></header>
    <div className="csh-home-grid">
      {recentActivity}
      <section className="hub-card csh-attention" aria-labelledby="csh-attention-heading">
        <header><h2 id="csh-attention-heading">Needs attention</h2></header>
        {needsProgram.map(athlete => row(athlete, 'Needs a program'))}
        {endingSoon.map(({ athlete, end }) => row(athlete, <>Cycle ends <time dateTime={end}>{new Date(`${end}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></>))}
        {gym && <MaxReportInbox key={gym} api={api} gym={gym} refreshKey={reportRevision} onOpen={onReport} />}
        {!needsProgram.length && !endingSoon.length && <p className="hub-caption">No athletes need a program or have a cycle ending this week.</p>}
      </section>
    </div>
  </>
}
