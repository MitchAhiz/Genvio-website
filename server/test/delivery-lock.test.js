// Unit tests for the delivery-details lock (Section 5 of HANDOFF.md).
//
// Everything runs on fake in-memory order objects: the Prisma client and the
// audit logger are stubbed via require.cache BEFORE the routes module loads,
// so nothing ever touches the real database, starts a server, sends email or
// triggers a payment. The real Express router — including the real
// requireAdminAuth guard — is exercised over a throwaway HTTP listener so
// status codes and the wire JSON are asserted, not just the service layer.
//
// Auth: requireAdminAuth validates against an in-memory session store (no DB),
// so tests mint a real session token via createSession() to act as an
// authenticated admin, and omit the cookie to prove unauthenticated requests
// are rejected.

const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')
const cookieParser = require('cookie-parser')

const STATUSES = ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered']
const LOCKED_MESSAGE = "Delivery details can't be changed after payment. Please contact us."

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const calls = {
  orderFindUnique: [],
  orderFindFirst: 0,
  orderCreate: 0,
  orderUpdate: [], // { where, data, include }
  customerUpsert: 0,
  customerUpdate: 0,
  activityLog: [], // [action, entityType, entityId, detail]
}

const orders = new Map()

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}

const prismaStub = {
  order: {
    async findUnique({ where }) {
      calls.orderFindUnique.push(where.id)
      return clone(orders.get(where.id) ?? null)
    },
    async findFirst() {
      calls.orderFindFirst++
      return null
    },
    async create(args) {
      calls.orderCreate++
      const order = { id: 'created-id', ...args.data, customer: { id: 'cus-1', name: 'Ada Obi', phone: '08012345678' } }
      orders.set(order.id, order)
      return clone(order)
    },
    async update({ where, data, include }) {
      calls.orderUpdate.push({ where: clone(where), data: clone(data), include })
      const existing = orders.get(where.id)
      if (!existing) throw new Error(`no order ${where.id}`)
      const merged = { ...existing, ...data, customer: existing.customer }
      orders.set(where.id, merged)
      return clone(merged)
    },
  },
  customer: {
    async upsert() {
      calls.customerUpsert++
      return { id: 'cus-1', name: 'Ada Obi', phone: '08012345678' }
    },
    async update() {
      calls.customerUpdate++
    },
  },
}

// Installed into require.cache before src/routes/orders.js is required.
const dbPath = require.resolve(path.join(__dirname, '..', 'src', 'db.js'))
const logPath = require.resolve(path.join(__dirname, '..', 'src', 'utils', 'logActivity.js'))

// fixtures ----------------------------------------------------------------

function seedOrder({ id, reference, status = 'confirmed', address, recipientName, customerName = 'Ada Obi', phone = '08012345678' }) {
  const order = {
    id,
    reference,
    status,
    paymentMethod: 'bank_transfer',
    total: 25000,
    items: [{ id: 1, name: 'Dress', qty: 1, unitPrice: 25000 }],
    address: { street: '12 Test Street', city: 'Lagos', state: 'Lagos' },
    customer: { id: 'cus-1', name: customerName, phone },
    createdAt: '2026-09-22T10:00:00.000Z',
    updatedAt: '2026-09-22T10:00:00.000Z',
  }
  if (recipientName) order.address.recipientName = recipientName
  if (address) order.address = { ...order.address, ...address }
  orders.set(id, order)
  return order
}

// ---------------------------------------------------------------------------
// Boot a real Express app over the real router, with the DB/logger stubbed.
// ---------------------------------------------------------------------------

let baseUrl
let server
let adminCookie

before(async () => {
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: prismaStub }
  require.cache[logPath] = {
    id: logPath,
    filename: logPath,
    loaded: true,
    exports: {
      logActivity: async (...args) => {
        calls.activityLog.push(args)
      },
    },
  }
  // The real auth middleware stays in place: requireAdminAuth validates the
  // admin_session cookie against the in-memory session store (no DB), so a
  // request without a cookie is rejected 401, and authenticated tests use a
  // real token minted with createSession.

  const router = require(path.join(__dirname, '..', 'src', 'routes', 'orders.js'))
  const { createSession } = require(path.join(__dirname, '..', 'src', 'services', 'auth.js'))
  adminCookie = `admin_session=${createSession('admin@example.com')}`

  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api', router)
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
})

