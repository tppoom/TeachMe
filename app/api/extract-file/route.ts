import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Size check before reading into memory
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 })
  }

  // Type validation by extension
  const nameLower = file.name.toLowerCase()
  const ext = Object.keys(ALLOWED_EXTENSIONS).find(e => nameLower.endsWith(e))
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' }, { status: 400 })
  }

  // Magic-byte validation
  const buffer = Buffer.from(await file.arrayBuffer())
  if (ext === '.pdf' && !buffer.subarray(0, 4).toString('ascii').startsWith('%PDF')) {
    return NextResponse.json({ error: 'File does not appear to be a valid PDF' }, { status: 400 })
  }
  if (ext === '.docx' && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    return NextResponse.json({ error: 'File does not appear to be a valid DOCX' }, { status: 400 })
  }

  // Sanitize filename before embedding in extracted text
  const safeName = file.name.replace(/[^\w.\-]/g, '_')
  let text = ''

  try {
    if (ext === '.pdf') {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      text = `[PDF: ${safeName}]\n${result.text}`
    } else if (ext === '.docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = `[DOCX: ${safeName}]\n${result.value}`
    } else {
      text = `[TXT: ${safeName}]\n${buffer.toString('utf8')}`
    }
  } catch (err: unknown) {
    console.error('[extract-file] parse error:', err)
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }

  return NextResponse.json({ text: text.slice(0, 10000) })
}
