import type { KeyboardEvent } from 'react'
// Keyboard Tab stops inside a dialog or popover, in document order. Shared by the live
// Coach focus traps so their lists can't drift apart again (UX-018: summaries were skipped).
const candidates = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex]'

const isTabStop = (element: HTMLElement) => {
  if (element.matches('[tabindex^="-"]') || element.closest('[hidden],[inert]')) return false
  if (element.tagName === 'SUMMARY') {
    // Only a details element's first summary is focusable, and it stays visible while closed.
    return element.matches('details > summary:first-of-type') && !element.parentElement!.parentElement?.closest('details:not([open])')
  }
  return !element.parentElement?.closest('details:not([open])')
}

export const dialogTabStops = (root: ParentNode | null): HTMLElement[] =>
  root ? Array.from(root.querySelectorAll<HTMLElement>(candidates)).filter(isTabStop) : []

// Keeps Tab and Shift+Tab inside the element that owns the keydown handler, wrapping at the ends.
export const trapDialogTab = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key !== 'Tab') return
  const items = dialogTabStops(event.currentTarget)
  if (!items.length) return
  const index = items.indexOf(document.activeElement as HTMLElement)
  if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus() }
  else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0].focus() }
}
