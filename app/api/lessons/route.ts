import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateCourse } from '@/lib/ai/pipeline'
import { getActiveProvider } from '@/lib/ai/provider'
import type { LessonContent } from '@/types/lesson'
import type { Prisma } from '@prisma/client'

/**
 * Streams pipeline events as newline-delimited JSON (NDJSON).
 * The client (`CreateForm`) reads one event per line.
 *
 * Event types are defined in `lib/ai/pipeline-types.ts`.
 */
export async function POST(req: Request) {
  const { topic, priorKnowledge, goals, referenceTexts } = await req.json()
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }

      try {
        for await (const event of generateCourse({ topic, priorKnowledge, goals, referenceTexts })) {
          if (event.type === 'complete') {
            // Persist and emit a lessonId event.
            const content: LessonContent = event.content
            const provider = await getActiveProvider()
            const lesson = await db.lesson.create({
              data: {
                title: topic,
                topic,
                priorKnowledge: priorKnowledge ?? null,
                goals: goals ?? null,
                provider,
                content: content as unknown as Prisma.InputJsonValue,
                atlas: event.atlas as unknown as Prisma.InputJsonValue,
                syllabus: event.syllabus as unknown as Prisma.InputJsonValue,
                language: event.profile.language ?? 'English',
                sourceUrls: '[]',
                sourceFiles: '[]',
              },
            })
            send({ type: 'lessonId', id: lesson.id })
          } else {
            send(event)
          }
        }
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : String(e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}

export async function GET() {
  const lessons = await db.lesson.findMany({
    select: { id: true, title: true, topic: true, provider: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(lessons)
}
