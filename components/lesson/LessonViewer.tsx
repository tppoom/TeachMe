'use client'
import { useState } from 'react'
import { TableOfContents } from './TableOfContents'
import { SectionBlock } from './SectionBlock'
import type { LessonRecord } from '@/types/lesson'

export function LessonViewer({ lesson }: { lesson: LessonRecord }) {
  const [activeSectionId, setActiveSectionId] = useState(
    lesson.content.sections[0]?.id ?? ''
  )

  return (
    <div className="flex gap-8 relative">
      {/* Left: TOC */}
      <aside className="w-56 flex-shrink-0">
        <div className="sticky top-6">
          <TableOfContents
            sections={lesson.content.sections}
            topic={lesson.topic}
            depth={lesson.depth}
            onSectionChange={setActiveSectionId}
          />
        </div>
      </aside>

      {/* Center: lesson content */}
      <article className="flex-1 min-w-0 space-y-12 pb-24">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
            Lesson
          </p>
          <h1 className="text-3xl font-bold">{lesson.title}</h1>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            {lesson.content.overview}
          </p>
        </div>
        {lesson.content.sections.map((section, i) => (
          <SectionBlock key={section.id} section={section} index={i} />
        ))}
        <div className="border-t pt-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Summary
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {lesson.content.summary}
          </p>
        </div>
      </article>

      {/* Right: AI Tutor placeholder — wired in Task 13 */}
      <aside className="w-72 flex-shrink-0">
        <div className="sticky top-6 border rounded-xl bg-muted/20 p-4 text-sm text-muted-foreground">
          AI Tutor — coming in Task 13
        </div>
      </aside>
    </div>
  )
}
