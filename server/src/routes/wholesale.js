const { Router } = require('express')
const {
  getWholesaleImages,
  getWholesaleCategories,
  addWholesaleImage,
  updateWholesaleImage,
  deleteWholesaleImage,
  reorderWholesaleImages,
  renameWholesaleCategory,
  deleteWholesaleCategory,
} = require('../services/wholesale')
const { requireAdminAuth } = require('../middleware/auth')
const { requireCsrf } = require('../middleware/csrf')

const router = Router()

// Public: the lookbook is browsable by anyone with the link.
router.get('/wholesale', async (req, res, next) => {
  try {
    const { category } = req.query
    const images = await getWholesaleImages({ category })
    res.json(images)
  } catch (err) {
    next(err)
  }
})

router.get('/wholesale/categories', async (_req, res, next) => {
  try {
    res.json(await getWholesaleCategories())
  } catch (err) {
    next(err)
  }
})

// Admin-only writes.
router.post('/wholesale', requireAdminAuth, requireCsrf, async (req, res, next) => {
  try {
    const { url, caption, category } = req.body
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
      return res.status(400).json({ error: 'Provide an image URL starting with http:// or https://' })
    }
    const image = await addWholesaleImage({ url: url.trim(), caption, category })
    res.status(201).json(image)
  } catch (err) {
    next(err)
  }
})

router.delete('/wholesale/:id', requireAdminAuth, requireCsrf, async (req, res, next) => {
  try {
    const result = await deleteWholesaleImage(req.params.id)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

// Registered before /wholesale/:id so "reorder" isn't captured as an id.
router.patch('/wholesale/reorder', requireAdminAuth, requireCsrf, async (req, res, next) => {
  try {
    const { orderedIds } = req.body
    const result = await reorderWholesaleImages(orderedIds)
    if (!result.ok) return res.status(400).json({ error: result.error })
    res.json({ reordered: true })
  } catch (err) {
    next(err)
  }
})

router.patch('/wholesale/:id', requireAdminAuth, requireCsrf, async (req, res, next) => {
  try {
    const { url, caption, category } = req.body
    if (url !== undefined && (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim()))) {
      return res.status(400).json({ error: 'Image URL must start with http:// or https://' })
    }
    const result = await updateWholesaleImage(req.params.id, {
      url: url !== undefined ? url.trim() : undefined,
      caption,
      category,
    })
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json(result.image)
  } catch (err) {
    next(err)
  }
})

router.patch('/wholesale/categories/:name', requireAdminAuth, requireCsrf, async (req, res, next) => {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' })
    }
    const result = await renameWholesaleCategory(req.params.name, name)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ renamed: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/wholesale/categories/:name', requireAdminAuth, requireCsrf, async (req, res, next) => {
  try {
    const { action, reassignTo } = req.body || {}
    const result = await deleteWholesaleCategory(req.params.name, { action, reassignTo })
    if (!result.ok) {
      const status = result.error === 'Category not found' ? 404 : 400
      return res.status(status).json({ error: result.error })
    }
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
