// Outlined pills; the active one fills with the section's accent.
export default function CategoryPills({ categories, active, onSelect }) {
  const all = ['All', ...categories]
  return (
    <div
      className="flex-1 min-w-0 flex gap-2 overflow-x-auto scrollbar-none pl-4 sm:pl-6 pr-1 py-0.5"
      role="group"
      aria-label="Filter by category"
    >
      {all.map((cat) => {
        const isActive = (cat === 'All' && !active) || cat === active
        return (
          <button
            key={cat}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(cat === 'All' ? null : cat)}
            className={`shrink-0 h-9 px-4 rounded-full border text-[12px] sm:text-[13px] font-medium tracking-[0.04em] transition-[background-color,border-color,color,box-shadow] duration-300 ${
              isActive
                ? 'bg-accent border-accent text-on-accent shadow-[0_2px_6px_-2px_rgb(0_0_0/0.3)]'
                : 'bg-transparent border-line text-ink-soft hover:border-accent hover:text-ink'
            }`}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
