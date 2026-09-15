import { ChevronDownIcon } from './icons'

export default function SortSelect({ value, onChange }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Sort by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-9 pl-4 pr-9 rounded-full border border-line bg-transparent text-[12px] sm:text-[13px] font-medium tracking-[0.04em] text-ink-soft hover:border-accent hover:text-ink transition-colors duration-300 cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        <option value="newest">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="name">Name</option>
      </select>
      <ChevronDownIcon size={14} className="pointer-events-none absolute right-3.5 text-muted" />
    </label>
  )
}
