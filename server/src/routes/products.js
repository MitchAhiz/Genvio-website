const { Router } = require('express')
const {
  getProducts,
  getProductBySlug,
  getProductById,
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
const { validateSession } = require('../services/auth')
const { SECTIONS, isValidSection } = require('../constants')

const router = Router()

function sectionError(res) {
  return res.status(400).json({ error: `section must be one of: ${SECTIONS.join(', ')}` })
}

// --- Read endpoints ---

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

router.post('/products', requireAdminAuth, async (req, res, next) => {
  try {
    const { slug, name, brand, categoryId, price, section } = req.body
    if (!slug || !name || !brand || !categoryId || price == null) {
      return res.status(400).json({ error: 'Missing required fields: slug, name, brand, categoryId, price' })
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' })
    }
    if (section !== undefined && !isValidSection(section)) return sectionError(res)
    const product = await createProduct({ slug, name, brand, categoryId, price, section })
    res.status(201).json(product)
  } catch (err) {
    next(err)
  }
})

router.patch('/products/:id', requireAdminAuth, async (req, res, next) => {
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

router.post('/products/bulk', requireAdminAuth, async (req, res, next) => {
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

router.post('/products/:id/unpublish', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await unpublishProduct(req.params.id)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json(result.product)
  } catch (err) {
    next(err)
  }
})

router.patch('/products/:id/images/reorder', requireAdminAuth, async (req, res, next) => {
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

router.post('/products/:id/images', requireAdminAuth, async (req, res, next) => {
  try {
    const existing = await getProductById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    const { urls } = req.body
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Provide { urls: ["..."] } with at least one URL' })
    }
    const images = await addImages(req.params.id, urls)
    res.status(201).json(images)
  } catch (err) {
    next(err)
  }
})

router.post('/products/:id/publish', requireAdminAuth, async (req, res, next) => {
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

router.delete('/products/:id', requireAdminAuth, async (req, res, next) => {
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

router.delete('/images/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await deleteImage(req.params.id)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/variants/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await deleteVariant(req.params.id)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/variants/:variantId/sizes/:sizeId', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await deleteVariantSize(req.params.sizeId)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
