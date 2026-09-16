const { Router } = require('express')
const {
  getRevenue,
  getOrdersBySection,
  getStatusBreakdown,
  getBestSellers,
} = require('../services/analyticsService')
const { requireAdminAuth } = require('../middleware/auth')

const router = Router()

router.get('/analytics/revenue', requireAdminAuth, async (req, res, next) => {
  try {
    res.json(await getRevenue(req.query.period))
  } catch (err) {
    next(err)
  }
})

router.get('/analytics/orders-by-section', requireAdminAuth, async (req, res, next) => {
  try {
    res.json(await getOrdersBySection(req.query.period))
  } catch (err) {
    next(err)
  }
})

router.get('/analytics/status-breakdown', requireAdminAuth, async (_req, res, next) => {
  try {
    res.json(await getStatusBreakdown())
  } catch (err) {
    next(err)
  }
})

router.get('/analytics/best-sellers', requireAdminAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10)
    res.json(await getBestSellers({ sort: req.query.sort, limit }))
  } catch (err) {
    next(err)
  }
})

module.exports = router
