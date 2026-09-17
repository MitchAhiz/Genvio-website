import { useEffect, useState } from 'react'
import { getActivityLog } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { RowSkeleton } from './Skeleton'

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

// Turns { action, entityType, detail } into a readable sentence instead of
// dumping raw JSON. Matches the exact action strings emitted by logActivity()
// call sites across server/src (categoryService, wholesale, products, orders,
// config) — not the illustrative names in HANDOFF.md's spec section, which
// differ from what got built. Falls back to the raw action string for
// anything not explicitly handled here — new action types keep working,
// just less pretty.
function describeActivity(entry) {
  const { action, detail } = entry
  const d = detail || {}

  if (action.startsWith('product.bulk_')) {
    const verb = action.slice('product.bulk_'.length)
    const count = Array.isArray(d.ids) ? d.ids.length : 0
    const verbLabel = { publish: 'Published', unpublish: 'Unpublished', delete: 'Deleted' }[verb] || verb
    return `${verbLabel} ${count} product${count === 1 ? '' : 's'} (bulk action)`
  }

  switch (action) {
    case 'category.created':
      return `Category created: ${d.name || ''}${d.section ? ` (${d.section})` : ''}`
    case 'category.renamed':
      return `Category renamed: ${d.from || '?'} → ${d.to || '?'}`
    case 'category.deleted':
      return `Category deleted${d.action ? ` (${d.action})` : ''}${
        typeof d.affectedProductCount === 'number' ? `, ${d.affectedProductCount} product(s) affected` : ''
      }`
    case 'wholesale_image.created':
      return `Wholesale image added${d.category ? ` (${d.category})` : ''}`
    case 'wholesale_image.updated':
      return 'Wholesale image updated'
    case 'wholesale_image.deleted':
      return `Wholesale image deleted${d.category ? ` (${d.category})` : ''}`
    case 'wholesale_image.reordered':
      return `Wholesale images reordered${typeof d.count === 'number' ? ` (${d.count} images)` : ''}`
    case 'wholesale_category.renamed':
      return `Wholesale category renamed: ${d.from || '?'} → ${d.to || '?'}`
    case 'wholesale_category.deleted':
      return `Wholesale category deleted: ${d.name || ''}${d.action ? ` (${d.action})` : ''}${
        typeof d.affectedCount === 'number' ? `, ${d.affectedCount} image(s) affected` : ''
      }`
    case 'order.notes_updated':
      return `Order notes updated (${d.notesLength ?? 0} characters)`
    case 'config.updated':
      return `Settings updated: ${Array.isArray(d.keys) ? d.keys.join(', ') : 'config'}`
    default:
      return action || 'Unknown action'
  }
}

const PAGE_SIZE = 20

export default function ActivityLogPanel() {
  const { show } = useToast()
  const [entries, setEntries] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getActivityLog(page, debouncedSearch)
      .then((data) => {
        if (cancelled) return
        setEntries(data.items || [])
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.totalCount || 0)
      })
      .catch((err) => {
        if (!cancelled) show(err.message || 'Failed to load activity log', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch])

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-slate-900">Activity Log</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activity…"
          className="w-full max-w-xs rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="mt-3 divide-y divide-slate-100 overflow-x-auto">
        {loading && (
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} columns={2} />)}
            </tbody>
          </table>
        )}
        {!loading && entries.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No activity found.</p>
        )}
        {!loading && entries.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <p className="text-slate-700">{describeActivity(entry)}</p>
            <p className="shrink-0 whitespace-nowrap text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
          </div>
        ))}
      </div>

      {!loading && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages} — {totalCount} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
