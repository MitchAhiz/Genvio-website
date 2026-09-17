import { useState } from 'react'
import { updateConfig } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from './ConfirmDialog'

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

const SECTIONS = [
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'kids', label: 'Kids' },
  { key: 'wholesale', label: 'Wholesale' },
]

export default function SiteControlsCard({ config, onSaved }) {
  const { show } = useToast()
  const [savingKey, setSavingKey] = useState(null)
  const [confirmMaintenance, setConfirmMaintenance] = useState(false)
  const [minOrder, setMinOrder] = useState(config.min_order_amount ?? '')
  const [savingMinOrder, setSavingMinOrder] = useState(false)

  const patchOne = async (key, value) => {
    setSavingKey(key)
    try {
      const updated = await updateConfig({ [key]: value })
      onSaved(updated)
    } catch (err) {
      show(err.message || 'Failed to update', 'error')
    } finally {
      setSavingKey(null)
    }
  }

  const toggleMaintenance = (next) => {
    if (next) {
      setConfirmMaintenance(true)
      return
    }
    patchOne('maintenance_mode', false).then(() => show('Maintenance mode turned off', 'success'))
  }

  const confirmTurnOnMaintenance = async () => {
    setConfirmMaintenance(false)
    await patchOne('maintenance_mode', true)
    show('Maintenance mode is now ON — the public site shows the "back soon" page', 'warning')
  }

  const toggleSection = async (key, next) => {
    setSavingKey(`section_${key}`)
    try {
      const nextVisibility = { ...config.section_visibility, [key]: next }
      const updated = await updateConfig({ section_visibility: nextVisibility })
      onSaved(updated)
    } catch (err) {
      show(err.message || 'Failed to update section visibility', 'error')
    } finally {
      setSavingKey(null)
    }
  }

  const toggleCheckout = async (next) => {
    await patchOne('checkout_enabled', next)
    show(next ? 'Checkout enabled' : 'Checkout disabled sitewide', 'success')
  }

  const saveMinOrder = async () => {
    setSavingMinOrder(true)
    try {
      const value = minOrder === '' ? null : Number(minOrder)
      const updated = await updateConfig({ min_order_amount: value })
      onSaved(updated)
      show('Minimum order amount updated', 'success')
    } catch (err) {
      show(err.message || 'Failed to update minimum order amount', 'error')
    } finally {
      setSavingMinOrder(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-slate-900">Site Controls</h2>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Maintenance Mode</p>
          <p className="text-xs text-slate-500">Shows a "back soon" page to visitors; admin still works.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${config.maintenance_mode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {config.maintenance_mode ? 'ON' : 'OFF'}
          </span>
          <Toggle checked={!!config.maintenance_mode} disabled={savingKey === 'maintenance_mode'} onChange={toggleMaintenance} />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-sm font-medium text-slate-800">Section Visibility</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SECTIONS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 p-2.5">
              <span className="text-sm text-slate-700">{s.label}</span>
              <Toggle
                checked={!!config.section_visibility?.[s.key]}
                disabled={savingKey === `section_${s.key}`}
                onChange={(next) => toggleSection(s.key, next)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Checkout</p>
          <p className="text-xs text-slate-500">When disabled, browsing stays on but the bag/checkout is unavailable.</p>
        </div>
        <Toggle checked={!!config.checkout_enabled} disabled={savingKey === 'checkout_enabled'} onChange={toggleCheckout} />
      </div>

      <div className="mt-3 rounded-md border border-slate-100 p-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-800">Minimum Order Amount (₦)</span>
          <span className="mb-2 block text-xs text-slate-500">Leave blank to disable the minimum.</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="No minimum"
              className="w-full max-w-[180px] rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={saveMinOrder}
              disabled={savingMinOrder || Number(minOrder || 0) === Number(config.min_order_amount || 0)}
              className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {savingMinOrder ? 'Saving…' : 'Save'}
            </button>
          </div>
        </label>
      </div>

      <ConfirmDialog
        open={confirmMaintenance}
        title="Turn on maintenance mode?"
        message="This immediately shows the public site's 'back soon' page to all visitors. The admin panel keeps working."
        confirmLabel="Turn On"
        onConfirm={confirmTurnOnMaintenance}
        onClose={() => setConfirmMaintenance(false)}
      />
    </section>
  )
}
