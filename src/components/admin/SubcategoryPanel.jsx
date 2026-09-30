import { useEffect, useState } from 'react'
import {
  createSubcategory,
  deleteSubcategory,
  getSizeRange,
  getSubcategories,
  getSubcategoryProductCount,
  updateSubcategory,
} from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from './ConfirmDialog'

// Same reassign-or-unpublish delete choice as CategoryDrawer's DeleteChoice,
// scoped to subcategories within one category instead of a section.
function DeleteChoice({ subcategory, siblings, count, onCancel, onReassign, onUnpublish }) {
  const [reassignTo, setReassignTo] = useState('')
  const otherOptions = siblings.filter((s) => s.id !== subcategory.id)

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Delete "{subcategory.name}"?</h3>
        <p className="mt-1.5 text-sm text-slate-500">
          {count} product{count === 1 ? '' : 's'} use this subcategory. Choose what happens to them.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Reassign to</label>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              disabled={otherOptions.length === 0}
              className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {otherOptions.length === 0 ? 'No other subcategory in this category' : 'Select a subcategory…'}
              </option>
              {otherOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!reassignTo}
              onClick={() => onReassign(reassignTo)}
              className="mt-2 w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Reassign products &amp; delete
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onUnpublish}
              className="w-full rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Unpublish affected products &amp; delete
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// Reachable by drilling into a category from CategoryDrawer (not a separate
// nav item) — subcategories only make sense scoped to one category, so the
// drawer's existing "pick a category, act on it" shell is the natural home
// rather than a whole new top-level screen.
export default function SubcategoryPanel({ category, onBack, onOpenSizeRange }) {
  const { show } = useToast()
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null) // { subcategory, count, hasSizeRange }

  const load = async () => {
    setLoading(true)
    try {
      const data = await getSubcategories(category.id)
      setSubcategories(data)
    } catch {
      show('Failed to load subcategories', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id])

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      await createSubcategory(category.id, name)
      setNewName('')
      show('Subcategory added', 'success')
      load()
    } catch (err) {
      // The API returns a clean 409 for a duplicate name in this category
      // ("A subcategory with this name already exists in this category") —
      // ApiError.message carries that straight through, no raw error shown.
      show(err.message || 'Failed to add subcategory', 'error')
    }
  }

  const startRename = (s) => {
    setRenamingId(s.id)
    setRenameValue(s.name)
  }

  const commitRename = async (id) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name) return
    try {
      await updateSubcategory(id, name)
      show('Subcategory renamed', 'success')
      load()
    } catch (err) {
      show(err.message || 'Failed to rename subcategory', 'error')
    }
  }

  const requestDelete = async (s) => {
    try {
      const [{ count }, sizeRange] = await Promise.all([
        getSubcategoryProductCount(s.id),
        getSizeRange(category.id, s.id),
      ])
      setPendingDelete({ subcategory: s, count, hasSizeRange: Boolean(sizeRange) })
    } catch {
      show('Failed to check product count', 'error')
    }
  }

  const runDelete = async (action, reassignTo) => {
    if (!pendingDelete) return
    try {
      await deleteSubcategory(pendingDelete.subcategory.id, action, reassignTo)
      show('Subcategory deleted', 'success')
      setPendingDelete(null)
      load()
    } catch (err) {
      show(err.message || 'Failed to delete subcategory', 'error')
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back to categories" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          ←
        </button>
        <div>
          <p className="text-xs text-slate-400">Categories</p>
          <h2 className="font-display text-lg font-semibold text-slate-900">{category.name}</h2>
        </div>
      </div>

      <form onSubmit={handleCreate} className="mt-4 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New subcategory name"
          className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Add</button>
      </form>

      <div className="mt-6">
        {loading && <p className="text-sm text-slate-400">Loading…</p>}
        {!loading && subcategories.length === 0 && (
          <p className="text-sm text-slate-400">No subcategories yet.</p>
        )}
        {!loading && subcategories.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {subcategories.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                {renamingId === s.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(s.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => commitRename(s.id)}
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                ) : (
                  <button type="button" onClick={() => startRename(s)} className="flex-1 text-left text-sm text-slate-700 hover:underline">
                    {s.name} <span className="text-slate-400">({s.productCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenSizeRange(s)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Size Range →
                </button>
                <button
                  type="button"
                  onClick={() => requestDelete(s)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingDelete && pendingDelete.count === 0 && (
        <ConfirmDialog
          open
          title={`Delete "${pendingDelete.subcategory.name}"?`}
          message={
            pendingDelete.hasSizeRange
              ? 'This subcategory has no products, but it does have a size range set — that will be deleted too. This cannot be undone.'
              : 'This subcategory has no products. This cannot be undone.'
          }
          confirmLabel="Delete"
          onConfirm={() => runDelete()}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {pendingDelete && pendingDelete.count > 0 && (
        <DeleteChoice
          subcategory={pendingDelete.subcategory}
          count={pendingDelete.count}
          siblings={subcategories}
          onCancel={() => setPendingDelete(null)}
          onReassign={(reassignTo) => runDelete('reassign', reassignTo)}
          onUnpublish={() => runDelete('unpublish')}
        />
      )}
    </>
  )
}
