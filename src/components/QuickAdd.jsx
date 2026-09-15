import { useState, useEffect } from 'react'
import { useBag } from '../hooks/useBag'
import { formatPrice } from '../api/products'
import { CloseIcon } from './icons'
import Price from './Price'

export default function QuickAdd({ product, onClose }) {
  const { addItem } = useBag()
  const [selectedColour, setSelectedColour] = useState(product.variants[0]?.colour ?? null)
  const [quantities, setQuantities] = useState({})

  const variant = product.variants.find((v) => v.colour === selectedColour)
  const sizes = variant ? Object.entries(variant.sizes) : []

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
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
      if (qty > 0) addItem({ product, colour: selectedColour, size, qty })
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${product.name} to bag`}
    >
      <div
        className="bg-elevated text-ink w-full sm:max-w-sm rounded-t-2xl sm:rounded-lg shadow-[0_24px_60px_-20px_rgb(0_0_0/0.5)] border border-line overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-line rounded-full mx-auto mt-2.5 sm:hidden" aria-hidden="true" />
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-medium leading-snug text-ink text-balance">{product.name}</h3>
            <p className="mt-1 text-xs text-muted">{product.brand}</p>
            <p className="mt-1.5 font-display text-lg text-ink-soft">
              <Price amount={product.price} />
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 -mt-1 rounded-full text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {product.variants.length > 1 && (
          <div className="px-5 pb-4">
            <p className="text-xs text-muted mb-2">
              Colour · <span className="text-ink">{selectedColour}</span>
            </p>
            <div className="flex gap-3">
              {product.variants.map((v) => (
                <button
                  key={v.colour}
                  onClick={() => {
                    setSelectedColour(v.colour)
                    setQuantities({})
                  }}
                  className={`w-8 h-8 rounded-full ring-1 ring-line ring-offset-2 ring-offset-elevated transition-[box-shadow,transform] duration-300 ${
                    selectedColour === v.colour ? 'ring-2 ring-accent scale-105' : 'hover:ring-accent/60'
                  }`}
                  style={{ backgroundColor: v.hex }}
                  aria-label={v.colour}
                  aria-pressed={selectedColour === v.colour}
                  title={v.colour}
                />
              ))}
            </div>
          </div>
        )}

        <div className="px-5 pb-4 border-t border-line/70 pt-3">
          {sizes.length === 0 ? (
            <p className="text-sm text-muted py-2">No sizes available.</p>
          ) : (
            sizes.map(([size, stock]) => (
              <div key={size} className="flex items-center gap-3 py-1.5">
                <span className="text-sm font-medium w-14 tabular-nums">{size}</span>
                <span className="text-xs text-muted flex-1 tabular-nums">{stock > 0 ? `${stock} available` : 'Out of stock'}</span>
                <input
                  type="number"
                  min={0}
                  max={stock}
                  value={quantities[size] || ''}
                  onChange={(e) => setQty(size, e.target.value)}
                  disabled={stock === 0}
                  placeholder="0"
                  aria-label={`Quantity for ${size}`}
                  className="w-16 h-10 sm:h-9 text-center text-sm rounded-md border border-line bg-ground text-ink placeholder:text-muted/70 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            ))
          )}
        </div>

        <div className="px-5 pb-5 sm:pb-5">
          <button
            onClick={handleAdd}
            disabled={totalQty === 0}
            className="w-full h-12 sm:h-11 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover active:translate-y-px active:shadow-none disabled:bg-transparent disabled:text-muted disabled:border disabled:border-line disabled:shadow-none disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform] duration-300"
          >
            {totalQty > 0 ? `Add ${totalQty} to Bag · ${formatPrice(totalQty * product.price)}` : 'Add to Bag'}
          </button>
        </div>
      </div>
    </div>
  )
}
