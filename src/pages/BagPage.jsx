import { Link } from 'react-router-dom'
import { useBag } from '../hooks/useBag'
import { formatPrice } from '../api/products'
import { useState } from 'react'
import { BagIcon } from '../components/icons'
import Price from '../components/Price'
import CheckoutOverlay from '../components/checkout/CheckoutOverlay'

const primaryLink =
  'inline-flex items-center h-11 px-6 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover active:translate-y-px active:shadow-none transition-[background-color,box-shadow,transform] duration-300'

export default function BagPage() {
  const { items, updateQty, removeItem, itemCount, total } = useBag()
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  return (
    <>
      {items.length === 0 ? (
        <div className="max-w-lg mx-auto px-4 py-24 sm:py-32 text-center">
          <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-accent-soft text-ink flex items-center justify-center">
            <BagIcon />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.01em] text-ink">Your bag is empty</h1>
          <p className="text-sm text-muted mt-3">Add pieces from any section — they all land here.</p>
          <Link to="/shop" className={`${primaryLink} mt-8`}>
            Browse the collection
          </Link>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-24">
          <div className="pt-10 sm:pt-16 pb-6 sm:pb-8 flex items-baseline justify-between">
            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.02em] text-ink">
              Bag <span className="text-muted tabular-nums">({itemCount})</span>
            </h1>
            <Link to="/shop" className="text-[13px] sm:text-sm text-muted hover:text-ink transition-colors">
              Continue shopping
            </Link>
          </div>

          <ul className="divide-y divide-line border-y border-line">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 py-5">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-[6.25rem] sm:w-24 sm:h-30 object-cover rounded-md bg-surface ring-1 ring-line/70 shrink-0"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm sm:text-[15px] font-medium text-ink leading-snug">{item.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{item.brand}</p>
                      <p className="text-xs text-muted mt-1">
                        {item.colour} · {item.size}
                      </p>
                    </div>
                    <p className="text-sm sm:text-[15px] font-semibold text-ink shrink-0 tabular-nums">
                      {formatPrice(item.unitPrice * item.qty)}
                    </p>
                  </div>

                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <div className="inline-flex items-center h-9 rounded-md border border-line bg-elevated overflow-hidden">
                      <button
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        aria-label="Fewer"
                        className="w-9 h-full text-muted hover:text-ink hover:bg-surface transition-colors text-base"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-medium tabular-nums border-x border-line leading-9">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        aria-label="More"
                        className="w-9 h-full text-muted hover:text-ink hover:bg-surface transition-colors text-base"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-muted hover:text-ink underline-offset-4 hover:underline transition-colors py-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <div className="flex items-baseline justify-between mb-6">
              <span className="text-sm text-muted">
                Total · {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
              <span className="font-display text-2xl sm:text-3xl text-ink">
                <Price amount={total} />
              </span>
            </div>

            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full h-13 sm:h-12 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover hover:shadow-[0_8px_20px_-6px_rgb(0_0_0/0.4)] active:translate-y-px active:shadow-none transition-[background-color,box-shadow,transform] duration-300"
            >
              Send order
            </button>
            <p className="mt-3 text-center text-xs text-muted">Pay by bank transfer — details on the next screen.</p>
          </div>
        </div>
      )}

      {checkoutOpen && <CheckoutOverlay onClose={() => setCheckoutOpen(false)} />}
    </>
  )
}
