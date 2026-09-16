import { useState } from 'react'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/admin/ConfirmDialog'

// Toast trigger buttons below are a temporary smoke test for the shell
// (TASK-06) — the real Products tab lands in TASK-07 and replaces this file.
const DEMO_TOASTS = [
  { type: 'success', label: 'Success', message: 'Product saved' },
  { type: 'error', label: 'Error', message: 'Failed to save product' },
  { type: 'warning', label: 'Warning', message: '2 sizes are low on stock' },
  { type: 'info', label: 'Info', message: 'Draft changes are not published yet' },
]

export default function AdminProducts() {
  const { show } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="font-display text-lg font-semibold text-slate-900">Products</h2>
      <p className="mt-1.5 text-sm text-slate-500">Products tab — coming soon.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {DEMO_TOASTS.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => show(t.message, t.type)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Test {t.label} Toast
          </button>
        ))}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Test Confirm Dialog
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this product?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { setConfirmOpen(false); show('Product deleted', 'success') }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
