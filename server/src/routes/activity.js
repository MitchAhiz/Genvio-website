const { Router } = require('express')
const { listActivity } = require('../services/activityService')
const { requireAdminAuth } = require('../middleware/auth')

const router = Router()

router.get('/activity', requireAdminAuth, async (req, res, next) => {
  try {
    const { page, search } = req.query
    res.json(await listActivity({ page, search }))
  } catch (err) {
    next(err)
  }
})

module.exports = router
