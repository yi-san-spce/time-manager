import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ThemeMode } from '@shared/types/ui'

interface ThemeContextValue {
  themeMode: ThemeMode
  effectiveTheme: 'light' | 'dark'
  setThemeMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')
  const [systemPrefersDark, setSystemPrefersDark] = useState(prefersDark())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.settings.getUIConfig().then((config) => {
      setThemeModeState(config.themeMode)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    return window.api.settings.onEffectiveThemeChanged((effective) => {
      setSystemPrefersDark(effective === 'dark')
    })
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (e: MediaQueryListEvent): void => setSystemPrefersDark(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  const effectiveTheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  function setThemeMode(mode: ThemeMode): void {
    setThemeModeState(mode)
    void window.api.settings.setUIConfig({ themeMode: mode })
  }

  const value = useMemo(
    () => ({ themeMode, effectiveTheme, setThemeMode }),
    [themeMode, effectiveTheme]
  )

  if (!loaded) return <></>

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
