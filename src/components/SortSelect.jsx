export default function SortSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-brown focus:outline-none focus:border-dusty-rose"
    >
      <option value="newest">Newest</option>
      <option value="price-asc">Price: Low → High</option>
      <option value="price-desc">Price: High → Low</option>
      <option value="name">Name</option>
    </select>
  )
}
