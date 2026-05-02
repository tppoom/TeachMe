import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createUIMessageStreamResponse, createUIMessageStream, convertToModelMessages, type UIMessage } from 'ai'
import { generateChat } from '@/lib/ai/generate-chat'
import type { LessonContent } from '@/types/lesson'

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, lessonContent, currentSectionId } = await req.json() as {
    messages: UIMessage[]
    lessonContent: LessonContent
    currentSectionId: string
  }

  // Convert UIMessages to ModelMessages for the AI SDK
  const modelMessages = await convertToModelMessages(messages)
  // Extract simple role/content pairs for our generateChat function
  const chatMessages = modelMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string'
        ? m.content
        : m.content
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text)
            .join(''),
    }))

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = await generateChat({
        userId: user.id,
        lessonContent,
        currentSectionId,
        messages: chatMessages,
      })

      writer.merge(result.toUIMessageStream())
    },
  })

  return createUIMessageStreamResponse({ stream })
}
