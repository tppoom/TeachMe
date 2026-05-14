'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { LessonExportProvider, useLessonExport } from '@/lib/lesson-export-context'

function Logo() {
  // Matches the Tutor Chat avatar style: --fg plate, --bg ink. The SVG uses
  // currentColor so it inverts cleanly with the theme — dark plate / light
  // mark in light mode, light plate / dark mark in dark mode.
  return (
    <span
      style={{
        width: 28, height: 28,
        borderRadius: 9,
        background: 'var(--fg)',
        color: 'var(--bg)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={15} height={15} viewBox="0 0 16 16" fill="none">
        <path d="M2 4.5L8 1.5L14 4.5L8 7.5L2 4.5Z" fill="currentColor" opacity="0.98"/>
        <path d="M2 8L8 11L14 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.65"/>
        <path d="M2 11.5L8 14.5L14 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
      </svg>
    </span>
  )
}

function SunIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function ExportNavButton() {
  const { exportFn } = useLessonExport()
  if (!exportFn) return null
  return (
    <button
      onClick={exportFn}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
      style={{ color: 'var(--fg-3)', background: 'transparent' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--fg)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--fg-3)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      title="Export course as .teachme file"
    >
      <ExportIcon />
      Export
    </button>
  )
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
]

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Top nav */}
      <header
        className="sticky top-0 z-50 flex items-center h-14 px-6 border-b"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5 mr-8 select-none">
          <Logo />
          <span
            className="font-semibold text-[15px] tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-general-sans, system-ui)', color: 'var(--fg)' }}
          >
            TeachMe
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  color: active ? 'var(--fg)' : 'var(--fg-3)',
                  background: active ? 'var(--bg-sunken)' : 'transparent',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--fg)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--fg-3)' }}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        <ExportNavButton />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200"
          style={{ color: 'var(--fg-3)', background: 'transparent' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--fg)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--fg-3)'
          }}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <main>{children}</main>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LessonExportProvider>
      <AppShell>{children}</AppShell>
    </LessonExportProvider>
  )
}
