const { Router } = require('express')
const {
  getSubcategories,
  getProductCount,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
} = require('../services/subcategoryService')

const { requireAdminAuth } = require('../middleware/auth')
const { requireCsrf } = require('../middleware/csrf')
const { rateLimit } = require('../middleware/rateLimit')
const { cleanText } = require('../utils/sanitize')
const prisma = require('../db')

const router = Router()

// Per-staff-account write limiter. 60/10min is generous for interactive
// admin use (well above any plausible legitimate burst while setting up a
// new section's taxonomy) but caps what a compromised session or a bug in
// the upload form's "New subcategory…" inline-create path (product-upload-
// project.md §12 build note) could do.
const writeLimit = rateLimit({
  name: 'subcategories-write',
  limit: 60,
  windowMs: 10 * 60 * 1000,
  key: (req) => req.adminEmail,
})

async function categoryExists(categoryId) {
  return Boolean(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))
}

router.get('/admin/subcategories', requireAdminAuth, async (req, res, next) => {
  try {
    const { categoryId } = req.query
    if (categoryId && !(await categoryExists(categoryId))) {
      return res.status(400).json({ error: 'categoryId is not a valid category' })
    }
    const subcategories = await getSubcategories({ categoryId })
    res.json(subcategories)
  } catch (err) {
    next(err)
  }
})

router.get('/admin/subcategories/:id/product-count', requireAdminAuth, async (req, res, next) => {
  try {
    const count = await getProductCount(req.params.id)
    res.json({ count })
  } catch (err) {
    next(err)
  }
})

router.post('/admin/subcategories', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const { categoryId, name } = req.body
    const cleanName = cleanText(name, 100)
    if (!cleanName) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string up to 100 characters' })
    }
    // Re-validated against the live table, not trusted off the client select
    // (product-upload-project.md §10.4) — a stale or forged categoryId is
    // rejected here rather than producing an orphaned subcategory.
    if (!categoryId || !(await categoryExists(categoryId))) {
      return res.status(400).json({ error: 'categoryId is required and must reference an existing category' })
    }
    const subcategory = await createSubcategory({ categoryId, name: cleanName, createdBy: req.adminEmail })
    res.status(201).json(subcategory)
  } catch (err) {
    // Unique(categoryId, name) violation -> a clear 409, not a raw DB error
    // leaking to the client (product-upload-project.md §10.8).
    if (err.code === 'P2002') return res.status(409).json({ error: 'A subcategory with this name already exists in this category' })
    next(err)
  }
})

router.patch('/admin/subcategories/:id', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const cleanName = cleanText(req.body?.name, 100)
    if (!cleanName) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string up to 100 characters' })
    }
    const result = await renameSubcategory(req.params.id, cleanName)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json(result.subcategory)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A subcategory with this name already exists in this category' })
    next(err)
  }
})

router.delete('/admin/subcategories/:id', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
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
