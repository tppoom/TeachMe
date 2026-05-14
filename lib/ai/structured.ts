/**
 * Structured-output parsing for pipeline stages.
 *
 * Strategy: try strict JSON first; if that fails, run a markdown-heading
 * fallback parser. Stages call `extractStructured` with a schema descriptor
 * that lists expected fields. Smaller models that emit "## Field name" with
 * prose under each are accepted via the fallback.
 */

// ─── Type guards / coercion helpers ──────────────────────────────────────

export function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

export function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function asEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

// ─── Strict JSON extraction ──────────────────────────────────────────────

/**
 * Extract a JSON object from raw model output. Strips code fences, finds the
 * outermost balanced { ... }, and parses it. Returns null on failure.
 */
export function extractJson(raw: string): unknown {
  if (!raw) return null

  // Strip code fences.
  let s = raw.replace(/^[\s\S]*?```(?:json)?\s*/i, '').replace(/\s*```[\s\S]*$/i, '').trim()
  // If no fence existed, the regex above would have stripped everything; recover.
  if (!s) s = raw.trim()

  // Find outermost balanced { ... } using a simple scanner that tracks string state.
  const start = s.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const candidate = s.slice(start, i + 1)
        try { return JSON.parse(candidate) } catch {
          // Fall through to looser repair attempts below.
          break
        }
      }
    }
  }

  // Repair pass: try removing trailing commas before } or ].
  const repaired = s
    .slice(start)
    .replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(repaired)
  } catch {
    return null
  }
}

// ─── Markdown-heading fallback ───────────────────────────────────────────

/**
 * Parses a markdown-style structured response into a flat key→value map.
 *
 * Convention the prompts teach when JSON fails:
 *
 *   ## field_name
 *   value text...
 *   - list item
 *   - list item
 *
 *   ## another_field
 *   value...
 *
 * Returns an object whose keys are the heading text (snake_case) and values
 * are either the prose under the heading or an array of bullets.
 */
export function parseMarkdownSections(raw: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  if (!raw) return out

  const lines = raw.split('\n')
  let currentKey: string | null = null
  let buffer: string[] = []
  let listBuffer: string[] = []
  let mode: 'prose' | 'list' = 'prose'

  function flush() {
    if (!currentKey) return
    if (mode === 'list' && listBuffer.length > 0) {
      out[currentKey] = listBuffer.slice()
    } else {
      const txt = buffer.join('\n').trim()
      if (txt) out[currentKey] = txt
    }
    buffer = []
    listBuffer = []
    mode = 'prose'
  }

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/)
    if (heading) {
      flush()
      currentKey = heading[1].toLowerCase().trim().replace(/\s+/g, '_')
      continue
    }
    if (!currentKey) continue
    const bullet = line.match(/^\s*[-*•]\s+(.+?)\s*$/)
    if (bullet) {
      mode = 'list'
      listBuffer.push(bullet[1].trim())
      continue
    }
    buffer.push(line)
  }
  flush()
  return out
}

// ─── Top-level "extract structured output" ───────────────────────────────

/**
 * Try strict JSON, then markdown fallback. Returns whichever parsed.
 *
 * The shape returned is `unknown` — callers must coerce with their own
 * shape-specific helpers (asString, asEnum, etc.).
 */
export function extractStructured(raw: string): { kind: 'json'; value: unknown } | { kind: 'markdown'; value: Record<string, string | string[]> } | null {
  const json = extractJson(raw)
  if (json !== null) return { kind: 'json', value: json }
  const md = parseMarkdownSections(raw)
  if (Object.keys(md).length > 0) return { kind: 'markdown', value: md }
  return null
}
