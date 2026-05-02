'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { UrlInput } from './UrlInput'
import type { Depth } from '@/types/lesson'

const DEPTHS: Depth[] = ['beginner', 'intermediate', 'advanced']

export function CreateForm() {
  const [topic, setTopic] = useState('')
  const [priorKnowledge, setPriorKnowledge] = useState('')
  const [goals, setGoals] = useState('')
  const [depth, setDepth] = useState<Depth>('beginner')
  const [urls, setUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)

    let referenceTexts: string[] = []

    if (urls.length > 0) {
      setStatus('Reading reference URLs...')
      const results = await Promise.allSettled(
        urls.map(url => fetch('/api/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        }).then(r => r.json()))
      )
      referenceTexts = results
        .filter(r => r.status === 'fulfilled' && r.value.text)
        .map(r => (r as PromiseFulfilledResult<{ text: string }>).value.text)
    }

    setStatus('Generating lesson (this takes 30–60 seconds)...')
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, depth, priorKnowledge: priorKnowledge || undefined, goals: goals || undefined, referenceTexts }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setStatus(null)
      setLoading(false)
      return
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let lessonId: string | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const match = chunk.match(/__LESSON_ID__([^_]+)__/)
      if (match) { lessonId = match[1]; break }
    }

    if (lessonId) router.push(`/lessons/${lessonId}`)
    else { setError('Failed to get lesson ID'); setStatus(null); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="topic">Topic *</Label>
        <Input id="topic" placeholder='e.g. "Machine Learning fundamentals"'
          value={topic} onChange={e => setTopic(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prior">What do you already know?</Label>
        <Textarea id="prior" placeholder="Optional — helps skip what you know and go deeper"
          value={priorKnowledge} onChange={e => setPriorKnowledge(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goals">Specific goals or requirements</Label>
        <Textarea id="goals" placeholder='Optional — e.g. "Focus on practical examples"'
          value={goals} onChange={e => setGoals(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Depth</Label>
        <div className="flex gap-2">
          {DEPTHS.map(d => (
            <button key={d} type="button" onClick={() => setDepth(d)}
              className={`px-4 py-2 rounded-lg border text-sm capitalize transition-colors
                ${depth === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b">
          <p className="text-sm font-medium">Reference Sources <span className="text-muted-foreground font-normal">(Optional)</span></p>
          <p className="text-xs text-muted-foreground">Web pages or YouTube URLs — AI will read these to ground your lesson</p>
        </div>
        <div className="p-4">
          <UrlInput urls={urls} onChange={setUrls} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      <Button type="submit" disabled={loading || !topic.trim()} className="w-full" size="lg">
        {loading ? status ?? 'Working...' : '✨ Generate Lesson'}
      </Button>
    </form>
  )
}
