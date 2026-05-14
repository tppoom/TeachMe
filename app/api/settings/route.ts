import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { db } from '@/lib/db'
import { hasApiKey, setApiKey, clearApiKey } from '@/lib/ai/provider'

type ApiKeyKind = 'anthropic' | 'openai' | 'gemini'

const VALID_KINDS: readonly ApiKeyKind[] = ['anthropic', 'openai', 'gemini'] as const

function cliInstalled(cmd: string): boolean {
  try { execSync(`which ${cmd}`, { stdio: 'pipe' }); return true } catch { return false }
}

export async function GET() {
  const config = await db.config.findUnique({ where: { key: 'activeProvider' } })
  const [hasAnthropicKey, hasOpenaiKey, hasGeminiKey] = await Promise.all([
    hasApiKey('anthropic'),
    hasApiKey('openai'),
    hasApiKey('gemini'),
  ])
  const cliAvailable = {
    'claude-code': cliInstalled('claude'),
    'gemini-cli':  cliInstalled('gemini'),
    'codex-cli':   cliInstalled('codex'),
  }
  return NextResponse.json({
    activeProvider: config?.value ?? 'none',
    hasAnthropicKey,
    hasOpenaiKey,
    hasGeminiKey,
    cliAvailable,
  })
}

/**
 * POST handles two actions:
 *   1. Set the active provider:  { activeProvider: 'gemini-cli' }
 *   2. Save an API key:          { kind: 'anthropic'|'openai'|'gemini', value: 'sk-...' }
 *
 * Both can appear in one request; either is optional.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as null | {
    activeProvider?: string
    kind?: string
    value?: string
  }
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  if (body.activeProvider) {
    await db.config.upsert({
      where: { key: 'activeProvider' },
      update: { value: body.activeProvider },
      create: { key: 'activeProvider', value: body.activeProvider },
    })
  }

  if (body.kind && body.value) {
    if (!(VALID_KINDS as readonly string[]).includes(body.kind)) {
      return NextResponse.json({ error: 'Unknown key kind' }, { status: 400 })
    }
    const trimmed = body.value.trim()
    if (!trimmed) return NextResponse.json({ error: 'Key value is empty' }, { status: 400 })
    await setApiKey(body.kind as ApiKeyKind, trimmed)
  }

  return NextResponse.json({ ok: true })
}

/** DELETE clears a saved API key:  ?kind=anthropic|openai|gemini */
export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')
  if (!kind || !(VALID_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: 'Missing or invalid kind' }, { status: 400 })
  }
  await clearApiKey(kind as ApiKeyKind)
  return NextResponse.json({ ok: true })
}
