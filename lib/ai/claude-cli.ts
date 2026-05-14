import { spawn } from 'child_process'

/**
 * Stream text from the Claude Code CLI.
 *
 * Flags rationale:
 *   -p / --print              : non-interactive print mode
 *   --bare                    : skip CLAUDE.md, hooks, plugins, auto-memory; clean slate
 *   --no-session-persistence  : don't persist sessions; we never resume them
 *   --disallowed-tools <...>  : explicitly forbid tool calls so the model produces text only
 *   --system-prompt           : inject our pipeline system prompt verbatim
 */
export async function* streamFromCLI(
  prompt: string,
  systemPrompt?: string,
): AsyncGenerator<string> {
  const args: string[] = [
    '-p', prompt,
    '--bare',
    '--no-session-persistence',
    // Disallow every tool we know Claude Code might try to use, so generation stays text-only.
    '--disallowed-tools',
    'Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite',
  ]

  if (systemPrompt) {
    args.push('--system-prompt', systemPrompt)
  }

  const proc = spawn('claude', args, { env: process.env })

  let stderr = ''
  proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

  for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
    yield chunk.toString()
  }

  const code = await new Promise<number>(resolve => proc.on('close', resolve))
  if (code !== 0) throw new Error(`Claude CLI failed (exit ${code}): ${stderr.trim() || 'no stderr'}`)
}
