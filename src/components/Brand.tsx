import { useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { APP_NAME } from '../config'

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="12" height="24" fill="currentColor" />
      <rect x="12" width="6" height="6" fill="currentColor" />
      <rect x="18" y="6" width="6" height="6" fill="currentColor" />
      <rect x="12" y="12" width="6" height="6" fill="currentColor" />
      <rect x="18" y="18" width="6" height="6" fill="currentColor" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark size={22} />
      {APP_NAME}
    </span>
  )
}

export function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

type Theme = 'light' | 'dark'

const themeListeners = new Set<() => void>()

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener)
  return () => themeListeners.delete(listener)
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem('theme', theme)
  } catch {
    // Private windows can block storage. The toggle still works for this visit.
  }
  themeListeners.forEach((listener) => listener())
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <motion.button className="icon-button" type="button" aria-label={`Switch to ${next} theme`} whileHover={{ y: -1 }} whileTap={{ scale: 0.92 }} onClick={() => applyTheme(next)}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </motion.button>
  )
}
