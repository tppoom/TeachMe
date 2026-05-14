import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runModifyChapter, runAddChapter } from '@/lib/ai/pipeline'
import type {
  Atlas,
  Syllabus,
  LearnerProfile,
  TopicFrame,
  CourseInputs,
  ModifyIntent,
  ModifyScope,
  ChapterPlan,
} from '@/lib/ai/pipeline-types'
import type { LessonContent, LessonSection } from '@/types/lesson'
import type { Prisma } from '@prisma/client'

/**
 * Apply a learner-driven change to a course.
 *
 * Body:
 *   {
 *     scope: 'chapter' | 'subtopic' | 'all_chapters' | 'add_chapter' | 'direction'
 *     intent: 'edit' | 'expand' | 'simplify' | 'restructure'
 *     instruction: string
 *
 *     // when scope === 'chapter' | 'subtopic'
 *     chapterIndex?: number
 *     subtopicId?: string
 *
 *     // when scope === 'add_chapter'
 *     insertAfter?: number   // -1 = prepend, default = append
 *   }
 *
 * Response: { content: LessonContent }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lesson = await db.lesson.findUnique({ where: { id } })
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  const atlas = lesson.atlas as unknown as Atlas | null
  const syllabus = lesson.syllabus as unknown as Syllabus | null
  if (!atlas || !syllabus) {
    return NextResponse.json(
      { error: 'This lesson was generated before modification was supported. Try a fresh course.' },
      { status: 400 },
    )
  }

  const body = await req.json().catch(() => null) as null | {
    scope?: ModifyScope
    intent?: ModifyIntent
    instruction?: string
    chapterIndex?: number
    subtopicId?: string
    insertAfter?: number
  }
  if (!body) {
    return NextResponse.json({ error: 'Body required' }, { status: 400 })
  }

  const scope: ModifyScope =
    body.scope === 'subtopic' ? 'subtopic'
      : body.scope === 'all_chapters' ? 'all_chapters'
      : body.scope === 'add_chapter' ? 'add_chapter'
      : body.scope === 'direction' ? 'direction'
      : 'chapter'
  const intent: ModifyIntent =
    body.intent === 'expand' ? 'expand'
      : body.intent === 'simplify' ? 'simplify'
      : body.intent === 'restructure' ? 'restructure'
      : 'edit'
  const instruction = (body.instruction ?? '').trim()
  if (!instruction) {
    return NextResponse.json({ error: 'instruction is required' }, { status: 400 })
  }

  const oldContent = lesson.content as unknown as LessonContent

  const inputs: CourseInputs = {
    topic: lesson.topic,
    priorKnowledge: lesson.priorKnowledge ?? undefined,
    goals: lesson.goals ?? undefined,
    referenceTexts: [],
  }
  const profile: LearnerProfile = {
    priorKnowledge: lesson.priorKnowledge ? [lesson.priorKnowledge] : [],
    goal: lesson.goals ?? `Become competent at ${lesson.topic}`,
    audience: 'beginner with adjacent experience',
    inputMode: lesson.goals ? 'topic_with_goal' : 'topic_only',
    topicCategory: 'mixed',
    requestedStyle: 'structured_course',
    materialsTreatment: 'not_applicable',
    depthPreference: 'standard',
    specialRequests: [],
    language: (lesson as unknown as { language?: string }).language ?? 'English',
  }
  const frame: TopicFrame = {
    topic: lesson.topic,
    framing: '',
    context: '',
    subAreas: [],
    referenceConcepts: [],
    materialsHaveCode: false,
  }

  let newContent: LessonContent

  try {
    if (scope === 'add_chapter') {
      const insertAfter =
        typeof body.insertAfter === 'number'
          ? Math.max(-1, Math.min(syllabus.chapters.length - 1, body.insertAfter))
          : syllabus.chapters.length - 1
      const { plan: newPlan, section: newSection } = await runAddChapter({
        inputs, profile, frame, atlas, syllabus,
        insertAfter,
        instruction,
      })

      // Insert into syllabus.chapters and content.sections at the same position.
      const insertIndex = insertAfter + 1
      const newChapters: ChapterPlan[] = [
        ...syllabus.chapters.slice(0, insertIndex),
        newPlan,
        ...syllabus.chapters.slice(insertIndex),
      ]
      const newSections: LessonSection[] = [
        ...oldContent.sections.slice(0, insertIndex),
        newSection,
        ...oldContent.sections.slice(insertIndex),
      ]

      const updatedSyllabus: Syllabus = { ...syllabus, chapters: newChapters }
      newContent = { ...oldContent, sections: newSections }

      await db.lesson.update({
        where: { id },
        data: {
          content: newContent as unknown as Prisma.InputJsonValue,
          syllabus: updatedSyllabus as unknown as Prisma.InputJsonValue,
        },
      })
      return NextResponse.json({ content: newContent })
    }

    if (scope === 'all_chapters' || scope === 'direction') {
      // Loop modify across every chapter sequentially. For 'direction', wrap the
      // user's instruction with a frame so the model treats it as a course-wide
      // direction shift rather than a per-chapter edit.
      const wrappedInstruction = scope === 'direction'
        ? `The course direction is being adjusted: ${instruction}\n\nApply this directional change to THIS chapter — its framing, examples, and emphasis should follow the new direction. Don't introduce concepts the rest of the course no longer covers.`
        : instruction

      const updatedSections: LessonSection[] = []
      for (let i = 0; i < syllabus.chapters.length; i++) {
        const chapter = syllabus.chapters[i]
        try {
          const updated = await runModifyChapter({
            inputs, profile, frame, atlas, syllabus, chapter,
            chapterIndex: i,
            scope: 'chapter',
            intent,
            instruction: wrappedInstruction,
          })
          updatedSections.push(updated)
        } catch (e) {
          // Keep the original on failure so partial failures don't wipe content
          updatedSections.push(oldContent.sections[i])
          console.error(`Modify-all chapter ${i} failed:`, e)
        }
      }
      newContent = { ...oldContent, sections: updatedSections }
      await db.lesson.update({
        where: { id },
        data: { content: newContent as unknown as Prisma.InputJsonValue },
      })
      return NextResponse.json({ content: newContent })
    }

    // scope === 'chapter' or 'subtopic'
    if (typeof body.chapterIndex !== 'number') {
      return NextResponse.json({ error: 'chapterIndex (number) is required for chapter/subtopic scope' }, { status: 400 })
    }
    if (scope === 'subtopic' && !body.subtopicId) {
      return NextResponse.json({ error: 'subtopicId is required when scope === "subtopic"' }, { status: 400 })
    }
    const chapter = syllabus.chapters[body.chapterIndex]
    if (!chapter) {
      return NextResponse.json({ error: 'chapterIndex out of range' }, { status: 400 })
    }

    const updatedChapter = await runModifyChapter({
      inputs, profile, frame, atlas, syllabus, chapter,
      chapterIndex: body.chapterIndex,
      scope,
      subtopicId: body.subtopicId,
      intent,
      instruction,
    })

    const newSections = oldContent.sections.map((s, i) => {
      if (i !== body.chapterIndex) return s
      if (scope === 'chapter') return updatedChapter
      const target = updatedChapter.subtopics?.find(st => st.id === body.subtopicId)
      if (!target) return s
      const newSubtopics = (s.subtopics ?? []).map(st => st.id === body.subtopicId ? target : st)
      return { ...s, subtopics: newSubtopics }
    })
    newContent = { ...oldContent, sections: newSections }

    await db.lesson.update({
      where: { id },
      data: { content: newContent as unknown as Prisma.InputJsonValue },
    })
    return NextResponse.json({ content: newContent })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Modification failed' },
      { status: 500 },
    )
  }
}
