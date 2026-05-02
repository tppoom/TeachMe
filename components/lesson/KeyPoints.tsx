interface KeyPointsProps {
  points: string[]
}

export function KeyPoints({ points }: KeyPointsProps) {
  return (
    <div className="rounded-lg border border-green-800/40 bg-green-950/20 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3">
        Key Points
      </p>
      <ul className="space-y-1.5">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
