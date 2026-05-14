'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

function TrashIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}

export function DeleteCourseButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(true)
    await fetch(`/api/lessons/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(false)
  }

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(true)
  }

  if (confirming) {
    return (
      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[16px]"
        style={{ background: 'rgba(10,10,14,0.88)', backdropFilter: 'blur(6px)' }}
        onClick={e => e.preventDefault()}
      >
        <p className="text-[14px] font-medium text-white text-center px-6 leading-snug">
          Delete this course?
        </p>
        <p className="text-[12px] text-center px-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)', marginTop: -8 }}>
          This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-1.5 rounded-[8px] text-[13px] font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-1.5 rounded-[8px] text-[13px] font-medium transition-all"
            style={{ background: '#b23535', color: 'white', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#c93e3e')}
            onMouseLeave={e => (e.currentTarget.style.background = '#b23535')}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleOpen}
      className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-[7px] opacity-0 group-hover:opacity-100 transition-all duration-150"
      style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.background = 'rgba(178,53,53,0.8)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.5)' }}
      title="Delete course"
    >
      <TrashIcon />
    </button>
  )
}
