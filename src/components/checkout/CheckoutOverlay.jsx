import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBag } from '../../hooks/useBag'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { CloseIcon } from '../icons'
import DetailsStep from './DetailsStep'
import SummaryStep from './SummaryStep'
import PaymentStep from './PaymentStep'
import DoneStep from './DoneStep'
import { deliveryFeeFor, deliveryLabelFor } from '../../utils/delivery'
import { createOrder } from '../../api/orders'
import { lookupOrder } from '../../api/receipts'

// The order is created once, on Summary -> Payment (not on upload), so
// order.reference and order.orderToken exist before the receipt step ever
// renders. Persisting the two here lets a customer who closes the sheet
// after this point reopen it straight into the pending-upload state
// instead of being asked to pay again.
const PENDING_ORDER_KEY = 'genvio:pending-order'
// Only these statuses still have something to do on the Payment step —
// anything else (confirmed and beyond) has nothing left to restore into.
const RESTORABLE_STATUSES = ['pending_payment', 'pending_verification', 'rejected', 'expired']

function loadPendingOrderRef() {
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.orderId && parsed?.orderToken ? parsed : null
  } catch {
    return null
  }
}

function savePendingOrderRef(order) {
  try {
    localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderId: order.id, orderToken: order.orderToken }))
  } catch {
    // Storage blocked/full — the order still exists server-side, only the
    // "reopen where I left off" convenience is lost.
  }
}

