import { useEffect, useRef, useState } from 'react'
import {
  updateOrderNotes,
  getOrderReceipts,
  getReceiptSignedUrl,
  confirmOrder as confirmOrderApi,
  rejectOrder as rejectOrderApi,
} from '../../api/admin'
import { updateOrderDeliveryAdmin } from '../../api/adminOrders'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { NairaAmount } from '../../utils/currency'
import { NIGERIAN_STATES } from '../../data/nigerianStates'

// Matches the backend's own guards in server/src/services/receipts.js so the
// UI never offers an action the backend would 409 on.
const CONFIRMABLE_STATUSES = ['pending_verification', 'rejected', 'expired']
const REJECTABLE_STATUSES = ['pending_verification']

// wa.me/tel:/sms: all want a bare international number, no leading zero.
// Phones are stored normalized as 0XXXXXXXXXX (see server/src/utils/sanitize.js).
function toInternationalPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('0')) return '234' + digits.slice(1)
  return digits
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

const STATUS_LABEL = {
  pending_payment: 'Pending',
  pending_verification: 'Paid',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  expired: 'Expired',
}

const PAYMENT_LABEL = {
  bank_transfer: 'Bank transfer',
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function OrderDetailDrawer({ order, onClose, onNotesSaved, onDeliveryUpdated, onStatusChanged }) {
  const { show } = useToast()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState(false)
  const [draft, setDraft] = useState({ name: '', street: '', city: '', state: '' })
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [deliveryError, setDeliveryError] = useState('')
  const [receipts, setReceipts] = useState([])
  const [stockWarnings, setStockWarnings] = useState([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [viewer, setViewer] = useState(null) // { url, fileType } while an image receipt is open
  const [viewingReceiptId, setViewingReceiptId] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const drawerRef = useRef(null)
  const previouslyFocused = useRef(null)
  const open = !!order

  useEffect(() => {
    if (!order) return
    setNotes(order.notes || '')
    setShowRejectInput(false)
    setRejectReason('')
    setShowConfirmDialog(false)
    setViewer(null)
  }, [order])

  useEffect(() => {
    if (!order) return
    let cancelled = false
    setReceiptsLoading(true)
    getOrderReceipts(order.id)
      .then((data) => {
        if (cancelled) return
        setReceipts(data.receipts || [])
        setStockWarnings(data.stockWarnings || [])
      })
      .catch((err) => {
        if (!cancelled) show(err.message || 'Failed to load receipts', 'error')
      })
      .finally(() => {
        if (!cancelled) setReceiptsLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

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

  const refetchReceipts = async () => {
    try {
      const data = await getOrderReceipts(order.id)
      setReceipts(data.receipts || [])
      setStockWarnings(data.stockWarnings || [])
    } catch {
      // Non-fatal — the confirm/reject action itself already succeeded and
      // updated the order; a stale receipts list just means a manual reopen
      // is needed to see reviewedBy/reviewedAt, not a broken action.
    }
  }

  const viewReceipt = async (receipt) => {
    setViewingReceiptId(receipt.id)
    try {
      const { url } = await getReceiptSignedUrl(receipt.id)
      if (receipt.fileType?.startsWith('image/')) {
        setViewer({ url, fileType: receipt.fileType })
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      show(err.message || 'Failed to open receipt', 'error')
    } finally {
      setViewingReceiptId(null)
    }
  }

  const handleConfirm = async () => {
    setShowConfirmDialog(false)
    setConfirming(true)
    try {
      await confirmOrderApi(order.id)
      show('Order confirmed', 'success')
      onStatusChanged?.(order.id)
      refetchReceipts()
    } catch (err) {
      show(err.message || 'Failed to confirm order', 'error')
    } finally {
      setConfirming(false)
    }
  }

  const handleReject = async () => {
    const reason = rejectReason.trim()
    if (!reason) {
      show('Enter a reason for rejecting this order', 'error')
      return
    }
    setRejecting(true)
    try {
      await rejectOrderApi(order.id, reason)
      show('Order rejected', 'success')
      onStatusChanged?.(order.id)
      setShowRejectInput(false)
      setRejectReason('')
      refetchReceipts()
    } catch (err) {
      show(err.message || 'Failed to reject order', 'error')
    } finally {
      setRejecting(false)
    }
  }

  const phone = order.customer?.phone
  const intlPhone = toInternationalPhone(phone)
  const whatsappHref = phone
    ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(`Hi ${order.customer.name}, this is Genvio Exotic Apparel regarding your order ${order.reference}.`)}`
    : null

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
          {phone && (
            <div className="mt-3 flex flex-wrap gap-2">
              {order.customer.isWhatsapp && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  WhatsApp
                </a>
              )}
              <a
                href={`tel:+${intlPhone}`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Call
              </a>
              <a
                href={`sms:+${intlPhone}`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                SMS
              </a>
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

        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Receipts</h3>

          {receiptsLoading && (
            <p className="mt-2 text-sm text-slate-400">Loading receipts…</p>
          )}

          {!receiptsLoading && receipts.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">No receipts uploaded for this order yet.</p>
          )}

          {!receiptsLoading && receipts.length > 0 && (
            <ul className="mt-2 space-y-2">
              {receipts.map((r) => (
                <li key={r.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{r.originalFilename}</p>
                      <p className="text-xs text-slate-400">
                        {formatFileSize(r.fileSize)} · uploaded {formatDateTime(r.uploadedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => viewReceipt(r)}
                      disabled={viewingReceiptId === r.id}
                      className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {viewingReceiptId === r.id ? 'Opening…' : 'View'}
                    </button>
                  </div>

                  {r.isDuplicate && (
                    <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800" role="alert">
                      ⚠ This exact file was already uploaded to a different order — check it isn't being reused.
                    </p>
                  )}

                  {r.reviewedBy && (
                    <p className="mt-2 text-xs text-slate-500">
                      Reviewed by {r.reviewedBy} — {formatDateTime(r.reviewedAt)}
                      {r.rejectionReason ? <>: <span className="text-slate-600">“{r.rejectionReason}”</span></> : null}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {stockWarnings.length > 0 && (
            <div className="mt-3 rounded-md bg-rose-50 px-2.5 py-2 text-xs text-rose-700">
              <p className="font-medium">Stock check</p>
              <ul className="mt-1 list-disc pl-4">
                {stockWarnings.map((w, i) => (
                  <li key={i}>
                    {w.name} ({[w.colour, w.size].filter(Boolean).join(' / ')}) —{' '}
                    {w.reason === 'no_longer_exists' ? 'no longer exists' : `only ${w.available} left, ${w.qty} needed`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {viewer && (
            <div
              className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/80 p-4"
              onMouseDown={(e) => { if (e.target === e.currentTarget) setViewer(null) }}
            >
              <div className="relative max-h-full max-w-full">
                <img src={viewer.url} alt="Receipt" className="max-h-[85vh] max-w-full rounded-md object-contain" />
                <button
                  type="button"
                  onClick={() => setViewer(null)}
                  aria-label="Close receipt viewer"
                  className="absolute -top-3 -right-3 rounded-full bg-white p-1.5 text-slate-600 shadow"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {(CONFIRMABLE_STATUSES.includes(order.status) || REJECTABLE_STATUSES.includes(order.status)) && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">
                Only confirm after checking the credit has actually landed in your bank account. Receipts can be faked.
              </p>

              {showRejectInput ? (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for rejecting this order (shown to the customer)…"
                    className="w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                      disabled={rejecting}
                      className="rounded-md border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={rejecting || !rejectReason.trim()}
                      className="rounded-md bg-rose-600 px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {rejecting ? 'Rejecting…' : 'Confirm rejection'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  {REJECTABLE_STATUSES.includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => setShowRejectInput(true)}
                      className="rounded-md border border-rose-200 px-3.5 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Reject
                    </button>
                  )}
                  {CONFIRMABLE_STATUSES.includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={confirming}
                      className="rounded-md bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {confirming ? 'Confirming…' : 'Confirm payment'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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

      <ConfirmDialog
        open={showConfirmDialog}
        title="Confirm this order?"
        message="Only confirm after checking the credit has actually landed in your bank account. Receipts can be faked."
        confirmLabel="Confirm payment"
        danger={false}
        onConfirm={handleConfirm}
        onClose={() => setShowConfirmDialog(false)}
      />
    </div>
  )
}
