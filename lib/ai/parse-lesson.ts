import type { LessonContent } from '@/types/lesson'

export function parseLessonContent(raw: string): LessonContent {
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const parsed = JSON.parse(stripped)
  if (!Array.isArray(parsed.sections)) {
    throw new Error('sections array missing from lesson JSON')
  }
  return parsed as LessonContent
}
