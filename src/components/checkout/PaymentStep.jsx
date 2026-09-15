import { useEffect, useState } from 'react'
import Price from '../Price'
import { getPaymentConfig, createOrder } from '../../api/orders'
import { normalizeNgPhone } from '../../utils/phone'
import { CheckIcon } from '../icons'

const primary =
  'w-full h-12 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover active:translate-y-px active:shadow-none disabled:bg-transparent disabled:text-muted disabled:border disabled:border-line disabled:shadow-none disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform] duration-300'
const quiet =
  'h-12 px-5 rounded-md border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-accent transition-colors duration-300 disabled:opacity-50'

// Nigerian NUBAN account numbers are 10 digits, read as 4-3-3.
function groupAccount(value) {
  const digits = String(value).replace(/\D/g, '')
  if (digits.length !== 10) return String(value)
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}

export default function PaymentStep({ items, total, details, active, onBack, onSubmitted }) {
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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

  const copy = async () => {
    if (!config) return
    try {
      await navigator.clipboard.writeText(config.accountNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — the number is still selectable.
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const order = await createOrder({
        phone: normalizeNgPhone(details.phone),
        name: details.name.trim(),
        address: {
          street: details.address.street.trim(),
          city: details.address.city.trim(),
          state: details.address.state,
        },
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          brand: i.brand,
          colour: i.colour,
          size: i.size,
          image: i.image,
          qty: i.qty,
          unitPrice: i.unitPrice,
        })),
        total,
      })
      onSubmitted(order)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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
              <p
                className={`font-display text-3xl sm:text-4xl leading-none tracking-[0.06em] tabular-nums transition-colors duration-500 ${
                  copied ? 'text-accent' : 'text-ink'
                }`}
              >
                {groupAccount(config.accountNumber)}
              </p>
              <button
                type="button"
                onClick={copy}
                aria-live="polite"
                className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-300 active:translate-y-px ${
                  copied
                    ? 'bg-accent border-accent text-on-accent'
                    : 'border-line text-ink-soft hover:border-accent hover:text-ink'
                }`}
              >
                {copied && <CheckIcon size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
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
        to the account above, then tap <span className="text-ink font-medium">I’ve paid</span>. We’ll confirm the
        transfer and start on your order.
      </p>

      {submitError && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {submitError}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className={quiet}>
          Back
        </button>
        <button type="button" onClick={submit} disabled={!config || submitting} className={primary}>
          {submitting ? 'Sending your order…' : 'I’ve paid'}
        </button>
      </div>
    </div>
  )
}
