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
const { logActivity } = require('../utils/logActivity')

const router = Router()

router.post('/auth/request-otp', async (req, res, next) => {
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

router.post('/auth/verify-otp', (req, res, next) => {
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
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_MS,
      secure: process.env.NODE_ENV === 'production',
    })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.post('/auth/logout', (req, res) => {
  const token = req.cookies?.admin_session
  if (token) destroySession(token)
  res.clearCookie('admin_session')
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
router.post('/auth/invalidate-all', requireAdminAuth, (req, res) => {
  destroyAllSessions()
  res.clearCookie('admin_session')
  logActivity('auth.sessions_invalidated', 'session', null, {}).catch(() => {})
  res.json({ success: true })
})

module.exports = router
