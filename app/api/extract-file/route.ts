import { NextResponse } from 'next/server'

const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED_EXTENSIONS: Record<string, string> = { '.pdf': 'pdf', '.docx': 'docx', '.txt': 'txt', '.md': 'txt' }

function ext(name: string) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 })

  const fileExt = ext(file.name)
  if (!ALLOWED_EXTENSIONS[fileExt]) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^\w.\-]/g, '_')

  try {
    let text = ''
    if (fileExt === '.pdf') {
      const magic = buffer.subarray(0, 4).toString('ascii')
      if (!magic.startsWith('%PDF')) return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 })
      const { PDFParse } = await import('pdf-parse')
      const result = await new PDFParse({ data: buffer }).getText()
      text = `[PDF: ${safeName}]\n${result.text}`
    } else if (fileExt === '.docx') {
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) return NextResponse.json({ error: 'Invalid DOCX file' }, { status: 400 })
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = `[DOCX: ${safeName}]\n${result.value}`
    } else {
      text = `[TXT: ${safeName}]\n${buffer.toString('utf8')}`
    }
    return NextResponse.json({ text: text.slice(0, 60000) })
  } catch (e) {
    console.error('File parse error:', e)
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }
}
