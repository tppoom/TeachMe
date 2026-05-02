import { streamText } from 'ai'
import { getProviderModel } from './provider'
import type { Depth } from '@/types/lesson'

interface GenerateLessonParams {
  userId: string
  topic: string
  depth: Depth
  priorKnowledge?: string
  goals?: string
  referenceTexts?: string[]
}

const SYSTEM_PROMPT = `You are an expert educator. Generate a comprehensive, structured lesson in valid JSON only — no markdown, no prose outside the JSON.

Return this exact structure:
{
  "overview": "string — 2-3 sentence intro to the topic",
  "sections": [
    {
      "id": "s1",
      "title": "Section title",
      "content": "Detailed prose explanation (300-600 words). Be thorough.",
      "keyPoints": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
      "summary": "1-2 sentence section summary",
      "visuals": []
    }
  ],
  "summary": "Overall lesson summary (2-3 sentences)"
}

For visuals, insert objects inside the visuals array with one of these shapes:
- Mermaid diagram: { "type": "mermaid", "title": "...", "syntax": "flowchart TD\\n  A-->B", "diagramType": "flowchart" }
- Chart: { "type": "chart", "title": "...", "chartType": "bar", "data": { "labels": [...], "datasets": [{ "label": "...", "data": [...] }] } }
- Code: { "type": "code", "title": "...", "language": "python", "code": "...", "explanation": "..." }

Rules:
- Generate 4-7 sections depending on depth
- Include at least 2 visuals total across all sections
- For programming topics, always include at least one runnable code visual
- Each section content must be detailed and educational, not surface-level
- Return ONLY the JSON object, nothing else`

export async function generateLesson(params: GenerateLessonParams) {
  const model = await getProviderModel(params.userId)

  const referenceBlock = params.referenceTexts?.length
    ? `\n\nReference material provided by the user:\n${params.referenceTexts.join('\n\n---\n\n')}`
    : ''

  const userPrompt = `Topic: ${params.topic}
Depth: ${params.depth}
${params.priorKnowledge ? `Prior knowledge: ${params.priorKnowledge}` : ''}
${params.goals ? `Learning goals: ${params.goals}` : ''}${referenceBlock}`

  return streamText({ model, system: SYSTEM_PROMPT, prompt: userPrompt, maxOutputTokens: 8000 })
}
