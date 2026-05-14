/**
 * Tiny inline-markdown renderer used by SectionBlock prose, table cells,
 * bullet items, and the chat panel.
 *
 * Supports:
 *   `code`        →  <code>code</code>     (rendered with monospace + chip)
 *   **bold**      →  <strong>bold</strong>
 *   *italic*      →  <em>italic</em>
 *   ~~strike~~    →  <s>strike</s>
 *   [text](url)   →  <a href="url">text</a>
 *
 * Emphasis pairs ignore content inside backticks so code snippets are safe.
 */
import React from 'react'

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'bold'; children: Token[] }
  | { kind: 'italic'; children: Token[] }
  | { kind: 'strike'; children: Token[] }
  | { kind: 'link'; href: string; children: Token[] }

/** Tokenize a chunk of inline markdown. */
function tokenize(input: string): Token[] {
  const out: Token[] = []
  let i = 0
  let buf = ''

  function flushText() {
    if (buf.length > 0) { out.push({ kind: 'text', value: buf }); buf = '' }
  }

  while (i < input.length) {
    const ch = input[i]

    // Code spans first — protect their contents from emphasis matching.
    if (ch === '`') {
      const end = input.indexOf('`', i + 1)
      if (end > i + 1) {
        flushText()
        out.push({ kind: 'code', value: input.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    // Links: [text](url)
    if (ch === '[') {
      const close = input.indexOf(']', i + 1)
      if (close > -1 && input[close + 1] === '(') {
        const urlEnd = input.indexOf(')', close + 2)
        if (urlEnd > -1) {
          const text = input.slice(i + 1, close)
          const href = input.slice(close + 2, urlEnd)
          flushText()
          out.push({ kind: 'link', href, children: tokenize(text) })
          i = urlEnd + 1
          continue
        }
      }
    }

    // Bold: **...**
    if (ch === '*' && input[i + 1] === '*') {
      const end = input.indexOf('**', i + 2)
      if (end > i + 2) {
        flushText()
        out.push({ kind: 'bold', children: tokenize(input.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }

    // Italic: *...*  (single-asterisk; only when bounded by non-space on both ends)
    if (ch === '*' && input[i + 1] !== '*') {
      const end = input.indexOf('*', i + 1)
      if (end > i + 1) {
        const inner = input.slice(i + 1, end)
        // Avoid matching across line breaks; require non-space at both ends.
        if (!/\n/.test(inner) && !/^\s/.test(inner) && !/\s$/.test(inner)) {
          flushText()
          out.push({ kind: 'italic', children: tokenize(inner) })
          i = end + 1
          continue
        }
      }
    }

    // Strikethrough: ~~...~~
    if (ch === '~' && input[i + 1] === '~') {
      const end = input.indexOf('~~', i + 2)
      if (end > i + 2) {
        flushText()
        out.push({ kind: 'strike', children: tokenize(input.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }

    buf += ch
    i++
  }

  flushText()
  return out
}

function render(tokens: Token[], opts: InlineOpts, keyPrefix = ''): React.ReactNode[] {
  return tokens.map((t, i) => {
    const k = `${keyPrefix}${i}`
    switch (t.kind) {
      case 'text':
        return <React.Fragment key={k}>{t.value}</React.Fragment>
      case 'code':
        return (
          <code
            key={k}
            style={{
              fontFamily: 'var(--font-jetbrains, ui-monospace, monospace)',
              fontSize: opts.codeSize ?? '0.92em',
              padding: '0.5px 5px',
              borderRadius: 4,
              background: opts.codeBg ?? 'var(--bg-sunken)',
              border: `1px solid var(--border)`,
              color: 'var(--fg)',
              whiteSpace: 'nowrap',
            }}
          >
            {t.value}
          </code>
        )
      case 'bold':
        return <strong key={k} style={{ fontWeight: 600, color: 'var(--fg)' }}>{render(t.children, opts, `${k}-`)}</strong>
      case 'italic':
        return <em key={k}>{render(t.children, opts, `${k}-`)}</em>
      case 'strike':
        return <s key={k}>{render(t.children, opts, `${k}-`)}</s>
      case 'link':
        return (
          <a
            key={k}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--info)', textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            {render(t.children, opts, `${k}-`)}
          </a>
        )
    }
  })
}

interface InlineOpts {
  codeBg?: string
  codeSize?: string
}

/** Render a string of inline markdown into React children. */
export function inline(text: string, opts: InlineOpts = {}): React.ReactNode {
  return render(tokenize(text), opts)
}

/**
 * Strip inline-markdown markers from a string, returning plain text.
 * Used for titles/headings where we don't want emphasis but the AI may
 * have wrapped text in `**...**` or backticks. Unmatched markers are
 * removed as well to prevent leaks like "**Foo".
 */
export function stripInline(text: string): string {
  if (!text) return ''
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // Strip any remaining stray markers
    .replace(/\*+/g, '')
    .replace(/~~+/g, '')
    .replace(/`+/g, '')
    .trim()
}
