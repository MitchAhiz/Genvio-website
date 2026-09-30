import { useEffect, useState } from 'react'
import { getSizeRange, saveSizeRange } from '../../api/admin'
import { useToast } from '../../hooks/useToast'

// One size range per (category, subcategory) pair. Save is a create-or-
// replace PUT/upsert on the backend (server/src/routes/sizeRanges.js) — there
// is no separate "add" vs "edit" state and no duplicate-name error to handle,
// unlike Category/Subcategory's create-then-rename pattern.
export default function SizeRangePanel({ category, subcategory, onBack }) {
  const { show } = useToast()
  const [sizesText, setSizesText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const range = await getSizeRange(category.id, subcategory.id)
      setSizesText(range ? range.sizes.join(', ') : '')
    } catch {
      show('Failed to load size range', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, subcategory.id])

  const handleSave = async (e) => {
    e.preventDefault()
    const sizes = sizesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (sizes.length === 0) {
      show('Enter at least one size', 'error')
      return
    }
    setSaving(true)
    try {
      const saved = await saveSizeRange(category.id, subcategory.id, sizes)
      setSizesText(saved.sizes.join(', '))
      show('Size range saved', 'success')
    } catch (err) {
      show(err.message || 'Failed to save size range', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back to subcategories" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          ←
        </button>
        <div>
          <p className="text-xs text-slate-400">{category.name}</p>
          <h2 className="font-display text-lg font-semibold text-slate-900">{subcategory.name} — Size Range</h2>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-4 space-y-2">
        <label className="block text-xs font-medium text-slate-500" htmlFor="size-range-input">
          Sizes, comma-separated
        </label>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <input
            id="size-range-input"
            type="text"
            value={sizesText}
            onChange={(e) => setSizesText(e.target.value)}
            placeholder="e.g. 36, 37, 38, 39, 40, 41"
            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        )}
        <button
          type="submit"
          disabled={loading || saving}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <p className="text-xs text-slate-400">
          Saving replaces the current size range for this category + subcategory — it's not an "add," so there's nothing to conflict with.
        </p>
      </form>
    </>
  )
}
