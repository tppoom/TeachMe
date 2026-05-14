import { KeyPoints } from './KeyPoints'
import { MermaidDiagram } from './MermaidDiagram'
import { ChartBlock } from './ChartBlock'
import { CodePlayground } from './CodePlayground'
import { ExerciseBlock } from './ExerciseBlock'
import { CodeBlock } from './CodePlayground'
import { inline, stripInline } from './inline-md'
import { labelsFor, type LessonLabels } from './labels'
import type { LessonSection, LessonExample, Subtopic, Visual } from '@/types/lesson'

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'para'; text: string }

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let bulletBuf: string[] = []
  let numberedBuf: string[] = []
  let paraBuf: string[] = []
  let tableBuf: string[][] = []

  function flushBullet() {
    if (bulletBuf.length) { blocks.push({ kind: 'bullet', items: [...bulletBuf] }); bulletBuf = [] }
  }
  function flushNumbered() {
    if (numberedBuf.length) { blocks.push({ kind: 'numbered', items: [...numberedBuf] }); numberedBuf = [] }
  }
  function flushPara() {
    const t = paraBuf.join(' ').trim()
    if (t) blocks.push({ kind: 'para', text: t })
    paraBuf = []
  }
  function flushTable() {
    if (tableBuf.length) { blocks.push({ kind: 'table', rows: [...tableBuf] }); tableBuf = [] }
  }
  function flushAll() {
    flushBullet(); flushNumbered(); flushPara(); flushTable()
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushAll()
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue
      flushBullet(); flushNumbered(); flushPara()
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim())
      tableBuf.push(cells)
      continue
    }
    if (/^#{1,4}\s/.test(line)) {
      flushAll()
      blocks.push({ kind: 'heading', text: line.replace(/^#{1,4}\s+/, '') })
      continue
    }
    if (/^[-*•]\s/.test(line.trimStart())) {
      flushNumbered(); flushPara(); flushTable()
      bulletBuf.push(line.replace(/^\s*[-*•]\s+/, ''))
      continue
    }
    if (/^\d+[.)]\s/.test(line.trimStart())) {
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

function ProseContent({ text }: { text: string; dropcap?: boolean }) {
  const blocks = parseBlocks(text)
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <p
              key={i}
              className="text-[12px] font-semibold uppercase tracking-[0.08em] mt-3 mb-1"
              style={{ color: 'var(--fg-3)' }}
            >
              {stripInline(block.text)}
            </p>
          )
        }
        if (block.kind === 'bullet') {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-[15px] leading-[1.75]" style={{ color: 'var(--fg-2)' }}>
                  <span className="mt-[10px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--fg-3)' }} />
                  <span>{inline(item, { codeBg: 'var(--bg-elev)' })}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (block.kind === 'numbered') {
          return (
            <ol key={i} className="space-y-2.5 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-[15px] leading-[1.75]" style={{ color: 'var(--fg-2)' }}>
                  <span
                    className="flex-shrink-0 text-[11px] font-bold mt-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)', border: '1px solid var(--border)' }}
                  >
                    {j + 1}
                  </span>
                  <span>{inline(item, { codeBg: 'var(--bg-elev)' })}</span>
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
              className="rounded-[10px] overflow-hidden text-[14px] my-2"
              style={{ border: '1px solid var(--border)' }}
            >
              <table className="w-full border-collapse">
                {head && (
                  <thead style={{ background: 'var(--bg-sunken)' }}>
                    <tr>
                      {head.map((h, k) => (
                        <th
                          key={k}
                          className="text-left px-4 py-2.5 font-semibold text-[12px] uppercase tracking-[0.04em]"
                          style={{ color: 'var(--fg-3)', borderBottom: '1px solid var(--border)' }}
                        >
                          {inline(h, { codeBg: 'var(--bg-elev)' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={r} style={{ background: r % 2 === 1 ? 'var(--bg-sunken)' : 'transparent' }}>
                      {row.map((cell, c) => (
                        <td
                          key={c}
                          className="px-4 py-2.5 align-top text-[14px] leading-[1.6]"
                          style={{ color: 'var(--fg-2)', borderTop: r === 0 ? 'none' : '1px solid var(--border)' }}
                        >
                          {inline(cell, { codeBg: 'var(--bg-elev)' })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return (
          <p
            key={i}
            className="text-[15.5px] leading-[1.8]"
            style={{ color: 'var(--fg-2)' }}
          >
            {inline(block.text)}
          </p>
        )
      })}
    </div>
  )
}

function VisualBlock({ visual }: { visual: Visual }) {
  if (visual.type === 'mermaid') return <MermaidDiagram visual={visual} />
  if (visual.type === 'chart') return <ChartBlock visual={visual} />
  if (visual.type === 'code') return <CodePlayground visual={visual} />
  return null
}

function ExampleCard({ ex, index, total, L }: { ex: LessonExample; index: number; total: number; L: LessonLabels }) {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-elev)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-3"
        style={{
          background: 'var(--info-soft)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          className="inline-flex items-center justify-center text-[10px] font-bold w-5 h-5 rounded-full"
          style={{ background: 'var(--info)', color: 'white' }}
        >
          {index + 1}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: 'var(--info)' }}
        >
          {total > 1 ? L.exampleNofM(index + 1, total) : L.example}
        </span>
        <span style={{ color: 'var(--border-strong)', fontSize: 10 }}>·</span>
        <span className="text-[13px] font-medium truncate" style={{ color: 'var(--fg-2)' }}>{stripInline(ex.title)}</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-[14.5px] leading-[1.75]" style={{ color: 'var(--fg-2)' }}>{inline(ex.body)}</p>
        {ex.code && <CodeBlock code={ex.code} language={ex.language} />}
      </div>
    </div>
  )
}

function AlertIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

/**
 * Parse a "Mistake: ... Why: ... Fix: ..." string into its three parts.
 * Returns null if the string doesn't match the structured form (we then
 * fall back to plain rendering).
 */
function parseMistake(s: string): { mistake: string; why: string; fix: string } | null {
  const m = s.match(/^\s*Mistake:\s*([\s\S]*?)\s*(?:Why|Reason):\s*([\s\S]*?)\s*Fix:\s*([\s\S]+?)\.?\s*$/i)
  if (!m) return null
  return { mistake: m[1].trim().replace(/\.$/, ''), why: m[2].trim().replace(/\.$/, ''), fix: m[3].trim().replace(/\.$/, '') }
}

function MistakeRow({ raw, index, L }: { raw: string; index: number; L: LessonLabels }) {
  const parts = parseMistake(raw)
  return (
    <div className="flex gap-3">
      <span
        className="flex-shrink-0 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center mt-[3px]"
        style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}
      >
        {index + 1}
      </span>
      {parts ? (
        <div className="flex-1 space-y-2 text-[14.5px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>
          <div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em] mr-2"
              style={{ color: 'var(--warning)' }}
            >
              {L.mistake}
            </span>
            <span>{inline(parts.mistake)}</span>
          </div>
          <div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em] mr-2"
              style={{ color: 'var(--fg-4)' }}
            >
              {L.whyItHappens}
            </span>
            <span style={{ color: 'var(--fg-3)' }}>{inline(parts.why)}</span>
          </div>
          <div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.12em] mr-2"
              style={{ color: 'var(--success)' }}
            >
              {L.fix}
            </span>
            <span>{inline(parts.fix)}</span>
          </div>
        </div>
      ) : (
        <p className="flex-1 text-[14.5px] leading-[1.7]" style={{ color: 'var(--fg-2)' }}>{inline(raw)}</p>
      )}
    </div>
  )
}

function MistakesCard({ mistakes, L }: { mistakes: string[]; L: LessonLabels }) {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2.5"
        style={{
          background: 'var(--warning-soft)',
          borderBottom: '1px solid var(--border)',
          color: 'var(--warning)',
        }}
      >
        <AlertIcon />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
          {L.watchOut}
        </span>
      </div>
      <div className="p-5 space-y-4" style={{ background: 'var(--bg-elev)' }}>
        {mistakes.map((m, i) => <MistakeRow key={i} raw={m} index={i} L={L} />)}
      </div>
    </div>
  )
}

function SubtopicBlock({
  subtopic,
  index,
  isFirst,
  L,
}: {
  subtopic: Subtopic
  index: number
  isFirst: boolean
  L: LessonLabels
}) {
  return (
    <section className="space-y-5">
      {!isFirst && (
        <div className="lesson-rule" aria-hidden>
          <span className="dot" />
        </div>
      )}

      {/* Subtopic header */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span
            className="text-[11px] font-mono font-semibold tracking-[0.04em]"
            style={{ color: 'var(--fg-4)' }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3
            className="text-[22px] font-medium leading-[1.25] tracking-[-0.012em]"
            style={{ fontFamily: 'var(--font-general-sans, system-ui)', color: 'var(--fg)' }}
          >
            {stripInline(subtopic.title)}
          </h3>
        </div>
        {subtopic.summary && (
          <p className="text-[13.5px] leading-[1.65] italic" style={{ color: 'var(--fg-3)' }}>
            {inline(subtopic.summary)}
          </p>
        )}
      </div>

      {subtopic.content && <ProseContent text={subtopic.content} dropcap={isFirst} />}

      {subtopic.visuals.length > 0 && (
        <div className="space-y-4">
          {subtopic.visuals.map((v, i) => <VisualBlock key={i} visual={v} />)}
        </div>
      )}

      {subtopic.examples.length > 0 && (
        <div className="space-y-4">
          {subtopic.examples.map((ex, i) => (
            <ExampleCard key={i} ex={ex} index={i} total={subtopic.examples.length} L={L} />
          ))}
        </div>
      )}

      {subtopic.commonMistakes.length > 0 && (
        <MistakesCard mistakes={subtopic.commonMistakes} L={L} />
      )}
    </section>
  )
}

interface SectionBlockProps {
  section: LessonSection
  index: number
  hideTitle?: boolean
  language?: string
}

export function SectionBlock({ section, index, hideTitle, language }: SectionBlockProps) {
  const hasSubtopics = (section.subtopics?.length ?? 0) > 0
  const sectionVisuals = section.visuals ?? []
  const sectionExamples = section.examples ?? []
  const sectionMistakes = section.commonMistakes ?? []
  const L = labelsFor(language)

  return (
    <div id={section.id} className="scroll-mt-20">

      {/* Section heading (only when not in single-chapter view) */}
      {!hideTitle && (
        <div className="flex items-center gap-3 mb-5">
          <span
            className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md"
            style={{ background: 'var(--bg-sunken)', color: 'var(--fg-4)' }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <h2
            className="text-[24px] font-medium leading-[1.2] tracking-[-0.012em]"
            style={{ fontFamily: 'var(--font-general-sans, system-ui)', color: 'var(--fg)' }}
          >
            {stripInline(section.title)}
          </h2>
        </div>
      )}

      {/* Hook — open paragraph that sets the situation up */}
      {section.hook && (
        <p
          className="text-[17px] leading-[1.75] mb-10 font-light"
          style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-general-sans, system-ui)' }}
        >
          {inline(section.hook)}
        </p>
      )}

      {/* Legacy section-level prose (only when there are no subtopics) */}
      {!hasSubtopics && section.content && (
        <div className="mb-8">
          <ProseContent text={section.content} dropcap />
        </div>
      )}

      {/* Subtopics */}
      {hasSubtopics && (
        <div className="space-y-12 mb-10">
          {section.subtopics!.map((st, i) => (
            <SubtopicBlock
              key={st.id || i}
              subtopic={st}
              index={i}
              isFirst={i === 0}
              L={L}
            />
          ))}
        </div>
      )}

      {/* Section-level visuals (legacy) */}
      {sectionVisuals.length > 0 && (
        <div className="space-y-4 mb-8">
          {sectionVisuals.map((v, i) => <VisualBlock key={i} visual={v} />)}
        </div>
      )}

      {/* Section-level examples (legacy fallback) */}
      {!hasSubtopics && sectionExamples.length > 0 && (
        <div className="space-y-4 mb-8">
          {sectionExamples.map((ex, i) => (
            <ExampleCard key={i} ex={ex} index={i} total={sectionExamples.length} L={L} />
          ))}
        </div>
      )}

      {/* Section-level mistakes (legacy fallback) */}
      {!hasSubtopics && sectionMistakes.length > 0 && (
        <div className="mb-8">
          <MistakesCard mistakes={sectionMistakes} L={L} />
        </div>
      )}

      {/* Key takeaways */}
      <div className="mt-10">
        <KeyPoints points={section.keyPoints} language={language} />
      </div>

      {/* Exercise */}
      {section.exercise && (
        <div className="mt-8">
          <ExerciseBlock exercise={section.exercise} language={language} />
        </div>
      )}

      {/* Section summary as pull quote */}
      <figure className="mt-10">
        <blockquote
          className="text-[16px] leading-[1.7] pl-5 py-1"
          style={{
            color: 'var(--fg-2)',
            borderLeft: '3px solid var(--fg)',
            fontFamily: 'var(--font-general-sans, system-ui)',
            fontStyle: 'italic',
          }}
        >
          {inline(section.summary)}
        </blockquote>
      </figure>
    </div>
  )
}
