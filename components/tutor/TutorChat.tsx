'use client'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isTextUIPart } from 'ai'
import { useRef, useEffect, useState } from 'react'
import type { LessonContent } from '@/types/lesson'

interface TutorChatProps {
  lessonContent: LessonContent
  currentSectionId: string
  currentSectionTitle: string
}

export function TutorChat({
  lessonContent,
  currentSectionId,
  currentSectionTitle,
}: TutorChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { lessonContent, currentSectionId },
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

  return (
    <div className="flex flex-col h-full border rounded-xl bg-background overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs">
            🤖
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">AI Tutor</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground truncate">
                {currentSectionTitle || 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            Hi! I'm your tutor for this lesson. Ask me anything about what you're reading.
          </div>
        )}
        {messages.map(m => {
          const text = m.parts
            .filter(isTextUIPart)
            .map(p => p.text)
            .join('')
          if (!text) return null
          return (
            <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex-shrink-0 mt-0.5" />
              )}
              <div
                className={`rounded-lg px-3 py-2 text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary/20 text-foreground border border-primary/30'
                    : 'bg-muted/50 text-foreground border border-border'
                }`}
              >
                {text}
              </div>
            </div>
          )
        })}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex-shrink-0" />
            <div className="bg-muted/50 border border-border rounded-lg px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-3 flex gap-2 flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about this section..."
          className="flex-1 text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm disabled:opacity-50 flex-shrink-0 hover:opacity-90 transition-opacity"
        >
          ↑
        </button>
      </form>
      <p className="text-center text-[10px] text-muted-foreground pb-2">
        using your API key · context-aware
      </p>
    </div>
  )
}
