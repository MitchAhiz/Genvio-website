import { useEffect, useMemo, useState } from 'react'
import { getOrders, updateOrderStatus } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { RowSkeleton, CardSkeleton } from '../../components/admin/Skeleton'
import { NairaAmount } from '../../utils/currency'
import OrderDetailDrawer from '../../components/admin/OrderDetailDrawer'

const STATUSES = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered']
const STATUS_LABEL = {
  pending_payment: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
}
const STATUS_BADGE = {
  pending_payment: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
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

  const load = async () => {
    setLoading(true)
    try {
      const data = await getOrders()
      setOrders(data)
    } catch (err) {
      show(err.message || 'Failed to load orders', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
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
        onNotesSaved={(updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
          setSelectedOrder(updated)
        }}
      />
    </div>
  )
}
