// Stock reservation lifecycle for pending_verification orders.
//
// Available stock is always `quantity - reservedQuantity`. Reservations are
// not tracked in a separate table: an order's own `items` JSON (immutable
// once the order is created) is replayed to find exactly which VariantSize
// rows it holds a reservation against, and by how much. That keeps this
// change schema-free — see AGENT_RULES.md before adding a table for this.
const prisma = require('../db')
const { getConfig } = require('./configService')

const DEFAULT_RESERVATION_HOURS = 48
const DEFAULT_PENDING_PAYMENT_HOURS = 24

async function reservationHours() {
  const hours = Number(await getConfig('reservation_hours'))
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_RESERVATION_HOURS
}

async function pendingPaymentHours() {
  const hours = Number(await getConfig('pending_payment_expiry_hours'))
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_PENDING_PAYMENT_HOURS
}

// Resolves one order line item (productId/colour/size strings, as snapshotted
// onto the order at checkout) back to the live VariantSize row it draws
// stock from. Returns null if the product/variant/size no longer exists
// (deleted or renamed since the order was placed) — callers treat that the
// same as "unavailable."
async function resolveVariantSize(tx, item) {
  if (!item.productId || !item.colour || !item.size) return null
  const variant = await tx.productVariant.findFirst({
    where: { productId: item.productId, colour: item.colour },
    select: { id: true },
  })
  if (!variant) return null
  return tx.variantSize.findFirst({
    where: { variantId: variant.id, size: item.size },
    select: { id: true, quantity: true, reservedQuantity: true },
  })
}

// Attempts to reserve stock for every item on the order, all-or-nothing.
// Must run inside the same transaction as the order-status update that
// follows, so the check-then-increment is atomic against a concurrent
// reservation for the same size. Returns { ok, unavailable } — unavailable
// lists the items that couldn't be reserved (out of stock, or no longer
// exist); nothing is reserved if any item fails.
async function reserveStockForOrder(tx, order) {
  const resolved = []
  const unavailable = []

  for (const item of order.items) {
    const variantSize = await resolveVariantSize(tx, item)
    if (!variantSize) {
      unavailable.push({ ...item, reason: 'no_longer_exists' })
      continue
    }
    const available = variantSize.quantity - variantSize.reservedQuantity
    if (available < item.qty) {
      unavailable.push({ ...item, reason: 'insufficient_stock', available })
      continue
    }
    resolved.push({ variantSizeId: variantSize.id, qty: item.qty })
  }

  if (unavailable.length > 0) return { ok: false, unavailable }

  for (const { variantSizeId, qty } of resolved) {
    await tx.variantSize.update({
      where: { id: variantSizeId },
      data: { reservedQuantity: { increment: qty } },
    })
  }
  return { ok: true, unavailable: [] }
}

// Releases whatever this order actually holds. Safe to call even if nothing
// was reserved (e.g. a re-upload after the first attempt found stock
// unavailable) — each decrement is clamped at 0 to tolerate drift rather
// than going negative.
async function releaseStockForOrder(tx, order) {
  for (const item of order.items) {
    const variantSize = await resolveVariantSize(tx, item)
    if (!variantSize) continue
    const nextReserved = Math.max(0, variantSize.reservedQuantity - item.qty)
    await tx.variantSize.update({
      where: { id: variantSize.id },
      data: { reservedQuantity: nextReserved },
    })
  }
}

// Deducts real stock (confirm). Assumes the reservation is being released in
// the same motion — callers decrement quantity and reservedQuantity together
// so a confirmed order's stock is neither double-reserved nor double-counted.
async function deductStockForOrder(tx, order) {
  for (const item of order.items) {
    const variantSize = await resolveVariantSize(tx, item)
    if (!variantSize) continue
    await tx.variantSize.update({
      where: { id: variantSize.id },
      data: {
        quantity: { decrement: Math.min(item.qty, variantSize.quantity) },
        reservedQuantity: { decrement: Math.min(item.qty, variantSize.reservedQuantity) },
      },
    })
  }
}

// Sweeps orders whose reservation window has passed without confirmation,
// releasing their stock and marking them expired. Called on the periodic
// interval in index.js, AND lazily at the top of any stock-checking
// operation (receipt upload, order creation) so correctness never depends on
// the interval having fired — see AGENT_RULES.md point 3 (this project's
// server can sleep/restart on its host).
async function releaseExpiredReservations() {
  const stale = await prisma.order.findMany({
    where: { status: 'pending_verification', reservedUntil: { lt: new Date() } },
    select: { id: true, items: true, reservedUntil: true },
  })
  let released = 0
  for (const order of stale) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: order.id } })
      // Re-check inside the transaction: another request may have confirmed
      // or rejected it since the outer findMany ran.
      if (!fresh || fresh.status !== 'pending_verification' || !fresh.reservedUntil || fresh.reservedUntil >= new Date()) {
        return
      }
      await releaseStockForOrder(tx, fresh)
      await tx.order.update({ where: { id: fresh.id }, data: { status: 'expired' } })
    })
    released++
  }
  return released
}

// A pending_payment order that never got a receipt uploaded holds no stock
// reservation (see schema comment on Order.reservedUntil), so expiring it is
// a status-only change.
async function expireStalePendingPayment() {
  const hours = await pendingPaymentHours()
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
  const result = await prisma.order.updateMany({
    where: { status: 'pending_payment', createdAt: { lt: cutoff } },
    data: { status: 'expired' },
  })
  return result.count
}

module.exports = {
  reservationHours,
  reserveStockForOrder,
  releaseStockForOrder,
  deductStockForOrder,
  releaseExpiredReservations,
  expireStalePendingPayment,
}
