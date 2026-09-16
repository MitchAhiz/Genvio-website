// Generic pulse-animation loading placeholders for admin tables/cards.
// Later tasks compose these into full-table or full-grid loading states.

export function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
}

// One placeholder table row, `columns` cells wide.
export function RowSkeleton({ columns = 5 }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <SkeletonBlock className="h-4 w-full max-w-[10rem]" />
        </td>
      ))}
    </tr>
  )
}

// One placeholder card (e.g. a product or stat card).
export function CardSkeleton({ className = '' }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`}>
      <SkeletonBlock className="h-24 w-full" />
      <SkeletonBlock className="mt-3 h-4 w-3/4" />
      <SkeletonBlock className="mt-2 h-4 w-1/2" />
    </div>
  )
}
