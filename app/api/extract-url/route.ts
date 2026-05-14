import { NextResponse } from 'next/server'
import { extractTextFromUrl } from '@/lib/ai/extract-url'

export async function POST(req: Request) {
  let body: { url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { url } = body
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  try {
    const text = await extractTextFromUrl(url)
    return NextResponse.json({ text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
