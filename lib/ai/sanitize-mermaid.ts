/**
 * Defensive Mermaid syntax sanitizer.
 *
 * Models often emit syntactically-correct-looking Mermaid that contains
 * characters Mermaid's grammar rejects:
 *   - Slashes inside [ ] node labels: `Root[/]` `API[api/]` → parser thinks
 *     [/...] is a parallelogram shape declaration.
 *   - Colons inside [ ]: `UserID[:id]` → conflicts with class/style syntax.
 *   - Periods, parentheses, quotes inside [ ] often confuse the lexer.
 *   - Pipe `|x.y|` edge labels with periods can break depending on context.
 *
 * Strategy: walk node-label and edge-label content, replace problematic
 * characters with safe equivalents that preserve human readability.
 */

const NODE_BRACKET_RE = /(\[)([^\[\]]*?)(\])/g
const PAREN_NODE_RE   = /([A-Za-z_][\w-]*)\(([^()]*?)\)/g  // A(label) → A[label]
const EDGE_LABEL_RE   = /(\|)([^|]+?)(\|)/g

const MULTILINE_NEWLINE = /\r\n?/g

/** Replace problematic chars in label text with safe equivalents. */
function sanitizeLabelContent(label: string): string {
  return label
    // Strip surrounding whitespace
    .trim()
    // Drop a leading or trailing forward slash (causes parallelogram shape)
    .replace(/^\/+|\/+$/g, '')
    // Inside the label, replace runs of chars Mermaid struggles with.
    // Slashes → spaces
    .replace(/\//g, ' ')
    // Colons → spaces (avoid class-selector conflicts)
    .replace(/:/g, ' ')
    // Parens → drop (we'll keep the contents)
    .replace(/[()]/g, '')
    // Curly braces → drop
    .replace(/[{}]/g, '')
    // Backticks / quotes → drop (we'll re-wrap whole label in quotes if needed)
    .replace(/[`'"]/g, '')
    // Angle brackets in labels → drop
    .replace(/[<>]/g, '')
    // Collapse multi-spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sanitize one fenced label region. Returns '' if the label was entirely
 *  composed of forbidden characters — caller drops the brackets entirely so
 *  Mermaid uses the node id as its display label (a much cleaner fallback
 *  than substituting a generic placeholder). */
function sanitizeNodeLabel(open: string, label: string, close: string): string {
  const cleaned = sanitizeLabelContent(label)
  if (!cleaned) return ''
  // Always quote to be safe.
  return `${open}"${cleaned}"${close}`
}

/** Sanitize an edge `|label|` segment. */
function sanitizeEdgeLabel(open: string, label: string, close: string): string {
  const cleaned = sanitizeLabelContent(label)
  if (!cleaned) return ''   // empty edge label → drop
  return `${open}${cleaned}${close}`
}

/**
 * Run all sanitizers over a Mermaid syntax string. Returns a string Mermaid
 * is far more likely to accept; preserves the diagram structure.
 */
export function sanitizeMermaid(raw: string): string {
  if (!raw) return ''
  let s = raw.replace(MULTILINE_NEWLINE, '\n').trim()

  // Strip code fences
  s = s.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  // Convert `A(label)` round-shape to `A[label]` to avoid trouble with parens
  // inside (parens break our regex assumptions, and round-shape isn't worth
  // protecting). Skip `subgraph(...)` and other keywords.
  s = s.replace(PAREN_NODE_RE, (m, id, label) => `${id}["${sanitizeLabelContent(label)}"]`)

  // Sanitize bracket labels
  s = s.replace(NODE_BRACKET_RE, (_m, open, label, close) => sanitizeNodeLabel(open, label, close))

  // Sanitize edge labels — but only segments that look like `-->|...|` or
  // `---|...|`. Plain `|` characters can appear in subgraph titles though, so
  // we only run this over arrow contexts.
  s = s.replace(/(-->|---|--o|--x)\s*\|([^|]+)\|/g, (_m, arrow, label) => {
    const cleaned = sanitizeLabelContent(label)
    return cleaned ? `${arrow}|${cleaned}|` : arrow
  })

  // Lines must not be longer than reasonable; collapse runaway whitespace
  s = s.replace(/[ \t]+/g, ' ').replace(/ \n/g, '\n')

  return s
}
