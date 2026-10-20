import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'

/** Manual activation keeps focus navigation separate from guarded draft navigation. */
export function ManualTabList({ children, className, panelId, 'aria-label': label }: {
  children: ReactNode
  className?: string
  panelId?: string
  'aria-label': string
}) {
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const tabs = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
    .filter(tab => tab.closest('[role="tablist"]') === root.current)
  const rove = (target: HTMLButtonElement | undefined) => {
    tabs().forEach(tab => { tab.tabIndex = tab === target ? 0 : -1 })
  }
  useLayoutEffect(() => {
    const items = tabs()
    items.forEach((tab, index) => {
      if (!tab.id) tab.id = `${id}-tab-${index}`
      if (panelId) tab.setAttribute('aria-controls', panelId)
    })
    const selected = items.find(tab => tab.getAttribute('aria-selected') === 'true')
    if (panelId && selected) document.getElementById(panelId)?.setAttribute('aria-labelledby', selected.id)
    const enabled = items.filter(tab => !tab.disabled && tab.getAttribute('aria-disabled') !== 'true')
    rove(enabled.find(tab => tab === document.activeElement) ?? enabled.find(tab => tab.getAttribute('aria-selected') === 'true') ?? enabled[0])
  })
  return <div ref={root} className={className} role="tablist" aria-label={label}
    onFocus={event => {
      const target = event.target
      if (!(target instanceof HTMLButtonElement)) return
      if (tabs().includes(target) && !target.disabled && target.getAttribute('aria-disabled') !== 'true') rove(target)
    }}
    onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      const enabled = tabs().filter(tab => !tab.disabled && tab.getAttribute('aria-disabled') !== 'true')
      const index = enabled.indexOf(event.target as HTMLButtonElement)
      if (index < 0) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length
      rove(enabled[next])
      enabled[next].focus()
    }}>{children}</div>
}
