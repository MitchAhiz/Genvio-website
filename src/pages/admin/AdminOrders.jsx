import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getOrders, updateOrderStatus } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { CardSkeleton, RowSkeleton } from '../../components/admin/Skeleton'
import { NairaAmount } from '../../utils/currency'
import OrderDetailDrawer from '../../components/admin/OrderDetailDrawer'

// pending_verification/rejected/expired are set by the receipt confirm/
// reject flow and the reservation-expiry sweep, not by hand here — but they
// still need to be listed so the filter can find them and the badge/select
// for a row in one of these statuses doesn't render blank.
const STATUSES = [
  'pending_payment',
  'pending_verification',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'rejected',
  'expired',
]
const STATUS_LABEL = {
  pending_payment: 'Pending',
  pending_verification: 'Paid',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  rejected: 'Rejected',
  expired: 'Expired',
}
const STATUS_BADGE = {
  pending_payment: 'bg-amber-100 text-amber-700',
  pending_verification: 'bg-sky-100 text-sky-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  expired: 'bg-slate-100 text-slate-500',
}
// What the row status <select> may actually be set to by hand — matches the
// backend's ORDER_STATUSES exactly. pending_verification/rejected/expired
// are reached only through the receipt confirm/reject actions and the
// expiry sweep, never picked from this dropdown.
const EDITABLE_STATUSES = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered']

// The manually-settable statuses, plus — only when the row isn't already in
// one of them — a disabled option for its actual current status, so the
// <select> always has a matching value instead of rendering blank/mismatched
// for a pending_verification/rejected/expired order.
function StatusOptions({ currentStatus }) {
  return (
    <>
      {!EDITABLE_STATUSES.includes(currentStatus) && (
        <option value={currentStatus} disabled>
          {STATUS_LABEL[currentStatus] || currentStatus}
        </option>
      )}
      {EDITABLE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </>
  )
}

// Client-side only — no server-side masking exists for admin order phone
// numbers. Flagged per Task 08: preferable server-side, but that's a
// backend change outside this task's frontend-only scope.
function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 7) return phone
  return `${digits.slice(0, 4)}•••${digits.slice(-4)}`
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function SummaryCards({ orders, loading }) {
  const stats = useMemo(() => {
    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    let today = 0, week = 0, month = 0, pending = 0, confirmed = 0
    for (const o of orders) {
      const created = new Date(o.createdAt)
      if (created >= todayStart) today++
      if (created >= weekStart) week++
      if (created >= monthStart) month++
      if (o.status === 'pending_payment') pending++
      if (o.status === 'confirmed') confirmed++
    }
    return { today, week, month, pending, confirmed }
  }, [orders])

  const cards = [
    { label: 'Today', value: stats.today },
    { label: 'This week', value: stats.week },
    { label: 'This month', value: stats.month },
    { label: 'Pending', value: stats.pending },
    { label: 'Confirmed', value: stats.confirmed },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} className="h-20" />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

// Card layout for the same row data — used below `md` where the table
// would otherwise force horizontal scrolling with no visual affordance.
function OrderCard({ order, onChangeStatus, onView }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{order.reference}</p>
          <p className="text-xs text-slate-400">{formatDateTime(order.createdAt)}</p>
        </div>
        <NairaAmount value={order.total} className="font-medium text-slate-900" />
      </div>
      <p className="mt-1.5 text-sm text-slate-500">{maskPhone(order.customer.phone)}</p>
      <p className="text-sm text-slate-500">
        {order.items.length} item{order.items.length === 1 ? '' : 's'} — {order.items[0]?.name}
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
        <select
          value={order.status}
          onChange={(e) => onChangeStatus(e.target.value)}
          className={`flex-1 rounded-md border-0 px-2.5 py-2 text-sm font-medium ${STATUS_BADGE[order.status] || 'bg-slate-100 text-slate-600'}`}
        >
          <StatusOptions currentStatus={order.status} />
        </select>
        <button type="button" onClick={onView} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          View
        </button>
      </div>
    </div>
  )
}

