const { Router } = require('express')
const {
  getSubcategories,
  getProductCount,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
} = require('../services/subcategoryService')

const { requireAdminAuth } = require('../middleware/auth')
const { SECTIONS, isValidSection } = require('../constants')

const router = Router()

function sectionError(res) {
  return res.status(400).json({ error: `section must be one of: ${SECTIONS.join(', ')}` })
}

router.get('/subcategories', requireAdminAuth, async (req, res, next) => {
  try {
    const { section } = req.query
    if (section && !isValidSection(section)) return sectionError(res)
    const subcategories = await getSubcategories({ section })
    res.json(subcategories)
  } catch (err) {
    next(err)
  }
})

router.get('/subcategories/:id/product-count', requireAdminAuth, async (req, res, next) => {
  try {
    const count = await getProductCount(req.params.id)
    res.json({ count })
  } catch (err) {
    next(err)
  }
})

router.post('/subcategories', requireAdminAuth, async (req, res, next) => {
  try {
    const { name, section } = req.body
    if (!name || typeof name !== 'string' || !name.trim() || name.length > 100) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string up to 100 characters' })
    }
    if (!isValidSection(section)) return sectionError(res)
    const subcategory = await createSubcategory({ name: name.trim(), section })
    res.status(201).json(subcategory)
  } catch (err) {
    next(err)
  }
})

router.patch('/subcategories/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string' || !name.trim() || name.length > 100) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string up to 100 characters' })
    }
    const result = await renameSubcategory(req.params.id, name.trim())
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json(result.subcategory)
  } catch (err) {
    next(err)
  }
})

router.delete('/subcategories/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { action, reassignTo } = req.body || {}
    const result = await deleteSubcategory(req.params.id, { action, reassignTo })
    if (!result.ok) {
      const status = result.error.includes('not found') ? 404 : 400
      return res.status(status).json({ error: result.error })
    }
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
