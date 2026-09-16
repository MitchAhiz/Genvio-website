import { useEffect, useRef, useState } from 'react'
import {
  createSubcategory,
  deleteSubcategory,
  getSubcategoryProductCount,
  getSubcategories,
  updateSubcategory,
} from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from './ConfirmDialog'

const SECTIONS = ['men', 'women', 'kids']
const SECTION_LABEL = { men: 'Men', women: 'Women', kids: 'Kids' }
const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

function DeleteChoice({ subcategory, sameSection, count, onCancel, onReassign, onUnpublish }) {
  const [reassignTo, setReassignTo] = useState('')
  const otherOptions = sameSection.filter((s) => s.id !== subcategory.id)

  return (
    <div className="fixed inset-0 z-[1150] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Delete "{subcategory.name}"?</h3>
        <p className="mt-1.5 text-sm text-slate-500">
          {count} product{count === 1 ? '' : 's'} use this sub-category. Choose what happens to them.
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
                {otherOptions.length === 0 ? 'No other sub-category in this section' : 'Select a sub-category…'}
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

export default function SubcategoryDrawer({ open, onClose }) {
  const { show } = useToast()
  const [subcategories, setSubcategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSection, setNewSection] = useState('men')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null) // { subcategory, count } | { subcategory, count: 0 }
  const drawerRef = useRef(null)
  const previouslyFocused = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getSubcategories()
      setSubcategories(data)
    } catch {
      show('Failed to load sub-categories', 'error')
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

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      await createSubcategory(name, newSection)
      setNewName('')
      show('Sub-category added', 'success')
      load()
    } catch (err) {
      show(err.message || 'Failed to add sub-category', 'error')
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
      show('Sub-category renamed', 'success')
      load()
    } catch (err) {
      show(err.message || 'Failed to rename sub-category', 'error')
    }
  }

  const requestDelete = async (s) => {
    try {
      const { count } = await getSubcategoryProductCount(s.id)
      setPendingDelete({ subcategory: s, count })
    } catch {
      show('Failed to check product count', 'error')
    }
  }

  const runDelete = async (action, reassignTo) => {
    if (!pendingDelete) return
    try {
      await deleteSubcategory(pendingDelete.subcategory.id, action, reassignTo)
      show('Sub-category deleted', 'success')
      setPendingDelete(null)
      load()
    } catch (err) {
      show(err.message || 'Failed to delete sub-category', 'error')
    }
  }

  const bySection = SECTIONS.map((section) => ({
    section,
    items: subcategories.filter((s) => s.section === section),
  }))

  return (
    <>
      <div className="fixed inset-0 z-[1100] flex justify-end bg-slate-900/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Manage sub-categories"
          className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900">Sub-categories</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              ✕
            </button>
          </div>

          <form onSubmit={handleCreate} className="mt-4 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New sub-category name"
              className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            />
            <select
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              {SECTIONS.map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
            </select>
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Add</button>
          </form>

          <div className="mt-6 space-y-6">
            {loading && <p className="text-sm text-slate-400">Loading…</p>}
            {!loading && bySection.map(({ section, items }) => (
              <div key={section}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{SECTION_LABEL[section]}</h3>
                {items.length === 0 ? (
                  <p className="mt-1.5 text-sm text-slate-400">No sub-categories yet.</p>
                ) : (
                  <ul className="mt-1.5 divide-y divide-slate-100">
                    {items.map((s) => (
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
            ))}
          </div>
        </div>
      </div>

      {pendingDelete && pendingDelete.count === 0 && (
        <ConfirmDialog
          open
          title={`Delete "${pendingDelete.subcategory.name}"?`}
          message="This sub-category has no products. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => runDelete()}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {pendingDelete && pendingDelete.count > 0 && (
        <DeleteChoice
          subcategory={pendingDelete.subcategory}
          count={pendingDelete.count}
          sameSection={subcategories.filter((s) => s.section === pendingDelete.subcategory.section)}
          onCancel={() => setPendingDelete(null)}
          onReassign={(reassignTo) => runDelete('reassign', reassignTo)}
          onUnpublish={() => runDelete('unpublish')}
        />
      )}
    </>
  )
}
