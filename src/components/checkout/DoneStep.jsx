import Price from '../Price'
import { AddressLines } from './SummaryStep'
import SaveDetailsOffer from './SaveDetailsOffer'
import { formatNgPhone } from '../../utils/phone'

const primary =
  'w-full h-12 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover active:translate-y-px active:shadow-none disabled:bg-transparent disabled:text-muted disabled:border disabled:border-line disabled:shadow-none disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform] duration-300'

// Delivery details are locked once the order exists (the server rejects every
// status), so there is deliberately no Edit button here — only this note.
const deliveryNote = 'Need to change delivery details? Contact us.'

function Row({ label, children }) {
  return (
    <div className="py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-0.5 text-sm text-ink leading-relaxed">{children}</div>
    </div>
  )
}

export default function DoneStep({ order, saveState, active, onDone }) {
  if (!order) return null

  // The recipient name may live on the order (address.recipientName, set by
  // the courier-correcting admin flow) or fall back to the shared customer
  // record for orders placed before that field existed.
  const recipientName = order.address?.recipientName || order.customer.name

  return (
    <div className="px-5 sm:px-8 pb-6 sm:pb-8">
      <div className="flex flex-col items-center text-center pt-1">
        {active && (
          <span className="success-disc w-14 h-14 rounded-full bg-accent text-on-accent flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m5 12 4.5 4.5L19 7" />
            </svg>
          </span>
        )}
        <p className="mt-4 text-sm text-ink-soft max-w-xs leading-relaxed">
          We’ll verify your payment and process your order. Keep this reference to hand.
        </p>
        <p className="mt-3 font-display text-2xl sm:text-3xl text-ink tracking-[0.04em] tabular-nums select-all">
          {order.reference}
        </p>
      </div>

      <section className="mt-6 rounded-md border border-line bg-ground px-4 py-3.5" aria-labelledby="delivery-heading">
        <h3 id="delivery-heading" className="text-sm font-medium text-ink">
          Delivery details for logistics
        </h3>
        <p className="mt-0.5 text-xs text-muted">This is what the courier will see.</p>
        <div className="mt-3 text-sm text-ink leading-relaxed">
          <p className="font-medium">{recipientName}</p>
          <AddressLines address={order.address} />
          <p className="text-muted tabular-nums mt-0.5">{formatNgPhone(order.customer.phone)}</p>
        </div>
        <p className="mt-3 text-xs text-muted">{deliveryNote}</p>
      </section>

      <SaveDetailsOffer order={order} saveState={saveState} />

      <div className="mt-5 divide-y divide-line border-y border-line">
        <Row label="Total">
          <span className="font-display text-xl">
            <Price amount={order.total} />
          </span>
        </Row>
      </div>

      <div className="mt-8">
        <button type="button" onClick={onDone} className={primary}>
          Done
        </button>
      </div>
    </div>
  )
}