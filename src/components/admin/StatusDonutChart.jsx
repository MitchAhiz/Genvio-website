import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SkeletonBlock } from './Skeleton'

const STATUS_LABEL = {
  pending_payment: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
}

// Neutral slate/zinc shades only — no section-specific colours in admin UI.
const COLORS = ['#0f172a', '#475569', '#94a3b8', '#cbd5e1', '#e2e8f0']

function StatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{STATUS_LABEL[point.status] || point.status}</p>
      <p className="mt-1 text-slate-600">{point.count} order{point.count === 1 ? '' : 's'}</p>
      <p className="text-slate-500">{point.percent}% of total</p>
    </div>
  )
}

export default function StatusDonutChart({ statuses, loading }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Order status breakdown</h3>

      <div className="mt-4 h-64">
        {loading ? (
          <SkeletonBlock className="h-full w-full" />
        ) : statuses.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No orders yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statuses} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {statuses.map((entry, i) => (
                  <Cell key={entry.status} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<StatusTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {!loading && statuses.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {statuses.map((s, i) => (
            <li key={s.status} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {STATUS_LABEL[s.status] || s.status} ({s.count})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
