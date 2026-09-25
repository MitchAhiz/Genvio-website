import Price from '../Price'
import { formatPrice } from '../../api/products'
import { formatNgPhone } from '../../utils/phone'
import { useSiteConfig } from '../../hooks/useSiteConfig'

const primary =
  'w-full h-12 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover active:translate-y-px active:shadow-none transition-[background-color,box-shadow,transform] duration-300'
const quiet =
  'h-12 px-5 rounded-md border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-accent transition-colors duration-300'

export function AddressLines({ address }) {
  if (!address) return null
  return (
    <>
      <span className="block">{address.street}</span>
      <span className="block">
        {address.city}, {address.state}
      </span>
    </>
  )
}

export default function SummaryStep({
  items,
  subtotal,
  deliveryFee,
  deliveryLabel,
  total,
  details,
  onBack,
  onEditDetails,
  onContinue,
  submitting = false,
  submitError = '',
}) {
  const count = items.reduce((n, i) => n + i.qty, 0)
  const { config } = useSiteConfig()
  const minOrder = config?.min_order_amount ?? null
  const belowMin = minOrder != null && subtotal < minOrder
  return (
    <div className="px-5 sm:px-8 pb-6 sm:pb-8">
      <ul className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3.5 py-3.5">
            <img
              src={item.image}
              alt=""
              className="w-14 h-[4.375rem] object-cover rounded-md bg-surface ring-1 ring-line/70 shrink-0"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink leading-snug">{item.name}</p>
              <p className="mt-0.5 text-xs text-muted">
                {item.colour} · {item.size}
              </p>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {item.qty} × {formatPrice(item.unitPrice)}
              </p>
            </div>
            <p className="text-sm font-semibold text-ink tabular-nums shrink-0">{formatPrice(item.unitPrice * item.qty)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">
            Subtotal · {count} {count === 1 ? 'item' : 'items'}
          </span>
          <span className="text-sm text-ink tabular-nums">
            <Price amount={subtotal} />
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">{deliveryLabel}</span>
          <span className="text-sm text-ink tabular-nums">
            {deliveryFee > 0 ? <Price amount={deliveryFee} /> : 'Free'}
          </span>
        </div>
        <div className="flex items-baseline justify-between pt-1.5">
          <span className="text-sm font-medium text-ink">Total</span>
          <span className="font-display text-2xl text-ink">
            <Price amount={total} />
          </span>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-line flex items-start justify-between gap-4">
        <div className="text-sm leading-relaxed">
          <p className="text-xs text-muted mb-1">Deliver to</p>
          <p className="font-medium text-ink">{details.name}</p>
          <p className="text-ink-soft">
            <AddressLines address={details.address} />
          </p>
          <p className="text-muted tabular-nums mt-0.5">{formatNgPhone(details.phone)}</p>
        </div>
        <button
          type="button"
          onClick={onEditDetails}
          className="shrink-0 text-xs text-ink-soft hover:text-ink underline underline-offset-4 transition-colors"
        >
          Edit
        </button>
      </div>

      {belowMin && (
        <p className="mt-6 text-sm text-center text-danger">
          Minimum order is {formatPrice(minOrder)} — add {formatPrice(minOrder - subtotal)} more to continue.
        </p>
      )}

      {submitError && (
        <p className="mt-6 text-sm text-danger" role="alert">
          {submitError}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className={quiet}>
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={belowMin || submitting}
          className={`${primary} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cta`}
        >
          {submitting ? 'Placing your order…' : 'Continue to payment'}
        </button>
      </div>
    </div>
  )
}
