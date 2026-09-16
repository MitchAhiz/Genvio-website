import { useEffect, useMemo, useRef, useState } from 'react'
import {
  bulkUpdateProducts,
  deleteProduct,
  getAdminProducts,
  unpublishProduct,
  updateProduct,
} from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { RowSkeleton } from '../../components/admin/Skeleton'
import { NairaAmount } from '../../utils/currency'
import ProductModal from '../../components/admin/ProductModal'
import SubcategoryDrawer from '../../components/admin/SubcategoryDrawer'

const SECTIONS = [
  { value: 'all', label: 'All' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'kids', label: 'Kids' },
]

const LOW_STOCK_DISMISSED_KEY = 'admin_low_stock_dismissed'

function stockTotal(product) {
  return product.variants.reduce((sum, v) => sum + v.sizes.reduce((s, sz) => s + sz.quantity, 0), 0)
}

function hasLowStockSize(product) {
  return product.variants.some((v) => v.sizes.some((s) => s.quantity <= 2))
}

function lowStockRows(products) {
  const rows = []
  for (const p of products) {
    for (const v of p.variants) {
      for (const s of v.sizes) {
        if (s.quantity <= 2) rows.push({ product: p, variant: v, size: s })
      }
    }
  }
  return rows
}

function LowStockPanel({ products }) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(LOW_STOCK_DISMISSED_KEY) === '1')
  const [collapsed, setCollapsed] = useState(false)
  const rows = useMemo(() => lowStockRows(products), [products])

  if (dismissed || rows.length === 0) return null

  const dismiss = () => {
    sessionStorage.setItem(LOW_STOCK_DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex items-center gap-2 text-sm font-semibold text-amber-800">
          <span>{collapsed ? '▸' : '▾'}</span>
          Low stock — {rows.length} size{rows.length === 1 ? '' : 's'} at or below 2 units
        </button>
        <button type="button" onClick={dismiss} className="text-xs font-medium text-amber-700 hover:underline">Dismiss</button>
      </div>
      {!collapsed && (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map(({ product, variant, size }) => (
            <li key={size.id} className={`flex items-center gap-2 ${size.quantity === 0 ? 'text-red-600' : 'text-amber-700'}`}>
              <span className="font-medium">{product.name}</span>
              <span className="text-slate-400">→</span>
              <span>{variant.colour}</span>
              <span className="text-slate-400">→</span>
              <span>{size.size}</span>
              <span className="ml-auto tabular-nums">{size.quantity} left</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function InlineText({ value, onSave, validate, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={`text-left hover:underline ${className}`}>
        {value}
      </button>
    )
  }

  const commit = () => {
    if (validate && !validate(draft)) {
      setEditing(false)
      return
    }
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
      className={`w-full rounded border border-slate-300 px-1.5 py-0.5 ${className}`}
    />
  )
}

export default function AdminProducts() {
  const { show } = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [selected, setSelected] = useState(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [confirmBulk, setConfirmBulk] = useState(null) // action string
  const [confirmUnpublish, setConfirmUnpublish] = useState(null) // product id
  const [confirmDelete, setConfirmDelete] = useState(null) // product id
  const [modalProduct, setModalProduct] = useState(undefined) // undefined = closed, null = add, obj = edit
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAdminProducts(section === 'all' ? {} : { section })
      setProducts(data)
    } catch (err) {
      show(err.message || 'Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    setSelected(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }, [products, debouncedSearch])

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.id)))
  }

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const runBulk = async () => {
    const action = confirmBulk
    setConfirmBulk(null)
    if (!action) return
    try {
      await bulkUpdateProducts(Array.from(selected), action)
      show(`Bulk ${action} complete`, 'success')
      setSelected(new Set())
      load()
    } catch (err) {
      show(err.message || 'Bulk action failed', 'error')
    }
  }

  const handleBulkTrigger = () => {
    if (!bulkAction || selected.size === 0) return
    setConfirmBulk(bulkAction)
  }

  const saveName = async (product, name) => {
    try {
      const updated = await updateProduct(product.id, { name })
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)))
      show('Name updated', 'success')
    } catch (err) {
      show(err.message || 'Failed to update name', 'error')
    }
  }

  const savePrice = async (product, priceStr) => {
    const price = Number(priceStr)
    if (!Number.isFinite(price) || price <= 0) {
      show('Price must be a positive number', 'error')
      return
    }
    try {
      const updated = await updateProduct(product.id, { price })
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)))
      show('Price updated', 'success')
    } catch (err) {
      show(err.message || 'Failed to update price', 'error')
    }
  }

  const toggleStatus = (product) => {
    if (product.status === 'published') {
      setConfirmUnpublish(product.id)
    } else {
      updateProduct(product.id, { status: 'published' })
        .then((updated) => {
          setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)))
          show('Product published', 'success')
        })
        .catch((err) => show(err.message || 'Failed to publish', 'error'))
    }
  }

  const runUnpublish = async () => {
    const id = confirmUnpublish
    setConfirmUnpublish(null)
    try {
      const updated = await unpublishProduct(id)
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)))
      show('Product unpublished', 'success')
    } catch (err) {
      show(err.message || 'Failed to unpublish', 'error')
    }
  }

  const runDelete = async () => {
    const id = confirmDelete
    setConfirmDelete(null)
    try {
      await deleteProduct(id)
      setProducts((prev) => prev.filter((p) => p.id !== id))
      show('Product deleted', 'success')
    } catch (err) {
      show(err.message || 'Failed to delete product', 'error')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {SECTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSection(s.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${section === s.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full max-w-xs rounded-md border border-slate-200 px-3 py-1.5 text-sm md:w-56"
          />
          <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Manage Sub-categories
          </button>
          <button type="button" onClick={() => setModalProduct(null)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">
            Add Product
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
          <span className="text-sm text-slate-500">{selected.size} selected</span>
          <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm">
            <option value="">Bulk action…</option>
            <option value="publish">Publish selected</option>
            <option value="unpublish">Unpublish selected</option>
            <option value="delete">Delete selected</option>
          </select>
          <button type="button" onClick={handleBulkTrigger} disabled={!bulkAction} className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-40">
            Apply
          </button>
        </div>
      )}

      <div className="mt-4">
        <LowStockPanel products={products} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="w-10 px-3 py-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Section / Sub-cat</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} columns={7} />)}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  No products found.
                </td>
              </tr>
            )}
            {!loading && filtered.map((p) => {
              const total = stockTotal(p)
              const low = hasLowStockSize(p)
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2 align-top"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} /></td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      {p.images[0] ? (
                        <img src={p.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-100" />
                      )}
                      <InlineText value={p.name} onSave={(v) => v.trim() && saveName(p, v.trim())} className="font-medium text-slate-900" />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-500">
                    <div className="capitalize">{p.section}</div>
                    <div className="text-xs text-slate-400">{p.subcategory?.name || '—'}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <InlineText
                      value={String(p.price)}
                      validate={(v) => Number.isFinite(Number(v)) && Number(v) > 0}
                      onSave={(v) => savePrice(p, v)}
                    />
                  </td>
                  <td className={`px-3 py-2 align-top tabular-nums ${low ? 'text-red-600' : 'text-slate-700'}`}>{total}</td>
                  <td className="px-3 py-2 align-top">
                    <button
                      type="button"
                      onClick={() => toggleStatus(p)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {p.status === 'published' ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setModalProduct(p)} className="text-xs font-medium text-slate-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => setConfirmDelete(p.id)} className="text-xs font-medium text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ProductModal
        open={modalProduct !== undefined}
        product={modalProduct}
        onClose={() => setModalProduct(undefined)}
        onSaved={() => load()}
      />
      <SubcategoryDrawer open={drawerOpen} onClose={() => { setDrawerOpen(false); load() }} />

      <ConfirmDialog
        open={confirmBulk != null}
        title={`${confirmBulk === 'delete' ? 'Delete' : confirmBulk === 'unpublish' ? 'Unpublish' : 'Publish'} ${selected.size} product${selected.size === 1 ? '' : 's'}?`}
        message={confirmBulk === 'delete' ? 'This cannot be undone.' : undefined}
        confirmLabel={confirmBulk === 'delete' ? 'Delete' : confirmBulk === 'unpublish' ? 'Unpublish' : 'Publish'}
        danger={confirmBulk !== 'publish'}
        onConfirm={runBulk}
        onClose={() => setConfirmBulk(null)}
      />
      <ConfirmDialog
        open={confirmUnpublish != null}
        title="Unpublish this product?"
        message="It will no longer be visible on the storefront."
        confirmLabel="Unpublish"
        onConfirm={runUnpublish}
        onClose={() => setConfirmUnpublish(null)}
      />
      <ConfirmDialog
        open={confirmDelete != null}
        title="Delete this product?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={runDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
