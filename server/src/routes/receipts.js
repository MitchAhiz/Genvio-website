const { Router } = require('express')
const multer = require('multer')
const prisma = require('../db')
const { requireAdminAuth } = require('../middleware/auth')
const { rateLimit } = require('../middleware/rateLimit')
const { cleanText } = require('../utils/sanitize')
const { validateReceiptFile, MAX_BYTES } = require('../utils/fileValidation')
const { logActivity } = require('../utils/logActivity')
const {
  createReceipt,
  listReceiptsForOrder,
  stockWarningsForOrder,
  confirmOrder,
  rejectOrder,
  getSignedUrl,
} = require('../services/receipts')
const {
  sendReceiptUploadedEmail,
  sendReceiptReceivedEmail,
  sendOrderConfirmedEmail,
  sendOrderRejectedEmail,
} = require('../services/mailer')

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
})

function publicReceipt(r) {
  return {
    id: r.id,
    originalFilename: r.originalFilename,
    fileType: r.fileType,
    fileSize: r.fileSize,
    uploadedAt: r.uploadedAt,
  }
}

function publicOrderWithReceipts(order, receipts) {
  return {
    id: order.id,
    reference: order.reference,
    orderToken: order.orderToken,
    status: order.status,
    total: order.total,
    items: order.items,
    address: order.address,
    customer: { name: order.customer.name, phone: order.customer.phone },
    receipts: receipts.map(publicReceipt),
    createdAt: order.createdAt,
  }
}

// Public: upload a receipt. Token-gated (the order id alone in the URL is
// not proof of ownership — see AGENT_RULES / CLAUDE.md conventions), rate
// limited per order so one customer retrying a flaky upload can't exhaust a
// shared IP bucket, and per IP against sheer abuse.
router.post(
  '/orders/:id/receipts',
  rateLimit({ name: 'receipt-upload-ip', limit: 20, windowMs: 10 * 60 * 1000 }),
  rateLimit({ name: 'receipt-upload-order', limit: 8, windowMs: 10 * 60 * 1000, key: (req) => req.params.id }),
  upload.single('receipt'),
  async (req, res, next) => {
    try {
      const orderToken = cleanText(req.body?.orderToken || req.query?.orderToken, 100)
      if (!orderToken) return res.status(400).json({ error: 'Missing order token' })
      if (!req.file) return res.status(400).json({ error: 'Attach a receipt file' })

      const validation = await validateReceiptFile(req.file.buffer, req.file.originalname)
      if (!validation.ok) return res.status(400).json({ error: validation.error })

      const result = await createReceipt({
        orderId: req.params.id,
        orderToken,
        buffer: req.file.buffer,
        mime: validation.mime,
        ext: validation.ext,
        declaredFilename: req.file.originalname || `receipt.${validation.ext}`,
      })

      if (!result.ok) return res.status(result.status).json({ error: result.error })

      const receipts = await listReceiptsForOrder(result.order.id)
      res.status(201).json(publicOrderWithReceipts(result.order, receipts))

      // Fire-and-forget: a failed alert must never fail the upload itself.
      sendReceiptUploadedEmail(result.order, {
        buffer: req.file.buffer,
        mime: validation.mime,
        filename: result.receipt.storedFilename,
        isDuplicate: result.receipt.isDuplicate,
      }).catch((err) => console.error('[mailer] unexpected error:', err))
      sendReceiptReceivedEmail(result.order).catch((err) => console.error('[mailer] unexpected error:', err))
    } catch (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'This file is too large. Try a screenshot of the receipt instead.' })
      }
      next(err)
    }
  }
)

// Public: reopen the checkout modal on a pending order — used when a
// customer closes the sheet after uploading and comes back later. Gated the
// same way as upload: the token is the proof, not the id in the URL.
router.get(
  '/orders/lookup',
  rateLimit({ name: 'order-lookup', limit: 30, windowMs: 10 * 60 * 1000 }),
  async (req, res, next) => {
    try {
      const id = cleanText(req.query?.id, 40)
      const token = cleanText(req.query?.token, 100)
      if (!id || !token) return res.status(400).json({ error: 'Missing order id or token' })

      const order = await prisma.order.findUnique({ where: { id }, include: { customer: true } })
      if (!order || order.orderToken !== token) return res.status(404).json({ error: 'Order not found' })

      const receipts = await listReceiptsForOrder(order.id)
      res.json(publicOrderWithReceipts(order, receipts))
    } catch (err) {
      next(err)
    }
  }
)

// Admin: a short-lived signed URL to view one receipt file. Never returns
// the storage key itself — the bucket is private.
router.get('/admin/receipts/:id/signed-url', requireAdminAuth, async (req, res, next) => {
  try {
    const receipt = await prisma.paymentReceipt.findUnique({ where: { id: req.params.id } })
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' })
    const url = await getSignedUrl(receipt.storageKey, 300)
    res.json({ url, expiresIn: 300 })
  } catch (err) {
    next(err)
  }
})

// Admin: all receipts + a live stock-availability check for one order —
// used by the review screen (Step 5) alongside the existing GET /api/orders.
router.get('/admin/orders/:id/receipts', requireAdminAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    const [receipts, stockWarnings] = await Promise.all([
      listReceiptsForOrder(order.id),
      stockWarningsForOrder(order),
    ])
    res.json({ receipts, stockWarnings })
  } catch (err) {
    next(err)
  }
})

// Admin: verify the transfer landed in the bank account, then confirm.
// Idempotent — confirming an already-confirmed order just returns it.
router.post('/admin/orders/:id/confirm', requireAdminAuth, async (req, res, next) => {
  try {
    const result = await confirmOrder(req.params.id, req.adminEmail)
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    if (!result.alreadyDone) {
      await logActivity('order.confirmed', 'order', req.params.id, {})
      sendOrderConfirmedEmail(result.order).catch((err) => console.error('[mailer] unexpected error:', err))
    }
    res.json(result.order)
  } catch (err) {
    next(err)
  }
})

// Admin: reject with a reason. Releases the reservation; a new upload on
// this order (see UPLOADABLE_STATUSES) re-attempts it.
router.post('/admin/orders/:id/reject', requireAdminAuth, async (req, res, next) => {
  try {
    const reason = cleanText(req.body?.reason, 500)
    if (!reason) return res.status(400).json({ error: 'A rejection reason is required' })

    const result = await rejectOrder(req.params.id, req.adminEmail, reason)
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    if (!result.alreadyDone) {
      await logActivity('order.rejected', 'order', req.params.id, { reason })
      sendOrderRejectedEmail(result.order, reason).catch((err) => console.error('[mailer] unexpected error:', err))
    }
    res.json(result.order)
  } catch (err) {
    next(err)
  }
})

module.exports = router
