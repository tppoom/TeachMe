import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { LessonViewer } from '@/components/lesson/LessonViewer'
import type { LessonRecord } from '@/types/lesson'

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const lesson = await db.lesson.findFirst({ where: { id, userId: user.id } })
  if (!lesson) notFound()

  return <LessonViewer lesson={lesson as unknown as LessonRecord} />
}
