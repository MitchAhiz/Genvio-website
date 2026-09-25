const { Router } = require('express')
const {
  getSizeRange,
  listSizeRanges,
  upsertSizeRange,
  deleteSizeRange,
} = require('../services/sizeRangeService')
const { requireAdminAuth } = require('../middleware/auth')
const { requireCsrf } = require('../middleware/csrf')
const { rateLimit } = require('../middleware/rateLimit')
const prisma = require('../db')

const router = Router()

const writeLimit = rateLimit({
  name: 'size-ranges-write',
  limit: 30, // config writes are rarer than product/subcategory writes — a tighter cap
  windowMs: 10 * 60 * 1000,
  key: (req) => req.adminEmail,
})

const MAX_SIZES = 30
const MAX_LABEL_LEN = 20

function validateSizes(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SIZES) return null
  const cleaned = []
  const seen = new Set()
  for (const raw of value) {
    if (typeof raw !== 'string') return null
    const label = raw.trim()
    if (!label || label.length > MAX_LABEL_LEN) return null
    if (seen.has(label)) return null // no duplicate size labels in one range
    seen.add(label)
    cleaned.push(label)
  }
  return cleaned
}

async function validScope(categoryId, subcategoryId) {
  const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } })
  if (!subcategory || subcategory.categoryId !== categoryId) return false
  return true
}

// GET /api/admin/size-ranges?category=<categoryId>&subcategory=<subcategoryId>
// Matches product-upload-project.md §8's query-param shape. Read by both the
// upload form (Step 4 grid) and the admin size-range config screen.
router.get('/admin/size-ranges', requireAdminAuth, async (req, res, next) => {
  try {
    const { category: categoryId, subcategory: subcategoryId } = req.query
    if (categoryId && subcategoryId) {
      if (!(await validScope(categoryId, subcategoryId))) {
        return res.status(400).json({ error: 'subcategory does not belong to category' })
      }
      const range = await getSizeRange({ categoryId, subcategoryId })
      return res.json(range ? { categoryId, subcategoryId, sizes: range.sizes } : null)
    }
    const ranges = await listSizeRanges({ categoryId })
    res.json(ranges.map((r) => ({ categoryId: r.categoryId, subcategoryId: r.subcategoryId, sizes: r.sizes })))
  } catch (err) {
    next(err)
  }
})

router.put('/admin/size-ranges', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const { categoryId, subcategoryId, sizes } = req.body || {}
    if (!categoryId || !subcategoryId) {
      return res.status(400).json({ error: 'categoryId and subcategoryId are required' })
    }
    if (!(await validScope(categoryId, subcategoryId))) {
      return res.status(400).json({ error: 'subcategory does not belong to category' })
    }
    const cleanSizes = validateSizes(sizes)
    if (!cleanSizes) {
      return res.status(400).json({ error: `sizes must be 1-${MAX_SIZES} unique, non-empty labels up to ${MAX_LABEL_LEN} characters each` })
    }
    const range = await upsertSizeRange({ categoryId, subcategoryId, sizes: cleanSizes, adminEmail: req.adminEmail })
    res.json({ categoryId: range.categoryId, subcategoryId: range.subcategoryId, sizes: range.sizes })
  } catch (err) {
    next(err)
  }
})

router.delete('/admin/size-ranges', requireAdminAuth, requireCsrf, writeLimit, async (req, res, next) => {
  try {
    const { categoryId, subcategoryId } = req.body || {}
    if (!categoryId || !subcategoryId) {
      return res.status(400).json({ error: 'categoryId and subcategoryId are required' })
    }
    const result = await deleteSizeRange({ categoryId, subcategoryId })
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
