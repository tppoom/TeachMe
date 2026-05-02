import { KeyPoints } from './KeyPoints'
import type { LessonSection, Visual } from '@/types/lesson'

function VisualBlock({ visual }: { visual: Visual }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
      [{visual.type.toUpperCase()}] {visual.title} — visual rendering coming soon
    </div>
  )
}

interface SectionBlockProps {
  section: LessonSection
  index: number
}

export function SectionBlock({ section, index }: SectionBlockProps) {
  return (
    <div id={section.id} className="space-y-4 scroll-mt-6">
      <div className="flex items-center gap-3">
        <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="text-xl font-semibold">{section.title}</h2>
      </div>
      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {section.content}
      </p>
      {section.visuals.map((v, i) => (
        <VisualBlock key={i} visual={v} />
      ))}
      <KeyPoints points={section.keyPoints} />
      <p className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">
        {section.summary}
      </p>
    </div>
  )
}
