'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Depth } from '@/types/lesson'

const DEPTHS: Depth[] = ['beginner', 'intermediate', 'advanced']

export function CreateForm() {
  const [topic, setTopic] = useState('')
  const [priorKnowledge, setPriorKnowledge] = useState('')
  const [goals, setGoals] = useState('')
  const [depth, setDepth] = useState<Depth>('beginner')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    setStatus('Generating lesson (30–60 seconds)...')

    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        depth,
        priorKnowledge: priorKnowledge || undefined,
        goals: goals || undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      setStatus(null)
      return
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let lessonId: string | null = null
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const match = buffer.match(/__LESSON_ID__([^_]+)__/)
      if (match) { lessonId = match[1]; break }
      const errMatch = buffer.match(/__ERROR__(.+)/)
      if (errMatch) { setError(errMatch[1]); setLoading(false); setStatus(null); return }
    }

    if (lessonId) {
      router.push(`/lessons/${lessonId}`)
    } else {
      setError('Could not get lesson ID. Check your API key in Settings.')
      setLoading(false)
      setStatus(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="topic">Topic *</Label>
        <Input
          id="topic"
          placeholder='e.g. "Machine Learning fundamentals", "Japanese grammar"'
          value={topic}
          onChange={e => setTopic(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prior">What do you already know?</Label>
        <Textarea
          id="prior"
          placeholder="Optional — helps skip what you know and go deeper where needed"
          value={priorKnowledge}
          onChange={e => setPriorKnowledge(e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goals">Specific goals or requirements</Label>
        <Textarea
          id="goals"
          placeholder='Optional — e.g. "Focus on practical examples", "Include code snippets"'
          value={goals}
          onChange={e => setGoals(e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Depth</Label>
        <div className="flex gap-2">
          {DEPTHS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDepth(d)}
              className={`px-4 py-2 rounded-lg border text-sm capitalize transition-colors
                ${depth === d
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary'
                }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {status && !error && <p className="text-sm text-muted-foreground">{status}</p>}

      <Button
        type="submit"
        disabled={loading || !topic.trim()}
        className="w-full"
        size="lg"
      >
        {loading ? (status ?? 'Generating...') : '✨ Generate Lesson'}
      </Button>
    </form>
  )
}
