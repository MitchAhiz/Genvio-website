import { useEffect, useRef, useState } from 'react'
import { updateOrderNotes } from '../../api/admin'
import { updateOrderDeliveryAdmin } from '../../api/adminOrders'
import { useToast } from '../../hooks/useToast'
import { NairaAmount } from '../../utils/currency'
import { NIGERIAN_STATES } from '../../data/nigerianStates'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

const STATUS_LABEL = {
  pending_payment: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
}

const PAYMENT_LABEL = {
  bank_transfer: 'Bank transfer',
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function OrderDetailDrawer({ order, onClose, onNotesSaved, onDeliveryUpdated }) {
  const { show } = useToast()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState(false)
  const [draft, setDraft] = useState({ name: '', street: '', city: '', state: '' })
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [deliveryError, setDeliveryError] = useState('')
  const drawerRef = useRef(null)
  const previouslyFocused = useRef(null)
  const open = !!order

  useEffect(() => {
    if (!order) return
    setNotes(order.notes || '')
  }, [order])

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const node = drawerRef.current
      if (!node) return
      const focusable = Array.from(node.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null)
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
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const saveNotes = async () => {
    setSaving(true)
    try {
      const updated = await updateOrderNotes(order.id, notes)
      show('Notes saved', 'success')
      onNotesSaved?.(updated)
    } catch (err) {
      show(err.message || 'Failed to save notes', 'error')
    } finally {
      setSaving(false)
    }
  }

  const startDeliveryEdit = () => {
    const address = (order.address && typeof order.address === 'object') ? order.address : {}
    setDraft({
      name: address.recipientName || order.customer.name,
      street: address.street || '',
      city: address.city || '',
      state: address.state || '',
    })
    setDeliveryError('')
    setEditingDelivery(true)
  }

  const saveDelivery = async () => {
    const name = draft.name.trim()
    const street = draft.street.trim()
    const city = draft.city.trim()
    const state = draft.state
    if (name.length < 2) {
      setDeliveryError('Enter the recipient’s full name')
      return
    }
    if (street.length < 3 || city.length < 2 || !state) {
      setDeliveryError('Enter a street address, city and state')
      return
    }
    setSavingDelivery(true)
    setDeliveryError('')
    try {
      const updated = await updateOrderDeliveryAdmin(order.id, { name, address: { street, city, state } })
      show('Delivery details updated', 'success')
      onDeliveryUpdated?.(updated)
      setEditingDelivery(false)
    } catch (err) {
      // The backend message (e.g. validation) is what the admin needs to see.
      setDeliveryError(err.message || 'Failed to save delivery details')
    } finally {
      setSavingDelivery(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex justify-end bg-slate-900/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.reference}`}
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">{order.reference}</h2>
            <p className="text-xs text-slate-400">{formatDateTime(order.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>

        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Items</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                {item.image ? (
                  <img src={item.image} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-slate-100" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {[item.colour, item.size].filter(Boolean).join(' · ')} {item.colour || item.size ? '·' : ''} Qty {item.qty}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <NairaAmount value={item.qty * item.unitPrice} className="font-medium text-slate-900" />
                  <p className="text-xs text-slate-400"><NairaAmount value={item.unitPrice} /> each</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2 text-sm font-semibold text-slate-900">
            Total&nbsp;<NairaAmount value={order.total} />
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Delivery details</h3>
            {!editingDelivery && (
              <button
                type="button"
                onClick={startDeliveryEdit}
                className="shrink-0 text-xs font-medium text-slate-600 hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          {editingDelivery ? (
            <div className="mt-2 space-y-3">
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Recipient name"
                aria-label="Recipient name"
                className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm"
              />
              <input
                value={draft.street}
                onChange={(e) => setDraft((d) => ({ ...d, street: e.target.value }))}
                placeholder="Street address"
                aria-label="Street address"
                className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={draft.city}
                  onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                  placeholder="City"
                  aria-label="City"
                  className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm"
                />
                <select
                  value={draft.state}
                  onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                  aria-label="State"
                  className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm"
                >
                  <option value="">State…</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {deliveryError && (
                <p className="text-xs text-red-600" role="alert">{deliveryError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setDeliveryError(''); setEditingDelivery(false) }}
                  disabled={savingDelivery}
                  className="rounded-md border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDelivery}
                  disabled={savingDelivery}
                  className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {savingDelivery ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p className="font-medium">{order.address?.recipientName || order.customer.name}</p>
              <p className="text-slate-500">{order.customer.phone}</p>
              <p className="text-slate-500">
                {order.address.street}, {order.address.city}, {order.address.state}
              </p>
            </div>
          )}
        </section>

        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</h3>
          <p className="mt-2 text-sm text-slate-700">{PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod}</p>
        </section>

        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</h3>
          {/* No status-history table exists yet — only current status + last-updated timestamp are available. */}
          <p className="mt-2 text-sm text-slate-700">
            {STATUS_LABEL[order.status] || order.status} <span className="text-slate-400">— updated {formatDateTime(order.updatedAt)}</span>
          </p>
        </section>

        <section className="mt-5 flex flex-1 flex-col">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Internal notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Admin-only notes about this order…"
            className="mt-2 w-full flex-1 resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm"
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={saving}
            className="mt-2 self-end rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        </section>
      </div>
    </div>
  )
}
