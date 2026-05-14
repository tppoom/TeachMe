import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { LessonContent } from '@/types/lesson'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lesson = await db.lesson.findUnique({ where: { id } })
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lesson)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { content } = await req.json() as { content: LessonContent }
  const lesson = await db.lesson.update({ where: { id }, data: { content: content as object } })
  return NextResponse.json(lesson)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.lesson.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
