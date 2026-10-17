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

export function initializeTheme(): Theme {
  const theme = __LOCAL_REVIEW__ ? resolveInitialTheme(
    window.localStorage,
    window.matchMedia('(prefers-color-scheme: dark)'),
  ) : 'light'
  applyTheme(theme, document.documentElement)
  return theme
}
