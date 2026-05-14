'use client'
import { useEffect, useState } from 'react'
import type { LessonSection } from '@/types/lesson'
import { stripInline } from './inline-md'

interface TableOfContentsProps {
  sections: LessonSection[]
  topic: string
  depth: string
  onSectionChange?: (sectionId: string) => void
}

export function TableOfContents({ sections, topic, depth, onSectionChange }: TableOfContentsProps) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(e => e.isIntersecting)
        if (visible) {
          setActive(visible.target.id)
          onSectionChange?.(visible.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections, onSectionChange])

  return (
    <div>
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3"
        style={{ color: 'var(--fg-4)' }}
      >
        On this page
      </p>
      <nav className="space-y-0.5">
        {sections.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="block text-[13px] py-1.5 pl-3 transition-all duration-150 leading-[1.4]"
            style={{
              color: active === s.id ? 'var(--fg)' : 'var(--fg-3)',
              borderLeft: active === s.id ? '2px solid var(--fg)' : '2px solid transparent',
              fontWeight: active === s.id ? 500 : 400,
            }}
            onMouseEnter={e => {
              if (active !== s.id) (e.currentTarget as HTMLElement).style.color = 'var(--fg-2)'
            }}
            onMouseLeave={e => {
              if (active !== s.id) (e.currentTarget as HTMLElement).style.color = 'var(--fg-3)'
            }}
          >
            {stripInline(s.title)}
          </a>
        ))}
      </nav>
      <div
        className="mt-6 pt-5 space-y-1.5"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <p className="text-[12px]" style={{ color: 'var(--fg-4)' }}>📚 {topic}</p>
        <p className="text-[12px] capitalize" style={{ color: 'var(--fg-4)' }}>🎯 {depth}</p>
      </div>
    </div>
  )
}
