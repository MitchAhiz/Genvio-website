import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts, formatPrice } from '../api/products'

export default function SearchOverlay({ onClose }) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
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
    <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-cream w-full max-w-lg mx-auto mt-16 rounded-xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands..."
            className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-muted"
          />
          <button onClick={onClose} className="text-muted hover:text-charcoal text-xs font-medium">
            ESC
          </button>
        </div>

        {q && (
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No products found</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors text-left"
                  onClick={() => { navigate(`/product/${p.slug}`); onClose() }}
                >
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className="w-12 h-12 object-cover rounded-lg"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{p.name}</p>
                    <p className="text-xs text-muted">{p.brand}</p>
                  </div>
                  <span className="text-sm font-medium text-brown">{formatPrice(p.price)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
