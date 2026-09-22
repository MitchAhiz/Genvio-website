import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateConfig, getAdminBrands, getAdminCategories } from '../../api/admin'
import { useToast } from '../../hooks/useToast'

const SECTION_KEYS = ['men', 'women', 'kids']
const SECTION_LABELS = { men: 'Men', women: 'Women', kids: 'Kids' }
const MAX_QUICK_LINKS = 12
const MAX_SUB_LINKS = 10
const MAX_BRANDS = 20
const MAX_LABEL_LEN = 50
const MAX_HEADING_LEN = 40

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Mirrors server/src/routes/config.js's isValidUrl — kept in sync by hand
// since the server is the source of truth and re-validates on save anyway.
// This copy exists purely so the admin sees a problem before clicking Save.
function isValidUrl(v) {
  if (typeof v !== 'string') return false
  const s = v.trim()
  if (!s || s.length > 500) return false
  if (/[\x00-\x20\x7F]/.test(s)) return false
  if (s.startsWith('/')) return !s.startsWith('//')
  try {
    const parsed = new URL(s)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname
  } catch {
    return false
  }
}

function isValidLabel(v, max = MAX_LABEL_LEN) {
  return typeof v === 'string' && !!v.trim() && v.trim().length <= max
}

// Returns { ok, message, badId } — badId lets the offending row get a red
// border; message is shown in the banner and mirrors the server's wording
// closely enough that a save-time 400 and a pre-save check read the same way.
function validateDraft(draft) {
  const { quickLinks: qh, categories: ch, brands: bh } = draft.headings
  if (!isValidLabel(qh, MAX_HEADING_LEN) || !isValidLabel(ch, MAX_HEADING_LEN) || !isValidLabel(bh, MAX_HEADING_LEN)) {
    return { ok: false, message: `Section headings must be 1-${MAX_HEADING_LEN} characters` }
  }

  if (draft.quickLinks.length > MAX_QUICK_LINKS) {
    return { ok: false, message: `Quick Links: at most ${MAX_QUICK_LINKS} links allowed` }
  }
  for (const link of draft.quickLinks) {
    if (!isValidLabel(link.label)) return { ok: false, message: `Quick Links: label must be 1-${MAX_LABEL_LEN} characters`, badId: link.id }
    if (!isValidUrl(link.url)) return { ok: false, message: `Quick Links: "${link.label || link.url}" has an invalid URL`, badId: link.id }
  }

  for (const key of SECTION_KEYS) {
    const entry = draft.sectionLinks[key]
    if (!isValidLabel(entry.label)) return { ok: false, message: `${SECTION_LABELS[key]} link: label must be 1-${MAX_LABEL_LEN} characters` }
    if (!isValidUrl(entry.url)) return { ok: false, message: `${SECTION_LABELS[key]} link: invalid URL` }
    if (entry.subLinks.length > MAX_SUB_LINKS) {
      return { ok: false, message: `${SECTION_LABELS[key]} sub-links: at most ${MAX_SUB_LINKS} allowed` }
    }
    for (const sub of entry.subLinks) {
      if (!isValidLabel(sub.label)) return { ok: false, message: `${SECTION_LABELS[key]} sub-link: label must be 1-${MAX_LABEL_LEN} characters`, badId: sub.id }
      if (!isValidUrl(sub.url)) return { ok: false, message: `${SECTION_LABELS[key]} sub-link: "${sub.label || sub.url}" has an invalid URL`, badId: sub.id }
    }
  }

  if (!Number.isInteger(draft.brands.maxCount) || draft.brands.maxCount < 1 || draft.brands.maxCount > MAX_BRANDS) {
    return { ok: false, message: `Top Brands: max shown must be an integer from 1 to ${MAX_BRANDS}` }
  }
  if (draft.brands.items.length > MAX_BRANDS) {
    return { ok: false, message: `Top Brands: at most ${MAX_BRANDS} brands allowed` }
  }
  const seen = new Set()
  for (const b of draft.brands.items) {
    if (!isValidLabel(b.name)) return { ok: false, message: 'Top Brands: brand name is required', badId: b.id }
    const key = b.name.trim().toLowerCase()
    if (seen.has(key)) return { ok: false, message: `Top Brands: "${b.name}" is already in the list`, badId: b.id }
    seen.add(key)
  }

  return { ok: true }
}

