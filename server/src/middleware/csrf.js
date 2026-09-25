const crypto = require('crypto')

// Double-submit-cookie CSRF protection for the admin session.
//
// admin_session is a cross-site cookie (SameSite=None in production, since
// the Vercel frontend and Render backend are different sites — see
// auth.js) sent with credentials:true, so a third-party page can trigger a
// credentialed request to any admin write route. The browser's
// same-origin policy stops that page from *reading* a response, but never
// stops it from *sending* one — so any route that mutates state purely off
// the strength of the cookie is forgeable.
//
// Fix: pair the session cookie with a second, readable (non-httpOnly)
// cookie holding a random token. A same-origin page can read that cookie
// (via JS) and echo it back in a request header; a cross-site attacker
// page cannot read it (cookies aren't readable cross-origin) and so cannot
// reproduce the header. requireCsrf rejects any write request where the
// header doesn't match the cookie.
//
// csrf_token itself carries no secret/session value — it's meaningless
// without the paired admin_session cookie also being valid, so it does not
// need httpOnly and the frontend must be able to read it.

const COOKIE_NAME = 'csrf_token'
const HEADER_NAME = 'x-csrf-token'

function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('hex')
  res.cookie(COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    // Matches the admin_session lifetime so both expire together; a stale
    // csrf_token with no matching session is harmless (requireAdminAuth
    // still runs first on every protected route).
    maxAge: 1000 * 60 * 60 * 8,
  })
  return token
}

function clearCsrfToken(res) {
  res.clearCookie(COOKIE_NAME)
}

// Apply after requireAdminAuth on every state-changing admin route (POST,
// PATCH, PUT, DELETE). Constant-time compare since both values are
// attacker-observable-length hex strings, not secrets by themselves, but
// there's no reason to leak timing here either.
function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.[COOKIE_NAME]
  const headerToken = req.get(HEADER_NAME)

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'Missing CSRF token' })
  }

  const a = Buffer.from(cookieToken)
  const b = Buffer.from(headerToken)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }

  next()
}

module.exports = { requireCsrf, issueCsrfToken, clearCsrfToken, COOKIE_NAME, HEADER_NAME }
