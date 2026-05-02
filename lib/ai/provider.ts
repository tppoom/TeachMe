import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { decrypt } from '@/lib/crypto'
import { db } from '@/lib/db'

export async function getProviderModel(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })

  if (user.activeProvider === 'openai') {
    if (!user.openaiKeyEnc) throw new Error('No OpenAI key saved. Add one in Settings.')
    const openai = createOpenAI({ apiKey: decrypt(user.openaiKeyEnc) })
    return openai('gpt-4o')
  }

  if (!user.anthropicKeyEnc) throw new Error('No Anthropic key saved. Add one in Settings.')
  const anthropic = createAnthropic({ apiKey: decrypt(user.anthropicKeyEnc) })
  return anthropic('claude-opus-4-7')
}
