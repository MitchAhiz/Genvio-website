import { useMemo, useState } from 'react'
import { updateConfig } from '../../api/admin'
import { useToast } from '../../hooks/useToast'

const MAX_TITLE_LEN = 100
const MAX_HEADING_LEN = 100
const MAX_PARAGRAPH_LEN = 2000
const MAX_BLOCKS = 40

function newBlockId() {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function validatePage(page) {
  if (!page.title.trim()) return 'Title is required'
  if (page.title.trim().length > MAX_TITLE_LEN) return `Title must be ${MAX_TITLE_LEN} characters or fewer`
  if (page.blocks.length === 0) return 'At least one block is required'
  if (page.blocks.length > MAX_BLOCKS) return `At most ${MAX_BLOCKS} blocks allowed`
  for (const block of page.blocks) {
    const max = block.type === 'heading' ? MAX_HEADING_LEN : MAX_PARAGRAPH_LEN
    if (!block.text.trim()) return `Every ${block.type} needs text`
    if (block.text.trim().length > max) return `A ${block.type} exceeds ${max} characters`
  }
  return null
}

function BlockRow({ block, onChange, onMoveUp, onMoveDown, onRemove, isFirst, isLast }) {
  const maxLen = block.type === 'heading' ? MAX_HEADING_LEN : MAX_PARAGRAPH_LEN
  return (
    <div className="rounded-md border border-slate-100 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {block.type}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={isFirst} aria-label="Move up" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
            ↑
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast} aria-label="Move down" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
            ↓
          </button>
          <button type="button" onClick={onRemove} aria-label="Delete block" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
            ✕
          </button>
        </div>
      </div>
      {block.type === 'heading' ? (
        <input
          type="text"
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          maxLength={maxLen}
          placeholder="Heading text"
          className="mt-2 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium"
        />
      ) : (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          maxLength={maxLen}
          rows={3}
          placeholder="Paragraph text"
          className="mt-2 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
        />
      )}
    </div>
  )
}

function PageEditor({ label, configKey, page, onSaved }) {
  const { show } = useToast()
  const [draft, setDraft] = useState(page)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(page), [draft, page])

  const addBlock = (type) =>
    setDraft((d) => ({ ...d, blocks: [...d.blocks, { id: newBlockId(), type, text: '' }] }))

  const updateBlock = (index, next) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b, i) => (i === index ? next : b)) }))

  const removeBlock = (index) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.filter((_, i) => i !== index) }))

  const moveBlock = (index, dir) =>
    setDraft((d) => {
      const next = [...d.blocks]
      const target = index + dir
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...d, blocks: next }
    })

  const save = async () => {
    const validationError = validatePage(draft)
    if (validationError) {
      setError(validationError)
      show(validationError, 'error')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const updated = await updateConfig({ [configKey]: draft })
      onSaved(updated)
      show(`${label} page updated`, 'success')
    } catch (err) {
      setError(err.message || 'Failed to save')
      show(err.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border border-slate-100 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
        {dirty && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Page title</span>
        <input
          type="text"
          value={draft.title}
          maxLength={MAX_TITLE_LEN}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          className="w-full max-w-md rounded-md border border-slate-200 px-2.5 py-1.5 text-sm"
        />
      </label>

      <div className="mt-3 space-y-2">
        {draft.blocks.map((block, i) => (
          <BlockRow
            key={block.id}
            block={block}
            isFirst={i === 0}
            isLast={i === draft.blocks.length - 1}
            onChange={(next) => updateBlock(i, next)}
            onMoveUp={() => moveBlock(i, -1)}
            onMoveDown={() => moveBlock(i, 1)}
            onRemove={() => removeBlock(i)}
          />
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => addBlock('heading')}
          className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          + Add heading
        </button>
        <button
          type="button"
          onClick={() => addBlock('paragraph')}
          className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          + Add paragraph
        </button>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? 'Saving…' : `Save ${label}`}
      </button>
    </div>
  )
}

// Content for the public /about and /refund-policy pages — plain text
// blocks only (no HTML), stored in site_config the same way footer_config
// is, so there's no separate storage mechanism to reason about.
export default function PageContentCard({ config, onSaved }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-slate-900">Page Content</h2>
      <p className="mt-1 text-sm text-slate-500">Editable text for the public About and Refund & Returns pages.</p>

      <div className="mt-4 space-y-4">
        <PageEditor label="About" configKey="page_about" page={config.page_about} onSaved={onSaved} />
        <PageEditor label="Refund & Returns" configKey="page_refund_policy" page={config.page_refund_policy} onSaved={onSaved} />
      </div>
    </section>
  )
}
