import { useEffect, useRef, useState } from 'react'
import { createWholesaleImage, updateWholesaleImage } from '../../api/admin'
import { useToast } from '../../hooks/useToast'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
const NEW_CATEGORY_VALUE = '__new__'

function emptyForm() {
  return { url: '', caption: '', category: '' }
}

// <WholesaleImageModal open image categories onClose onSaved />
// `image` null → add mode (POST); otherwise edit mode (PATCH).
export default function WholesaleImageModal({ open, image, categories, onClose, onSaved }) {
  const { show } = useToast()
  const [form, setForm] = useState(emptyForm())
  const [categoryChoice, setCategoryChoice] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const modalRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement
    if (image) {
      setForm({ url: image.url, caption: image.caption || '', category: image.category || '' })
      setCategoryChoice(image.category || '')
    } else {
      setForm(emptyForm())
      setCategoryChoice('')
    }
    setNewCategory('')

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const node = modalRef.current
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
  }, [open, image])

  if (!open) return null

  const resolvedCategory = categoryChoice === NEW_CATEGORY_VALUE ? newCategory.trim() : categoryChoice

  const handleSave = async (e) => {
    e.preventDefault()
    const url = form.url.trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      show('Provide an image URL starting with http:// or https://', 'error')
      return
    }
    if (categoryChoice === NEW_CATEGORY_VALUE && !newCategory.trim()) {
      show('Enter a name for the new category', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = { url, caption: form.caption.trim() || null, category: resolvedCategory || null }
      const saved = image
        ? (await updateWholesaleImage(image.id, payload))
        : (await createWholesaleImage(payload))
      show(image ? 'Image updated' : 'Image added', 'success')
      onSaved?.(saved)
      onClose?.()
    } catch (err) {
      show(err.message || 'Failed to save image', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <form
        ref={modalRef}
        onSubmit={handleSave}
        role="dialog"
        aria-modal="true"
        aria-label={image ? 'Edit wholesale image' : 'Add wholesale image'}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {image ? 'Edit Image' : 'Add Image'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Image URL</span>
            <input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://…"
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </label>

          {form.url.trim() && (
            <img src={form.url.trim()} alt="" className="h-32 w-full rounded-md object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Caption (optional)</span>
            <input
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Category</span>
            <select
              value={categoryChoice}
              onChange={(e) => setCategoryChoice(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={NEW_CATEGORY_VALUE}>New category…</option>
            </select>
          </label>

          {categoryChoice === NEW_CATEGORY_VALUE && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">New category name</span>
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
              />
            </label>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Saving…' : image ? 'Save' : 'Add Image'}
          </button>
        </div>
      </form>
    </div>
  )
}