function clearPendingOrderRef() {
  try {
    localStorage.removeItem(PENDING_ORDER_KEY)
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

const STEPS = [
  { key: 'details', label: 'Details', title: 'Your details' },
  { key: 'summary', label: 'Summary', title: 'Your order' },
  { key: 'payment', label: 'Payment', title: 'Pay by transfer' },
  { key: 'done', label: 'Done', title: 'Order submitted' },
]

const EMPTY_DETAILS = {
  phone: '',
  name: '',
  email: '',
  isWhatsapp: true,
  deliveryZone: '',
  address: { street: '', city: '', state: '' },
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Drag-to-dismiss thresholds: either pull the sheet down past a third of its
// height, or flick it with enough speed.
const DISMISS_FRACTION = 0.33
const DISMISS_VELOCITY = 0.6 // px per ms

// One sheet, four cards that slide sideways. Bottom sheet on mobile, centred
// modal from sm up. Themed by whatever section the bag was opened from.
export default function CheckoutOverlay({ onClose }) {
  const { items, total, clearBag } = useBag()
  const { config } = useSiteConfig()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [details, setDetails] = useState(EMPTY_DETAILS)
  const [order, setOrder] = useState(null)
  // Captured once from the order that was created; a later delivery edit
  // returns an order without it, and re-asking would be rude.
  const [saveState, setSaveState] = useState(null)
  const [closing, setClosing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [createError, setCreateError] = useState('')
  // 'checking' while the localStorage restore is in flight, so the sheet
  // doesn't flash the Details step before jumping to Payment.
  const [restoring, setRestoring] = useState(true)

  // After submission the bag is cleared; later steps read from the order.
  const lineItems = order ? order.items.map((i, idx) => ({ ...i, id: `${i.productId}-${idx}` })) : items
  const productSubtotal = order ? order.total - (order.address?.deliveryFee || 0) : total

  // Once an order exists its address carries the delivery choice the backend
  // priced and charged; before that, price from the live config the same way
  // the backend will.
  const deliverySource = order
    ? { deliveryZone: order.address?.deliveryZone, address: { state: order.address?.state } }
    : details
  const deliveryFee = order ? order.address?.deliveryFee || 0 : deliveryFeeFor(details, config)
  const deliveryLabel = deliveryLabelFor(deliverySource)
  const grandTotal = productSubtotal + deliveryFee

  const bodyRef = useRef(null)
  const panelRefs = useRef([])
  const sheetRef = useRef(null)
  const returnFocusRef = useRef(null)
  const drag = useRef(null)

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      onClose()
      if (order) navigate('/shop')
    }, 330)
  }, [closing, onClose, order, navigate])

  // On open, check for a pending order left over from a previous visit
  // (closed after the order was created, before/during upload) and jump
  // straight to Payment with it restored, instead of starting over.
  useEffect(() => {
    const ref = loadPendingOrderRef()
    if (!ref) {
      setRestoring(false)
      return
    }
    let cancelled = false
    lookupOrder(ref.orderId, ref.orderToken)
      .then((restored) => {
        if (cancelled) return
        if (RESTORABLE_STATUSES.includes(restored.status)) {
          setOrder(restored)
          setStep(2)
        } else {
          // Confirmed and beyond — nothing left to restore into.
          clearPendingOrderRef()
        }
      })
      .catch(() => {
        // Order gone, token stale, or a network hiccup — fall back to a
        // fresh checkout rather than getting stuck.
        clearPendingOrderRef()
      })
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Remember what opened the sheet, and hand focus back on the way out.
  useEffect(() => {
    returnFocusRef.current = document.activeElement
    return () => {
      const el = returnFocusRef.current
      if (el && typeof el.focus === 'function' && document.contains(el)) {
        el.focus({ preventScroll: true })
      }
    }
  }, [])

  // Escape closes; Tab stays inside the sheet; body scroll locks while open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key !== 'Tab') return
      const sheet = sheetRef.current
      if (!sheet) return
      const focusable = [...sheet.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null && !el.closest('[inert]')
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [close])

  // The body follows the active card's height so the sheet never shows a
  // taller card's empty space.
  useLayoutEffect(() => {
    const body = bodyRef.current
    const panel = panelRefs.current[step]
    if (!body || !panel) return
    const apply = () => {
      body.style.height = `${panel.offsetHeight}px`
    }
    apply()
    body.scrollTop = 0
    const ro = new ResizeObserver(apply)
    ro.observe(panel)
    return () => ro.disconnect()
  }, [step])

  // Focus follows the card. Without this the outgoing panel goes inert with
  // focus still inside it and the caret lands on <body>.
  //
  // A card the visitor fills in gets focus on its first field; a card they
  // read gets focus on the card itself, so nothing is pre-selected for them
  // and a screen reader announces the step before its controls.
  useEffect(() => {
    const panel = panelRefs.current[step]
    if (!panel) return
    const t = setTimeout(() => {
      const field = panel.querySelector('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
      ;(field || panel).focus({ preventScroll: true })
    }, 460) // after the slide settles
    return () => clearTimeout(t)
  }, [step])

  // ── Drag to dismiss (the grab handle is only shown on mobile) ──

  const onPointerDown = (e) => {
    if (closing) return
    const sheet = sheetRef.current
    if (!sheet) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), velocity: 0 }
    sheet.style.transform = 'translateY(0px)'
    setDragging(true)
  }

  const onPointerMove = (e) => {
    const d = drag.current
    const sheet = sheetRef.current
    if (!d || !sheet) return
    const now = performance.now()
    const dy = e.clientY - d.startY
    if (now > d.lastT) d.velocity = (e.clientY - d.lastY) / (now - d.lastT)
    d.lastY = e.clientY
    d.lastT = now
    // Downward is free; upward meets resistance rather than a hard stop.
    const offset = dy >= 0 ? dy : -Math.sqrt(-dy) * 3
    sheet.style.transform = `translateY(${offset}px)`
  }

  const endDrag = (e) => {
    const d = drag.current
    const sheet = sheetRef.current
    drag.current = null
    setDragging(false)
    if (!d || !sheet) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const dy = e.clientY - d.startY
    const shouldClose = dy > sheet.offsetHeight * DISMISS_FRACTION || d.velocity > DISMISS_VELOCITY
    if (shouldClose) {
      sheet.style.transform = ''
      close()
    } else {
      sheet.classList.add('is-settling')
      sheet.style.transform = 'translateY(0px)'
      setTimeout(() => {
        sheet.classList.remove('is-settling')
        sheet.style.transform = ''
      }, 420)
    }
  }

  // Summary -> Payment: create the order now (not on upload), so
  // order.reference and order.orderToken exist before the receipt step
  // renders and can be shown/copied and persisted immediately.
  const goToPayment = async () => {
    if (creatingOrder) return
    // Already created this session (e.g. customer went Payment -> Back ->
    // Summary -> Continue again) — reuse it rather than placing a second
    // order. Matches the delivery-lock behaviour: once an order exists its
    // details are frozen, so re-editing Details/Summary at this point has
    // no server-side effect anyway.
    if (order) {
      setStep(2)
      return
    }
    setCreatingOrder(true)
    setCreateError('')
    try {
      const placed = await createOrder({
        phone: details.phone,
        name: details.name,
        email: details.email,
        isWhatsapp: details.isWhatsapp,
        deliveryZone: details.deliveryZone || null,
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
      setOrder(placed)
      setSaveState(placed.saveState || 'saved')
      savePendingOrderRef(placed)
      clearBag()
      setStep(2)
    } catch (err) {
      setCreateError(err.message || 'Something went wrong placing your order. Please try again.')
    } finally {
      setCreatingOrder(false)
    }
  }

  // Called by PaymentStep once a receipt has been uploaded — the order
  // already exists (created above), this just carries the refreshed order
  // (now including the new receipt) into the Done step.
  const submitted = (updatedOrder) => {
    setOrder(updatedOrder)
    setStep(3)
  }

  const current = STEPS[step]
  const panelProps = (i) => ({
    ref: (el) => (panelRefs.current[i] = el),
    className: 'checkout-panel focus:outline-none',
    tabIndex: -1,
    'aria-labelledby': 'checkout-title',
    'aria-hidden': step !== i,
    inert: step !== i,
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
    >
      <div className={`checkout-scrim absolute inset-0 bg-black/55 ${closing ? 'is-closing' : ''}`} onClick={close} />

      <div
        ref={sheetRef}
        className={`checkout-sheet relative w-full sm:max-w-lg max-h-[94dvh] sm:max-h-[88dvh] flex flex-col bg-elevated text-ink rounded-t-2xl sm:rounded-xl border border-line shadow-[0_32px_80px_-24px_rgb(0_0_0/0.55)] overflow-hidden ${closing ? 'is-closing' : ''} ${dragging ? 'is-dragging' : ''}`}
      >
        <div
          className="checkout-grip sm:hidden shrink-0 pt-2.5 pb-1.5 flex justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="button"
          tabIndex={-1}
          aria-label="Drag down to close checkout"
        >
          <span className="w-9 h-1 bg-line rounded-full" aria-hidden="true" />
        </div>

        <header className="px-5 sm:px-8 pt-2 sm:pt-6 pb-4 shrink-0 flex items-start justify-between gap-4">
          <div>
            <h2 id="checkout-title" className="font-display text-2xl sm:text-3xl font-medium leading-tight text-ink">
              {current.title}
            </h2>
            <ol className="step-trail mt-2.5 flex items-center gap-2.5 text-[12px]" aria-label="Checkout steps">
              {STEPS.map((s, i) => (
                <li
                  key={s.key}
                  className={`${i === step ? 'is-current text-ink' : i < step ? 'text-ink-soft' : 'text-muted'} transition-colors duration-300`}
                  aria-current={i === step ? 'step' : undefined}
                >
                  {s.label}
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close checkout"
            className="p-2 -mr-2 -mt-1 rounded-full text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <CloseIcon />
          </button>
        </header>

        <div ref={bodyRef} className="checkout-body overflow-y-auto overflow-x-hidden min-h-0">
          {restoring ? (
            <div className="px-5 sm:px-8 py-16 flex justify-center">
              <p className="text-sm text-muted">Just a moment…</p>
            </div>
          ) : (
            <div className="checkout-track" style={{ transform: `translateX(-${step * 100}%)` }}>
              <section {...panelProps(0)}>
                <DetailsStep details={details} setDetails={setDetails} onContinue={() => setStep(1)} />
              </section>
              <section {...panelProps(1)}>
                <SummaryStep
                  items={lineItems}
                  subtotal={productSubtotal}
                  deliveryFee={deliveryFee}
                  deliveryLabel={deliveryLabel}
                  total={grandTotal}
                  details={details}
                  onBack={() => setStep(0)}
                  onEditDetails={() => setStep(0)}
                  onContinue={goToPayment}
                  submitting={creatingOrder}
                  submitError={createError}
                />
              </section>
              <section {...panelProps(2)}>
                <PaymentStep
                  order={order}
                  total={grandTotal}
                  active={step === 2}
                  onBack={() => setStep(1)}
                  onSubmitted={submitted}
                />
              </section>
              <section {...panelProps(3)}>
                <DoneStep
                  order={order}
                  saveState={saveState}
                  active={step === 3}
                  onDone={close}
                />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
