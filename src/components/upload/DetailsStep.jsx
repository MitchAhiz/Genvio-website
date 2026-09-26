import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/client'
import { getAdminBrands, getSubcategories, searchUploadProducts, suggestUploadField } from '../../api/admin'
import { useDebounce } from '../../hooks/useDebounce'
import { NairaAmount } from '../../utils/currency'

function describeSuggestError(err) {
  if (err instanceof ApiError && err.status === 503) return "AI suggestions aren't set up yet — type it manually."
  if (err instanceof ApiError && err.status === 429) return 'Suggestions are temporarily unavailable — type it manually for now.'
  return ''
}

// Step 2. Category is fixed to "Women" — there is deliberately no category
// selector anywhere in this component; only the sub-category dropdown,
// fetched live from admin. `lockedProduct` is non-null once brand/name/
// sub-category/price have been confirmed for this session — in that case
// only the colour name is editable.
export default function DetailsStep({ capabilities, categoryId, cardImageUrl, lockedProduct, onSaveColour }) {
  const aiSuggestions = Boolean(capabilities?.aiSuggestions)

  const [brands, setBrands] = useState([])
  const [subcategories, setSubcategories] = useState([])

  useEffect(() => {
    getAdminBrands().then(setBrands).catch(() => setBrands([]))
  }, [])
  useEffect(() => {
    if (!categoryId) return
    getSubcategories(categoryId).then(setSubcategories).catch(() => setSubcategories([]))
  }, [categoryId])

  const [brandInput, setBrandInput] = useState(lockedProduct?.brand || '')
  const [brandOpen, setBrandOpen] = useState(false)
  const [name, setName] = useState(lockedProduct?.name || '')
  const [subcategoryId, setSubcategoryId] = useState(lockedProduct?.subcategoryId || '')
  const [price, setPrice] = useState(lockedProduct?.price ? String(lockedProduct.price) : '')
  const [colourName, setColourName] = useState('')
  const [adoptedProduct, setAdoptedProduct] = useState(null) // existing product picked via dedup

  const [suggestion, setSuggestion] = useState(null) // { colourName, garmentDescription }
  const [suggestError, setSuggestError] = useState('')
  const [suggestedFor, setSuggestedFor] = useState(null) // brand string the current suggestion was fetched for

  const effective = adoptedProduct || lockedProduct
  const isLocked = Boolean(effective)

  // Fetch one suggestion per colour, only when a brand is chosen and the
  // approved card image is available — never on every keystroke.
  useEffect(() => {
    if (isLocked || !aiSuggestions || !brandInput.trim() || !cardImageUrl) return
    if (suggestedFor === brandInput.trim()) return
    let cancelled = false
    suggestUploadField(cardImageUrl)
      .then((data) => { if (!cancelled) { setSuggestion(data); setSuggestError(''); setSuggestedFor(brandInput.trim()) } })
      .catch((err) => { if (!cancelled) { setSuggestError(describeSuggestError(err)); setSuggestedFor(brandInput.trim()) } })
    return () => { cancelled = true }
  }, [isLocked, aiSuggestions, brandInput, cardImageUrl, suggestedFor])

  const nameSuggestionText = suggestion ? `${brandInput.trim()} ${suggestion.garmentDescription}`.trim() : ''

  const [dedupName, setDedupName] = useState('')
  const debouncedDedupName = useDebounce(dedupName, 400)
  const [dedupHits, setDedupHits] = useState([])
  useEffect(() => {
    if (isLocked || debouncedDedupName.trim().length < 3) { setDedupHits([]); return }
    let cancelled = false
    searchUploadProducts(debouncedDedupName.trim())
      .then((data) => { if (!cancelled) setDedupHits(data) })
      .catch(() => { if (!cancelled) setDedupHits([]) })
    return () => { cancelled = true }
  }, [debouncedDedupName, isLocked])

  const filteredBrands = useMemo(() => {
    const q = brandInput.trim().toLowerCase()
    if (!q) return brands
    return brands.filter((b) => b.toLowerCase().includes(q))
  }, [brands, brandInput])
  const exactBrandMatch = brands.some((b) => b.toLowerCase() === brandInput.trim().toLowerCase())

  const canSave = isLocked
    ? colourName.trim().length > 0
    : brandInput.trim().length > 0 && name.trim().length > 0 && subcategoryId && price && Number(price) > 0 && colourName.trim().length > 0

  const submit = () => {
    if (!canSave) return
    if (effective) {
      onSaveColour({
        productId: effective.id,
        brand: effective.brand,
        name: effective.name,
        subcategoryId: effective.subcategoryId ?? effective.subcategory?.id,
        price: effective.price,
        colourName: colourName.trim(),
      })
      return
    }
    onSaveColour({
      productId: null,
      brand: brandInput.trim(),
      name: name.trim(),
      subcategoryId,
      price: Number(price),
      colourName: colourName.trim(),
    })
  }

  if (effective) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div><span className="block text-xs uppercase text-slate-400">Brand</span><b>{effective.brand}</b></div>
          <div><span className="block text-xs uppercase text-slate-400">Product</span><b>{effective.name}</b></div>
          {effective.price != null && (
            <div><span className="block text-xs uppercase text-slate-400">Price</span><NairaAmount value={effective.price} className="font-semibold" /></div>
          )}
        </div>
        <p className="text-xs text-slate-400">Already set for this product — only the colour is needed.</p>

        <ColourField
          colourName={colourName}
          setColourName={setColourName}
          suggestion={suggestion}
          suggestError={suggestError}
        />

        <button type="button" disabled={!canSave} onClick={submit} className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Save colour →
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <label className="mb-1 block text-xs font-semibold text-slate-500">Brand</label>
        <input
          type="text"
          value={brandInput}
          onChange={(e) => setBrandInput(e.target.value)}
          onFocus={() => setBrandOpen(true)}
          onBlur={() => setTimeout(() => setBrandOpen(false), 120)}
          placeholder="Search brands…"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        {brandOpen && (
          <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {brandInput.trim() && !exactBrandMatch && (
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setBrandOpen(false) }} className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-50">
                + Add "{brandInput.trim()}" as a new brand
              </button>
            )}
            {filteredBrands.map((b) => (
              <button key={b} type="button" onMouseDown={(e) => { e.preventDefault(); setBrandInput(b); setBrandOpen(false) }} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Product name</label>
        {aiSuggestions && (
          <div className="mb-1.5">
            {nameSuggestionText ? (
              <button type="button" onClick={() => setName(nameSuggestionText)} className="rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ✨ {nameSuggestionText}
              </button>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-400">
                {brandInput.trim() ? 'Loading suggestion…' : '✨ Pick a brand first'}
              </span>
            )}
            {suggestError && <p className="mt-1 text-xs text-amber-600">{suggestError}</p>}
          </div>
        )}
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setDedupName(e.target.value) }}
          disabled={!brandInput.trim()}
          placeholder="Product name"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        />
      </div>

      {dedupHits.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-semibold text-amber-700">⚠ You may already stock this</p>
          <div className="space-y-2">
            {dedupHits.slice(0, 3).map((p) => (
              <div key={p.id} className="rounded-md border border-amber-200 bg-white p-2 text-sm">
                <div className="font-medium text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-400">{p.brand} · {p.variants.map((v) => v.colour).join(', ')}</div>
                <button type="button" onClick={() => setAdoptedProduct(p)} className="mt-1 text-xs font-medium text-emerald-700 hover:underline">
                  Add my colour to this product instead →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ColourField colourName={colourName} setColourName={setColourName} suggestion={suggestion} suggestError="" />

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Sub-category</label>
        <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
          <option value="">Choose sub-category…</option>
          {subcategories.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Price (₦)</label>
        <input
          type="number"
          min="0"
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 25000"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <button type="button" disabled={!canSave} onClick={submit} className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
        Save colour →
      </button>
    </div>
  )
}

function ColourField({ colourName, setColourName, suggestion, suggestError }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">Colour name</label>
      {suggestion?.colourName && (
        <button type="button" onClick={() => setColourName(suggestion.colourName)} className="mb-1.5 rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          ✨ {suggestion.colourName}
        </button>
      )}
      {suggestError && <p className="mb-1 text-xs text-amber-600">{suggestError}</p>}
      <input
        type="text"
        value={colourName}
        onChange={(e) => setColourName(e.target.value)}
        placeholder="Colour name"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  )
}
