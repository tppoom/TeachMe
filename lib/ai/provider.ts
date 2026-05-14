import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, streamText } from 'ai'
import { db } from '@/lib/db'
import { encryptString, decryptString } from '@/lib/crypto'
import { streamFromCLI } from './claude-cli'
import { streamFromGeminiCLI } from './gemini-cli'
import { streamFromCodexCLI } from './codex-cli'

/** Provider ids supported by the platform. */
export type ProviderId =
  | 'none'          // No provider selected
  | 'claude-code'   // Claude Code CLI (local)
  | 'gemini-cli'    // Gemini CLI (local)
  | 'codex-cli'     // OpenAI Codex CLI (local)
  | 'anthropic'     // Anthropic API (remote)
  | 'openai'        // OpenAI / ChatGPT API (remote)
  | 'gemini'        // Google Gemini API (remote)

const CLI_IDS: ProviderId[] = ['claude-code', 'gemini-cli', 'codex-cli']
const API_IDS: ProviderId[] = ['anthropic', 'openai', 'gemini']

export const ALL_PROVIDERS: ProviderId[] = ['none', ...CLI_IDS, ...API_IDS]

export function isCliProvider(id: string): id is ProviderId {
  return (CLI_IDS as string[]).includes(id)
}

export async function getActiveProvider(): Promise<ProviderId> {
  try {
    const config = await db.config.findUnique({ where: { key: 'activeProvider' } })
    const v = config?.value
    if (v && (ALL_PROVIDERS as string[]).includes(v)) return v as ProviderId
    return 'none'
  } catch {
    return 'none'
  }
}

// ─── User-managed API keys (stored encrypted in the Config table) ───────

const KEY_CONFIG: Record<'anthropic' | 'openai' | 'gemini', { db: string; env: string }> = {
  anthropic: { db: 'apiKey.anthropic', env: 'ANTHROPIC_API_KEY' },
  openai:    { db: 'apiKey.openai',    env: 'OPENAI_API_KEY'    },
  gemini:    { db: 'apiKey.gemini',    env: 'GEMINI_API_KEY'    },
}

/** Read an API key. Prefers the user-saved key in the DB; falls back to env. */
export async function getApiKey(kind: 'anthropic' | 'openai' | 'gemini'): Promise<string | null> {
  const cfg = KEY_CONFIG[kind]
  try {
    const row = await db.config.findUnique({ where: { key: cfg.db } })
    if (row?.value) {
      const k = decryptString(row.value)
      if (k) return k
    }
  } catch { /* fall through to env */ }
  const fromEnv = process.env[cfg.env]
  return fromEnv ?? null
}

/** True when a key is available (DB or env). */
export async function hasApiKey(kind: 'anthropic' | 'openai' | 'gemini'): Promise<boolean> {
  return !!(await getApiKey(kind))
}

/** Save (or replace) a user-supplied API key in the Config table. */
export async function setApiKey(kind: 'anthropic' | 'openai' | 'gemini', plain: string) {
  const cfg = KEY_CONFIG[kind]
  const enc = encryptString(plain.trim())
  await db.config.upsert({
    where: { key: cfg.db },
    update: { value: enc },
    create: { key: cfg.db, value: enc },
  })
}

/** Delete the user-supplied key (env var, if set, becomes the fallback again). */
export async function clearApiKey(kind: 'anthropic' | 'openai' | 'gemini') {
  const cfg = KEY_CONFIG[kind]
  await db.config.deleteMany({ where: { key: cfg.db } })
}

/** Returns an AI SDK model instance for API providers. CLI providers return null. */
export async function getProviderModel() {
  const provider = await getActiveProvider()

  if (provider === 'openai') {
    const k = await getApiKey('openai')
    if (!k) throw new Error('OpenAI API key not set. Add one in Settings.')
    return createOpenAI({ apiKey: k })('gpt-4o')
  }
  if (provider === 'gemini') {
    const k = await getApiKey('gemini')
    if (!k) throw new Error('Gemini API key not set. Add one in Settings.')
    return createGoogleGenerativeAI({ apiKey: k })('gemini-2.0-flash')
  }
  if (provider === 'anthropic') {
    const k = await getApiKey('anthropic')
    if (!k) throw new Error('Anthropic API key not set. Add one in Settings.')
    return createAnthropic({ apiKey: k })('claude-opus-4-7')
  }

  // CLI provider — caller should use streamCompletion / runCompletion directly.
  return null
}

// ─── Unified completion runners ──────────────────────────────────────────

interface CompletionOptions {
  system: string
  prompt: string
  maxOutputTokens?: number
}

/** Run a single non-streaming completion through whichever provider is active. */
export async function runCompletion({ system, prompt, maxOutputTokens = 8000 }: CompletionOptions): Promise<string> {
  const provider = await getActiveProvider()

  if (provider === 'none') throw new Error('No AI provider configured. Go to Settings to set one up.')
  if (provider === 'claude-code') return collect(streamFromCLI(prompt, system))
  if (provider === 'gemini-cli') return collect(streamFromGeminiCLI(prompt, system))
  if (provider === 'codex-cli') return collect(streamFromCodexCLI(prompt, system))

  const model = await getProviderModel()
  const result = await generateText({ model: model!, system, prompt, maxOutputTokens })
  return result.text
}

/** Run a streaming completion through whichever provider is active. */
export async function* streamCompletion({ system, prompt, maxOutputTokens = 16000 }: CompletionOptions): AsyncGenerator<string> {
  const provider = await getActiveProvider()

  if (provider === 'none') throw new Error('No AI provider configured. Go to Settings to set one up.')
  if (provider === 'claude-code') { yield* streamFromCLI(prompt, system); return }
  if (provider === 'gemini-cli') { yield* streamFromGeminiCLI(prompt, system); return }
  if (provider === 'codex-cli') { yield* streamFromCodexCLI(prompt, system); return }

  const model = await getProviderModel()
  const result = streamText({ model: model!, system, prompt, maxOutputTokens })
  for await (const chunk of result.textStream) yield chunk
}

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = ''
  for await (const chunk of gen) out += chunk
  return out
}
