'use client'
import { useEffect, useState } from 'react'
import type { LessonSection } from '@/types/lesson'

interface TableOfContentsProps {
  sections: LessonSection[]
  topic: string
  depth: string
  onSectionChange?: (sectionId: string) => void
}

export function TableOfContents({
  sections,
  topic,
  depth,
  onSectionChange,
}: TableOfContentsProps) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting)
        if (visible) {
          setActive(visible.target.id)
          onSectionChange?.(visible.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections, onSectionChange])

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Contents
      </p>
      <nav className="space-y-1">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`block text-sm px-2 py-1.5 rounded transition-colors ${
              active === s.id
                ? 'bg-primary/10 text-primary border-l-2 border-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.title}
          </a>
        ))}
      </nav>
      <div className="border-t pt-4 space-y-1">
        <p className="text-xs text-muted-foreground">📚 {topic}</p>
        <p className="text-xs text-muted-foreground capitalize">🎯 {depth}</p>
      </div>
    </div>
  )
}
