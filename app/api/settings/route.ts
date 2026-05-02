import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbUser = await db.user.findUnique({ where: { id: user.id } })
  return NextResponse.json({
    hasAnthropicKey: !!dbUser?.anthropicKeyEnc,
    hasOpenaiKey: !!dbUser?.openaiKeyEnc,
    activeProvider: dbUser?.activeProvider ?? 'anthropic',
  })
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { anthropicKey, openaiKey, activeProvider } = await req.json()

  await db.user.update({
    where: { id: user.id },
    data: {
      ...(anthropicKey ? { anthropicKeyEnc: encrypt(anthropicKey) } : {}),
      ...(openaiKey ? { openaiKeyEnc: encrypt(openaiKey) } : {}),
      ...(activeProvider ? { activeProvider } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider } = await req.json()
  await db.user.update({
    where: { id: user.id },
    data: provider === 'anthropic' ? { anthropicKeyEnc: null } : { openaiKeyEnc: null },
  })

  return NextResponse.json({ ok: true })
}
