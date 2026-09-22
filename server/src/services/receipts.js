const crypto = require('crypto')
const prisma = require('../db')
const { uploadReceiptFile, deleteReceiptFile, getSignedUrl } = require('./storage')
const {
  reserveStockForOrder,
  releaseStockForOrder,
  deductStockForOrder,
  reservationHours,
  releaseExpiredReservations,
} = require('./reservations')

// Orders a receipt can be uploaded to. Not confirmed/processing/shipped/
// delivered — those are locked (spec: "can't upload a receipt to a
// confirmed order"). pending_payment, pending_verification (another attempt
// while under review), rejected, and expired (a late receipt should still
// be accepted and reopen verification) are all fine.
const UPLOADABLE_STATUSES = ['pending_payment', 'pending_verification', 'rejected', 'expired']

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

// GV-4821_AdaOkafor_receipt_20260922T1514.pdf
function buildStoredFilename(order, customerName, ext) {
  const namePart = customerName.replace(/[^a-zA-Z]/g, '') || 'Customer'
  const now = new Date()
  const stamp =
    now.toISOString().slice(0, 10).replace(/-/g, '') +
    'T' +
    now.toISOString().slice(11, 16).replace(':', '')
  return `${order.reference}_${namePart}_receipt_${stamp}.${ext}`
}

async function assertNotDuplicateElsewhere(orderId, fileHash) {
  const existing = await prisma.paymentReceipt.findFirst({
    where: { fileHash, orderId: { not: orderId } },
    select: { id: true },
  })
  return Boolean(existing)
}

// Creates a receipt for an order: uploads the file, reserves stock
// (best-effort — an unavailable item does not block the upload, see
// AdminOrders' live availability check instead of a stored flag), and moves
// the order into pending_verification. Runs the DB side in a Serializable
// transaction so two near-simultaneous uploads for the same size can't both
// believe they reserved the last unit.
async function createReceipt({ orderId, orderToken, buffer, mime, ext, declaredFilename }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { name: true } } },
  })
  if (!order) return { ok: false, status: 404, error: 'Order not found' }
  if (order.orderToken !== orderToken) return { ok: false, status: 403, error: 'This request could not be verified against your order.' }
  if (!UPLOADABLE_STATUSES.includes(order.status)) {
    return { ok: false, status: 409, error: 'This order is no longer open for a receipt upload.' }
  }

  const fileHash = sha256(buffer)
  const storedFilename = buildStoredFilename(order, order.customer.name, ext)
  const storageKey = `${order.reference}/${storedFilename}`

  // Correctness must not depend on the periodic sweep in index.js having
  // fired recently — free up anything stale before checking availability.
  await releaseExpiredReservations()

  await uploadReceiptFile(storageKey, buffer, mime)

  try {
    const isDuplicate = await assertNotDuplicateElsewhere(order.id, fileHash)
    const hours = await reservationHours()

    const result = await prisma.$transaction(
      async (tx) => {
        const fresh = await tx.order.findUnique({ where: { id: order.id } })
        if (!fresh || !UPLOADABLE_STATUSES.includes(fresh.status)) {
          throw Object.assign(new Error('Order is no longer open for a receipt upload.'), { code: 'LOCKED' })
        }

        const receipt = await tx.paymentReceipt.create({
          data: {
            orderId: order.id,
            storageKey,
            fileType: mime,
            fileSize: buffer.length,
            originalFilename: declaredFilename.slice(0, 200),
            storedFilename,
            fileHash,
            isDuplicate,
          },
        })

        const reservation = await reserveStockForOrder(tx, fresh)

        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'pending_verification',
            reservedUntil: new Date(Date.now() + hours * 60 * 60 * 1000),
          },
          include: { customer: { select: { id: true, name: true, phone: true, email: true, isWhatsapp: true } } },
        })

        return { receipt, order: updated, stockAvailable: reservation.ok, unavailable: reservation.unavailable }
      },
      { isolationLevel: 'Serializable' }
    )

    return { ok: true, ...result }
  } catch (err) {
    // The DB side failed after the file was already written — don't leave an
    // orphaned object in the bucket.
    await deleteReceiptFile(storageKey)
    if (err.code === 'LOCKED') return { ok: false, status: 409, error: err.message }
    throw err
  }
}

