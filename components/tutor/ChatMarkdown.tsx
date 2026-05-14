/**
 * Compact markdown renderer for tutor chat replies.
 *
 * The tutor produces structured micro-lessons (headings, bullets, numbered
 * lists, inline code, code blocks, tables). We render those with spacing
 * tight enough to fit the narrow chat panel.
 */
import React from 'react'

type Block =
  | { kind: 'heading'; text: string; level: number }
  | { kind: 'para'; text: string }
  | { kind: 'bullet'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'code'; lang: string; code: string }

function parse(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []

  let bulletBuf: string[] = []
  let numberedBuf: string[] = []
  let paraBuf: string[] = []
  let tableBuf: string[][] = []

  function flushBullet() { if (bulletBuf.length) { blocks.push({ kind: 'bullet', items: [...bulletBuf] }); bulletBuf = [] } }
  function flushNumbered() { if (numberedBuf.length) { blocks.push({ kind: 'numbered', items: [...numberedBuf] }); numberedBuf = [] } }
  function flushPara() {
    const t = paraBuf.join(' ').trim()
    if (t) blocks.push({ kind: 'para', text: t })
    paraBuf = []
  }
  function flushTable() { if (tableBuf.length) { blocks.push({ kind: 'table', rows: [...tableBuf] }); tableBuf = [] } }
  function flushAll() { flushBullet(); flushNumbered(); flushPara(); flushTable() }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trimEnd()

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      flushAll()
      const lang = fence[1] ?? ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ kind: 'code', lang, code: codeLines.join('\n') })
      continue
    }

    if (!line.trim()) { flushAll(); continue }

    // Markdown table row
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue
      flushBullet(); flushNumbered(); flushPara()
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim())
      tableBuf.push(cells)
      continue
    }

    // Headings
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*$/)
    if (heading) {
      flushAll()
      blocks.push({ kind: 'heading', text: heading[2], level: heading[1].length })
      continue
    }

    // Bullet
    if (/^\s*[-*•]\s/.test(line)) {
      flushNumbered(); flushPara(); flushTable()
      bulletBuf.push(line.replace(/^\s*[-*•]\s+/, ''))
      continue
    }

    // Numbered
    if (/^\s*\d+[.)]\s/.test(line)) {
      flushBullet(); flushPara(); flushTable()
      numberedBuf.push(line.replace(/^\s*\d+[.)]\s*/, ''))
      continue
    }

    flushBullet(); flushNumbered(); flushTable()
    paraBuf.push(line.trim())
  }
  flushAll()
  return blocks
}

/** Render inline markdown: `code`, **bold**, *italic*. */
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  // Tokenize on backticks first so emphasis inside code is left alone.
  const codeSplit = text.split(/(`[^`\n]+`)/g)
  codeSplit.forEach((seg, i) => {
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
      out.push(
        <code
          key={`c${i}`}
          style={{
            fontFamily: 'var(--font-jetbrains, ui-monospace, monospace)',
            fontSize: '0.92em',
            padding: '0.5px 5px',
            borderRadius: 4,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
          }}
        >
          {seg.slice(1, -1)}
        </code>
      )
      return
    }
    // bold + italic
    const boldSplit = seg.split(/(\*\*[^*]+\*\*)/g)
    boldSplit.forEach((bs, j) => {
      if (bs.startsWith('**') && bs.endsWith('**') && bs.length > 4) {
        out.push(<strong key={`b${i}-${j}`} style={{ fontWeight: 600 }}>{bs.slice(2, -2)}</strong>)
        return
      }
      const italSplit = bs.split(/(\*[^*\n]+\*)/g)
      italSplit.forEach((is, k) => {
        if (is.startsWith('*') && is.endsWith('*') && is.length > 2) {
          out.push(<em key={`i${i}-${j}-${k}`}>{is.slice(1, -1)}</em>)
        } else if (is) {
          out.push(<React.Fragment key={`t${i}-${j}-${k}`}>{is}</React.Fragment>)
        }
      })
    })
  })
  return out
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = parse(text)

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <p
              key={i}
              className="text-[10.5px] font-bold uppercase tracking-[0.1em] mt-2.5 mb-0.5 first:mt-0"
              style={{ color: 'var(--fg-3)' }}
            >
              {renderInline(block.text)}
            </p>
          )
        }
        if (block.kind === 'bullet') {
          return (
            <ul key={i} className="space-y-1 pl-0.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-[12.5px] leading-[1.6]">
                  <span className="mt-[7px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--fg-3)' }} />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (block.kind === 'numbered') {
          return (
            <ol key={i} className="space-y-1 pl-0.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-[12.5px] leading-[1.6]">
                  <span
                    className="flex-shrink-0 text-[10px] font-mono mt-[1px] w-4 text-right"
                    style={{ color: 'var(--fg-4)' }}
                  >
                    {j + 1}.
                  </span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          )
        }
        if (block.kind === 'table') {
          const [head, ...rows] = block.rows
          return (
            <div
              key={i}
              className="rounded-[6px] overflow-x-auto text-[11.5px]"
              style={{ border: '1px solid var(--border)' }}
            >
              <table className="w-full border-collapse">
                {head && (
                  <thead style={{ background: 'var(--bg-sunken)' }}>
                    <tr>
                      {head.map((h, k) => (
                        <th
                          key={k}
                          className="text-left px-2 py-1.5 font-semibold"
                          style={{ color: 'var(--fg-2)', borderBottom: '1px solid var(--border)' }}
                        >
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td
                          key={c}
                          className="px-2 py-1.5 align-top"
                          style={{ color: 'var(--fg-2)', borderTop: r === 0 ? 'none' : '1px solid var(--border)' }}
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        if (block.kind === 'code') {
          return (
            <pre
              key={i}
              className="rounded-[6px] overflow-x-auto text-[11.5px]"
              style={{
                background: '#0d0d0d',
                color: '#cdd6f4',
                fontFamily: 'var(--font-jetbrains, ui-monospace, monospace)',
                lineHeight: 1.65,
                padding: '8px 10px',
                margin: 0,
              }}
            >
              <code>{block.code}</code>
            </pre>
          )
        }
        return (
          <p key={i} className="text-[12.5px] leading-[1.65]">
            {renderInline(block.text)}
          </p>
        )
      })}
    </div>
  )
}
