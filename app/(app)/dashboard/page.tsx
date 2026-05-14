import Link from 'next/link'
import { db } from '@/lib/db'
import { DeleteCourseButton } from '@/components/dashboard/DeleteCourseButton'
import { ImportCourseButton } from '@/components/dashboard/ImportCourseButton'
import { ExportCourseButton } from '@/components/dashboard/ExportCourseButton'

function SparkleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.5 2.5M16 16l2.5 2.5M5.5 18.5L8 16M16 8l2.5-2.5"/>
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14zM4 19.5A2.5 2.5 0 006.5 22H20"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
    </svg>
  )
}

const COURSE_GRADIENTS = [
  'linear-gradient(135deg, #5B5FE5 0%, #8B5FE5 100%)',  // indigo → violet
  'linear-gradient(135deg, #2E7A53 0%, #5B5FE5 100%)',  // emerald → indigo
  'linear-gradient(135deg, #2A5DAE 0%, #5B5FE5 100%)',  // blue → indigo
  'linear-gradient(135deg, #5B5FE5 0%, #2A5DAE 100%)',  // indigo → blue
  'linear-gradient(135deg, #A07419 0%, #B23535 100%)',  // amber → terra
  'linear-gradient(135deg, #2E7A53 0%, #A07419 100%)',  // emerald → amber
  'linear-gradient(135deg, #14171F 0%, #5B5FE5 100%)',  // ink → indigo
  'linear-gradient(135deg, #B23535 0%, #5B5FE5 100%)',  // terra → indigo
]

function gradientFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return COURSE_GRADIENTS[Math.abs(hash) % COURSE_GRADIENTS.length]
}

function relativeDate(d: Date): string {
  const now = Date.now()
  const diff = now - d.getTime()
  const day = 86400_000
  if (diff < day) return 'Today'
  if (diff < 2 * day) return 'Yesterday'
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function DashboardPage() {
  const lessons = await db.lesson.findMany({
    select: { id: true, title: true, topic: true, provider: true, createdAt: true, content: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      {/* Page header */}
      <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2"
            style={{ color: 'var(--fg-4)' }}
          >
            Library
          </p>
          <h1
            className="text-[34px] font-medium tracking-[-0.018em] leading-[1.1]"
            style={{ fontFamily: 'var(--font-general-sans, system-ui)', color: 'var(--fg)' }}
          >
            {lessons.length === 0 ? 'Start your library.' : 'Your courses'}
          </h1>
          {lessons.length > 0 && (
            <p className="text-[14px] mt-2" style={{ color: 'var(--fg-3)' }}>
              {lessons.length} course{lessons.length !== 1 ? 's' : ''} · keep building your knowledge.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ImportCourseButton />
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[14px] font-medium transition-opacity duration-200 hover:opacity-90"
            style={{ background: 'var(--fg)', color: 'var(--bg)' }}
          >
            <SparkleIcon />
            New course
          </Link>
        </div>
      </div>

      {lessons.length === 0 ? (
        <div
          className="rounded-[16px] border py-24 text-center dot-grid"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
          <div
            className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)', border: '1px solid var(--border)' }}
          >
            <BookIcon />
          </div>
          <p
            className="text-[20px] font-medium mb-2 tracking-[-0.01em]"
            style={{ color: 'var(--fg)', fontFamily: 'var(--font-general-sans, system-ui)' }}
          >
            No courses yet
          </p>
          <p className="text-[14px] mb-7 max-w-sm mx-auto leading-[1.6]" style={{ color: 'var(--fg-3)' }}>
            Generate a complete, structured course on any topic — with diagrams, examples, and a tutor that knows what you're reading.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[14px] font-medium transition-opacity hover:opacity-90"
            style={{ background: 'var(--fg)', color: 'var(--bg)' }}
          >
            <SparkleIcon />
            Generate your first course
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map(lesson => {
            const sectionCount = (lesson.content as { sections?: unknown[] })?.sections?.length ?? 0
            const overview = (lesson.content as { overview?: string })?.overview ?? ''
            const gradient = gradientFor(lesson.id)
            return (
              <div key={lesson.id} className="group relative">
                <DeleteCourseButton id={lesson.id} />
                <ExportCourseButton
                  id={lesson.id}
                  title={lesson.title}
                  topic={lesson.topic}
                  provider={lesson.provider}
                  content={lesson.content}
                />
              <Link
                href={`/lessons/${lesson.id}`}
                className="lesson-card block rounded-[16px] overflow-hidden border"
                style={{
                  background: 'var(--bg-elev)',
                  borderColor: 'var(--border)',
                }}
              >
                {/* Cover strip */}
                <div
                  className="h-[88px] relative overflow-hidden flex items-end p-4"
                  style={{ background: gradient }}
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.18)', color: 'white', backdropFilter: 'blur(6px)' }}
                  >
                    {lesson.provider}
                  </span>
                </div>

                {/* Body */}
                <div className="p-5 pt-4">
                  <p
                    className="font-medium text-[16px] leading-[1.35] line-clamp-2 mb-2"
                    style={{ color: 'var(--fg)', fontFamily: 'var(--font-general-sans, system-ui)' }}
                  >
                    {lesson.title}
                  </p>
                  {overview && (
                    <p className="text-[13.5px] leading-[1.6] line-clamp-2" style={{ color: 'var(--fg-3)' }}>
                      {overview}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2.5 text-[11.5px]" style={{ color: 'var(--fg-4)' }}>
                      <span>{sectionCount} chapter{sectionCount !== 1 ? 's' : ''}</span>
                      <span style={{ color: 'var(--border-strong)' }}>·</span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon />
                        {relativeDate(new Date(lesson.createdAt))}
                      </span>
                    </div>
                    <span className="card-arrow" style={{ color: 'var(--fg-3)' }}>
                      <ArrowRight />
                    </span>
                  </div>
                </div>
              </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
