import { useEffect, useState } from 'react'
import {
  getAdminProducts,
  getBestSellers,
  getOrdersBySection,
  getRevenueAnalytics,
  getStatusBreakdown,
} from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { CardSkeleton, RowSkeleton } from '../../components/admin/Skeleton'
import { NairaAmount } from '../../utils/currency'
import RevenueChart from '../../components/admin/RevenueChart'
import SectionBarChart from '../../components/admin/SectionBarChart'
import StatusDonutChart from '../../components/admin/StatusDonutChart'
import ProductModal from '../../components/admin/ProductModal'

const SECTION_LABEL = { men: 'Men', women: 'Women', kids: 'Kids' }

function ChangeIndicator({ percent }) {
  if (percent === 0) return <span className="text-xs text-slate-400">No change</span>
  const positive = percent > 0
  return (
    <span className={`text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
      {positive ? '▲' : '▼'} {Math.abs(percent)}% vs last month
    </span>
  )
}

function RevenueCards({ revenue, loading }) {
  if (loading || !revenue) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} className="h-20" />)}
      </div>
    )
  }

  const cards = [
    { label: 'Total revenue', value: revenue.totalRevenue },
    { label: 'This month', value: revenue.thisMonthRevenue, change: revenue.thisMonthChangePercent },
    { label: 'This week', value: revenue.thisWeekRevenue },
    { label: 'Pending', value: revenue.pendingRevenue },
    { label: 'Confirmed', value: revenue.confirmedRevenue },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900"><NairaAmount value={c.value} /></p>
          {c.change !== undefined && <div className="mt-1"><ChangeIndicator percent={c.change} /></div>}
        </div>
      ))}
    </div>
  )
}

function BestSellersTable({ products, loading, sort, onSortChange, onRowClick }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Best sellers</h3>
        <div className="flex gap-1">
          {[{ value: 'units', label: 'Units' }, { value: 'revenue', label: 'Revenue' }].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSortChange(opt.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                sort === opt.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Mobile: stacked cards instead of a horizontally-scrolled table */}
      <div className="space-y-2 p-3 md:hidden">
        {loading && Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} className="h-14" />)}
        {!loading && products.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-slate-400">No sales data yet.</p>
        )}
        {!loading && products.map((p, i) => (
          <button
            key={p.productId || p.name}
            type="button"
            disabled={!p.productId}
            onClick={() => p.productId && onRowClick(p.productId)}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left disabled:opacity-80"
          >
            <span className="text-sm font-medium text-slate-400">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-slate-700">{p.name}</span>
              <span className="block text-xs text-slate-400">{SECTION_LABEL[p.section] || '—'} · {p.unitsSold} sold</span>
            </span>
            <NairaAmount value={p.revenue} className="shrink-0 text-sm font-medium text-slate-900" />
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2">Rank</th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Section</th>
              <th className="px-4 py-2">Units sold</th>
              <th className="px-4 py-2">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} columns={5} />)}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No sales data yet.</td>
              </tr>
            )}
            {!loading && products.map((p, i) => (
              <tr
                key={p.productId || p.name}
                onClick={() => p.productId && onRowClick(p.productId)}
                className={p.productId ? 'cursor-pointer hover:bg-slate-50' : ''}
              >
                <td className="px-4 py-2 align-top font-medium text-slate-900">{i + 1}</td>
                <td className="px-4 py-2 align-top text-slate-700">{p.name}</td>
                <td className="px-4 py-2 align-top text-slate-500">{SECTION_LABEL[p.section] || '—'}</td>
                <td className="px-4 py-2 align-top tabular-nums text-slate-700">{p.unitsSold}</td>
                <td className="px-4 py-2 align-top"><NairaAmount value={p.revenue} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminAnalytics() {
  const { show } = useToast()

  const [revenue, setRevenue] = useState(null)
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [revenuePeriod, setRevenuePeriod] = useState('30d')

  const [sections, setSections] = useState([])
  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [sectionPeriod, setSectionPeriod] = useState('month')

  const [statuses, setStatuses] = useState([])
  const [statusesLoading, setStatusesLoading] = useState(true)

  const [bestSellers, setBestSellers] = useState([])
  const [bestSellersLoading, setBestSellersLoading] = useState(true)
  const [sort, setSort] = useState('units')

  const [editingProduct, setEditingProduct] = useState(null)

  useEffect(() => {
    setRevenueLoading(true)
    getRevenueAnalytics(revenuePeriod)
      .then(setRevenue)
      .catch((err) => show(err.message || 'Failed to load revenue analytics', 'error'))
      .finally(() => setRevenueLoading(false))
  }, [revenuePeriod, show])

  useEffect(() => {
    setSectionsLoading(true)
    getOrdersBySection(sectionPeriod)
      .then((data) => setSections(data.sections))
      .catch((err) => show(err.message || 'Failed to load section analytics', 'error'))
      .finally(() => setSectionsLoading(false))
  }, [sectionPeriod, show])

  useEffect(() => {
    setStatusesLoading(true)
    getStatusBreakdown()
      .then((data) => setStatuses(data.statuses))
      .catch((err) => show(err.message || 'Failed to load status breakdown', 'error'))
      .finally(() => setStatusesLoading(false))
  }, [show])

  useEffect(() => {
    setBestSellersLoading(true)
    getBestSellers(sort, 10)
      .then((data) => setBestSellers(data.products))
      .catch((err) => show(err.message || 'Failed to load best sellers', 'error'))
      .finally(() => setBestSellersLoading(false))
  }, [sort, show])

  const openProduct = async (productId) => {
    try {
      const products = await getAdminProducts()
      const found = products.find((p) => p.id === productId)
      if (!found) {
        show('Product not found — it may have been deleted', 'error')
        return
      }
      setEditingProduct(found)
    } catch (err) {
      show(err.message || 'Failed to load product', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <RevenueCards revenue={revenue} loading={revenueLoading} />

      <RevenueChart
        series={revenue?.series || []}
        period={revenuePeriod}
        onPeriodChange={setRevenuePeriod}
        loading={revenueLoading}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionBarChart
          sections={sections}
          period={sectionPeriod}
          onPeriodChange={setSectionPeriod}
          loading={sectionsLoading}
        />
        <StatusDonutChart statuses={statuses} loading={statusesLoading} />
      </div>

      <BestSellersTable
        products={bestSellers}
        loading={bestSellersLoading}
        sort={sort}
        onSortChange={setSort}
        onRowClick={openProduct}
      />

      <ProductModal
        open={editingProduct != null}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSaved={setEditingProduct}
      />
    </div>
  )
}
