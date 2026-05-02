import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lessons = await db.lesson.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, topic: true, depth: true, provider: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Lessons</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} generated
          </p>
        </div>
        <Link href="/create">
          <Button>+ New Lesson</Button>
        </Link>
      </div>

      {lessons.length === 0 ? (
        <div className="text-center py-20 border rounded-xl">
          <p className="text-muted-foreground mb-4">No lessons yet.</p>
          <Link href="/create">
            <Button>Generate your first lesson</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map(lesson => (
            <Link
              key={lesson.id}
              href={`/lessons/${lesson.id}`}
              className="block border rounded-xl p-5 hover:border-primary transition-colors space-y-3"
            >
              <div className="space-y-1">
                <p className="font-semibold line-clamp-2">{lesson.title}</p>
                <p className="text-sm text-muted-foreground">{lesson.topic}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{lesson.depth}</Badge>
                <Badge variant="outline" className="capitalize">{lesson.provider}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(lesson.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
