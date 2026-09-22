import { useEffect, useState } from 'react'
import { getAllConfig, updateConfig } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import { CardSkeleton } from '../../components/admin/Skeleton'
import PaymentSettingsCard from '../../components/admin/PaymentSettingsCard'
import SiteControlsCard from '../../components/admin/SiteControlsCard'
import DeliveryFeesCard from '../../components/admin/DeliveryFeesCard'
import FooterSettingsCard from '../../components/admin/FooterSettingsCard'
import PageContentCard from '../../components/admin/PageContentCard'
import ActivityLogPanel from '../../components/admin/ActivityLogPanel'
import SessionSecurityCard from '../../components/admin/SessionSecurityCard'

function NotificationsCard({ config, onSaved }) {
  const { show } = useToast()
  const [email, setEmail] = useState(config.notification_email || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await updateConfig({ notification_email: email.trim() })
      onSaved(updated)
      show('Notification email updated', 'success')
    } catch (err) {
      show(err.message || 'Failed to update notification email', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-slate-900">Notifications</h2>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Order Alert Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving || !email.trim() || email.trim() === (config.notification_email || '')}
        className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </section>
  )
}

export default function AdminSettings() {
  const { show } = useToast()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllConfig()
      .then(setConfig)
      .catch((err) => show(err.message || 'Failed to load settings', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} className="h-40" />)}
      </div>
    )
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Couldn't load settings. Try refreshing the page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PaymentSettingsCard config={config} onSaved={setConfig} />
      <SiteControlsCard config={config} onSaved={setConfig} />
      <DeliveryFeesCard config={config} onSaved={setConfig} />
      <FooterSettingsCard config={config} onSaved={setConfig} />
      <PageContentCard config={config} onSaved={setConfig} />
      <NotificationsCard config={config} onSaved={setConfig} />
      <ActivityLogPanel />
      <SessionSecurityCard />
    </div>
  )
}
