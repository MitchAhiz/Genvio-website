import { useEffect, useState } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import { searchUploadProducts } from '../../api/admin'
import { NairaAmount } from '../../utils/currency'

// Collapsed side-door above the main form: search an existing product,
// pick one of its colours, and jump straight to the stock-per-size step —
// skipping photos and details entirely, since the product already exists.
export default function RestockBar({ onPickColour }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const q = debouncedQuery.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    searchUploadProducts(q)
      .then((data) => { if (!cancelled) setResults(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Search failed') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, open])

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 p-3">
        <p className="text-sm text-slate-500">Just adding more of something you already stock?</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {open ? 'Close' : 'Find it to restock →'}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name…"
            autoFocus
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          {loading && <p className="mt-2 text-xs text-slate-400">Searching…</p>}

          {!loading && debouncedQuery.trim().length >= 2 && results.length === 0 && !error && (
            <p className="mt-2 text-xs text-slate-400">
              Nothing found — close this and shoot photos to add it as new.
            </p>
          )}

          <div className="mt-2 space-y-2">
            {results.map((product) => (
              <div key={product.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{product.name}</div>
                    <div className="text-xs text-slate-400">
                      {product.brand} · {product.category?.name}
                      {product.subcategory?.name ? ` / ${product.subcategory.name}` : ''}
                    </div>
                  </div>
                  <NairaAmount value={product.price} className="whitespace-nowrap text-sm font-semibold" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => onPickColour(product, variant)}
                      className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-900"
                    >
                      {variant.colour}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
