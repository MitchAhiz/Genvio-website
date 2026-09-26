const { Router } = require('express')
const { randomUUID } = require('crypto')
const { requireAdminAuth } = require('../middleware/auth')
const { requireCsrf } = require('../middleware/csrf')
const { rateLimit } = require('../middleware/rateLimit')
const { createUploadProduct, restockVariant, isSupabaseStorageUrl } = require('../services/uploadProducts')
const { signProductImageUpload, uploadImageBuffer, ALLOWED_CONTENT_TYPES } = require('../services/productImageStorage')
const { generateProductCardImage, suggestColourAndDescription, isQuotaError } = require('../services/gemini')

const router = Router()

const QUOTA_MESSAGE = 'Image generation is temporarily unavailable, try again shortly'

// Every Gemini route follows the same "no key configured" gate (rule 1)
// and the same friendly quota message (rule 4, product-upload-project.md
// §3) — kept as one helper so neither can drift between the two routes.
function requireGeminiConfigured(req, res, next) {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "AI features aren't set up yet" })
  }
  next()
}

async function fetchSourceImage(sourceUrl) {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Could not fetch source image (${response.status})`)
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await response.arrayBuffer())
  return { buffer, contentType }
}

// True only for a URL that's both a valid product-images Storage URL AND
// sits under the card/ folder — i.e. a previously generated/approved
// card, never a raw camera photo. Used to gate the back view: it must
// reference an actual approved front card, not just any bucket URL.
function isUnderCardFolder(url) {
  if (!isSupabaseStorageUrl(url)) return false
  const bucket = process.env.PRODUCT_IMAGES_BUCKET
  const prefix = `/storage/v1/object/public/${bucket}/`
  const pathname = new URL(url).pathname
  return pathname.slice(prefix.length).startsWith('card/')
}

// Model output is untrusted text (rule 6) — trims, collapses whitespace,
// strips control characters and quotes, and caps length. Anything left
// unusable becomes an empty string rather than an error, since these are
// optional suggestions the staff member can always type over.
function sanitizeSuggestion(value, maxLength) {
  if (typeof value !== 'string') return ''
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, '') // control characters
    .replace(/["'`]/g, '') // quotes
    .trim()
    .replace(/\s+/g, ' ')
  return cleaned.slice(0, maxLength)
}

// Same 60/10min-per-staff-account pattern as products.js's writeLimit —
// this is a comparable admin write surface.
const writeLimit = rateLimit({
  name: 'upload-write',
  limit: 60,
  windowMs: 10 * 60 * 1000,
  key: (req) => req.adminEmail,
})

const signLimit = rateLimit({
  name: 'upload-sign',
  limit: 60,
  windowMs: 10 * 60 * 1000,
  key: (req) => req.adminEmail,
})

// §10 item 5: rate-limit the Gemini-calling endpoints per staff account,
// separately from writeLimit — protects the API budget from a bug or
// compromised account burning through it via a retry loop.
const generateCardLimit = rateLimit({
  name: 'upload-generate-card',
  limit: 30,
  windowMs: 10 * 60 * 1000,
  key: (req) => req.adminEmail,
})

const suggestLimit = rateLimit({
  name: 'upload-suggest',
  limit: 30,
  windowMs: 10 * 60 * 1000,
  key: (req) => req.adminEmail,
})

// Issues a short-lived signed upload URL for one image, into
// PRODUCT_IMAGES_BUCKET. The storage path is generated server-side (see
// productImageStorage.js) — never taken from the client — so staff can
// only ever write to a path this server chose.
router.post('/admin/upload/sign', requireAdminAuth, requireCsrf, signLimit, async (req, res, next) => {
  try {
    const { kind, contentType } = req.body || {}
    const result = await signProductImageUpload({ kind, contentType })
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
    const { uploadUrl, token, path, publicUrl } = result
    res.json({ uploadUrl, token, path, publicUrl })
  } catch (err) {
    next(err)
  }
})