export default function AdminOrders() {
  const { show } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const load = async () => {
    setLoading(true)
    try {
      const data = await getOrders()
      setOrders(data)
      return data
    } catch (err) {
      show(err.message || 'Failed to load orders', 'error')
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep link from the "Open this order in the admin" email (see
  // frontendOrderLink in server/src/services/mailer.js) — open that order's
  // drawer once the list has loaded, then drop the param so a refresh/close
  // doesn't keep re-opening it.
  useEffect(() => {
    const orderId = searchParams.get('order')
    if (!orderId || orders.length === 0) return
    const match = orders.find((o) => o.id === orderId)
    if (match) setSelectedOrder(match)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('order')
      return next
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders])

  const filtered = useMemo(() => {
    let list = orders
    if (status !== 'all') list = list.filter((o) => o.status === status)
    if (dateFrom) {
      const from = startOfDay(dateFrom)
      list = list.filter((o) => new Date(o.createdAt) >= from)
    }
    if (dateTo) {
      const to = startOfDay(dateTo)
      to.setDate(to.getDate() + 1)
      list = list.filter((o) => new Date(o.createdAt) < to)
    }
    const q = debouncedSearch.trim().toLowerCase()
    if (q) {
      // Matches the raw phone number even though it's displayed masked.
      const qDigits = q.replace(/\D/g, '')
      list = list.filter((o) =>
        o.reference.toLowerCase().includes(q) ||
        (qDigits.length > 0 && o.customer.phone.replace(/\D/g, '').includes(qDigits))
      )
    }
    return list
  }, [orders, status, dateFrom, dateTo, debouncedSearch])

  // Confirm/reject responses (adminOrderWithReceipts in receipts.js) carry a
  // smaller shape than the canonical adminOrder() used by GET /api/orders
  // (no paymentMethod/notes/updatedAt, customer trimmed to name+phone) — so
  // rather than merge that partial shape into local state, just refetch the
  // full list and reselect by id to stay on the canonical shape everywhere.
  const handleStatusChanged = async (orderId) => {
    const data = await load()
    if (data) {
      const match = data.find((o) => o.id === orderId)
      if (match) setSelectedOrder(match)
    }
  }

  const changeStatus = async (order, newStatus) => {
    if (newStatus === order.status) return
    try {
      const updated = await updateOrderStatus(order.id, newStatus)
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
      show('Order status updated', 'success')
      setSelectedOrder((cur) => (cur && cur.id === order.id ? updated : cur))
    } catch (err) {
      show(err.message || 'Failed to update status', 'error')
    }
  }

  return (
    <div>
      <SummaryCards orders={orders} loading={loading} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
          aria-label="From date"
        />
        <span className="text-sm text-slate-400">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
          aria-label="To date"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by reference or phone…"
          className="ml-auto w-full max-w-xs rounded-md border border-slate-200 px-3 py-1.5 text-sm md:w-64"
        />
      </div>

      {/* Mobile: stacked cards instead of a horizontally-scrolled table */}
      <div className="mt-4 space-y-3 md:hidden">
        {loading && Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} className="h-32" />)}
        {!loading && filtered.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No orders found.
          </div>
        )}
        {!loading && filtered.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            onChangeStatus={(status) => changeStatus(o, status)}
            onView={() => setSelectedOrder(o)}
          />
        ))}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} columns={7} />)}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  No orders found.
                </td>
              </tr>
            )}
            {!loading && filtered.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2 align-top font-medium text-slate-900">{o.reference}</td>
                <td className="px-3 py-2 align-top text-slate-500">{formatDateTime(o.createdAt)}</td>
                <td className="px-3 py-2 align-top text-slate-500">{maskPhone(o.customer.phone)}</td>
                <td className="px-3 py-2 align-top text-slate-500">
                  {o.items.length} item{o.items.length === 1 ? '' : 's'} — {o.items[0]?.name}
                </td>
                <td className="px-3 py-2 align-top"><NairaAmount value={o.total} /></td>
                <td className="px-3 py-2 align-top">
                  <select
                    value={o.status}
                    onChange={(e) => changeStatus(o, e.target.value)}
                    className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[o.status] || 'bg-slate-100 text-slate-600'}`}
                  >
                    <StatusOptions currentStatus={o.status} />
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  <button type="button" onClick={() => setSelectedOrder(o)} className="text-xs font-medium text-slate-600 hover:underline">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OrderDetailDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onStatusChanged={handleStatusChanged}
        onDeliveryUpdated={(updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
          setSelectedOrder(updated)
        }}
        onNotesSaved={(updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
          setSelectedOrder(updated)
        }}
      />
    </div>
  )
}
