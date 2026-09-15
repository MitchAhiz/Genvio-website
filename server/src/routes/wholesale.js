const { Router } = require('express')
const {
  getWholesaleImages,
  getWholesaleCategories,
  addWholesaleImage,
  deleteWholesaleImage,
} = require('../services/wholesale')
const { requireAdminAuth } = require('../middleware/auth')

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
router.post('/wholesale', requireAdminAuth, async (req, res, next) => {
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

router.delete('/wholesale/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await deleteWholesaleImage(req.params.id)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