async function listReceiptsForOrder(orderId) {
  return prisma.paymentReceipt.findMany({ where: { orderId }, orderBy: { uploadedAt: 'desc' } })
}

// Live stock-availability check for display in admin — deliberately not
// stored on the order (stock can free up again before review), so this is
// computed fresh every time the order list is read.
async function stockWarningsForOrder(order) {
  const warnings = []
  for (const item of order.items) {
    const variant = await prisma.productVariant.findFirst({
      where: { productId: item.productId, colour: item.colour },
      select: { sizes: { where: { size: item.size }, select: { quantity: true, reservedQuantity: true } } },
    })
    const size = variant?.sizes?.[0]
    if (!size) {
      warnings.push({ ...item, reason: 'no_longer_exists' })
      continue
    }
    // Reserved-for-this-order stock still counts as "available to this
    // order" from the customer's perspective, but a simple, honest signal
    // for admin is: is there currently enough *unreserved* stock system-wide
    // to cover this line, ignoring who holds what.
    if (size.quantity < item.qty) {
      warnings.push({ ...item, reason: 'insufficient_stock', available: size.quantity })
    }
  }
  return warnings
}

async function confirmOrder(orderId, adminEmail) {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } })
      if (!order) return { ok: false, status: 404, error: 'Order not found' }
      // Idempotent: a second click just returns the already-confirmed order.
      if (order.status === 'confirmed') {
        const full = await tx.order.findUnique({ where: { id: orderId }, include: { customer: true, receipts: true } })
        return { ok: true, order: full, alreadyDone: true }
      }
      if (order.status !== 'pending_verification' && order.status !== 'rejected' && order.status !== 'expired') {
        return { ok: false, status: 409, error: `Order is ${order.status}, not awaiting verification.` }
      }

      await deductStockForOrder(tx, order)

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'confirmed' },
        include: { customer: true, receipts: { orderBy: { uploadedAt: 'desc' } } },
      })

      const latestReceipt = updated.receipts[0]
      if (latestReceipt) {
        await tx.paymentReceipt.update({
          where: { id: latestReceipt.id },
          data: { reviewedBy: adminEmail, reviewedAt: new Date() },
        })
      }

      return { ok: true, order: updated, alreadyDone: false }
    },
    { isolationLevel: 'Serializable' }
  )
}

async function rejectOrder(orderId, adminEmail, reason) {
  return prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } })
      if (!order) return { ok: false, status: 404, error: 'Order not found' }
      if (order.status === 'rejected') {
        const full = await tx.order.findUnique({ where: { id: orderId }, include: { customer: true, receipts: true } })
        return { ok: true, order: full, alreadyDone: true }
      }
      if (order.status !== 'pending_verification') {
        return { ok: false, status: 409, error: `Order is ${order.status}, not awaiting verification.` }
      }

      await releaseStockForOrder(tx, order)

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'rejected' },
        include: { customer: true, receipts: { orderBy: { uploadedAt: 'desc' } } },
      })

      const latestReceipt = updated.receipts[0]
      if (latestReceipt) {
        await tx.paymentReceipt.update({
          where: { id: latestReceipt.id },
          data: { reviewedBy: adminEmail, reviewedAt: new Date(), rejectionReason: reason },
        })
      }

      return { ok: true, order: updated, alreadyDone: false }
    },
    { isolationLevel: 'Serializable' }
  )
}

module.exports = {
  UPLOADABLE_STATUSES,
  buildStoredFilename, // exported for testability — pure string formatting, no I/O
  createReceipt,
  listReceiptsForOrder,
  stockWarningsForOrder,
  confirmOrder,
  rejectOrder,
  getSignedUrl,
}
