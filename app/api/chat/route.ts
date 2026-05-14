import { createUIMessageStreamResponse, createUIMessageStream, convertToModelMessages, type UIMessage } from 'ai'
import { generateChat, buildChatSystem, buildChatUserTurn } from '@/lib/ai/generate-chat'
import { getActiveProvider, streamCompletion } from '@/lib/ai/provider'
import type { LessonContent } from '@/types/lesson'

export async function POST(req: Request) {
  const { messages, lessonContent, currentSectionId, language } = await req.json() as {
    messages: UIMessage[]
    lessonContent: LessonContent
    currentSectionId: string
    language?: string
  }

  const modelMessages = await convertToModelMessages(messages)
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

  const provider = await getActiveProvider()
  const isCli = provider === 'claude-code' || provider === 'gemini-cli' || provider === 'codex-cli'

  // CLI providers: render the conversation as a flat prompt and stream the reply.
  if (isCli) {
    const system = buildChatSystem(lessonContent, currentSectionId, language)
    const userTurn = buildChatUserTurn(chatMessages)
    const partId = 'cli-text-0'

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: 'text-start', id: partId } as any)
        for await (const chunk of streamCompletion({ system, prompt: userTurn, maxOutputTokens: 800 })) {
          writer.write({ type: 'text-delta', id: partId, delta: chunk } as any)
        }
        writer.write({ type: 'text-end', id: partId } as any)
      },
    })
    return createUIMessageStreamResponse({ stream })
  }

  // API providers: AI SDK message-stream path.
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = await generateChat({ lessonContent, currentSectionId, messages: chatMessages, language })
      writer.merge(result.toUIMessageStream())
    },
  })

  return createUIMessageStreamResponse({ stream })
}
