const { Router } = require('express')
const { requireAdminAuth } = require('../middleware/auth')
const { requireCsrf } = require('../middleware/csrf')
const { rateLimit } = require('../middleware/rateLimit')
const { createUploadProduct, restockVariant } = require('../services/uploadProducts')
const { signProductImageUpload } = require('../services/productImageStorage')

const router = Router()

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
