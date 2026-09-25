const prisma = require('../db')
const { upsertCustomer } = require('./customers')
const { releaseExpiredReservations } = require('./reservations')

const ORDER_STATUSES = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered']

// The single place the "can a customer still edit this order's delivery
// details?" rule lives. Once the order exists — as soon as the customer sees
// the payment/account details and creates the order — delivery details are
// locked for the customer on EVERY status, including pending_payment. There
// is no post-order edit window; the reference can still prove ownership for
// other actions, but the courier-facing details are frozen at placement. Any
// correction must go through the shop (admin route below). Admin routes never
// call this helper; they are always allowed to correct details.
function isOrderLockedForCustomerEdit(order) {
  return Boolean(order)
}

const orderWithCustomer = {
  customer: { select: { id: true, name: true, phone: true, email: true, isWhatsapp: true } },
}

function todayStamp() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// GEA-20260911-001, counting up within the day.
async function nextReference() {
  const prefix = `GEA-${todayStamp()}-`
  const last = await prisma.order.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  })
  const n = last ? parseInt(last.reference.slice(prefix.length), 10) + 1 : 1
  return `${prefix}${String(n).padStart(3, '0')}`
}

// Whether the confirmation step should offer to save these details:
//   'offer'     — never asked; show the prompt
//   'saved'     — already saved behind a PIN; say nothing
//   'opted_out' — asked before and declined; only a quiet opt-in link
function saveStateFor(customer) {
  if (customer.detailsSaved && customer.pinHash) return 'saved'
  if (customer.saveOptedOut) return 'opted_out'
  return 'offer'
}

async function createOrder({ phone, name, email, isWhatsapp, address, items, total }) {
  // Keep stock numbers fresh at the moment a new order is placed — see
  // reservations.js and AGENT_RULES.md; correctness never depends solely on
  // the periodic sweep having fired.
  await releaseExpiredReservations()

  const customer = await upsertCustomer({ phone, name, email, isWhatsapp, address })
  const saveState = saveStateFor(customer)

  // Two orders in the same instant could race for a reference; retry on the
  // unique violation rather than lock.
  // The recipient name is frozen per order (address.recipientName) so the
  // courier-facing name never changes after payment, even if the shared
  // Customer record is later overwritten by a differently-named order.
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = await nextReference()
    try {
      const order = await prisma.order.create({
        data: { reference, customerId: customer.id, items, address: { ...address, recipientName: name }, total },
        include: orderWithCustomer,
      })
      return { ...order, saveState }
    } catch (err) {
      if (err.code === 'P2002' && attempt < 4) continue
      throw err
    }
  }
}

// Proof that the caller placed this order: they hold a reference that belongs
// to this phone number. Used to gate the post-order actions (saving details
// behind a PIN, declining to) so that knowing a phone number alone is never
// enough to change someone else's record.
async function orderProvesPhone(reference, phone) {
  if (!reference) return false
  const order = await prisma.order.findUnique({
    where: { reference },
    select: { customer: { select: { phone: true } } },
  })
  return order?.customer?.phone === phone
}

async function listOrders() {
  return prisma.order.findMany({
    include: orderWithCustomer,
    orderBy: { createdAt: 'desc' },
  })
}

async function updateOrderStatus(id, status) {
  const existing = await prisma.order.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Order not found' }
  const order = await prisma.order.update({
    where: { id },
    data: { status },
    include: orderWithCustomer,
  })
  return { ok: true, order }
}

// Customers may correct the delivery details (the name and address the
// courier sees) right after ordering. The reference acts as the proof they
// placed it. This is now locked for every order status once the order exists;
// see isOrderLockedForCustomerEdit.
async function updateOrderDelivery(id, reference, { name, address }) {
  const existing = await prisma.order.findUnique({ where: { id } })
  if (!existing || existing.reference !== reference) return { ok: false, error: 'Order not found' }
  if (isOrderLockedForCustomerEdit(existing)) {
    return { ok: false, error: "Delivery details can't be changed after payment. Please contact us." }
  }
  const order = await prisma.order.update({
    where: { id },
    data: { address: { ...address, recipientName: name } },
    include: orderWithCustomer,
  })
  return { ok: true, order }
}

// Admin: correct the delivery details on any order, paid or not. Writes only
// to Order.address (including the per-order recipientName) and never touches
// the shared Customer record, so the name and address on OTHER orders by the
// same customer are unaffected. Returns the previous values so the caller can
// audit exactly what changed.
async function updateOrderDeliveryAdmin(id, { name, address }) {
  const existing = await prisma.order.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  })
  if (!existing) return { ok: false, error: 'Order not found' }

  // previous is the address as it was stored. recipientName is resolved to
  // the effective name shown (falls back to customer.name on older orders),
  // so the audit log records what the courier was actually told, not a null.
  const previous = {
    ...(existing.address || {}),
    recipientName: existing.address?.recipientName || existing.customer.name,
  }
  const order = await prisma.order.update({
    where: { id },
    data: { address: { ...(existing.address || {}), ...address, recipientName: name } },
    include: orderWithCustomer,
  })
  return { ok: true, order, previous }
}

async function updateOrderNotes(id, notes) {
  const existing = await prisma.order.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Order not found' }
  const order = await prisma.order.update({
    where: { id },
    data: { notes },
    include: orderWithCustomer,
  })
  return { ok: true, order }
}

module.exports = {
  ORDER_STATUSES,
  isOrderLockedForCustomerEdit,
  createOrder,
  listOrders,
  updateOrderStatus,
  updateOrderDelivery,
  updateOrderDeliveryAdmin,
  updateOrderNotes,
  orderProvesPhone,
}
