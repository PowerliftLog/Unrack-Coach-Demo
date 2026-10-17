import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PublicDemo from './demo/PublicDemo'
import { initializeTheme } from './lib/theme'
import './styles.css'
initializeTheme()
createRoot(document.getElementById('root')!).render(<StrictMode><PublicDemo /></StrictMode>)
