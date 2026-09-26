// Integration tests for the two Gemini-backed /upload routes
// (server/src/routes/upload.js POST /admin/upload/generate-card and
// POST /admin/upload/suggest, server/src/services/gemini.js).
//
// '@google/genai' and '@supabase/supabase-js' are both swapped for
// in-memory fakes before the router is required, so no real Gemini or
// Storage call is ever made — same require.cache-swap pattern as
// test/productImageStorage.test.js. The router is mounted on a real
// Express app with the real requireAdminAuth + requireCsrf, driven over
// HTTP, same pattern as test/csrf.test.js's Tier 2.

const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const cookieParser = require('cookie-parser')

process.env.SUPABASE_URL = 'https://project-ref.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
process.env.PRODUCT_IMAGES_BUCKET = 'product-images'
process.env.NODE_ENV = 'test' // keeps cookies non-Secure/SameSite=lax so plain fetch can carry them
delete process.env.GEMINI_API_KEY // default unset — tests that need it set it explicitly

const GOOD_URL = 'https://project-ref.supabase.co/storage/v1/object/public/product-images/raw/2026/09/abc.jpg'

// ---------------------------------------------------------------------------
// Fake @google/genai
// ---------------------------------------------------------------------------

let generateContentBehavior = async () => {
  throw new Error('generateContentBehavior not set for this test')
}

class FakeApiError extends Error {
  constructor({ message, status }) {
    super(message)
    this.status = status
  }
}

const fakeGenAiExports = {
  GoogleGenAI: class {
    // eslint-disable-next-line no-useless-constructor
    constructor() {}
    get models() {
      return { generateContent: (params) => generateContentBehavior(params) }
    }
  },
  ApiError: FakeApiError,
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY' },
}

const genaiPath = require.resolve('@google/genai')
require.cache[genaiPath] = { id: genaiPath, filename: genaiPath, loaded: true, exports: fakeGenAiExports }

// ---------------------------------------------------------------------------
// Fake @supabase/supabase-js (Storage upload target for generate-card)
// ---------------------------------------------------------------------------

let lastUploadedBucket
let lastUploadedPath
let lastUploadedBuffer

function fakeSupabaseClient() {
  return {
    storage: {
      from(bucket) {
        return {
          async upload(storagePath, buffer) {
            lastUploadedBucket = bucket
            lastUploadedPath = storagePath
            lastUploadedBuffer = buffer
            return { data: { path: storagePath }, error: null }
          },
          async createSignedUploadUrl(storagePath) {
            return { data: { signedUrl: 'https://signed.example/x', path: storagePath, token: 'tok' }, error: null }
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

// ---------------------------------------------------------------------------
// Fake db (uploadProducts.js, required by upload.js, needs one to load)
// ---------------------------------------------------------------------------

const dbPath = require.resolve('../src/db')
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {} }

const uploadRouter = require('../src/routes/upload')
const { createSession } = require('../src/services/auth')
const { issueCsrfToken, COOKIE_NAME, HEADER_NAME } = require('../src/middleware/csrf')

function fakeRes() {
  return { cookie() {}, cookies: {} }
}

function authedHeaders() {
  const sessionToken = createSession('exoticapparels0105@gmail.com')
  const csrfToken = issueCsrfToken(fakeRes())
  return {
    'content-type': 'application/json',
    cookie: `admin_session=${sessionToken}; ${COOKIE_NAME}=${csrfToken}`,
    [HEADER_NAME]: csrfToken,
  }
}

let server
let baseUrl
let originalFetch
let fetchCalled
let fetchShouldServe

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

beforeEach(() => {
  lastUploadedBucket = undefined
  lastUploadedPath = undefined
  lastUploadedBuffer = undefined
  fetchCalled = false
  fetchShouldServe = { buffer: Buffer.from('fake-source-image-bytes'), contentType: 'image/jpeg' }
  generateContentBehavior = async () => {
    throw new Error('generateContentBehavior not set for this test')
  }

  // The route under test calls the real global `fetch` to fetch the
  // source image; the test itself also uses `fetch` to call the server
  // over loopback HTTP. Distinguish by URL so only the route's outbound
  // "fetch a supposed image URL" call is faked.
  originalFetch = global.fetch
  global.fetch = async (url, opts) => {
    const urlStr = typeof url === 'string' ? url : url.url
    if (urlStr.startsWith(baseUrl)) return originalFetch(url, opts)
    fetchCalled = true
    return {
      ok: true,
      status: 200,
      headers: { get: () => fetchShouldServe.contentType },
      async arrayBuffer() {
        return fetchShouldServe.buffer.buffer.slice(
          fetchShouldServe.buffer.byteOffset,
          fetchShouldServe.buffer.byteOffset + fetchShouldServe.buffer.byteLength
        )
      },
    }
  }
})

afterEach(() => {
  global.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// 1. Missing GEMINI_API_KEY -> 503, never crashes
// ---------------------------------------------------------------------------

test('generate-card: missing GEMINI_API_KEY returns 503, never crashes', async () => {
  const res = await fetch(`${baseUrl}/api/admin/upload/generate-card`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ sourceUrl: GOOD_URL }),
  })
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.error, "AI features aren't set up yet")
  assert.equal(fetchCalled, false)
})

test('suggest: missing GEMINI_API_KEY returns 503, never crashes', async () => {
  const res = await fetch(`${baseUrl}/api/admin/upload/suggest`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ imageUrl: GOOD_URL }),
  })
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.error, "AI features aren't set up yet")
  assert.equal(fetchCalled, false)
})

