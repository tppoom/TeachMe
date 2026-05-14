import { spawn } from 'child_process'

/**
 * Stream text from the Codex CLI (OpenAI's `codex` command).
 *
 * Codex has no first-class `--system-prompt` flag, so we prepend the system
 * prompt to the user prompt with a clear separator. We invoke `codex exec`
 * for non-interactive runs that emit the model's output to stdout.
 *
 * Falls back gracefully if `codex` is not installed — the caller will see
 * a clear "command not found" error and can switch providers.
 */
export async function* streamFromCodexCLI(
  prompt: string,
  systemPrompt?: string,
): AsyncGenerator<string> {
  const fullPrompt = systemPrompt
    ? `[SYSTEM]\n${systemPrompt}\n[/SYSTEM]\n\n${prompt}`
    : prompt

  // `codex exec` is the non-interactive equivalent of typing the prompt and pressing enter.
  // It prints the model's reply to stdout.
  const args = ['exec', '--skip-git-repo-check', fullPrompt]

  const proc = spawn('codex', args, { env: process.env })

  let stderr = ''
  proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

  for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
    yield chunk.toString()
  }

  const code = await new Promise<number>(resolve => proc.on('close', resolve))
  if (code !== 0) throw new Error(`Codex CLI failed (exit ${code}): ${stderr.trim() || 'no stderr'}`)
}
