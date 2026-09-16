const prisma = require('../db')
const { upsertCustomer } = require('./customers')

const ORDER_STATUSES = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered']

const orderWithCustomer = {
  customer: { select: { id: true, name: true, phone: true } },
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

async function createOrder({ phone, name, address, items, total }) {
  const customer = await upsertCustomer({ phone, name, address })
  const saveState = saveStateFor(customer)

  // Two orders in the same instant could race for a reference; retry on the
  // unique violation rather than lock.
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = await nextReference()
    try {
      const order = await prisma.order.create({
        data: { reference, customerId: customer.id, items, address, total },
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
// placed it.
async function updateOrderDelivery(id, reference, { name, address }) {
  const existing = await prisma.order.findUnique({ where: { id } })
  if (!existing || existing.reference !== reference) return { ok: false, error: 'Order not found' }
  if (existing.status !== 'pending_payment' && existing.status !== 'confirmed') {
    return { ok: false, error: 'This order is already being processed — contact us to change the delivery details.' }
  }
  const [order] = await prisma.$transaction([
    prisma.order.update({ where: { id }, data: { address }, include: orderWithCustomer }),
    prisma.customer.update({ where: { id: existing.customerId }, data: { name, address } }),
  ])
  return { ok: true, order }
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
  createOrder,
  listOrders,
  updateOrderStatus,
  updateOrderDelivery,
  updateOrderNotes,
  orderProvesPhone,
}
