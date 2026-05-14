import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { LessonViewer } from '@/components/lesson/LessonViewer'
import type { LessonRecord } from '@/types/lesson'
import type { Atlas, Syllabus } from '@/lib/ai/pipeline-types'

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lesson = await db.lesson.findUnique({ where: { id } })
  if (!lesson) notFound()

  const atlas = (lesson.atlas ?? null) as Atlas | null
  const syllabus = (lesson.syllabus ?? null) as Syllabus | null
  const language = (lesson as unknown as { language?: string }).language ?? 'English'

  return (
    <LessonViewer
      lesson={lesson as unknown as LessonRecord}
      atlas={atlas}
      syllabus={syllabus}
      language={language}
    />
  )
}
