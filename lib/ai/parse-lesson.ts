import type { LessonContent } from '@/types/lesson'

export function parseLessonContent(raw: string): LessonContent {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed.sections)) {
    throw new Error('sections array missing from lesson JSON')
  }
  return parsed as LessonContent
}
