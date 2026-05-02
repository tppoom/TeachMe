import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { extractTextFromUrl } from '@/lib/ai/extract-url'

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let url: string | undefined
  try {
    ;({ url } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  // Validate URL - prevent SSRF
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 })
    }
    const hostname = parsed.hostname.toLowerCase()
    // Block localhost and common internal addresses
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname === '169.254.169.254' // AWS metadata
    ) {
      return NextResponse.json({ error: 'Internal URLs are not allowed' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const text = await extractTextFromUrl(url)
    return NextResponse.json({ text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
