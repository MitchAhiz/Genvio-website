import { useEffect, useRef, useState } from 'react'
import {
  addProductImages,
  createCategory,
  createProduct,
  deleteProductImage,
  deleteProductVariant,
  deleteVariantSize as deleteVariantSizeApi,
  getAdminCategories,
  reorderProductImages,
  updateProduct,
} from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from './ConfirmDialog'
import { NairaAmount } from '../../utils/currency'

const SECTIONS = ['men', 'women', 'kids']
const SECTION_LABEL = { men: 'Men', women: 'Women', kids: 'Kids' }
const SIZE_OPTIONS = {
  men: ['XS', 'S', 'M', 'L', 'XL'],
  women: ['XS', 'S', 'M', 'L', 'XL'],
  kids: ['2-3Y', '4-5Y', '6-7Y'],
}
const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
const NEW_CATEGORY_VALUE = '__new__'

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function emptyProduct() {
  return { name: '', brand: '', price: '', section: 'women' }
}

export default function ProductModal({ open, product, onClose, onSaved }) {
  const { show } = useToast()
  const [form, setForm] = useState(emptyProduct())
  const [saved, setSaved] = useState(null) // full product record once it exists server-side
  const [categories, setCategories] = useState([])
  const [categoryChoice, setCategoryChoice] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [saving, setSaving] = useState(false)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState(null)
  const [confirmDeleteImage, setConfirmDeleteImage] = useState(null)
  const modalRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement
    if (product) {
      setSaved(product)
      setForm({
        name: product.name,
        brand: product.brand,
        price: String(product.price),
        section: product.section,
      })
      setCategoryChoice(product.categoryId || '')
    } else {
      setSaved(null)
      setForm(emptyProduct())
      setCategoryChoice('')
    }
    setNewCategoryName('')

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
  }, [open, product])

  useEffect(() => {
    if (!open) return
    getAdminCategories(form.section).then(setCategories).catch(() => setCategories([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.section])

  if (!open) return null

  const refresh = (updated) => {
    setSaved(updated)
    onSaved?.(updated)
  }

  const validateBasics = () => {
    if (!form.name.trim() || !form.brand.trim()) {
      show('Name and brand are required', 'error')
      return false
    }
    if (!categoryChoice) {
      show('Choose or create a category', 'error')
      return false
    }
    if (categoryChoice === NEW_CATEGORY_VALUE && !newCategoryName.trim()) {
      show('Enter a name for the new category', 'error')
      return false
    }
    const price = Number(form.price)
    if (!Number.isFinite(price) || price <= 0) {
      show('Price must be a positive number', 'error')
      return false
    }
    return true
  }

  // Resolves the chosen category to a real id, creating it first if the
  // admin picked "New category…" — categories are a normalized table
  // scoped per section, unlike Wholesale's plain-string categories.
  const resolveCategoryId = async () => {
    if (categoryChoice !== NEW_CATEGORY_VALUE) return categoryChoice
    const created = await createCategory(newCategoryName.trim(), form.section)
    setCategories((prev) => [created, ...prev])
    setCategoryChoice(created.id)
    setNewCategoryName('')
    return created.id
  }

  const handleCreateDraft = async () => {
    if (!validateBasics()) return
    setSaving(true)
    try {
      const categoryId = await resolveCategoryId()
      const created = await createProduct({
        slug: slugify(form.name),
        name: form.name.trim(),
        brand: form.brand.trim(),
        categoryId,
        price: Number(form.price),
        section: form.section,
      })
      show('Draft created — add variants, sizes and images below', 'success')
      refresh(created)
    } catch (err) {
      show(err.message || 'Failed to create product', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBasics = async () => {
    if (!validateBasics()) return
    setSaving(true)
    try {
      const categoryId = await resolveCategoryId()
      const updated = await updateProduct(saved.id, {
        name: form.name.trim(),
        brand: form.brand.trim(),
        price: Number(form.price),
        section: form.section,
        categoryId,
      })
      show('Product updated', 'success')
      refresh(updated)
    } catch (err) {
      show(err.message || 'Failed to save product', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSetStatus = async (status) => {
    if (!saved) return
    setSaving(true)
    try {
      const updated = await updateProduct(saved.id, { status })
      show(status === 'published' ? 'Product published' : 'Saved as draft', 'success')
      refresh(updated)
      if (status === 'published') onClose?.()
    } catch (err) {
      show(err.message || 'Failed to update status', 'error')
    } finally {
      setSaving(false)
    }
  }

  // --- Variants ---

  const addVariant = async () => {
    const updated = await updateProduct(saved.id, { variants: [{ colour: 'New colour', sizes: [] }] })
    refresh(updated)
  }

  const saveVariantColour = async (variantId, colour) => {
    const updated = await updateProduct(saved.id, { variants: [{ id: variantId, colour }] })
    refresh(updated)
  }

  const saveVariantImage = async (variantId, imageUrl) => {
    const updated = await updateProduct(saved.id, { variants: [{ id: variantId, imageUrl }] })
    refresh(updated)
  }

  const runDeleteVariant = async () => {
    const variantId = confirmDeleteVariant
    setConfirmDeleteVariant(null)
    try {
      await deleteProductVariant(variantId)
      show('Variant deleted', 'success')
      refresh({ ...saved, variants: saved.variants.filter((v) => v.id !== variantId) })
    } catch (err) {
      show(err.message || 'Failed to delete variant', 'error')
    }
  }

  const addSize = async (variantId) => {
    const options = SIZE_OPTIONS[form.section] || []
    const size = options[0] || 'S'
    const updated = await updateProduct(saved.id, { variants: [{ id: variantId, sizes: [{ size, quantity: 0 }] }] })
    refresh(updated)
  }

  const saveSize = async (variantId, sizeId, size, quantity) => {
    const updated = await updateProduct(saved.id, { variants: [{ id: variantId, sizes: [{ id: sizeId, size, quantity }] }] })
    refresh(updated)
  }

  const runDeleteSize = async (variantId, sizeId) => {
    try {
      await deleteVariantSizeApi(variantId, sizeId)
      show('Size removed', 'success')
      refresh({
        ...saved,
        variants: saved.variants.map((v) =>
          v.id === variantId ? { ...v, sizes: v.sizes.filter((s) => s.id !== sizeId) } : v
        ),
      })
    } catch (err) {
      show(err.message || 'Failed to remove size', 'error')
    }
  }

  // --- Images ---

  const handleAddImage = async () => {
    const url = newImageUrl.trim()
    if (!url) return
    try {
      await addProductImages(saved.id, [url])
      setNewImageUrl('')
      const updated = await updateProduct(saved.id, {})
      refresh(updated)
      show('Image added', 'success')
    } catch (err) {
      show(err.message || 'Failed to add image', 'error')
    }
  }

  const runDeleteImage = async () => {
    const imageId = confirmDeleteImage
    setConfirmDeleteImage(null)
    try {
      await deleteProductImage(imageId)
      show('Image deleted', 'success')
      refresh({ ...saved, images: saved.images.filter((img) => img.id !== imageId) })
    } catch (err) {
      show(err.message || 'Failed to delete image', 'error')
    }
  }

  const moveImage = async (index, direction) => {
    const images = [...saved.images]
    const target = index + direction
    if (target < 0 || target >= images.length) return
    ;[images[index], images[target]] = [images[target], images[index]]
    refresh({ ...saved, images })
    try {
      await reorderProductImages(saved.id, images.map((img) => img.id))
    } catch {
      show('Failed to save image order', 'error')
    }
  }

  const sizeOptions = SIZE_OPTIONS[form.section] || []

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={saved ? 'Edit product' : 'Add product'}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {saved ? 'Edit Product' : 'Add Product'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        {/* Basic info */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Brand</span>
            <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Price (₦)</span>
            <input type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Section</span>
            <select
              value={form.section}
              onChange={(e) => {
                const section = e.target.value
                setForm((f) => ({ ...f, section }))
                setCategoryChoice('')
                setNewCategoryName('')
              }}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            >
              {SECTIONS.map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Category</span>
            <select
              value={categoryChoice}
              onChange={(e) => setCategoryChoice(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            >
              <option value="">Select a category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_CATEGORY_VALUE}>New category…</option>
            </select>
          </label>
          {categoryChoice === NEW_CATEGORY_VALUE && (
            <label className="sm:col-span-2 text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                New category name ({SECTION_LABEL[form.section]})
              </span>
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
              />
            </label>
          )}
        </div>

        {!saved ? (
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="button" disabled={saving} onClick={handleCreateDraft} className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Draft & Continue'}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex justify-end">
              <button type="button" disabled={saving} onClick={handleSaveBasics} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Save basic info
              </button>
            </div>

            {/* Variants */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Variants</h3>
                <button type="button" onClick={addVariant} className="text-xs font-medium text-slate-600 hover:underline">+ Add variant</button>
              </div>
              <div className="mt-2 space-y-3">
                {saved.variants.length === 0 && <p className="text-sm text-slate-400">No colour variants yet.</p>}
                {saved.variants.map((v) => (
                  <div key={v.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        defaultValue={v.colour}
                        onBlur={(e) => e.target.value !== v.colour && saveVariantColour(v.id, e.target.value)}
                        className="min-w-[110px] flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
                        placeholder="Colour name"
                      />
                      <input
                        defaultValue={v.imageUrl || ''}
                        onBlur={(e) => e.target.value !== (v.imageUrl || '') && saveVariantImage(v.id, e.target.value)}
                        className="min-w-[140px] flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
                        placeholder="Image URL"
                      />
                      <button type="button" onClick={() => setConfirmDeleteVariant(v.id)} className="rounded-md px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">Delete</button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {v.sizes.map((s) => (
                        <div key={s.id} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1">
                          <select
                            defaultValue={s.size}
                            onChange={(e) => saveSize(v.id, s.id, e.target.value, s.quantity)}
                            className="text-xs"
                          >
                            {sizeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <input
                            type="number"
                            min="0"
                            defaultValue={s.quantity}
                            onBlur={(e) => saveSize(v.id, s.id, s.size, Number(e.target.value))}
                            className={`w-14 rounded border px-1 text-xs ${s.quantity <= 2 ? 'border-red-300 text-red-600' : 'border-slate-200'}`}
                          />
                          <button type="button" onClick={() => runDeleteSize(v.id, s.id)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addSize(v.id)} className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                        + Size
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Images */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Images</h3>
              <div className="mt-2 flex gap-2">
                <input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Image URL"
                  className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
                />
                <button type="button" onClick={handleAddImage} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Add</button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {saved.images.map((img, i) => (
                  <li key={img.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-1.5">
                    <img src={img.url} alt="" className="h-10 w-10 rounded object-cover" />
                    <span className="flex-1 truncate text-xs text-slate-500">{img.url}</span>
                    <button type="button" disabled={i === 0} onClick={() => moveImage(i, -1)} className="text-xs text-slate-400 disabled:opacity-30 hover:text-slate-700">↑</button>
                    <button type="button" disabled={i === saved.images.length - 1} onClick={() => moveImage(i, 1)} className="text-xs text-slate-400 disabled:opacity-30 hover:text-slate-700">↓</button>
                    <button type="button" onClick={() => setConfirmDeleteImage(img.id)} className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Delete</button>
                  </li>
                ))}
                {saved.images.length === 0 && <p className="text-sm text-slate-400">No images yet.</p>}
              </ul>
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-400">
                Current price: <NairaAmount value={form.price || 0} />
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="button" disabled={saving} onClick={() => handleSetStatus('draft')} className="rounded-md border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  Save Draft
                </button>
                <button type="button" disabled={saving} onClick={() => handleSetStatus('published')} className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Publish
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteVariant != null}
        title="Delete this variant?"
        message="This removes the colour and all of its sizes."
        confirmLabel="Delete"
        onConfirm={runDeleteVariant}
        onClose={() => setConfirmDeleteVariant(null)}
      />
      <ConfirmDialog
        open={confirmDeleteImage != null}
        title="Delete this image?"
        confirmLabel="Delete"
        onConfirm={runDeleteImage}
        onClose={() => setConfirmDeleteImage(null)}
      />
    </div>
  )
}
