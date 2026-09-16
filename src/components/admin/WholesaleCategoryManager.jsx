import { useEffect, useRef, useState } from 'react'
import {
  deleteWholesaleCategory,
  getWholesaleImagesAdmin,
  renameWholesaleCategory,
} from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from './ConfirmDialog'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

function DeleteChoice({ category, otherCategories, count, onCancel, onReassign, onUncategorise }) {
  const [reassignTo, setReassignTo] = useState('')

  return (
    <div className="fixed inset-0 z-[1150] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Delete "{category}"?</h3>
        <p className="mt-1.5 text-sm text-slate-500">
          {count} image{count === 1 ? '' : 's'} use this category. Choose what happens to them.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Reassign to</label>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              disabled={otherCategories.length === 0}
              className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {otherCategories.length === 0 ? 'No other category exists' : 'Select a category…'}
              </option>
              {otherCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              type="button"
              disabled={!reassignTo}
              onClick={() => onReassign(reassignTo)}
              className="mt-2 w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Reassign images &amp; delete
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onUncategorise}
              className="w-full rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Leave images uncategorised &amp; delete
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

// <WholesaleCategoryManager open onClose onChanged />
// Categories aren't a separate table here — they're the distinct set of
// WholesaleImage.category strings — so this drawer derives counts from the
// image list rather than a dedicated categories endpoint.
export default function WholesaleCategoryManager({ open, onClose, onChanged }) {
  const { show } = useToast()
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [renamingName, setRenamingName] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null) // { category, count } | null
  const drawerRef = useRef(null)
  const previouslyFocused = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      setImages(await getWholesaleImagesAdmin())
    } catch {
      show('Failed to load categories', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement
    load()

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

  const counts = images.reduce((acc, img) => {
    if (!img.category) return acc
    acc[img.category] = (acc[img.category] || 0) + 1
    return acc
  }, {})
  const categories = Object.keys(counts).sort()

  const refreshAfterChange = () => {
    load()
    onChanged?.()
  }

  const startRename = (c) => {
    setRenamingName(c)
    setRenameValue(c)
  }

  const commitRename = async (oldName) => {
    const name = renameValue.trim()
    setRenamingName(null)
    if (!name || name === oldName) return
    try {
      await renameWholesaleCategory(oldName, name)
      show('Category renamed', 'success')
      refreshAfterChange()
    } catch (err) {
      show(err.message || 'Failed to rename category', 'error')
    }
  }

  const requestDelete = (category) => {
    setPendingDelete({ category, count: counts[category] })
  }

  const runDelete = async (action, reassignTo) => {
    if (!pendingDelete) return
    try {
      await deleteWholesaleCategory(pendingDelete.category, action, reassignTo)
      show('Category deleted', 'success')
      setPendingDelete(null)
      refreshAfterChange()
    } catch (err) {
      show(err.message || 'Failed to delete category', 'error')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[1100] flex justify-end bg-slate-900/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Manage wholesale categories"
          className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900">Categories</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              ✕
            </button>
          </div>

          <div className="mt-6 space-y-1.5">
            {loading && <p className="text-sm text-slate-400">Loading…</p>}
            {!loading && categories.length === 0 && (
              <p className="text-sm text-slate-400">No categories yet — add one from the image upload form.</p>
            )}
            {!loading && (
              <ul className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <li key={c} className="flex items-center justify-between gap-2 py-2">
                    {renamingName === c ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(c)
                          if (e.key === 'Escape') setRenamingName(null)
                        }}
                        onBlur={() => commitRename(c)}
                        className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <button type="button" onClick={() => startRename(c)} className="flex-1 text-left text-sm text-slate-700 hover:underline">
                        {c} <span className="text-slate-400">({counts[c]})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => requestDelete(c)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {pendingDelete && (
        <DeleteChoice
          category={pendingDelete.category}
          count={pendingDelete.count}
          otherCategories={categories.filter((c) => c !== pendingDelete.category)}
          onCancel={() => setPendingDelete(null)}
          onReassign={(reassignTo) => runDelete('reassign', reassignTo)}
          onUncategorise={() => runDelete('uncategorise')}
        />
      )}
    </>
  )
}
