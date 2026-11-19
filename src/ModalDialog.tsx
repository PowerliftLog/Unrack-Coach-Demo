import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { dialogTabStops, trapDialogTab } from './lib/dialog-focus'

type Name = { label: string; labelledBy?: never } | { labelledBy: string; label?: never }

// Prefer the requested initial focus, then a child already focused by React autoFocus,
// then the first Tab stop. Read the selector from the node so nested dialogs can use it too.
const openModal = (dialog: HTMLDialogElement) => {
  const focused = document.activeElement
  if (!dialog.open) dialog.showModal()
  const selector = dialog.dataset.modalInitialFocus
  const target = (selector ? dialog.querySelector<HTMLElement>(selector) : null)
    ?? (focused instanceof HTMLElement && focused !== dialog && dialog.contains(focused) ? focused : dialogTabStops(dialog)[0])
  target?.focus()
}

// Every Coach modal is a native <dialog> opened with showModal(): the page behind is inert and
// the dialog sits in the top layer. On top of that we keep Coach's behaviour: Escape calls
// onEscape (callers decide whether a busy dialog may close), Tab wraps inside the dialog, and
// closing returns focus to whatever opened it. The browser never closes a dialog on its own:
// React state decides when it unmounts.
// `box`: the <dialog> itself is the styled box and ::backdrop dims the page (the client removal and
// tracking review dialogs). Otherwise it is a full-screen backdrop around an inner .dialog box.
export function ModalDialog({ className, label, labelledBy, describedBy, onEscape, onBackdropClick, initialFocus, fallbackFocus, box = false, children }: Name & {
  className: string
  describedBy?: string
  onEscape?(): void
  onBackdropClick?(): void
  initialFocus?: string
  fallbackFocus?: RefObject<HTMLElement | null>
  box?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const fallback = useRef(fallbackFocus)
  // Captured at first render, before a child's autoFocus moves focus into the dialog.
  const [opener] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null)
  useLayoutEffect(() => {
    const dialog = ref.current!
    // Layout effects run child-first. A nested modal that mounts with its parent waits, and the
    // parent opens it afterwards so it stacks on top.
    if (!dialog.parentElement?.closest('dialog.native-modal:not([open])')) {
      openModal(dialog)
      dialog.querySelectorAll<HTMLDialogElement>('dialog.native-modal:not([open])').forEach(openModal)
    }
    return () => {
      // Removing the node takes it out of the top layer; then return focus to the opener.
      queueMicrotask(() => {
        if (dialog.isConnected) return
        const target = opener?.isConnected ? opener : fallback.current?.current
        target?.focus()
      })
    }
  }, [opener])
  return <dialog ref={ref} className={box ? className : `native-modal ${className}`} aria-label={label} aria-labelledby={labelledBy} aria-describedby={describedBy}
    data-modal-initial-focus={initialFocus}
    onClick={onBackdropClick && (event => {
      if (event.target !== event.currentTarget) return
      const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onBackdropClick()
    })}
    // Escape reaching the dialog without a keydown inside it (focus on the dialog itself).
    onCancel={event => { event.preventDefault(); onEscape?.() }}
    // Chrome can still close a modal whose cancel was prevented; reopen it while it is mounted.
    onClose={() => { if (ref.current?.isConnected) openModal(ref.current) }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onEscape?.() }
      else trapDialogTab(event)
    }}>{children}</dialog>
}
