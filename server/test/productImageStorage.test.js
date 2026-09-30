// Unit + integration tests for the signed-upload endpoint
// (server/src/services/productImageStorage.js,
// server/src/routes/upload.js's POST /admin/upload/sign).
//
// '@supabase/supabase-js' is swapped for an in-memory fake before
// productImageStorage.js is required, so no real Storage call is ever
// made — same require.cache-swap pattern as test/products.test.js uses
// for the Prisma client. Integration tests mount the real router (real
// requireAdminAuth + requireCsrf) over HTTP, same pattern as
// test/csrf.test.js's Tier 2.

const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')
const cookieParser = require('cookie-parser')

process.env.SUPABASE_URL = 'https://project-ref.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
process.env.PRODUCT_IMAGES_BUCKET = 'product-images'
process.env.NODE_ENV = 'test' // keeps cookies non-Secure/SameSite=lax so plain fetch can carry them

// ---------------------------------------------------------------------------
// Fake Supabase Storage client
// ---------------------------------------------------------------------------

let lastSignedPath
let lastSignedBucket

function fakeSupabaseClient() {
  return {
    storage: {
      from(bucket) {
        return {
          async createSignedUploadUrl(storagePath) {
            lastSignedBucket = bucket
            lastSignedPath = storagePath
            return {
              data: { signedUrl: `https://project-ref.supabase.co/storage/v1/upload/sign/${bucket}/${storagePath}`, path: storagePath, token: 'fake-token-123' },
              error: null,
            }
          },
          getPublicUrl(storagePath) {
            return {
              data: { publicUrl: `https://project-ref.supabase.co/storage/v1/object/public/${bucket}/${storagePath}` },
            }
          },
        }
      },
    },
  }
}

const supabaseJsPath = require.resolve('@supabase/supabase-js')
require.cache[supabaseJsPath] = {
  id: supabaseJsPath,
  filename: supabaseJsPath,
  loaded: true,
  exports: { createClient: () => fakeSupabaseClient() },
}

const { signProductImageUpload } = require(
  path.join(__dirname, '..', 'src', 'services', 'productImageStorage.js')
)

beforeEach(() => {
  lastSignedPath = undefined
  lastSignedBucket = undefined
})

// ---------------------------------------------------------------------------
// Unit tests: signProductImageUpload
// ---------------------------------------------------------------------------

test('rejects an unsupported content type', async () => {
  const result = await signProductImageUpload({ kind: 'raw', contentType: 'application/pdf' })
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.match(result.error, /image\/jpeg/)
  assert.equal(lastSignedPath, undefined) // rejected before ever touching Storage
})

test('rejects an invalid kind', async () => {
  const result = await signProductImageUpload({ kind: 'gallery', contentType: 'image/jpeg' })
  assert.equal(result.ok, false)
  assert.match(result.error, /"raw" or "card"/)
})

test('the storage path is server-generated — the client cannot choose it', async () => {
  // No path/filename of any kind is accepted as input — only kind + contentType.
  const result = await signProductImageUpload({ kind: 'card', contentType: 'image/png' })

  assert.equal(result.ok, true)
  // kind/yyyy/mm/<uuid>.ext, entirely server-assembled.
  assert.match(result.path, /^card\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/)
  // Exactly what was sent to Supabase — nothing else could have been.
  assert.equal(lastSignedPath, result.path)
  assert.equal(lastSignedBucket, 'product-images')
})

test('response shape: uploadUrl, token, path and publicUrl are all present', async () => {
  const result = await signProductImageUpload({ kind: 'raw', contentType: 'image/jpeg' })

  assert.equal(result.ok, true)
  assert.equal(typeof result.uploadUrl, 'string')
  assert.equal(typeof result.token, 'string')
  assert.equal(typeof result.path, 'string')
  assert.equal(typeof result.publicUrl, 'string')
  assert.ok(result.publicUrl.startsWith('https://project-ref.supabase.co/storage/v1/object/public/product-images/'))
})

// ---------------------------------------------------------------------------
// Integration tests: POST /api/admin/upload/sign, real middleware chain
// ---------------------------------------------------------------------------

const dbPath = require.resolve('../src/db')
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {} }

const uploadRouter = require('../src/routes/upload')
const { createSession } = require('../src/services/auth')
const { issueCsrfToken, COOKIE_NAME, HEADER_NAME } = require('../src/middleware/csrf')

function fakeRes() {
  return { cookie() {}, cookies: {} }
}

let server
let baseUrl

test.before(async () => {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api', uploadRouter)
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

test('POST /admin/upload/sign — no session is rejected 401, before the service ever runs', async () => {
  const res = await fetch(`${baseUrl}/api/admin/upload/sign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'card', contentType: 'image/jpeg' }),
  })
  assert.equal(res.status, 401)
  assert.equal(lastSignedPath, undefined)
})

test('POST /admin/upload/sign — valid session but no CSRF token is rejected', async () => {
  const sessionToken = createSession('exoticapparels0105@gmail.com')
  const res = await fetch(`${baseUrl}/api/admin/upload/sign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `admin_session=${sessionToken}` },
    body: JSON.stringify({ kind: 'card', contentType: 'image/jpeg' }),
  })
  assert.equal(res.status, 403)
})

test('POST /admin/upload/sign — authenticated + CSRF returns the signed payload', async () => {
  const sessionToken = createSession('exoticapparels0105@gmail.com')
  const csrfToken = issueCsrfToken(fakeRes())

  const res = await fetch(`${baseUrl}/api/admin/upload/sign`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `admin_session=${sessionToken}; ${COOKIE_NAME}=${csrfToken}`,
      [HEADER_NAME]: csrfToken,
    },
    body: JSON.stringify({ kind: 'raw', contentType: 'image/webp' }),
  })

  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(typeof body.uploadUrl, 'string')
  assert.equal(typeof body.token, 'string')
  assert.equal(typeof body.path, 'string')
  assert.equal(typeof body.publicUrl, 'string')
  assert.match(body.path, /^raw\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/)
})

test('POST /admin/upload/sign — an unsupported content type is rejected 400 even when authenticated', async () => {
  const sessionToken = createSession('exoticapparels0105@gmail.com')
  const csrfToken = issueCsrfToken(fakeRes())

  const res = await fetch(`${baseUrl}/api/admin/upload/sign`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `admin_session=${sessionToken}; ${COOKIE_NAME}=${csrfToken}`,
      [HEADER_NAME]: csrfToken,
    },
    body: JSON.stringify({ kind: 'raw', contentType: 'application/pdf' }),
  })

  assert.equal(res.status, 400)
  const body = await res.json()
  assert.match(body.error, /image\/jpeg/)
})
