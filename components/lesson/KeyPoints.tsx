import { inline } from './inline-md'
import { labelsFor } from './labels'

interface KeyPointsProps {
  points: string[]
  language?: string
}

function CheckIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export function KeyPoints({ points, language }: KeyPointsProps) {
  if (!points?.length) return null
  const L = labelsFor(language)
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2.5"
        style={{
          background: 'var(--success-soft)',
          borderBottom: '1px solid var(--border)',
          color: 'var(--success)',
        }}
      >
        <StarIcon />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
          {L.keyTakeaways}
        </span>
      </div>
      <ul className="p-5 space-y-3" style={{ background: 'var(--bg-elev)' }}>
        {points.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-[2px]"
              style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
            >
              <CheckIcon />
            </span>
            <span className="text-[14.5px] leading-[1.7]" style={{ color: 'var(--fg-2)' }}>{inline(p)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
