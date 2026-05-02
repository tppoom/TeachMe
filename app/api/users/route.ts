import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { id, email } = await req.json()
  if (!id || !email) {
    return NextResponse.json({ error: 'id and email required' }, { status: 400 })
  }
  await db.user.upsert({
    where: { id },
    update: {},
    create: { id, email },
  })
  return NextResponse.json({ ok: true })
}