// Generates one product-card image (Step 1 Mode A — see
// product-upload-project.md §4/§7). Women's apparel only for now (the
// loaded prompts are women-specific); the products.js write path enforces
// that separately for staff-supplied vs ai-generated images.
//
// view: 'front' → one image (sourceUrl). "Regenerate" is just calling
// this again with the same sourceUrl.
// view: 'back' → REQUIRES frontCardUrl (an already-generated/approved
// front card under card/). Sent as TWO images, in order: IMAGE 1 =
// sourceUrl (the back photo), IMAGE 2 = frontCardUrl — matching how the
// back prompt refers to them. If the front card is regenerated after a
// back card already exists, the back must be regenerated too (the
// frontend's job to prompt for that — this endpoint has no notion of
// "existing back card" to invalidate).
router.post(
  '/admin/upload/generate-card',
  requireAdminAuth,
  requireCsrf,
  generateCardLimit,
  requireGeminiConfigured,
  async (req, res, next) => {
    try {
      const { sourceUrl, view, frontCardUrl } = req.body || {}
      if (view !== 'front' && view !== 'back') {
        return res.status(400).json({ error: 'view must be "front" or "back"' })
      }
      // The server fetches every source image itself — but only ever a
      // URL that already passed the same storage check every other image
      // URL in this app is held to. No arbitrary URL is ever fetched.
      if (!isSupabaseStorageUrl(sourceUrl)) {
        return res.status(400).json({ error: 'sourceUrl must be an image already uploaded to our storage' })
      }
      if (view === 'back' && !isUnderCardFolder(frontCardUrl)) {
        return res.status(400).json({ error: 'Generate and approve the front card first.' })
      }

      const sourcePhoto = await fetchSourceImage(sourceUrl)
      const images = [{ buffer: sourcePhoto.buffer, mimeType: sourcePhoto.contentType }]
      if (view === 'back') {
        const frontCard = await fetchSourceImage(frontCardUrl)
        images.push({ buffer: frontCard.buffer, mimeType: frontCard.contentType })
      }

      const generated = await generateProductCardImage({ view, images })

      const ext = ALLOWED_CONTENT_TYPES[generated.mimeType] || 'png'
      const now = new Date()
      const yyyy = now.getUTCFullYear()
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
      const path = `card/${yyyy}/${mm}/${randomUUID()}.${ext}`

      const url = await uploadImageBuffer(path, generated.data, generated.mimeType)
      res.json({ url, provenance: 'ai-generated' })
    } catch (err) {
      if (isQuotaError(err)) return res.status(429).json({ error: QUOTA_MESSAGE })
      next(err)
    }
  }
)

// Suggests a colour name and a garment-only description (no brand — the
// frontend builds the product name as `${brand} ${garmentDescription}`,
// per product-upload-project.md §3/§4 Step 2). One Gemini call, structured
// JSON output. Never errors on unusable output — these are optional,
// editable suggestions, so an empty string is always a safe fallback.
router.post(
  '/admin/upload/suggest',
  requireAdminAuth,
  requireCsrf,
  suggestLimit,
  requireGeminiConfigured,
  async (req, res, next) => {
    try {
      const { imageUrl } = req.body || {}
      if (!isSupabaseStorageUrl(imageUrl)) {
        return res.status(400).json({ error: 'imageUrl must be an image already uploaded to our storage' })
      }

      const { buffer, contentType } = await fetchSourceImage(imageUrl)
      const suggestion = await suggestColourAndDescription({ imageBuffer: buffer, mimeType: contentType })

      res.json({
        colourName: sanitizeSuggestion(suggestion.colourName, 30),
        garmentDescription: sanitizeSuggestion(suggestion.garmentDescription, 60),
      })
    } catch (err) {
      if (isQuotaError(err)) return res.status(429).json({ error: QUOTA_MESSAGE })
      next(err)
    }
  }
)

// Creates a new product with its first colour(s), or adds new colours to
// an existing product (productId present). See
// product-upload-project.md §4 and server/src/services/uploadProducts.js.
router.post('/admin/upload/products', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const { productId, brand, name, subcategoryId, price, colours } = req.body || {}
    const result = await createUploadProduct({
      productId,
      brand,
      name,
      subcategoryId,
      price,
      colours,
      adminEmail: req.adminEmail,
    })
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
    res.status(201).json(result.product)
  } catch (err) {
    next(err)
  }
})

// The upload flow's side-door restock entry point (§4): units received are
// added to existing stock via an atomic increment, never a read-then-write.
router.post('/admin/upload/restock', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const { variantId, sizes } = req.body || {}
    const result = await restockVariant({ variantId, sizes, adminEmail: req.adminEmail })
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
    res.json({ sizes: result.sizes })
  } catch (err) {
    next(err)
  }
})

module.exports = router