after(() => {
  server?.close()
})

beforeEach(() => {
  orders.clear()
  calls.orderFindUnique.length = 0
  calls.orderFindFirst = 0
  calls.orderCreate = 0
  calls.orderUpdate.length = 0
  calls.customerUpsert = 0
  calls.customerUpdate = 0
  calls.activityLog.length = 0
})

async function patch(url, body, { admin = false } = {}) {
  const res = await fetch(`${baseUrl}${url}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(admin ? { cookie: adminCookie } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return { status: res.status, json }
}

async function adminPatch(url, body) {
  return patch(url, body, { admin: true })
}

const goodBody = {
  name: 'Ada Obi',
  address: { street: '12 Test Street', city: 'Lagos', state: 'Lagos' },
}

// ---------------------------------------------------------------------------
// Customer edit is locked once the order exists — every status.
// ---------------------------------------------------------------------------

test('customer delivery edit is rejected with 409 + exact message on EVERY status', async () => {
  for (const status of STATUSES) {
    seedOrder({ id: `ord-${status}`, reference: `REF-${status}`, status })
    const { status: httpStatus, json } = await patch(`/orders/ord-${status}/delivery`, {
      reference: `REF-${status}`,
      ...goodBody,
    })
    assert.equal(httpStatus, 409, `expected 409 for ${status}`)
    assert.equal(json.error, LOCKED_MESSAGE, `wrong message for ${status}`)
  }
  // The locked path must never write.
  assert.equal(calls.orderUpdate.length, 0)
  assert.equal(calls.customerUpsert + calls.customerUpdate, 0)
})

test('customer delivery edit with the wrong reference is 404', async () => {
  seedOrder({ id: 'ord-1', reference: 'REF-REAL' })
  const { status, json } = await patch('/orders/ord-1/delivery', { reference: 'REF-WRONG', ...goodBody })
  assert.equal(status, 404)
  assert.equal(json.error, 'Order not found')
})

test('customer delivery edit for an unknown order id is 404', async () => {
  const { status, json } = await patch('/orders/ord-missing/delivery', { reference: 'REF-ANY', ...goodBody })
  assert.equal(status, 404)
  assert.equal(json.error, 'Order not found')
})

test('customer delivery edit with invalid fields never reaches the service', async () => {
  seedOrder({ id: 'ord-1', reference: 'REF-1' })
  const { status, json } = await patch('/orders/ord-1/delivery', {
    reference: 'REF-1',
    name: 'X', // too short
    address: { street: '12 Test Street', city: 'Lagos', state: 'Lagos' },
  })
  assert.equal(status, 400)
  assert.equal(json.error, 'Enter the recipient’s full name')
  assert.equal(calls.orderUpdate.length, 0)
})

// ---------------------------------------------------------------------------
// Admin edit is allowed on every status, writes only Order.address.
// ---------------------------------------------------------------------------

test('admin delivery edit is allowed on EVERY status and writes only Order.address', async () => {
  for (const status of STATUSES) {
    seedOrder({
      id: `ord-${status}`,
      reference: `REF-${status}`,
      status,
      address: { street: '1 Old Street', city: 'Ikeja', state: 'Lagos' },
      customerName: 'Chidinma',
    })
    calls.orderUpdate.length = 0
    calls.customerUpsert = 0
    calls.customerUpdate = 0

    const nextCity = status === 'confirmed' ? 'Surulere' : 'Ikeja'
    const { status: httpStatus, json } = await adminPatch(`/admin/orders/ord-${status}/delivery`, {
      name: 'Chidinma Updated',
      address: { street: '9 New Road', city: nextCity, state: 'Lagos' },
    })

    assert.equal(httpStatus, 200, `expected 200 for ${status}`)

    // The response is the full order with the corrected address.
    assert.equal(json.address.street, '9 New Road')
    assert.equal(json.address.recipientName, 'Chidinma Updated')

    // Exactly one write: the order, with ONLY the address field in `data`.
    assert.equal(calls.orderUpdate.length, 1)
    const write = calls.orderUpdate[0]
    assert.deepEqual(Object.keys(write.data), ['address'])
    assert.equal(write.data.address.street, '9 New Road')
    assert.equal(write.data.address.recipientName, 'Chidinma Updated')

    // The shared Customer record is never touched.
    assert.equal(calls.customerUpsert, 0)
    assert.equal(calls.customerUpdate, 0)
  }
})

test('admin edit on an unknown order id is 404', async () => {
  const { status, json } = await adminPatch('/admin/orders/ord-missing/delivery', { ...goodBody })
  assert.equal(status, 404)
  assert.equal(json.error, 'Order not found')
})

test('admin edit with invalid fields is 400 before any write', async () => {
  seedOrder({ id: 'ord-1' })
  const { status, json } = await adminPatch('/admin/orders/ord-1/delivery', {
    name: 'A', // too short
    address: { street: '12 Test Street', city: 'Lagos', state: 'Lagos' },
  })
  assert.equal(status, 400)
  assert.equal(calls.orderUpdate.length, 0)
})

test('admin delivery edit without a session is rejected 401 by the real requireAdminAuth guard', async () => {
  seedOrder({ id: 'ord-1', reference: 'REF-1' })
  // No cookie is sent, so the real requireAdminAuth must reject before the
  // handler runs — proving the guard is attached to the route.
  const { status, json } = await patch('/admin/orders/ord-1/delivery', { ...goodBody })

  assert.equal(status, 401)
  assert.equal(json.error, 'Unauthorized')
  // The rejection happens before the handler, so nothing may have been
  // written or audited.
  assert.equal(calls.orderUpdate.length, 0)
  assert.equal(calls.activityLog.length, 0)
  assert.equal(calls.customerUpsert + calls.customerUpdate, 0)
})

// ---------------------------------------------------------------------------
// Audit logging: only changed fields, with from/to values.
// ---------------------------------------------------------------------------

test('logActivity records ONLY changed fields with from/to', async () => {
  // No stored recipientName: previous name falls back to customer.name.
  seedOrder({
    id: 'ord-1',
    reference: 'REF-1',
    address: { street: '12 Test Street', city: 'Lagos', state: 'Lagos' },
  })
  await adminPatch('/admin/orders/ord-1/delivery', {
    name: 'Ada Obi', // same as customer.name → recipientName unchanged
    address: { street: '12 Test Street', city: 'Surulere', state: 'Lagos' }, // only city changes
  })

  assert.equal(calls.activityLog.length, 1)
  const [action, entityType, entityId, detail] = calls.activityLog[0]
  assert.equal(action, 'order.delivery_updated')
  assert.equal(entityType, 'order')
  assert.equal(entityId, 'ord-1')
  assert.deepEqual(detail, { city: { from: 'Lagos', to: 'Surulere' } })
})

test('logActivity records the stored recipientName as the from value', async () => {
  seedOrder({
    id: 'ord-2',
    reference: 'REF-2',
    recipientName: 'Chinedu',
    address: { street: '12 Test Street', city: 'Lagos', state: 'Lagos' },
  })
  await adminPatch('/admin/orders/ord-2/delivery', {
    name: 'Chinedu New',
    address: { street: '12 Test Street', city: 'Lagos', state: 'Lagos' }, // only name changes
  })

  assert.equal(calls.activityLog.length, 1)
  const detail = calls.activityLog[0][3]
  assert.deepEqual(detail, { recipientName: { from: 'Chinedu', to: 'Chinedu New' } })
})

test('logActivity is NOT called when nothing actually changed', async () => {
  seedOrder({
    id: 'ord-3',
    reference: 'REF-3',
    recipientName: 'Ada Obi',
    address: { street: '12 Test Street', city: 'Lagos', state: 'Lagos' },
  })
  await adminPatch('/admin/orders/ord-3/delivery', { ...goodBody })
  assert.equal(calls.orderUpdate.length, 1, 'address is still written (harmless idempotent write)')
  assert.equal(calls.activityLog.length, 0)
})

test('the customer-facing locked route never writes an audit entry', async () => {
  seedOrder({ id: 'ord-1', reference: 'REF-1' })
  await patch('/orders/ord-1/delivery', { reference: 'REF-1', ...goodBody })
  assert.equal(calls.activityLog.length, 0)
})