// ---------------------------------------------------------------------------
// 2. Non-bucket URL is rejected before any fetch
// ---------------------------------------------------------------------------

test('generate-card: a non-bucket sourceUrl is rejected before any fetch is made', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  const res = await fetch(`${baseUrl}/api/admin/upload/generate-card`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ sourceUrl: 'https://evil.example.com/x.jpg' }),
  })
  assert.equal(res.status, 400)
  assert.equal(fetchCalled, false)
})

test('suggest: a non-bucket imageUrl is rejected before any fetch is made', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  const res = await fetch(`${baseUrl}/api/admin/upload/suggest`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ imageUrl: 'https://evil.example.com/x.jpg' }),
  })
  assert.equal(res.status, 400)
  assert.equal(fetchCalled, false)
})

// ---------------------------------------------------------------------------
// 3. A quota error becomes 429 with the friendly message
// ---------------------------------------------------------------------------

test('generate-card: a Gemini quota error becomes 429 with the friendly message', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  generateContentBehavior = async () => {
    throw new FakeApiError({ message: 'RESOURCE_EXHAUSTED: quota exceeded', status: 429 })
  }
  const res = await fetch(`${baseUrl}/api/admin/upload/generate-card`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ sourceUrl: GOOD_URL }),
  })
  assert.equal(res.status, 429)
  const body = await res.json()
  assert.equal(body.error, 'Image generation is temporarily unavailable, try again shortly')
})

test('suggest: a Gemini quota error becomes 429 with the friendly message', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  generateContentBehavior = async () => {
    throw new FakeApiError({ message: 'RESOURCE_EXHAUSTED: quota exceeded', status: 429 })
  }
  const res = await fetch(`${baseUrl}/api/admin/upload/suggest`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ imageUrl: GOOD_URL }),
  })
  assert.equal(res.status, 429)
  const body = await res.json()
  assert.equal(body.error, 'Image generation is temporarily unavailable, try again shortly')
})

// ---------------------------------------------------------------------------
// 4. Suggestion output sanitised and length-capped
// ---------------------------------------------------------------------------

test('suggest: output is trimmed, control chars/quotes stripped, and length-capped', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  generateContentBehavior = async () => ({
    text: JSON.stringify({
      colourName: '  "Burg\u0007undy\'  ' + 'x'.repeat(40),
      garmentDescription: '`Linen  Wrap   Dress`' + ' extra padding'.repeat(10),
    }),
  })
  const res = await fetch(`${baseUrl}/api/admin/upload/suggest`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ imageUrl: GOOD_URL }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.colourName.length <= 30, `colourName too long: ${body.colourName.length}`)
  assert.ok(!/["'`]/.test(body.colourName))
  assert.ok(!/[\u0000-\u001F]/.test(body.colourName))
  assert.ok(body.garmentDescription.length <= 60, `garmentDescription too long: ${body.garmentDescription.length}`)
  assert.ok(!/["'`]/.test(body.garmentDescription))
})

// ---------------------------------------------------------------------------
// 5. Unusable output -> empty strings, not an error
// ---------------------------------------------------------------------------

test('suggest: unparseable model output returns empty strings, not an error', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  generateContentBehavior = async () => ({ text: 'not valid json at all' })
  const res = await fetch(`${baseUrl}/api/admin/upload/suggest`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ imageUrl: GOOD_URL }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.colourName, '')
  assert.equal(body.garmentDescription, '')
})

test('suggest: non-string fields in an otherwise-valid JSON response become empty strings', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  generateContentBehavior = async () => ({ text: JSON.stringify({ colourName: 42, garmentDescription: null }) })
  const res = await fetch(`${baseUrl}/api/admin/upload/suggest`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ imageUrl: GOOD_URL }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.colourName, '')
  assert.equal(body.garmentDescription, '')
})

// ---------------------------------------------------------------------------
// 6. Generated card is uploaded under card/
// ---------------------------------------------------------------------------

test('generate-card: the generated image is uploaded under card/ with provenance ai-generated', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  const fakeImageBytes = Buffer.from('fake-generated-png-bytes')
  generateContentBehavior = async () => ({
    candidates: [
      {
        content: {
          parts: [{ inlineData: { data: fakeImageBytes.toString('base64'), mimeType: 'image/png' } }],
        },
      },
    ],
  })

  const res = await fetch(`${baseUrl}/api/admin/upload/generate-card`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ sourceUrl: GOOD_URL }),
  })

  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.provenance, 'ai-generated')
  assert.match(lastUploadedPath, /^card\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/)
  assert.equal(lastUploadedBucket, 'product-images')
  assert.ok(body.url.startsWith('https://project-ref.supabase.co/storage/v1/object/public/product-images/card/'))
  assert.equal(Buffer.compare(Buffer.from(lastUploadedBuffer), fakeImageBytes), 0)
  assert.equal(fetchCalled, true) // the source photo WAS fetched, since sourceUrl passed the bucket check
})

test('generate-card: a response with no image part is treated as a failure, not a crash', async () => {
  process.env.GEMINI_API_KEY = 'fake-key'
  generateContentBehavior = async () => ({ candidates: [{ content: { parts: [{ text: 'no image here' }] } }] })

  const res = await fetch(`${baseUrl}/api/admin/upload/generate-card`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ sourceUrl: GOOD_URL }),
  })

  assert.equal(res.status, 500)
})
