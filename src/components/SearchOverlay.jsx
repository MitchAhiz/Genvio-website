import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts, formatPrice } from '../api/products'
import { getSection, productPath } from '../sections'
import { SearchIcon } from './icons'

// Searches every retail section; each result shows its section and opens in
// that section (the theme follows).
export default function SearchOverlay({ onClose }) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => console.error('Failed to load products for search:', err))
  }, [])

  const q = query.toLowerCase().trim()
  const results = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
    : []

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-3 sm:p-0" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search">
      <div
        className="bg-elevated text-ink w-full max-w-lg mx-auto mt-12 sm:mt-16 rounded-xl shadow-xl shadow-black/20 overflow-hidden border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <SearchIcon size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands, categories"
            className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-muted"
          />
          <button onClick={onClose} className="text-muted hover:text-ink text-xs font-medium">
            Esc
          </button>
        </div>

        {q && (
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No products match “{query.trim()}”</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
                  onClick={() => {
                    navigate(productPath(p))
                    onClose()
                  }}
                >
                  <img src={p.images[0]} alt="" className="w-12 h-12 object-cover rounded-lg bg-surface" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                    <p className="text-xs text-muted">
                      {p.brand} · {getSection(p.section).label}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-ink-soft tabular-nums">{formatPrice(p.price)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
