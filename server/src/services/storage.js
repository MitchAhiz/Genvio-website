// Supabase Storage client for payment receipts. Uses the service-role key —
// server-side only, never exposed to the frontend (see AGENT_RULES.md /
// CLAUDE.md: SUPABASE_SERVICE_ROLE_KEY must never reach a VITE_ env var).
const { createClient } = require('@supabase/supabase-js')

const BUCKET = process.env.SUPABASE_RECEIPTS_BUCKET

let client = null
function supabase() {
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured')
    }
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  }
  return client
}

// Receipts contain bank details — the bucket must be private. This only
// checks/creates; it never flips an existing bucket's visibility, so it
// can't silently make a receipts bucket public.
async function ensureBucketExists() {
  if (!BUCKET) throw new Error('SUPABASE_RECEIPTS_BUCKET is not configured')
  const { data: existing, error: getErr } = await supabase().storage.getBucket(BUCKET)
  if (existing) return { created: false, public: existing.public }
  // getBucket errors on "not found" the same way it would on a real failure;
  // only proceed to create if the message says not found.
  if (getErr && !/not.*found/i.test(getErr.message || '')) throw new Error(`Storage check failed: ${getErr.message}`)

  const { error: createErr } = await supabase().storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: '20MB',
    // Defense in depth alongside the app-level magic-byte check in
    // fileValidation.js — Storage itself now also refuses anything else.
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
  })
  if (createErr) throw new Error(`Bucket creation failed: ${createErr.message}`)
  return { created: true, public: false }
}

async function uploadReceiptFile(storageKey, buffer, contentType) {
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(storageKey, buffer, { contentType, upsert: false })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
}

async function deleteReceiptFile(storageKey) {
  // Best-effort cleanup (e.g. the DB write after a successful upload fails).
  // Never lets a cleanup failure surface as the user-facing error.
  try {
    await supabase().storage.from(BUCKET).remove([storageKey])
  } catch (err) {
    console.error('[storage] cleanup failed for', storageKey, err)
  }
}

async function getSignedUrl(storageKey, expiresInSeconds = 300) {
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUrl(storageKey, expiresInSeconds)
  if (error) throw new Error(`Signed URL failed: ${error.message}`)
  return data.signedUrl
}

module.exports = { ensureBucketExists, uploadReceiptFile, deleteReceiptFile, getSignedUrl }
