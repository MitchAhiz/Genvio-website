const crypto = require('crypto')

const otpStore = new Map()
const sessionStore = new Map()

const OTP_EXPIRY_MS = 10 * 60 * 1000
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function storeOtp(email, code) {
  otpStore.set(email, { code, expiresAt: Date.now() + OTP_EXPIRY_MS })
}

function verifyOtp(email, code) {
  const entry = otpStore.get(email)
  if (!entry) return { ok: false, error: 'Invalid or expired code' }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email)
    return { ok: false, error: 'Code has expired. Request a new one.' }
  }
  if (entry.code !== code) return { ok: false, error: 'Invalid or expired code' }
  otpStore.delete(email)
  return { ok: true }
}

function createSession(email) {
  const token = crypto.randomBytes(32).toString('hex')
  sessionStore.set(token, { email, expiresAt: Date.now() + SESSION_EXPIRY_MS })
  return token
}

function validateSession(token) {
  if (!token) return null
  const session = sessionStore.get(token)
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token)
    return null
  }
  return session
}

function destroySession(token) {
  sessionStore.delete(token)
}

async function sendOtpEmail(email, code) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    console.log(`[DEV] OTP for ${email}: ${code}`)
    return
  }

  const payload = {
    sender: { name: 'Genvio Exotic Apparel Admin', email: 'exoticapparels0105@gmail.com' },
    to: [{ email }],
    subject: `Your login code: ${code}`,
    htmlContent: `
      <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 0;">
        <h2 style="font-size: 20px; color: #2C2420; margin: 0 0 8px;">Genvio Exotic Apparel Admin Login</h2>
        <p style="font-size: 14px; color: #8A7B72; margin: 0 0 24px;">Enter this code to sign in:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #2C2420; padding: 16px 0; text-align: center; background: #F5F0EB; border-radius: 8px;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #8A7B72; margin: 24px 0 0;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  }
  console.log('[BREVO] Request payload:', JSON.stringify({ sender: payload.sender, to: payload.to, subject: payload.subject }, null, 2))

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = await res.text()
  console.log(`[BREVO] Response: ${res.status} ${res.statusText}`)
  console.log(`[BREVO] Body: ${body}`)

  if (!res.ok) {
    throw new Error(`Brevo API error: ${res.status} ${body}`)
  }
}

module.exports = {
  generateOtp,
  storeOtp,
  verifyOtp,
  createSession,
  validateSession,
  destroySession,
  sendOtpEmail,
  SESSION_EXPIRY_MS,
}
