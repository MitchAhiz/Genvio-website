import { useEffect, useState } from 'react'
import { updateConfig, getConfigHistory } from '../../api/admin'
import { useToast } from '../../hooks/useToast'

const HISTORY_KEYS = ['bank_account_name', 'bank_account_number', 'bank_name']
const KEY_LABEL = {
  bank_account_name: 'Account name',
  bank_account_number: 'Account number',
  bank_name: 'Bank name',
}

function EyeIcon({ open, size = 18, ...props }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} {...props}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.6 18.6 0 0 1 4.22-5.06M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.11 3.09M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  )
}

function maskAccountNumber(number) {
  const digits = String(number || '')
  if (digits.length <= 4) return digits
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PaymentSettingsCard({ config, onSaved }) {
  const { show } = useToast()
  const [accountName, setAccountName] = useState(config.bank_account_name || '')
  const [accountNumber, setAccountNumber] = useState(config.bank_account_number || '')
  const [bankName, setBankName] = useState(config.bank_name || '')
  const [revealNumber, setRevealNumber] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState(null)

  const loadHistory = () => {
    getConfigHistory(HISTORY_KEYS, 3)
      .then(setHistory)
      .catch((err) => show(err.message || 'Failed to load change history', 'error'))
  }

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dirty =
    accountName !== (config.bank_account_name || '') ||
    accountNumber !== (config.bank_account_number || '') ||
    bankName !== (config.bank_name || '')

  const save = async () => {
    setSaving(true)
    try {
      const updated = await updateConfig({
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
        bank_name: bankName.trim(),
      })
      onSaved(updated)
      show('Payment details updated', 'success')
      loadHistory()
    } catch (err) {
      show(err.message || 'Failed to save payment details', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-slate-900">Payment &amp; Banking</h2>
      <p className="mt-1 text-sm text-slate-500">Shown to customers at checkout for bank transfer.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Account Name</span>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Bank Name</span>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Account Number</span>
          <div className="relative">
            <input
              type={revealNumber ? 'text' : 'password'}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-md border border-slate-200 px-3 py-2 pr-10 text-sm font-mono tracking-wide"
              placeholder="0123456789"
            />
            <button
              type="button"
              onClick={() => setRevealNumber((v) => !v)}
              aria-label={revealNumber ? 'Hide account number' : 'Reveal account number'}
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
            >
              <EyeIcon open={revealNumber} />
            </button>
          </div>
          {!revealNumber && accountNumber && (
            <span className="mt-1 block text-xs text-slate-400">{maskAccountNumber(accountNumber)}</span>
          )}
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty || !accountName.trim() || !accountNumber.trim() || !bankName.trim()}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-700">Change History</h3>
        {history === null ? (
          <p className="mt-1.5 text-sm text-slate-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="mt-1.5 text-sm text-slate-400">No updates yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-1 text-sm text-slate-500">
            {history.slice(0, 3).map((h) => (
              <li key={h.id}>
                {KEY_LABEL[h.key] || h.key} updated — {formatDateTime(h.changedAt)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
