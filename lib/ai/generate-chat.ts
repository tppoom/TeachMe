import { streamText } from 'ai'
import { getProviderModel } from './provider'
import type { LessonContent } from '@/types/lesson'

interface ChatParams {
  userId: string
  lessonContent: LessonContent
  currentSectionId: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

export async function generateChat({
  userId,
  lessonContent,
  currentSectionId,
  messages,
}: ChatParams) {
  const model = await getProviderModel(userId)
  const currentSection = lessonContent.sections.find(s => s.id === currentSectionId)

  const system = `You are a knowledgeable, friendly tutor helping a student understand a lesson they are currently reading.

LESSON OVERVIEW:
${lessonContent.overview}

CURRENT SECTION THE STUDENT IS READING:
Title: ${currentSection?.title ?? 'Unknown'}
Content: ${currentSection?.content ?? ''}
Key Points: ${currentSection?.keyPoints.join(', ') ?? ''}

FULL LESSON SECTIONS (for context):
${lessonContent.sections.map(s => `- ${s.title}: ${s.summary}`).join('\n')}

Instructions:
- Answer questions specifically about this lesson and the current section
- Keep answers concise (2-4 sentences unless more is needed)
- Use examples from the lesson when possible
- If asked something outside the lesson scope, gently redirect to the lesson topic
- Use markdown code blocks when referencing code`

  return streamText({ model, system, messages, maxOutputTokens: 1000 })
}
