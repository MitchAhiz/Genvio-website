import { useEffect, useState } from 'react'
import { getCurrentSession, logoutAdmin, invalidateAllSessions } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from './ConfirmDialog'

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SessionSecurityCard() {
  const { show } = useToast()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmInvalidateAll, setConfirmInvalidateAll] = useState(false)
  const [invalidating, setInvalidating] = useState(false)

  useEffect(() => {
    getCurrentSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
  }, [])

  // AdminSettings sits under the AdminLayout shell, which owns the
  // authed/not-authed state via AdminPage but doesn't expose it through
  // routing context. A full reload back to /admin re-runs AdminPage's
  // /api/auth/me check and lands on the login screen — same end result
  // as the sidebar's logout, without touching AdminLayout.jsx.
  const goToLogin = () => {
    window.location.href = '/admin'
  }

  const doLogout = async () => {
    try {
      await logoutAdmin()
    } catch {
      // Ignore — still redirect below so the user isn't stuck if the
      // request fails but the cookie is already stale/expired.
    }
    goToLogin()
  }

  const doInvalidateAll = async () => {
    setConfirmInvalidateAll(false)
    setInvalidating(true)
    try {
      await invalidateAllSessions()
      // The call just wiped every session, including the one this request
      // rode in on — the cookie is dead the instant the response lands.
      // Redirect immediately rather than showing a toast and leaving the
      // admin on a page where the next API call would 401.
      goToLogin()
    } catch (err) {
      show(err.message || 'Failed to invalidate sessions', 'error')
      setInvalidating(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-slate-900">Session &amp; Security</h2>

      <div className="mt-3 rounded-md border border-slate-100 p-3 text-sm">
        {loading ? (
          <p className="text-slate-400">Loading session…</p>
        ) : session?.email ? (
          <>
            <p className="text-slate-700">
              Logged in as <span className="font-medium">{session.email}</span>
            </p>
            {session.sessionStartedAt && (
              <p className="mt-0.5 text-xs text-slate-400">Session started {formatDateTime(session.sessionStartedAt)}</p>
            )}
          </>
        ) : (
          <p className="text-slate-400">Session info unavailable.</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="rounded-md border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Log Out
        </button>
        <button
          type="button"
          onClick={() => setConfirmInvalidateAll(true)}
          disabled={invalidating}
          className="rounded-md border border-red-200 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          {invalidating ? 'Invalidating…' : 'Invalidate All Sessions'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You'll need to verify your email again to sign back in."
        confirmLabel="Log Out"
        onConfirm={doLogout}
        onClose={() => setConfirmLogout(false)}
      />

      <ConfirmDialog
        open={confirmInvalidateAll}
        title="Invalidate all sessions?"
        message="This immediately signs out every active admin session, including this one. You'll need to verify your email again to sign back in."
        confirmLabel="Invalidate All"
        onConfirm={doInvalidateAll}
        onClose={() => setConfirmInvalidateAll(false)}
      />
    </section>
  )
}
