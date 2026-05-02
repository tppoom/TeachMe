import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-8 py-4 flex items-center justify-between">
        <span className="font-bold text-lg">TeachMe</span>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started free</Button>
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-8 py-32 text-center space-y-6">
        <p className="text-sm font-semibold text-primary uppercase tracking-widest">
          Learn anything, deeply
        </p>
        <h1 className="text-5xl font-bold leading-tight">
          AI lessons built around<br />exactly what you want to know
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Enter a topic. Attach your notes, articles, or YouTube videos.
          TeachMe generates a complete, structured lesson — with diagrams, code playgrounds,
          and a tutor you can ask questions mid-lesson.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link href="/signup">
            <Button size="lg">Start learning</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">Sign in</Button>
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-8 pb-24">
        <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Describe what you want to learn',
              desc: 'Enter a topic, your current knowledge level, and any specific goals. Paste URLs or upload documents as reference material.',
            },
            {
              step: '02',
              title: 'AI generates your full lesson',
              desc: 'TeachMe produces a complete, structured lesson with detailed sections, diagrams, charts, and runnable code examples.',
            },
            {
              step: '03',
              title: 'Ask questions as you read',
              desc: "The built-in AI tutor knows exactly which section you're reading. Ask anything, get context-aware answers instantly.",
            },
          ].map(item => (
            <div key={item.step} className="space-y-3">
              <span className="text-4xl font-bold text-primary/30">{item.step}</span>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
