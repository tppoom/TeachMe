'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const Ctx = createContext<{ theme: Theme; toggle: () => void }>(null!)

function readCookieTheme(): Theme | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)theme=(light|dark)/)
  return (m?.[1] as Theme) ?? null
}

function writeCookieTheme(t: Theme) {
  // 1 year, root path, lax — readable by the server on next request
  document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`
}

export function ThemeProvider({
  initialTheme = 'light',
  children,
}: {
  initialTheme?: Theme
  children: React.ReactNode
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  // Hydrate from client storage if it disagrees with the SSR value
  useEffect(() => {
    const stored =
      readCookieTheme() ??
      ((localStorage.getItem('theme') as Theme | null) || null)
    if (stored && stored !== theme) setTheme(stored)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem('theme', theme) } catch {}
    writeCookieTheme(theme)
  }, [theme])

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>
      {children}
    </Ctx.Provider>
  )
}

export const useTheme = () => useContext(Ctx)
