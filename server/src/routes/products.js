const { Router } = require('express')
const {
  getProducts,
  getProductBySlug,
  getProductById,
  getCategories,
  getInventory,
  createProduct,
  updateProduct,
  addImages,
  publishProduct,
  deleteProduct,
  deleteImage,
  deleteVariant,
  deleteVariantSize,
} = require('../services/products')

const { requireAdminAuth } = require('../middleware/auth')

const router = Router()

// --- Read endpoints ---

router.get('/products', async (req, res, next) => {
  try {
    const { category } = req.query
    const products = await getProducts({ category })
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

router.get('/categories', async (_req, res, next) => {
  try {
    const categories = await getCategories()
    res.json(categories)
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
    const { slug, name, brand, category, price } = req.body
    if (!slug || !name || !brand || !category || price == null) {
      return res.status(400).json({ error: 'Missing required fields: slug, name, brand, category, price' })
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' })
    }
    const product = await createProduct({ slug, name, brand, category, price })
    res.status(201).json(product)
  } catch (err) {
    next(err)
  }
})

router.patch('/products/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const existing = await getProductById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    const { name, brand, category, price, variants } = req.body
    if (price !== undefined && (typeof price !== 'number' || price <= 0)) {
      return res.status(400).json({ error: 'Price must be a positive number' })
    }
    const product = await updateProduct(req.params.id, { name, brand, category, price, variants })
    res.json(product)
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
