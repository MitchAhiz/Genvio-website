export default function CategoryPills({ categories, active, onSelect }) {
  const all = ['All', ...categories]
  return (
    <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pl-4">
      {all.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat === 'All' ? null : cat)}
          className={`shrink-0 px-3 sm:px-4 py-2 rounded-full text-[13px] sm:text-sm font-medium transition-colors ${
            (cat === 'All' && !active) || cat === active
              ? 'bg-charcoal text-cream'
              : 'bg-surface text-brown hover:bg-blush/40'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
