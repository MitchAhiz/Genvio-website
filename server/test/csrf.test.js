// Exercises the double-submit-cookie CSRF guard (server/src/middleware/csrf.js)
// at two levels:
//
// Tier 1 — unit tests against requireCsrf/issueCsrfToken/clearCsrfToken
// directly, with hand-built req/res fakes. No Express, no network, no DB.
//
// Tier 2 — integration tests that mount the real auth router (real
// requireAdminAuth + real requireCsrf, exactly as index.js wires them) and
// drive it over HTTP with supertest-style fetch calls. The Prisma client
// (`../db`) is swapped for an in-memory fake before the router is required,
// so logActivity()'s prisma.activityLog.create() never touches a real
// database — same pattern as test/orders-delivery-fee.test.js. Sessions
// come from the real in-memory server/src/services/auth.js store, so no
// mocking of session logic is needed.
//
// Neither tier opens a real browser, so neither can prove the csrf_token /
// admin_session cookies' SameSite/Secure attributes actually stop a
// cross-site browser from attaching them — that's what the separate
// DevTools check (Tier 3) is for. What this file does prove: if requireCsrf
// is removed from a route, made a no-op, or its comparison logic is broken
// (e.g. a bug that makes mismatched tokens pass), the Tier 2 "corrupted
// cookie" tests fail.
//
// Run with: npm test  (from server/)
const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const cookieParser = require('cookie-parser')

// ---------------------------------------------------------------------------
// Tier 1: unit tests against the middleware functions directly
// ---------------------------------------------------------------------------
const { requireCsrf, issueCsrfToken, clearCsrfToken, COOKIE_NAME, HEADER_NAME } = require('../src/middleware/csrf')

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    cookies: {},
    cleared: [],
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
    cookie(name, value, options) {
      this.cookies[name] = { value, options }
      return this
    },
    clearCookie(name) {
      this.cleared.push(name)
      return this
    },
  }
  return res
}

test('Tier 1: requireCsrf — missing cookie is rejected', () => {
  const req = { cookies: {}, get: () => 'some-header-value' }
  const res = fakeRes()
  let nextCalled = false
  requireCsrf(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'Missing CSRF token')
})

test('Tier 1: requireCsrf — missing header is rejected', () => {
  const req = { cookies: { [COOKIE_NAME]: 'abc123' }, get: () => undefined }
  const res = fakeRes()
  let nextCalled = false
  requireCsrf(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'Missing CSRF token')
})

test('Tier 1: requireCsrf — mismatched cookie/header is rejected', () => {
  const req = {
    cookies: { [COOKIE_NAME]: 'a'.repeat(64) },
    get: (name) => (name === HEADER_NAME ? 'b'.repeat(64) : undefined),
  }
  const res = fakeRes()
  let nextCalled = false
  requireCsrf(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'Invalid CSRF token')
})

test('Tier 1: requireCsrf — mismatched-length cookie/header is rejected (no crash)', () => {
  const req = {
    cookies: { [COOKIE_NAME]: 'short' },
    get: (name) => (name === HEADER_NAME ? 'a-much-longer-value' : undefined),
  }
  const res = fakeRes()
  let nextCalled = false
  assert.doesNotThrow(() => requireCsrf(req, res, () => { nextCalled = true }))

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
})

test('Tier 1: requireCsrf — matching cookie/header calls next()', () => {
  const token = 'c'.repeat(64)
  const req = {
    cookies: { [COOKIE_NAME]: token },
    get: (name) => (name === HEADER_NAME ? token : undefined),
  }
  const res = fakeRes()
  let nextCalled = false
  requireCsrf(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200) // untouched — requireCsrf never called status()
})

test('Tier 1: issueCsrfToken sets a non-httpOnly, readable cookie', () => {
  const res = fakeRes()
  const token = issueCsrfToken(res)

  assert.equal(typeof token, 'string')
  assert.equal(token.length, 64) // 32 bytes hex-encoded
  const cookie = res.cookies[COOKIE_NAME]
  assert.ok(cookie)
  assert.equal(cookie.value, token)
  assert.equal(cookie.options.httpOnly, false) // must be JS-readable by the frontend
})

test('Tier 1: clearCsrfToken clears the csrf_token cookie', () => {
  const res = fakeRes()
  clearCsrfToken(res)
  assert.ok(res.cleared.includes(COOKIE_NAME))
})

// ---------------------------------------------------------------------------
// Tier 2: integration tests through the real auth router
// ---------------------------------------------------------------------------

// Must happen before anything requires '../src/db', so logActivity (used by
// POST /auth/invalidate-all) gets this fake instead of the real Prisma
// client. No DB, no network call, anywhere in this file.
const fakePrisma = {
  activityLog: {
    async create() {
      return {}
    },
  },
}
const dbPath = require.resolve('../src/db')
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePrisma }

process.env.NODE_ENV = 'test' // keeps cookies non-Secure/SameSite=lax so plain fetch can carry them

const authRouter = require('../src/routes/auth')
const { createSession } = require('../src/services/auth')
const { issueCsrfToken: issueToken } = require('../src/middleware/csrf')

let server
let baseUrl

test.before(async () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api', authRouter)
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

test('Tier 2: POST /auth/invalidate-all — no session cookie at all is rejected by requireAdminAuth, before CSRF is even checked', async () => {
  const res = await fetch(`${baseUrl}/api/auth/invalidate-all`, { method: 'POST' })
  assert.equal(res.status, 401)
})

test('Tier 2: POST /auth/invalidate-all — valid session but no CSRF cookie/header is rejected', async () => {
  const sessionToken = createSession('exoticapparels0105@gmail.com')

  const res = await fetch(`${baseUrl}/api/auth/invalidate-all`, {
    method: 'POST',
    headers: { cookie: `admin_session=${sessionToken}` },
  })
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.error, 'Missing CSRF token')
})

test('Tier 2: POST /auth/invalidate-all — valid session with mismatched (corrupted) CSRF cookie vs header is rejected', async () => {
  const sessionToken = createSession('exoticapparels0105@gmail.com')

  const res = await fetch(`${baseUrl}/api/auth/invalidate-all`, {
    method: 'POST',
    headers: {
      cookie: `admin_session=${sessionToken}; ${COOKIE_NAME}=${'1'.repeat(64)}`,
      [HEADER_NAME]: '2'.repeat(64), // attacker page can't read the real cookie value, so it can never match
    },
  })
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.error, 'Invalid CSRF token')
})

test('Tier 2: POST /auth/invalidate-all — valid session with matching CSRF cookie/header succeeds', async () => {
  const sessionToken = createSession('exoticapparels0105@gmail.com')
  // Mint a real csrf token the way issueCsrfToken would, so cookie and
  // header genuinely match — this is the only path that should reach the
  // route handler and return 200.
  const csrfToken = issueToken(fakeRes())

  const res = await fetch(`${baseUrl}/api/auth/invalidate-all`, {
    method: 'POST',
    headers: {
      cookie: `admin_session=${sessionToken}; ${COOKIE_NAME}=${csrfToken}`,
      [HEADER_NAME]: csrfToken,
    },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
})
