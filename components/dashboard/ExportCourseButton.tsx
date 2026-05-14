'use client'

function ExportIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

interface Props {
  id: string
  title: string
  topic: string
  provider: string
  content: unknown
}

export function ExportCourseButton({ id, title, topic, provider, content }: Props) {
  function handleExport(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const exportData = {
      format: 'teachme-course',
      version: '1',
      exportedAt: new Date().toISOString(),
      title,
      topic,
      provider,
      content,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = title.replace(/[/\\:*?"<>|]+/g, '-').replace(/^-+|-+$/g, '').trim() || 'course'
    a.download = `${safeName}.teachme`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="absolute top-3 left-3 z-20 w-7 h-7 rounded-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)' }}
      title="Export course"
      aria-label="Export course"
    >
      <ExportIcon />
    </button>
  )
}
