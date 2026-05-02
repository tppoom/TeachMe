import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { generateLesson } from '@/lib/ai/generate-lesson'
import { parseLessonContent } from '@/lib/ai/parse-lesson'

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topic, depth, priorKnowledge, goals, referenceTexts } = await req.json()
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 })

  try {
    const stream = await generateLesson({
      userId: user.id,
      topic,
      depth: depth ?? 'beginner',
      priorKnowledge,
      goals,
      referenceTexts,
    })

    let fullText = ''
    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream.textStream) {
            fullText += chunk
            controller.enqueue(encoder.encode(chunk))
          }

          const content = parseLessonContent(fullText) as unknown as import('@prisma/client').Prisma.InputJsonValue
          const dbUser = await db.user.findUnique({ where: { id: user.id } })
          const lesson = await db.lesson.create({
            data: {
              userId: user.id,
              title: topic,
              topic,
              priorKnowledge: priorKnowledge ?? null,
              goals: goals ?? null,
              depth: depth ?? 'beginner',
              provider: dbUser?.activeProvider ?? 'anthropic',
              content,
              sourceUrls: [],
              sourceFiles: [],
            },
          })
          controller.enqueue(encoder.encode(`\n\n__LESSON_ID__${lesson.id}__`))
        } catch (e: any) {
          controller.enqueue(encoder.encode(`\n\n__ERROR__${e.message}`))
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lessons = await db.lesson.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, topic: true, depth: true, provider: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(lessons)
}
