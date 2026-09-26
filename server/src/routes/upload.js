const { Router } = require('express')
const { requireAdminAuth } = require('../middleware/auth')
const { requireCsrf } = require('../middleware/csrf')
const { rateLimit } = require('../middleware/rateLimit')
const { createUploadProduct, restockVariant } = require('../services/uploadProducts')

const router = Router()

// Same 60/10min-per-staff-account pattern as products.js's writeLimit —
// this is a comparable admin write surface.
const writeLimit = rateLimit({
  name: 'upload-write',
  limit: 60,
  windowMs: 10 * 60 * 1000,
  key: (req) => req.adminEmail,
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
