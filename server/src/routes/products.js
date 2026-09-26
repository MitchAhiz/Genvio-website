const { Router } = require('express')
const {
  getProducts,
  getProductBySlug,
  getProductById,
  searchUploadProducts,
  getCategories,
  getBrands,
  getInventory,
  createProduct,
  updateProduct,
  addImages,
  publishProduct,
  unpublishProduct,
  bulkUpdate,
  reorderImages,
  deleteProduct,
  deleteImage,
  deleteVariant,
  deleteVariantSize,
} = require('../services/products')

const { requireAdminAuth } = require('../middleware/auth')
const { requireCsrf } = require('../middleware/csrf')
const { rateLimit } = require('../middleware/rateLimit')
const { validateSession } = require('../services/auth')
const { SECTIONS, isValidSection } = require('../constants')

const router = Router()

// Same 60/10min-per-staff-account pattern as categories.js/subcategories.js
// — this is the highest-traffic admin write surface (product CRUD, bulk
// actions, image management), so it gets the same cap as those rather than
// sizeRanges.js's tighter 30/10min (that one's specifically for rarer
// config-style writes).
const writeLimit = rateLimit({
  name: 'products-write',
  limit: 60,
  windowMs: 10 * 60 * 1000,
  key: (req) => req.adminEmail,
})

// Keystroke-driven usage (product-upload-project.md §9 — search-as-you-type
// hits the DB directly) needs a much looser cap than a write action, so this
// is scoped separately from writeLimit rather than reusing its 60/10min.
const uploadSearchLimit = rateLimit({
  name: 'products-upload-search',
  limit: 100,
  windowMs: 60 * 1000,
  key: (req) => req.adminEmail,
})

function sectionError(res) {
  return res.status(400).json({ error: `section must be one of: ${SECTIONS.join(', ')}` })
}

// --- Read endpoints ---

// Staff-only search used before the upload flow creates or restocks a product.
// Includes draft products so an unfinished product cannot be duplicated.
router.get('/admin/upload/products', requireAdminAuth, uploadSearchLimit, async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (query.length > 100) return res.status(400).json({ error: 'Search text must be 100 characters or fewer' })
    res.set('Cache-Control', 'no-store')
    res.json(await searchUploadProducts(query))
  } catch (err) {
    next(err)
  }
})

// GET /api/products?section=women&category=Tops
// `all=1` includes drafts, but only for a signed-in admin.
router.get('/products', async (req, res, next) => {
  try {
    const { category, section, all } = req.query
    if (section && !isValidSection(section)) return sectionError(res)
    const isAdmin = Boolean(validateSession(req.cookies?.admin_session))
    const products = await getProducts({
      category,
      section,
      includeDrafts: all === '1' && isAdmin,
    })
    res.json(products)
  } catch (err) {
    next(err)
  }
})

router.get('/products/:slug', async (req, res, next) => {
  try {
    const product = await getProductBySlug(req.params.slug)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    next(err)
  }
})

router.get('/categories', async (req, res, next) => {
  try {
    const { section } = req.query
    if (section && !isValidSection(section)) return sectionError(res)
    const categories = await getCategories({ section })
    res.json(categories)
  } catch (err) {
    next(err)
  }
})

// Admin: distinct brand names for the Footer settings "Top Brands" picker.
router.get('/admin/brands', requireAdminAuth, async (_req, res, next) => {
  try {
    const brands = await getBrands()
    res.json(brands)
  } catch (err) {
    next(err)
  }
})

router.get('/inventory/:productId', async (req, res, next) => {
  try {
    const inventory = await getInventory(req.params.productId)
    res.json(inventory)
  } catch (err) {
    next(err)
  }
})

// --- Write endpoints (require admin auth) ---

router.post('/products', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const { slug, name, brand, categoryId, price, section } = req.body
    if (!slug || !name || !brand || !categoryId || price == null) {
      return res.status(400).json({ error: 'Missing required fields: slug, name, brand, categoryId, price' })
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' })
    }
    if (section !== undefined && !isValidSection(section)) return sectionError(res)
    const result = await createProduct({ slug, name, brand, categoryId, price, section })
    if (!result.ok) return res.status(400).json({ error: result.error })
    res.status(201).json(result.product)
  } catch (err) {
    next(err)
  }
})

router.patch('/products/:id', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const existing = await getProductById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    const { name, brand, price, section, categoryId, status, variants } = req.body
    if (price !== undefined && (typeof price !== 'number' || price <= 0)) {
      return res.status(400).json({ error: 'Price must be a positive number' })
    }
    if (section !== undefined && !isValidSection(section)) return sectionError(res)
    if (status !== undefined && status !== 'draft' && status !== 'published') {
      return res.status(400).json({ error: 'status must be "draft" or "published"' })
    }
    const result = await updateProduct(req.params.id, { name, brand, price, section, categoryId, status, variants })
    if (!result.ok) return res.status(400).json({ error: result.error })
    res.json(result.product)
  } catch (err) {
    next(err)
  }
})

router.post('/products/bulk', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const { ids, action } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }
    if (!['publish', 'unpublish', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action must be "publish", "unpublish", or "delete"' })
    }
    const results = await bulkUpdate(ids, action)
    res.json({ results })
  } catch (err) {
    next(err)
  }
})

router.post('/products/:id/unpublish', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const result = await unpublishProduct(req.params.id)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json(result.product)
  } catch (err) {
    next(err)
  }
})

router.patch('/products/:id/images/reorder', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const existing = await getProductById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })
    const { order } = req.body
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order must be a non-empty array of image ids' })
    }
    const images = await reorderImages(req.params.id, order)
    res.json(images)
  } catch (err) {
    next(err)
  }
})

router.post('/products/:id/images', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const existing = await getProductById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    const { urls } = req.body
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Provide { urls: ["..."] } with at least one URL' })
    }
    // Same http(s)-only check as wholesale.js's image URLs — closes the gap
    // before the planned Gemini pipeline starts feeding URLs into this same
    // code path.
    if (!urls.every((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))) {
      return res.status(400).json({ error: 'Each URL must start with http:// or https://' })
    }
    const images = await addImages(req.params.id, urls)
    res.status(201).json(images)
  } catch (err) {
    next(err)
  }
})

router.post('/products/:id/publish', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const result = await publishProduct(req.params.id)
    if (!result.ok) {
      const status = result.error.includes('not found') ? 404 : 400
      return res.status(status).json({ error: result.error })
    }
    res.json(result.product)
  } catch (err) {
    next(err)
  }
})

router.delete('/products/:id', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const result = await deleteProduct(req.params.id)
    if (!result.ok) {
      const status = result.error.includes('not found') ? 404 : 400
      return res.status(status).json({ error: result.error })
    }
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/images/:id', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const result = await deleteImage(req.params.id)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/variants/:id', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const result = await deleteVariant(req.params.id)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/variants/:variantId/sizes/:sizeId', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const result = await deleteVariantSize(req.params.sizeId)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
