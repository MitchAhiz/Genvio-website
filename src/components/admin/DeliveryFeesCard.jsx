import { useState } from 'react'
import { updateConfig } from '../../api/admin'
import { useToast } from '../../hooks/useToast'

const FEE_FIELDS = [
  { key: 'delivery_mainland_fee', label: 'Lagos Mainland Fee (₦)' },
  { key: 'delivery_island_fee', label: 'Lagos Island Fee (₦)' },
  { key: 'delivery_interstate_fee', label: 'Interstate Fee (₦)' },
]

export default function DeliveryFeesCard({ config, onSaved }) {
  const { show } = useToast()
  const [fees, setFees] = useState(() =>
    FEE_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: config[f.key] ?? 0 }), {})
  )
  const [saving, setSaving] = useState(false)

  const dirty = FEE_FIELDS.some((f) => Number(fees[f.key] || 0) !== Number(config[f.key] || 0))

  const save = async () => {
    setSaving(true)
    try {
      const updated = await updateConfig(
        FEE_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: Number(fees[f.key] || 0) }), {})
      )
      onSaved(updated)
      show('Delivery fees updated', 'success')
    } catch (err) {
      show(err.message || 'Failed to update delivery fees', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-slate-900">Delivery Fees</h2>
      <p className="mt-1 text-sm text-slate-500">Charged at checkout when a customer chooses Dispatch.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {FEE_FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{f.label}</span>
            <input
              type="number"
              min="0"
              value={fees[f.key]}
              onChange={(e) => setFees((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </section>
  )
}
