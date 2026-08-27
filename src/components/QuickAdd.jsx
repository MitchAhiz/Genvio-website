import { useState, useEffect } from 'react'
import { useBag } from '../hooks/useBag'

export default function QuickAdd({ product, onClose }) {
  const { addItem } = useBag()
  const [selectedColour, setSelectedColour] = useState(product.variants[0].colour)
  const [quantities, setQuantities] = useState({})

  const variant = product.variants.find((v) => v.colour === selectedColour)
  const sizes = Object.entries(variant.sizes)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const setQty = (size, val) => {
    const max = variant.sizes[size]
    const qty = Math.max(0, Math.min(max, Number(val) || 0))
    setQuantities((prev) => ({ ...prev, [size]: qty }))
  }

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0)

  const handleAdd = () => {
    for (const [size, qty] of Object.entries(quantities)) {
      if (qty > 0) {
        addItem({ product, colour: selectedColour, size, qty })
      }
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal/40" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-sm sm:rounded-xl rounded-t-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-border/60 rounded-full mx-auto mt-2 sm:hidden" />
        <div className="px-4 pt-3 sm:pt-4 pb-2 flex items-center justify-between">
          <h3 className="font-display text-base sm:text-lg font-medium text-charcoal">{product.name}</h3>
          <button onClick={onClose} aria-label="Close" className="p-2 -mr-1 text-muted hover:text-charcoal">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {product.variants.length > 1 && (
          <div className="px-4 pb-3 flex gap-2.5">
            {product.variants.map((v) => (
              <button
                key={v.colour}
                onClick={() => { setSelectedColour(v.colour); setQuantities({}) }}
                className={`w-8 h-8 rounded-full border-2 transition-colors ${
                  selectedColour === v.colour ? 'border-charcoal scale-110' : 'border-border'
                }`}
                style={{ backgroundColor: v.hex }}
                aria-label={v.colour}
                title={v.colour}
              />
            ))}
          </div>
        )}

        <div className="px-4 pb-4 space-y-1.5">
          {sizes.map(([size, stock]) => (
            <div key={size} className="flex items-center justify-between py-0.5">
              <span className="text-sm font-medium w-10">{size}</span>
              <span className="text-xs text-muted flex-1">{stock > 0 ? `${stock} avail` : 'Out'}</span>
              <input
                type="number"
                min={0}
                max={stock}
                value={quantities[size] || ''}
                onChange={(e) => setQty(size, e.target.value)}
                disabled={stock === 0}
                placeholder="0"
                className="w-16 text-center text-sm border border-border rounded-lg py-2.5 sm:py-1.5 bg-warm-white disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-dusty-rose"
              />
            </div>
          ))}
        </div>

        <div className="px-4 pb-5 sm:pb-4">
          <button
            onClick={handleAdd}
            disabled={totalQty === 0}
            className="w-full py-3 sm:py-2.5 rounded-xl sm:rounded-lg bg-charcoal text-cream text-sm font-medium hover:bg-brown transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-px"
          >
            Add to Bag{totalQty > 0 ? ` (${totalQty})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
