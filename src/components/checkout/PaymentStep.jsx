import { useEffect, useState } from 'react'
import Price from '../Price'
import ReceiptUpload from './ReceiptUpload'
import { getPaymentConfig } from '../../api/orders'
import { CheckIcon } from '../icons'

const quiet =
  'h-12 px-5 rounded-md border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-accent transition-colors duration-300 disabled:opacity-50'

// Nigerian NUBAN account numbers are 10 digits, read as 4-3-3.
function groupAccount(value) {
  const digits = String(value).replace(/\D/g, '')
  if (digits.length !== 10) return String(value)
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — the value is still selectable.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-300 active:translate-y-px ${
        copied ? 'bg-accent border-accent text-on-accent' : 'border-line text-ink-soft hover:border-accent hover:text-ink'
      }`}
    >
      {copied && <CheckIcon size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// The order already exists by the time this renders — CheckoutOverlay
// creates it on Summary -> Payment, specifically so order.reference and
// order.orderToken are available here, before any upload.
export default function PaymentStep({ order, total, active, onBack, onSubmitted }) {
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState('')

  useEffect(() => {
    if (!active || config) return
    let cancelled = false
    getPaymentConfig()
      .then((c) => {
        if (!cancelled) setConfig(c)
      })
      .catch((err) => {
        if (!cancelled) setConfigError(err.message || 'Payment details are unavailable right now.')
      })
    return () => {
      cancelled = true
    }
  }, [active, config])

  return (
    <div className="px-5 sm:px-8 pb-6 sm:pb-8">
      <div className="rounded-lg border border-line bg-ground px-5 py-5 sm:px-6 sm:py-6">
        {configError ? (
          <p className="text-sm text-danger">{configError}</p>
        ) : !config ? (
          <div className="animate-pulse" aria-busy="true">
            <div className="h-3 w-28 rounded bg-surface" />
            <div className="mt-4 h-9 w-56 rounded bg-surface" />
            <div className="mt-4 h-3 w-40 rounded bg-surface" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">{config.bankName}</p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="font-display text-3xl sm:text-4xl leading-none tracking-[0.06em] tabular-nums text-ink">
                {groupAccount(config.accountNumber)}
              </p>
              <CopyButton value={config.accountNumber} />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">{config.accountName}</p>
          </>
        )}
      </div>

      <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
        Transfer{' '}
        <span className="font-display text-xl text-ink">
          <Price amount={total} />
        </span>{' '}
        to the account above.
      </p>

      {order && (
        <div className="mt-4 rounded-md border border-line bg-ground px-4 py-3.5">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Use{' '}
            <span className="font-display text-base text-ink tracking-[0.03em] tabular-nums select-all">
              {order.reference}
            </span>{' '}
            as your transfer narration/description (optional, but it helps us confirm faster).
          </p>
          <div className="mt-2.5">
            <CopyButton value={order.reference} />
          </div>
        </div>
      )}

      <div className="mt-6">
        <ReceiptUpload order={order} onUploaded={onSubmitted} />
      </div>

      <div className="mt-6">
        <button type="button" onClick={onBack} className={quiet}>
          Back
        </button>
      </div>
    </div>
  )
}
