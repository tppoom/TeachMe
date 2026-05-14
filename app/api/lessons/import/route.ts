import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { LessonContent } from '@/types/lesson'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const file = body as Record<string, unknown>

  if (file.format !== 'teachme-course') {
    return NextResponse.json({ error: 'Unrecognized file format' }, { status: 400 })
  }

  const content = file.content as LessonContent
  if (!content?.sections || !Array.isArray(content.sections) || content.sections.length === 0) {
    return NextResponse.json({ error: 'Course file has no sections' }, { status: 400 })
  }

  const title = typeof file.title === 'string' && file.title ? file.title : 'Imported Course'
  const topic = typeof file.topic === 'string' && file.topic ? file.topic : title
  const provider = typeof file.provider === 'string' ? file.provider : 'anthropic'

  const lesson = await db.lesson.create({
    data: {
      title,
      topic,
      provider,
      content: content as object,
      sourceUrls: '[]',
      sourceFiles: '[]',
    },
  })

  return NextResponse.json({ id: lesson.id })
}
