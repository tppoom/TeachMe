import { spawn } from 'child_process'

/**
 * Stream text from the Gemini CLI.
 *
 * Gemini CLI has no `--system-prompt` flag — we prepend the system prompt to
 * the user prompt so the model still sees both.
 *
 * Flags:
 *   -p / --prompt          : non-interactive headless mode
 *   --skip-trust           : don't prompt for workspace trust dialog
 *   --output-format text   : emit plain text (no JSON wrapper)
 *   --approval-mode yolo   : auto-approve any tool calls (we don't expect any)
 */
export async function* streamFromGeminiCLI(
  prompt: string,
  systemPrompt?: string,
): AsyncGenerator<string> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt

  const args: string[] = [
    '-p', fullPrompt,
    '--skip-trust',
    '--output-format', 'text',
    '--approval-mode', 'yolo',
  ]

  const proc = spawn('gemini', args, { env: process.env })

  let stderr = ''
  proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

  for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
    yield chunk.toString()
  }

  const code = await new Promise<number>(resolve => proc.on('close', resolve))
  if (code !== 0) throw new Error(`Gemini CLI failed (exit ${code}): ${stderr.trim() || 'no stderr'}`)
}
