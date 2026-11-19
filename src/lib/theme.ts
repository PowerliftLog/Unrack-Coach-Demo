export type Theme = 'light' | 'dark'

const themeStorageKey = 'unrack-coach-theme'

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>
type ThemeMedia = Pick<MediaQueryList, 'matches'>

export function resolveInitialTheme(storage: ThemeStorage, media: ThemeMedia): Theme {
  const saved = storage.getItem(themeStorageKey)
  if (saved === 'light' || saved === 'dark') return saved
  return media.matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme, root: HTMLElement, storage?: ThemeStorage) {
  root.dataset.theme = theme
  root.style.colorScheme = theme
  storage?.setItem(themeStorageKey, theme)
}

// Coach ships one working theme (the builder's green palette). Dark mode is retired.
export function initializeTheme(): Theme {
  applyTheme('light', document.documentElement)
  return 'light'
}
