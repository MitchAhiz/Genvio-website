import { Link } from 'react-router-dom'
import { useBag } from '../hooks/useBag'
import { formatPrice } from '../api/products'
import { useState } from 'react'

export default function BagPage() {
  const { items, updateQty, removeItem, clearBag, itemCount, total } = useBag()
  const [orderSent, setOrderSent] = useState(false)

  if (orderSent) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center text-2xl">
          ✓
        </div>
        <h1 className="font-display text-2xl font-semibold text-charcoal">Order Sent</h1>
        <p className="text-sm text-muted mt-2">
          Your order has been submitted successfully. We'll be in touch shortly.
        </p>
        <Link
          to="/"
          className="inline-block mt-6 px-6 py-2.5 bg-charcoal text-cream text-sm font-medium rounded-lg hover:bg-brown transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold text-charcoal">Your bag is empty</h1>
        <p className="text-sm text-muted mt-2">Browse our collection and add items to get started</p>
        <Link
          to="/"
          className="inline-block mt-6 px-6 py-2.5 bg-charcoal text-cream text-sm font-medium rounded-lg hover:bg-brown transition-colors"
        >
          Browse Collection
        </Link>
      </div>
    )
  }

  const handleSendOrder = () => {
    clearBag()
    setOrderSent(true)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <div className="pt-6 pb-4 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-semibold text-charcoal">
          Bag ({itemCount})
        </h1>
        <Link to="/" className="text-sm text-muted hover:text-charcoal transition-colors">
          Continue Shopping
        </Link>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 p-3 bg-warm-white rounded-xl border border-border">
            <img
              src={item.image}
              alt={item.name}
              className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-lg shrink-0"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] sm:text-sm font-medium text-charcoal truncate">{item.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {item.colour} · {item.size}
                  </p>
                </div>
                <p className="text-[13px] sm:text-sm font-semibold text-charcoal shrink-0">
                  {formatPrice(item.unitPrice * item.qty)}
                </p>
              </div>
              <p className="text-[13px] sm:text-sm font-semibold text-brown mt-1">{formatPrice(item.unitPrice)}</p>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => updateQty(item.id, item.qty - 1)}
                    className="px-3 py-2 sm:px-2.5 sm:py-1 text-muted hover:text-charcoal text-sm"
                  >
                    -
                  </button>
                  <span className="px-3 py-2 sm:py-1 text-sm font-medium border-x border-border min-w-[2rem] text-center">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => updateQty(item.id, item.qty + 1)}
                    className="px-3 py-2 sm:px-2.5 sm:py-1 text-muted hover:text-charcoal text-sm"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  className="text-xs text-muted hover:text-charcoal transition-colors py-2 px-1"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-4 border-t border-border">
        <div className="flex items-baseline justify-between mb-6">
          <span className="text-sm text-muted">Total ({itemCount} items)</span>
          <span className="text-xl font-semibold text-charcoal">{formatPrice(total)}</span>
        </div>

        <button
          onClick={handleSendOrder}
          className="w-full py-3.5 sm:py-3 rounded-xl bg-charcoal text-cream text-sm font-semibold hover:bg-brown transition-colors active:translate-y-px"
        >
          Send Order
        </button>
      </div>
    </div>
  )
}
