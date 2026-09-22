// Exercises POST /api/orders's server-side delivery-fee repricing and
// total-tampering guard (server/src/routes/orders.js): the client sends a
// `total`, but the server always recomputes it from the admin-set delivery
// fees and the items array, and 400s if the two disagree. That's the only
// thing stopping a modified client from shipping an order for less than it
// should cost.
//
// This spins up a real Express app with the real orders router mounted (not
// a reimplementation of its logic), but replaces the Prisma client (`../db`)
// and the rate-limit middleware with in-memory fakes before the router is
// required, so no real database or network call is ever made — the delivery
// fees and one "existing" customer/order live entirely in the `state` object
// below. BREVO_API_KEY/ADMIN_EMAIL are also cleared for the test process so
// the fire-and-forget order-alert email mailer no-ops instead of trying to
// reach Brevo.
//
// Run with: npm test  (from server/)
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const express = require('express')

// Must happen before anything requires '../src/db' or
// '../src/middleware/rateLimit', so every module that pulls in the real
// Prisma client or the real limiter gets these fakes instead.
delete process.env.BREVO_API_KEY
delete process.env.ADMIN_EMAIL

const state = {
  // key -> decoded value, mirrors what configService.decode() would return.
  siteConfig: {
    delivery_mainland_fee: 1500,
    delivery_island_fee: 2000,
    delivery_interstate_fee: 3000,
  },
  createdOrders: [],
}

const fakePrisma = {
  siteConfig: {
    async findUnique({ where: { key } }) {
      return Object.prototype.hasOwnProperty.call(state.siteConfig, key)
        ? { key, value: JSON.stringify(state.siteConfig[key]) }
        : null
    },
  },
  customer: {
    async upsert({ where, create }) {
      return {
        id: 'cust-1',
        phone: where.phone,
        name: create.name,
        address: create.address,
        detailsSaved: false,
        pinHash: null,
        saveOptedOut: false,
      }
    },
  },
  order: {
    // nextReference()'s lookup for the day's last order — always "none yet".
    async findFirst() {
      return null
    },
    async create({ data }) {
      const order = {
        id: `order-${state.createdOrders.length + 1}`,
        reference: `GEA-TEST-${String(state.createdOrders.length + 1).padStart(3, '0')}`,
        status: 'pending_payment',
        paymentMethod: 'bank_transfer',
        createdAt: new Date().toISOString(),
        customer: { id: data.customerId, name: 'Test Customer', phone: '08012345678' },
        ...data,
      }
      state.createdOrders.push(order)
      return order
    },
  },
}

const dbPath = require.resolve('../src/db')
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePrisma }

const rateLimitPath = require.resolve('../src/middleware/rateLimit')
require.cache[rateLimitPath] = {
  id: rateLimitPath,
  filename: rateLimitPath,
  loaded: true,
  // Rate limiting is a separate concern from the delivery-fee guard this
  // file tests, and the real limiter (5 requests/10min per IP) would 429 out
  // partway through this suite since every request comes from the same
  // loopback address.
  exports: { rateLimit: () => (_req, _res, next) => next() },
}

const ordersRouter = require('../src/routes/orders')

let server
let baseUrl

test.before(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api', ordersRouter)
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

const ITEMS = [{ productId: 'p1', name: 'Satin Midi Dress', qty: 2, unitPrice: 5000 }]
const ITEMS_TOTAL = 10000 // 2 * 5000

function orderPayload(overrides) {
  return {
    phone: '08012345678',
    name: 'Test Customer',
    address: { street: '1 Test Street', city: 'Testville', state: 'Oyo' },
    items: ITEMS,
    ...overrides,
  }
}

async function postOrder(payload) {
  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

test('correct total (interstate) is accepted and priced with the admin fee', async () => {
  const total = ITEMS_TOTAL + state.siteConfig.delivery_interstate_fee // 13000
  const { status, body } = await postOrder(orderPayload({ total }))
  assert.equal(status, 201, JSON.stringify(body))
  assert.equal(body.total, total)
  assert.equal(body.address.deliveryFee, state.siteConfig.delivery_interstate_fee)
})

test('tampered lower total is rejected with 400 and no order is created', async () => {
  const before = state.createdOrders.length
  const correctTotal = ITEMS_TOTAL + state.siteConfig.delivery_interstate_fee
  const { status, body } = await postOrder(orderPayload({ total: correctTotal - 1 }))
  assert.equal(status, 400)
  assert.ok(body.error)
  assert.equal(state.createdOrders.length, before, 'no order should have been created')
})

test('tampered total for Lagos Mainland is rejected with 400', async () => {
  const correctTotal = ITEMS_TOTAL + state.siteConfig.delivery_mainland_fee // 11500
  const { status, body } = await postOrder(
    orderPayload({
      address: { street: '1 Test Street', city: 'Lagos', state: 'Lagos' },
      deliveryZone: 'mainland',
      total: ITEMS_TOTAL, // omits the delivery fee entirely
    })
  )
  assert.equal(status, 400)
  assert.ok(body.error)
  assert.notEqual(ITEMS_TOTAL, correctTotal, 'sanity: fee must be non-zero for this test to mean anything')
})

test('tampered total for Lagos Island is rejected with 400', async () => {
  const correctTotal = ITEMS_TOTAL + state.siteConfig.delivery_island_fee // 12000
  const { status, body } = await postOrder(
    orderPayload({
      address: { street: '1 Test Street', city: 'Lagos', state: 'Lagos' },
      deliveryZone: 'island',
      total: correctTotal - 500, // under-priced by part of the fee, not all of it
    })
  )
  assert.equal(status, 400)
  assert.ok(body.error)
})

test('tampered total for interstate delivery is rejected with 400', async () => {
  const correctTotal = ITEMS_TOTAL + state.siteConfig.delivery_interstate_fee // 13000
  const { status, body } = await postOrder(orderPayload({ total: correctTotal - 3000 })) // as if fee were waived
  assert.equal(status, 400)
  assert.ok(body.error)
})

test('missing total is rejected with 400, not a 500', async () => {
  const payload = orderPayload({})
  delete payload.total
  const { status, body } = await postOrder(payload)
  assert.equal(status, 400)
  assert.ok(body.error)
})

test('non-numeric total is rejected with 400, not a 500', async () => {
  const { status, body } = await postOrder(orderPayload({ total: 'not-a-number' }))
  assert.equal(status, 400)
  assert.ok(body.error)
})

test('null total is rejected with 400, not a 500', async () => {
  const { status, body } = await postOrder(orderPayload({ total: null }))
  assert.equal(status, 400)
  assert.ok(body.error)
})
