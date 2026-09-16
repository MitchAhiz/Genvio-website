import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNaira } from '../../utils/currency'
import { SkeletonBlock } from './Skeleton'

const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

const SECTION_LABEL = { men: 'Men', women: 'Women', kids: 'Kids' }

function SectionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{point.label}</p>
      <p className="mt-1 text-slate-600">{point.orderCount} order{point.orderCount === 1 ? '' : 's'}</p>
      <p className="text-slate-500">₦{formatNaira(point.revenue)} revenue</p>
    </div>
  )
}

export default function SectionBarChart({ sections, period, onPeriodChange, loading }) {
  const data = sections.map((s) => ({ ...s, label: SECTION_LABEL[s.section] || s.section }))
  const hasData = data.some((s) => s.orderCount > 0)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Orders by section</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPeriodChange(p.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                period === p.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64">
        {loading ? (
          <SkeletonBlock className="h-full w-full" />
        ) : !hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No orders yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
              <Tooltip content={<SectionTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="orderCount" fill="#475569" radius={[4, 4, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
