import { useState, useEffect } from 'react'
import AdminLayout from './admin/AdminLayout'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function api(path, options = {}) {
  return fetch(`${API}${path}`, { credentials: 'include', ...options })
}

function jsonPost(path, body) {
  return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

const S = {
  input: { width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem', border: '1px solid #E8E2DB', borderRadius: 6, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' },
  btnPrimary: { padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: '#FAF7F2', background: '#2C2420', border: 'none', borderRadius: 6, cursor: 'pointer' },
}

// ── Login Form ──

function LoginForm({ onLogin }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const requestOtp = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await jsonPost('/api/auth/request-otp', { email: email.trim() })
      const data = await res.json()
      if (res.ok) setStep('code')
      else setError(data.error || 'Failed to send code')
    } catch { setError('Network error. Is the server running?') }
    finally { setSending(false) }
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await jsonPost('/api/auth/verify-otp', { email: email.trim(), code: code.trim() })
      const data = await res.json()
      if (res.ok && data.success) onLogin()
      else setError(data.error || 'Verification failed')
    } catch { setError('Network error') }
    finally { setSending(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '2.5rem 2rem', background: '#fff', borderRadius: 12, border: '1px solid #E8E2DB' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.5rem', fontWeight: 600, color: '#2C2420', margin: '0 0 0.25rem' }}>Genvio Exotic Apparel Admin</h1>
        <p style={{ fontSize: '0.875rem', color: '#8A7B72', margin: '0 0 1.5rem' }}>
          {step === 'email' ? 'Enter your admin email to sign in' : 'Check your email for the 6-digit code'}
        </p>
        {error && <div style={{ padding: '0.625rem 0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: '0.8125rem', color: '#991B1B', marginBottom: '1rem' }}>{error}</div>}
        {step === 'email' ? (
          <form onSubmit={requestOtp}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required autoFocus style={{ ...S.input }} />
            <button type="submit" disabled={sending || !email.trim()} style={{ ...S.btnPrimary, width: '100%', marginTop: '0.75rem', padding: '0.625rem', opacity: sending ? 0.6 : 1 }}>{sending ? 'Sending...' : 'Send Code'}</button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required autoFocus maxLength={6} style={{ ...S.input, fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', letterSpacing: '0.2em' }} />
            <button type="submit" disabled={sending || code.length !== 6} style={{ ...S.btnPrimary, width: '100%', marginTop: '0.75rem', padding: '0.625rem', opacity: sending ? 0.6 : 1 }}>{sending ? 'Verifying...' : 'Verify & Sign In'}</button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError('') }} style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem', fontSize: '0.8125rem', color: '#8A7B72', background: 'none', border: 'none', cursor: 'pointer' }}>Use a different email</button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Root ──
//
// This gate is the only thing standing between LoginForm and the admin
// shell (AdminLayout + its nested /admin/* routes). Everything past login
// used to be a single inline Dashboard here; TASK-06 replaced it with the
// router-based shell, and Tasks 07-11 fill in each tab's real content.

export default function AdminPage() {
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    api('/api/auth/me')
      .then(res => setAuthed(res.ok))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) return null
  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <AdminLayout onLogout={() => setAuthed(false)} />
}
