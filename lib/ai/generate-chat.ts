import { streamText } from 'ai'
import { getProviderModel } from './provider'
import { INSTRUCTOR_PERSONA } from './teaching'
import type { LessonContent } from '@/types/lesson'

interface ChatParams {
  lessonContent: LessonContent
  currentSectionId: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  language?: string
}

/**
 * Render the current chapter into a self-contained teaching context.
 * Includes objective, hook, every subtopic's content + examples + mistakes.
 * The tutor sees what the learner is actually reading — not just the title.
 */
function renderSectionForChat(section: LessonContent['sections'][number]): string {
  const lines: string[] = []
  if (section.objective) lines.push(`OBJECTIVE: ${section.objective}`)
  if (section.hook) lines.push(`\nHOOK: ${section.hook}`)
  if (section.subtopics && section.subtopics.length > 0) {
    for (const st of section.subtopics) {
      lines.push(`\n### ${st.title}`)
      if (st.summary) lines.push(`(summary: ${st.summary})`)
      if (st.content) lines.push(st.content)
      if (st.examples && st.examples.length > 0) {
        for (const ex of st.examples) {
          lines.push(`Example — ${ex.title}: ${ex.body}`)
          if (ex.code) lines.push('```' + (ex.language ?? '') + '\n' + ex.code + '\n```')
        }
      }
      if (st.commonMistakes && st.commonMistakes.length > 0) {
        lines.push('Common mistakes:')
        for (const m of st.commonMistakes) lines.push(`- ${m}`)
      }
    }
  } else if (section.content) {
    lines.push(section.content)
  }
  if (section.summary) lines.push(`\nCHAPTER SUMMARY: ${section.summary}`)
  return lines.join('\n').trim()
}

export function buildChatSystem(lessonContent: LessonContent, currentSectionId: string, language: string = 'English'): string {
  const lang = language?.trim() || 'English'
  const langDirective = lang.toLowerCase() === 'english'
    ? `RESPOND IN: English`
    : `RESPOND IN: ${lang} — always, regardless of what language the learner writes in.`

  const allChapters = lessonContent.sections.map((s, i) => {
    const isCurrent = s.id === currentSectionId
    const content = renderSectionForChat(s)
    return `${'─'.repeat(60)}
CHAPTER ${i + 1}${isCurrent ? ' ◀ LEARNER IS READING THIS NOW' : ''}: ${s.title}
${content}`
  }).join('\n\n')

  return `${langDirective}

You are the tutor for this course. You have the full course content below. The learner is currently reading the chapter marked "◀ LEARNER IS READING THIS NOW" and has asked a question.

RULES:
- No openers ("Great question!"), no closings ("Hope that helps!"), no restating the question.
- Ground your answer in the course content. Reference specific concepts, examples, or analogies from the chapters when relevant.
- If the question touches another chapter, briefly note it.

FORMAT — pick whichever fits best:
- Simple fact → 1–2 sentences.
- Explanation → a short intro sentence, then 3–5 bullet points covering the key points.
- Step-by-step process → numbered list.
- Comparison → a small markdown table.
- Code question → brief explanation + one focused code block.
Never write a wall of plain prose. Always break it up with bullets, a list, or a table.

━━━ COURSE OVERVIEW ━━━
${lessonContent.overview}

━━━ FULL COURSE CONTENT ━━━
${allChapters}`
}

export function buildChatUserTurn(messages: { role: 'user' | 'assistant'; content: string }[]): string {
  return messages.map(m =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n\n') + '\n\nAssistant:'
}

export async function generateChat({ lessonContent, currentSectionId, messages, language }: ChatParams) {
  const system = buildChatSystem(lessonContent, currentSectionId, language)
  const model = await getProviderModel()
  return streamText({ model: model!, system, messages, maxOutputTokens: 800 })
}
