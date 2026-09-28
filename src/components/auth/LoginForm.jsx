import { useState } from 'react'
import { apiFetch, jsonOptions } from '../../api/client'

// Shared staff sign-in form: same OTP-via-email flow, same session/CSRF
// cookies, used by both AdminPage.jsx and UploadPage.jsx. Only the heading
// differs per page — everything else (copy, request-otp/verify-otp calls,
// layout) is identical, since it's the same staff account either way.
const S = {
  input: { width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem', border: '1px solid #E8E2DB', borderRadius: 6, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' },
  btnPrimary: { padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: '#FAF7F2', background: '#2C2420', border: 'none', borderRadius: 6, cursor: 'pointer' },
}

export default function LoginForm({ title = 'Genvio Exotic Apparel Admin', onLogin }) {
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
      await apiFetch('/api/auth/request-otp', jsonOptions('POST', { email: email.trim() }))
      setStep('code')
    } catch (err) {
      setError(err.message || 'Failed to send code')
    } finally {
      setSending(false)
    }
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await apiFetch('/api/auth/verify-otp', jsonOptions('POST', { email: email.trim(), code: code.trim() }))
      onLogin()
    } catch (err) {
      setError(err.message || 'Verification failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '2.5rem 2rem', background: '#fff', borderRadius: 12, border: '1px solid #E8E2DB' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.5rem', fontWeight: 600, color: '#2C2420', margin: '0 0 0.25rem' }}>{title}</h1>
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
