const { Router } = require('express')
const {
  generateOtp,
  storeOtp,
  verifyOtp,
  createSession,
  destroySession,
  destroyAllSessions,
  sendOtpEmail,
  validateSession,
  SESSION_EXPIRY_MS,
} = require('../services/auth')
const { requireAdminAuth } = require('../middleware/auth')
const { requireCsrf, issueCsrfToken, clearCsrfToken } = require('../middleware/csrf')
const { rateLimit } = require('../middleware/rateLimit')
const { logActivity } = require('../utils/logActivity')

const router = Router()

// Tighter than customers.js's public 10/10min routes — this is a single
// admin account, not a general customer-facing endpoint, so there's no
// legitimate reason for high-frequency traffic. 3/10min is enough for a
// real admin to recover from a mistyped email or an expired code without
// friction, while capping how fast an attacker can spam OTP emails to the
// admin's inbox (or burn through Brevo's send quota).
const requestOtpLimit = rateLimit({ name: 'auth-request-otp', limit: 3, windowMs: 10 * 60 * 1000 })

// Paired with the per-code MAX_OTP_ATTEMPTS cap in services/auth.js: this
// limits how fast a single IP can throw guesses at verify-otp regardless of
// which code they're guessing against, while the per-code cap stops a
// distributed/rotating-IP attacker from working around this by spreading
// attempts across many IPs. 5/10min comfortably covers a real admin typing
// the right code on the first or second try (with room for a fat-fingered
// third).
const verifyOtpLimit = rateLimit({ name: 'auth-verify-otp', limit: 5, windowMs: 10 * 60 * 1000 })

router.post('/auth/request-otp', requestOtpLimit, async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    if (email.toLowerCase().trim() !== process.env.ADMIN_EMAIL?.toLowerCase().trim()) {
      return res.status(403).json({ error: 'This email is not authorized for admin access.' })
    }

    const code = generateOtp()
    storeOtp(email.toLowerCase().trim(), code)

    try {
      await sendOtpEmail(email.toLowerCase().trim(), code)
    } catch (err) {
      console.error('Failed to send OTP email:', err.message)
      return res.status(500).json({ error: 'Failed to send verification email. Check server configuration.' })
    }

    res.json({ message: 'Verification code sent to your email.' })
  } catch (err) {
    next(err)
  }
})

router.post('/auth/verify-otp', verifyOtpLimit, (req, res, next) => {
  try {
    const { email, code } = req.body
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' })

    const normalizedEmail = email.toLowerCase().trim()
    if (normalizedEmail !== process.env.ADMIN_EMAIL?.toLowerCase().trim()) {
      return res.status(401).json({ error: 'Invalid or expired code' })
    }

    const result = verifyOtp(normalizedEmail, code)
    if (!result.ok) return res.status(401).json({ error: result.error })

    const token = createSession(normalizedEmail)
    res.cookie('admin_session', token, {
      httpOnly: true,
      // Frontend (Vercel) and backend (Render) are different sites in
      // production, so the cookie must be SameSite=None to survive
      // cross-site fetch — browsers require Secure whenever None is used.
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: SESSION_EXPIRY_MS,
      secure: process.env.NODE_ENV === 'production',
    })
    issueCsrfToken(res)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.post('/auth/logout', (req, res) => {
  const token = req.cookies?.admin_session
  if (token) destroySession(token)
  res.clearCookie('admin_session')
  clearCsrfToken(res)
  res.json({ success: true })
})

router.get('/auth/me', (req, res) => {
  const token = req.cookies?.admin_session
  const session = validateSession(token)
  if (!session) return res.status(401).json({ error: 'Not authenticated' })
  // No createdAt is stored on the session — it's derived from the fixed
  // expiry window instead, since sessions never get a variable-length
  // extension anywhere in this codebase (no "remember me", no sliding
  // expiry). If that ever changes, this derivation breaks silently, so
  // watch for it.
  res.json({ email: session.email, sessionStartedAt: new Date(session.expiresAt - SESSION_EXPIRY_MS).toISOString() })
})

// Admin: wipes every active session (there's only ever one admin account,
// so "all sessions" is the whole in-memory store), including the caller's
// own. The frontend must treat a successful response as an immediate
// logout — the cookie this request came in on is dead the instant this
// returns.
router.post('/auth/invalidate-all', requireAdminAuth, requireCsrf, (req, res) => {
  destroyAllSessions()
  res.clearCookie('admin_session')
  clearCsrfToken(res)
  logActivity('auth.sessions_invalidated', 'session', null, {}).catch(() => {})
  res.json({ success: true })
})

module.exports = router
