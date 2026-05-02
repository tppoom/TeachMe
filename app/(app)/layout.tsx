import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg">TeachMe</Link>
        <div className="flex items-center gap-4">
          <Link href="/create">
            <Button size="sm">+ New Lesson</Button>
          </Link>
          <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
            Settings
          </Link>
        </div>
      </nav>
      <main className="container mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