// Strips UI-only fields and recomputes sortOrder from array position before
// sending to the server — the drag list is the source of truth for order,
// not whatever sortOrder a stale item happened to carry.
function toPayload(draft) {
  const withOrder = (list) => list.map((item, i) => ({ ...item, sortOrder: i }))
  return {
    headings: {
      quickLinks: draft.headings.quickLinks.trim(),
      categories: draft.headings.categories.trim(),
      brands: draft.headings.brands.trim(),
    },
    quickLinks: withOrder(draft.quickLinks).map((l) => ({
      id: l.id,
      label: l.label.trim(),
      url: l.url.trim(),
      external: !l.url.trim().startsWith('/'),
      newTab: !!l.newTab,
      enabled: !!l.enabled,
      sortOrder: l.sortOrder,
    })),
    sectionLinks: SECTION_KEYS.reduce((acc, key) => {
      const entry = draft.sectionLinks[key]
      acc[key] = {
        enabled: !!entry.enabled,
        label: entry.label.trim(),
        url: entry.url.trim(),
        subLinks: withOrder(entry.subLinks).map((l) => ({
          id: l.id,
          label: l.label.trim(),
          url: l.url.trim(),
          external: !l.url.trim().startsWith('/'),
          newTab: !!l.newTab,
          enabled: !!l.enabled,
          sortOrder: l.sortOrder,
        })),
      }
      return acc
    }, {}),
    brands: {
      maxCount: draft.brands.maxCount,
      items: withOrder(draft.brands.items).map((b) => ({ id: b.id, name: b.name.trim(), sortOrder: b.sortOrder })),
    },
  }
}

function DragHandleIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-slate-900' : 'bg-slate-200'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// A single editable link row (used for both quickLinks and sectionLinks[*].subLinks).
function SortableLinkRow({ link, badId, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const errored = badId === link.id

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-md border p-2.5 ${errored ? 'border-red-300 bg-red-50/50' : 'border-slate-100'}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{ touchAction: 'none' }}
        className="mt-1 flex h-8 w-8 shrink-0 cursor-grab select-none items-center justify-center rounded text-slate-400 hover:text-slate-700 active:cursor-grabbing"
      >
        <DragHandleIcon className="h-4 w-4" />
      </button>

      <div className="grid flex-1 gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={link.label}
          onChange={(e) => onChange({ ...link, label: e.target.value })}
          placeholder="Label"
          maxLength={MAX_LABEL_LEN}
          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
        />
        <input
          type="text"
          value={link.url}
          onChange={(e) => onChange({ ...link, url: e.target.value })}
          placeholder="/shop or https://…"
          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
        />
      </div>

      <label className="mt-1.5 flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={!!link.newTab}
          onChange={(e) => onChange({ ...link, newTab: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-slate-300"
        />
        New tab
      </label>

      <Toggle checked={!!link.enabled} onChange={(v) => onChange({ ...link, enabled: v })} />

      <button
        type="button"
        onClick={onRemove}
        aria-label="Delete link"
        className="mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        ✕
      </button>
    </div>
  )
}

function LinkListEditor({ links, badId, onAdd, onChange, onReorder, addLabel }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = links.findIndex((l) => l.id === active.id)
    const newIndex = links.findIndex((l) => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(links, oldIndex, newIndex))
  }

  return (
    <div className="space-y-2">
      {links.length === 0 && <p className="text-xs text-slate-400">No links yet.</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {links.map((link) => (
            <SortableLinkRow
              key={link.id}
              link={link}
              badId={badId}
              onChange={(next) => onChange(links.map((l) => (l.id === link.id ? next : l)))}
              onRemove={() => onChange(links.filter((l) => l.id !== link.id))}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={onAdd}
        className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {addLabel}
      </button>
    </div>
  )
}

function CategoryPicker({ section, onPick }) {
  const [categories, setCategories] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [value, setValue] = useState('')

  const load = () => {
    if (loaded) return
    getAdminCategories(section)
      .then((cats) => setCategories(cats))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }

  return (
    <select
      value={value}
      onFocus={load}
      onChange={(e) => {
        const name = e.target.value
        if (!name) return
        onPick(name)
        setValue('')
      }}
      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600"
    >
      <option value="">+ Add category link…</option>
      {categories.map((c) => (
        <option key={c.id} value={c.name}>{c.name}</option>
      ))}
    </select>
  )
}

function SectionLinkGroup({ sectionKey, entry, badId, onChange }) {
  const addSubLink = () =>
    onChange({
      ...entry,
      subLinks: [
        ...entry.subLinks,
        { id: newId('sub'), label: '', url: `/shop/${sectionKey}`, external: false, newTab: false, enabled: true, sortOrder: entry.subLinks.length },
      ],
    })

  const addSubLinkFromCategory = (name) =>
    onChange({
      ...entry,
      subLinks: [
        ...entry.subLinks,
        {
          id: newId('sub'),
          label: name,
          // Category deep-linking lands on the Footer/CataloguePage work
          // (Part 3) — CataloguePage will read this ?category= param the
          // same way it already reads ?brand=.
          url: `/shop/${sectionKey}?category=${encodeURIComponent(name)}`,
          external: false,
          newTab: false,
          enabled: true,
          sortOrder: entry.subLinks.length,
        },
      ],
    })

  return (
    <div className="rounded-md border border-slate-100 p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Toggle checked={!!entry.enabled} onChange={(v) => onChange({ ...entry, enabled: v })} />
        <input
          type="text"
          value={entry.label}
          onChange={(e) => onChange({ ...entry, label: e.target.value })}
          placeholder="Label"
          maxLength={MAX_LABEL_LEN}
          className="w-32 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
        />
        <input
          type="text"
          value={entry.url}
          onChange={(e) => onChange({ ...entry, url: e.target.value })}
          placeholder="/shop/…"
          className="min-w-[10rem] flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div className="mt-2.5 pl-1">
        <p className="mb-1.5 text-xs font-medium text-slate-500">Sub-links</p>
        <LinkListEditor
          links={entry.subLinks}
          badId={badId}
          onAdd={addSubLink}
          onChange={(next) => onChange({ ...entry, subLinks: next })}
          onReorder={(next) => onChange({ ...entry, subLinks: next })}
          addLabel="+ Add sub-link"
        />
        <div className="mt-2">
          <CategoryPicker section={sectionKey} onPick={addSubLinkFromCategory} />
        </div>
      </div>
    </div>
  )
}

function SortableBrandRow({ brand, badId, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: brand.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const errored = badId === brand.id

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${errored ? 'border-red-300 bg-red-50/50' : 'border-slate-100'}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{ touchAction: 'none' }}
        className="flex h-6 w-6 shrink-0 cursor-grab select-none items-center justify-center rounded text-slate-400 hover:text-slate-700 active:cursor-grabbing"
      >
        <DragHandleIcon className="h-3.5 w-3.5" />
      </button>
      <span className="flex-1 text-sm text-slate-800">{brand.name}</span>
      <button type="button" onClick={onRemove} aria-label="Remove brand" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">✕</button>
    </div>
  )
}

function BrandsEditor({ brandsCfg, badId, onChange }) {
  const { show } = useToast()
  const [available, setAvailable] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    getAdminBrands()
      .then(setAvailable)
      .catch(() => show('Failed to load existing brands', 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const selectedKeys = useMemo(() => new Set(brandsCfg.items.map((b) => b.name.toLowerCase())), [brandsCfg.items])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available.filter((name) => !selectedKeys.has(name.toLowerCase())).slice(0, 8)
    return available.filter((name) => name.toLowerCase().includes(q) && !selectedKeys.has(name.toLowerCase())).slice(0, 8)
  }, [available, query, selectedKeys])

  const addBrand = (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (selectedKeys.has(trimmed.toLowerCase())) {
      show(`"${trimmed}" is already in Top Brands`, 'warning')
      return
    }
    onChange({ ...brandsCfg, items: [...brandsCfg.items, { id: newId('brand'), name: trimmed, sortOrder: brandsCfg.items.length }] })
    setQuery('')
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = brandsCfg.items.findIndex((b) => b.id === active.id)
    const newIndex = brandsCfg.items.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange({ ...brandsCfg, items: arrayMove(brandsCfg.items, oldIndex, newIndex) })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mr-2 text-slate-600">Max shown on storefront</span>
          <input
            type="number"
            min={1}
            max={MAX_BRANDS}
            value={brandsCfg.maxCount}
            onChange={(e) => onChange({ ...brandsCfg, maxCount: Number(e.target.value) })}
            className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="relative mt-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              e.preventDefault()
              addBrand(query)
            }
          }}
          placeholder="Search brands, or type a new one and press Enter"
          className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        {(query || matches.length > 0) && (
          <div className="mt-1 max-w-sm rounded-md border border-slate-200 bg-white shadow-sm">
            {matches.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addBrand(name)}
                className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {name}
              </button>
            ))}
            {query.trim() && !available.some((n) => n.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => addBrand(query)}
                className="block w-full border-t border-slate-100 px-3 py-1.5 text-left text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                + Add "{query.trim()}"
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={brandsCfg.items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {brandsCfg.items.map((brand) => (
              <SortableBrandRow
                key={brand.id}
                brand={brand}
                badId={badId}
                onChange={(next) => onChange({ ...brandsCfg, items: brandsCfg.items.map((b) => (b.id === brand.id ? next : b)) })}
                onRemove={() => onChange({ ...brandsCfg, items: brandsCfg.items.filter((b) => b.id !== brand.id) })}
              />
            ))}
          </SortableContext>
        </DndContext>
        {brandsCfg.items.length === 0 && <p className="text-xs text-slate-400">No brands selected yet.</p>}
      </div>
    </div>
  )
}

export default function FooterSettingsCard({ config, onSaved }) {
  const { show } = useToast()
  const [draft, setDraft] = useState(() => structuredClone(config.footer_config))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Keeps the draft in sync if another Settings card's save round-trips a
  // fresh `config` (onSaved replaces the whole object) without this card's
  // own edits having been saved — only resync while untouched.
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config.footer_config), [draft, config.footer_config])

  useEffect(() => {
    if (!dirty) setDraft(structuredClone(config.footer_config))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.footer_config])

  useEffect(() => {
    if (!dirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const addQuickLink = () =>
    setDraft((d) => ({
      ...d,
      quickLinks: [...d.quickLinks, { id: newId('ql'), label: '', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: d.quickLinks.length }],
    }))

  const save = async () => {
    const result = validateDraft(draft)
    if (!result.ok) {
      setError(result)
      show(result.message, 'error')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const updated = await updateConfig({ footer_config: toPayload(draft) })
      onSaved(updated)
      show('Footer settings saved', 'success')
    } catch (err) {
      setError({ message: err.message || 'Failed to save footer settings' })
      show(err.message || 'Failed to save footer settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-slate-900">Footer / Quick Links</h2>
        {dirty && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
      </div>
      <p className="mt-1 text-sm text-slate-500">Controls the storefront footer's three columns.</p>

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {/* Headings */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['quickLinks', 'Quick Links heading'],
          ['categories', 'Top Categories heading'],
          ['brands', 'Top Brands heading'],
        ].map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{label}</span>
            <input
              type="text"
              value={draft.headings[key]}
              maxLength={MAX_HEADING_LEN}
              onChange={(e) => setDraft((d) => ({ ...d, headings: { ...d.headings, [key]: e.target.value } }))}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </label>
        ))}
      </div>

      {/* Quick Links */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-800">Quick Links</h3>
        <div className="mt-2">
          <LinkListEditor
            links={draft.quickLinks}
            badId={error?.badId}
            onAdd={addQuickLink}
            onChange={(next) => setDraft((d) => ({ ...d, quickLinks: next }))}
            onReorder={(next) => setDraft((d) => ({ ...d, quickLinks: next }))}
            addLabel="+ Add quick link"
          />
        </div>
      </div>

      {/* Section links */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-800">Section Links (Top Categories)</h3>
        <p className="text-xs text-slate-500">
          On a section page, the other two sections show here automatically (e.g. browsing Men shows Women + Kids).
          Everywhere else, all three show. Each can carry its own sub-links.
        </p>
        <div className="mt-2 space-y-2.5">
          {SECTION_KEYS.map((key) => (
            <SectionLinkGroup
              key={key}
              sectionKey={key}
              entry={draft.sectionLinks[key]}
              badId={error?.badId}
              onChange={(next) => setDraft((d) => ({ ...d, sectionLinks: { ...d.sectionLinks, [key]: next } }))}
            />
          ))}
        </div>
      </div>

      {/* Top brands */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-800">Top Brands</h3>
        <div className="mt-2">
          <BrandsEditor
            brandsCfg={draft.brands}
            badId={error?.badId}
            onChange={(next) => setDraft((d) => ({ ...d, brands: next }))}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save Footer Settings'}
      </button>
    </section>
  )
}
