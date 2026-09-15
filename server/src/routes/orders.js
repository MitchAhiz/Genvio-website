const { Router } = require('express')
const {
  ORDER_STATUSES,
  createOrder,
  listOrders,
  updateOrderStatus,
  updateOrderDelivery,
} = require('../services/orders')
const { requireAdminAuth } = require('../middleware/auth')
const { rateLimit } = require('../middleware/rateLimit')
const { cleanText, normalizePhone, cleanAddress, cleanItems } = require('../utils/sanitize')

const router = Router()

function publicOrder(order) {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    paymentMethod: order.paymentMethod,
    total: order.total,
    items: order.items,
    address: order.address,
    customer: { name: order.customer.name, phone: order.customer.phone },
    // 'offer' | 'saved' | 'opted_out' — drives the post-order save prompt.
    // Present only on the response that created the order.
    ...(order.saveState ? { saveState: order.saveState } : {}),
    createdAt: order.createdAt,
  }
}

// Public: place an order. Creates or refreshes the customer record so the
// admin can group orders by customer; that record is never read back out.
router.post('/orders', rateLimit({ name: 'order', limit: 5, windowMs: 10 * 60 * 1000 }), async (req, res, next) => {
  try {
    const body = req.body || {}
    const phone = normalizePhone(String(body.phone || ''))
    if (!phone) return res.status(400).json({ error: 'Enter a valid Nigerian mobile number' })

    const name = cleanText(body.name, 80)
    if (name.length < 2) return res.status(400).json({ error: 'Enter your full name' })

    const address = cleanAddress(body.address)
    if (!address) return res.status(400).json({ error: 'Enter a street address, city and state' })

    const items = cleanItems(body.items)
    if (!items) return res.status(400).json({ error: 'Your bag is empty or contains an invalid item' })

    const total = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
    if (Number(body.total) !== total) {
      return res.status(400).json({ error: 'Order total doesn’t match the items. Refresh and try again.' })
    }

    const order = await createOrder({ phone, name, address, items, total })
    res.status(201).json(publicOrder(order))
  } catch (err) {
    next(err)
  }
})

// Public: correct the delivery details — what the courier sees — right after
// ordering. The order reference is the proof the caller placed it.
router.patch(
  '/orders/:id/delivery',
  rateLimit({ name: 'delivery', limit: 10, windowMs: 10 * 60 * 1000 }),
  async (req, res, next) => {
    try {
      const reference = cleanText(req.body?.reference, 40)
      const name = cleanText(req.body?.name, 80)
      const address = cleanAddress(req.body?.address)
      if (!reference) return res.status(400).json({ error: 'Order reference is required' })
      if (name.length < 2) return res.status(400).json({ error: 'Enter the recipient’s full name' })
      if (!address) return res.status(400).json({ error: 'Enter a street address, city and state' })
      const result = await updateOrderDelivery(req.params.id, reference, { name, address })
      if (!result.ok) return res.status(result.error === 'Order not found' ? 404 : 409).json({ error: result.error })
      res.json(publicOrder(result.order))
    } catch (err) {
      next(err)
    }
  }
)

// Admin: every order with customer details.
router.get('/orders', requireAdminAuth, async (_req, res, next) => {
  try {
    res.json(await listOrders())
  } catch (err) {
    next(err)
  }
})

// Admin: move an order along.
router.patch('/orders/:id', requireAdminAuth, async (req, res, next) => {
  try {
    const { status } = req.body || {}
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` })
    }
    const result = await updateOrderStatus(req.params.id, status)
    if (!result.ok) return res.status(404).json({ error: result.error })
    res.json(result.order)
  } catch (err) {
    next(err)
  }
})

module.exports = router
