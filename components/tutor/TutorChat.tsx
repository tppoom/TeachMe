'use client'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isTextUIPart } from 'ai'
import { useRef, useEffect, useState } from 'react'
import type { LessonContent } from '@/types/lesson'
import { ChatMarkdown } from './ChatMarkdown'

interface TutorChatProps {
  lessonContent: LessonContent
  currentSectionId: string
  currentSectionTitle: string
  language?: string
  onClose?: () => void
}

const SUGGESTIONS = [
  'Teach me the underlying mechanism',
  'Show me a real-world example',
  'What misconception trips people up here?',
  'Compare this with the alternative',
]

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

export function TutorChat({ lessonContent, currentSectionId, currentSectionTitle, language, onClose }: TutorChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { lessonContent, currentSectionId, language },
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  function quickAsk(text: string) {
    if (isLoading) return
    sendMessage({ text })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex-shrink-0 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[14px] flex-shrink-0"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          ✦
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold tracking-[-0.005em]" style={{ color: 'var(--fg)' }}>
            Tutor
          </p>
          <p className="text-[11px] truncate inline-flex items-center gap-1.5" style={{ color: 'var(--fg-4)' }}>
            <span className="w-1.5 h-1.5 rounded-full pulse" style={{ background: 'var(--success)' }} />
            {currentSectionTitle || 'Ready to help'}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close tutor"
            className="w-7 h-7 flex items-center justify-center rounded-[7px] transition-colors"
            style={{ color: 'var(--fg-4)' }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--fg)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--fg-4)'
            }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div
              className="rounded-[10px] p-3.5 text-[12.5px] leading-[1.65]"
              style={{
                background: 'var(--bg-sunken)',
                color: 'var(--fg-2)',
                border: '1px solid var(--border)',
              }}
            >
              I'm reading this chapter alongside you. Ask anything — about a sentence, a concept, or where this fits in.
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: 'var(--fg-4)' }}>
                Try asking
              </p>
              <div className="space-y-1.5">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => quickAsk(s)}
                    className="w-full text-left text-[12.5px] px-3 py-2 rounded-[8px] transition-all"
                    style={{
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--border)',
                      color: 'var(--fg-2)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(m => {
          const text = m.parts.filter(isTextUIPart).map(p => p.text).join('')
          if (!text) return null
          return (
            <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div
                  className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--fg)', color: 'var(--bg)' }}
                >
                  ✦
                </div>
              )}
              <div
                className={`rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.65] ${m.role === 'user' ? 'max-w-[85%] whitespace-pre-wrap' : 'max-w-[92%]'}`}
                style={m.role === 'user'
                  ? { background: 'var(--fg)', color: 'var(--bg)' }
                  : { background: 'var(--bg-sunken)', color: 'var(--fg-2)', border: '1px solid var(--border)' }
                }
              >
                {m.role === 'assistant' ? <ChatMarkdown text={text} /> : text}
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex gap-2">
            <div
              className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[11px] flex-shrink-0"
              style={{ background: 'var(--fg)', color: 'var(--bg)' }}
            >
              ✦
            </div>
            <div
              className="rounded-[10px] px-3 py-2.5"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}
            >
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: 'var(--fg-4)', animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask about this chapter..."
          style={{
            flex: 1,
            fontSize: 13,
            padding: '8px 12px',
            background: 'var(--bg-elev)',
            color: 'var(--fg)',
            border: '1px solid',
            borderColor: focused ? 'var(--fg-3)' : 'var(--border)',
            borderRadius: 9,
            outline: 'none',
            boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)' : 'none',
            transition: 'border-color 150ms, box-shadow 150ms',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Send"
          className="flex items-center justify-center rounded-[9px] transition-opacity"
          style={{
            width: 34,
            height: 34,
            background: input.trim() ? 'var(--fg)' : 'var(--bg-sunken)',
            color: input.trim() ? 'var(--bg)' : 'var(--fg-4)',
            flexShrink: 0,
            opacity: isLoading ? 0.5 : 1,
            border: input.trim() ? 'none' : '1px solid var(--border)',
          }}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  )
}
