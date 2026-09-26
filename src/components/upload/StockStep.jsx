import { useEffect, useState } from 'react'
import { getSizeRange } from '../../api/admin'

function SizeInput({ size, current, value, onChange }) {
  const [display, setDisplay] = useState(String(value ?? 0))

  useEffect(() => { setDisplay(String(value ?? 0)) }, [value])

  return (
    <tr>
      <td className="px-2 py-1.5 text-sm">{size}</td>
      <td className="px-2 py-1.5 text-sm tabular-nums text-slate-500">{current}</td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          min="0"
          step="1"
          value={display}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            setDisplay(e.target.value)
            const n = Number(e.target.value)
            onChange(Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0)
          }}
          onBlur={() => { if (display.trim() === '') { setDisplay('0'); onChange(0) } }}
          className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums"
        />
      </td>
      <td className="px-2 py-1.5 font-mono text-xs text-slate-500">
        {current} → {current + (value || 0)}
      </td>
    </tr>
  )
}

// Step 3: additive stock only — every number entered here is units
// RECEIVED and is added on top of whatever is already there, never a
// replace/overwrite. `blocks` is one entry per colour this session needs
// stock for: { key, colourName, currentBySize: { [size]: qty } }.
export default function StockStep({ categoryId, subcategoryId, blocks, stockByBlock, onChangeStock, onContinue }) {
  const [sizes, setSizes] = useState(null) // null = loading, [] = none configured
  const [error, setError] = useState('')

  useEffect(() => {
    if (!categoryId || !subcategoryId) return
    let cancelled = false
    getSizeRange(categoryId, subcategoryId)
      .then((range) => { if (!cancelled) setSizes(range?.sizes || []) })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Failed to load size range'); setSizes([]) } })
    return () => { cancelled = true }
  }, [categoryId, subcategoryId])

  if (sizes === null) return <p className="text-sm text-slate-400">Loading size range…</p>

  if (sizes.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        {error || 'No size range is configured for this sub-category yet.'} Configure it in Admin → Products → Manage Categories first, then come back.
      </div>
    )
  }

  const canContinue = blocks.length > 0

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-slate-400">
        Enter units received per size — this is added to current stock, it never replaces it.
      </p>
      {blocks.map((block) => {
        const rowState = stockByBlock[block.key] || {}
        return (
          <div key={block.key}>
            <div className="mb-1 text-sm font-semibold text-slate-900">{block.colourName}</div>
            <table className="w-full max-w-md border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-400">
                  <th className="px-2 py-1">Size</th>
                  <th className="px-2 py-1">Current</th>
                  <th className="px-2 py-1">Units received</th>
                  <th className="px-2 py-1">Before → After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sizes.map((size) => (
                  <SizeInput
                    key={size}
                    size={size}
                    current={block.currentBySize[size] || 0}
                    value={rowState[size] || 0}
                    onChange={(qty) => onChangeStock(block.key, size, qty)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <button
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
        className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        Continue to review →
      </button>
    </div>
  )
}
