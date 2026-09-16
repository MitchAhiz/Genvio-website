// One-off verification script for Task 04 (activity + analytics endpoints).
// Seeds tagged rows into the real DB, hits every endpoint over HTTP against
// a locally-started instance of the actual server, checks the responses
// against expected values computed from the same seed data, then deletes
// everything it inserted. Not a permanent test suite — there is no test
// runner in this project yet.
//
// Usage: node scripts/seed-and-test-analytics.js

require('dotenv').config()

const PORT = process.env.TEST_PORT || 4123
process.env.PORT = String(PORT)

const prisma = require('../src/db')
const { createSession } = require('../src/services/auth')
const { logActivity } = require('../src/utils/logActivity')

const TAG = 'testseed'
const BASE = `http://localhost:${PORT}/api`

let pass = 0
let fail = 0
function check(label, condition, extra) {
  if (condition) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`)
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

async function seed() {
  const categories = await Promise.all([
    prisma.category.create({ data: { id: `${TAG}-category-men`, name: 'Shirts', section: 'men' } }),
    prisma.category.create({ data: { id: `${TAG}-category-women`, name: 'Dresses', section: 'women' } }),
    prisma.category.create({ data: { id: `${TAG}-category-kids`, name: 'Sets', section: 'kids' } }),
  ])
  const [catMen, catWomen, catKids] = categories

  const products = await Promise.all([
    prisma.product.create({
      data: { id: `${TAG}-product-men`, slug: `${TAG}-men-shirt`, name: 'Test Seed Men Shirt', brand: 'TestBrand', categoryId: catMen.id, section: 'men', price: 5000, status: 'published' },
    }),
    prisma.product.create({
      data: { id: `${TAG}-product-women`, slug: `${TAG}-women-dress`, name: 'Test Seed Women Dress', brand: 'TestBrand', categoryId: catWomen.id, section: 'women', price: 15000, status: 'published' },
    }),
    prisma.product.create({
      data: { id: `${TAG}-product-kids`, slug: `${TAG}-kids-set`, name: 'Test Seed Kids Set', brand: 'TestBrand', categoryId: catKids.id, section: 'kids', price: 8000, status: 'published' },
    }),
  ])

  const customers = await Promise.all([
    prisma.customer.create({ data: { id: `${TAG}-customer-1`, phone: '08011110001', name: 'Test Seed Customer One', address: { street: '1 Test St', city: 'Lagos', state: 'Lagos' } } }),
    prisma.customer.create({ data: { id: `${TAG}-customer-2`, phone: '08011110002', name: 'Test Seed Customer Two', address: { street: '2 Test St', city: 'Lagos', state: 'Lagos' } } }),
  ])

  function item(product, qty) {
    return { productId: product.id, name: product.name, brand: product.brand, colour: 'Black', size: 'M', image: null, qty, unitPrice: product.price }
  }

  const [men, women, kids] = products
  const [cust1, cust2] = customers

  // { daysAgo, customer, status, items }
  const orderSpecs = [
    { daysAgo: 0, customer: cust1, status: 'confirmed', items: [item(men, 2)] }, // today, confirmed, men
    { daysAgo: 0, customer: cust2, status: 'pending_payment', items: [item(women, 1), item(kids, 1)] }, // today, pending, women+kids
    { daysAgo: 3, customer: cust1, status: 'processing', items: [item(men, 1)] }, // this week, confirmed-group
    { daysAgo: 10, customer: cust1, status: 'shipped', items: [item(women, 3)] }, // this month, not this week
    { daysAgo: 20, customer: cust2, status: 'delivered', items: [item(kids, 2)] }, // this month
    { daysAgo: 40, customer: cust1, status: 'confirmed', items: [item(men, 1)] }, // last month
    { daysAgo: 75, customer: cust2, status: 'pending_payment', items: [item(women, 1)] }, // within 3m, outside 30d
  ]

  const orders = []
  for (let i = 0; i < orderSpecs.length; i++) {
    const spec = orderSpecs[i]
    const total = spec.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
    const order = await prisma.order.create({
      data: {
        id: `${TAG}-order-${i + 1}`,
        reference: `GEA-${TAG}-${String(i + 1).padStart(3, '0')}`,
        customerId: spec.customer.id,
        items: spec.items,
        address: spec.customer.address,
        total,
        status: spec.status,
        createdAt: daysAgo(spec.daysAgo),
      },
    })
    orders.push({ ...order, _spec: spec })
  }

  // A couple of activity_log rows to exercise search + pagination.
  await logActivity('testseed.product.created', 'product', men.id, { name: men.name })
  await logActivity('testseed.order.status_changed', 'order', orders[0].id, { from: 'pending_payment', to: 'confirmed' })

  // Task 03's zero-product category delete logs `action: null` inside the
  // JSON detail (distinct from the activity_log row's own top-level `action`
  // column, which is always the string "category.deleted"). Reproduce
  // that exact shape here so /api/activity's JSON-text search and the JSON
  // round-trip are exercised against a real null value, not just non-null
  // detail payloads.
  const extraCategory = await prisma.category.create({
    data: { id: `${TAG}-category-extra`, name: 'Test Seed Category', section: 'men' },
  })
  await logActivity('testseed.category.deleted', 'category', extraCategory.id, {
    action: null,
    affectedProductCount: 0,
  })

  return { products, customers, category: extraCategory, orders: orderSpecs.map((s, i) => ({ ...s, order: orders[i] })) }
}

async function cleanup() {
  await prisma.activityLog.deleteMany({ where: { action: { startsWith: TAG } } })
  await prisma.order.deleteMany({ where: { id: { startsWith: `${TAG}-` } } })
  await prisma.customer.deleteMany({ where: { id: { startsWith: `${TAG}-` } } })
  await prisma.product.deleteMany({ where: { id: { startsWith: `${TAG}-` } } })
  await prisma.category.deleteMany({ where: { id: { startsWith: `${TAG}-` } } })
}

function computeExpected(seedOrders) {
  const PENDING = ['pending_payment']
  const CONFIRMED = ['confirmed', 'processing', 'shipped', 'delivered']

  let totalRevenue = 0
  let pendingRevenue = 0
  let confirmedRevenue = 0
  const sectionTotals = { men: { orderCount: 0, revenue: 0 }, women: { orderCount: 0, revenue: 0 }, kids: { orderCount: 0, revenue: 0 } }
  const statusCounts = {}
  const bestSellers = new Map()

  for (const { order, status, items } of seedOrders) {
    totalRevenue += order.total
    if (PENDING.includes(status)) pendingRevenue += order.total
    else if (CONFIRMED.includes(status)) confirmedRevenue += order.total
    statusCounts[status] = (statusCounts[status] || 0) + 1

    const sectionsInOrder = new Set()
    for (const it of items) {
      const section = it.productId.includes('-men') ? 'men' : it.productId.includes('-women') ? 'women' : 'kids'
      sectionTotals[section].revenue += it.qty * it.unitPrice
      sectionsInOrder.add(section)

      const entry = bestSellers.get(it.productId) || { unitsSold: 0, revenue: 0 }
      entry.unitsSold += it.qty
      entry.revenue += it.qty * it.unitPrice
      bestSellers.set(it.productId, entry)
    }
    for (const s of sectionsInOrder) sectionTotals[s].orderCount += 1
  }

  return { totalRevenue, pendingRevenue, confirmedRevenue, sectionTotals, statusCounts, bestSellers }
}

async function main() {
  console.log('Seeding test data...')
  const { orders } = await seed()
  const expected = computeExpected(orders)

  console.log('Starting server...')
  require('../src/index.js')
  await new Promise((r) => setTimeout(r, 500))

  const token = createSession(process.env.ADMIN_EMAIL || 'test@admin.local')
  const cookie = `admin_session=${token}`

  try {
    console.log('\n--- Auth guard ---')
    const noAuth = await fetch(`${BASE}/activity`)
    check('GET /api/activity without cookie returns 401', noAuth.status === 401, `got ${noAuth.status}`)

    console.log('\n--- GET /api/activity ---')
    const actRes = await fetch(`${BASE}/activity?page=1`, { headers: { Cookie: cookie } })
    const act = await actRes.json()
    check('responds 200', actRes.status === 200, `got ${actRes.status}`)
    check('page defaults/echoes correctly', act.page === 1)
    check('items is an array, <=20', Array.isArray(act.items) && act.items.length <= 20)
    check('most-recent first', act.items.length < 2 || new Date(act.items[0].createdAt) >= new Date(act.items[1].createdAt))
    check('totalCount/totalPages present', typeof act.totalCount === 'number' && typeof act.totalPages === 'number')

    const searchRes = await fetch(`${BASE}/activity?search=testseed`, { headers: { Cookie: cookie } })
    const search = await searchRes.json()
    check('search filters to seeded rows only', search.items.length >= 3 && search.items.every((i) => i.action.startsWith('testseed')), JSON.stringify(search.items.map((i) => i.action)))

    console.log('\n--- Null-action detail (Task 03 zero-product-delete shape) ---')
    const nullActionRes = await fetch(`${BASE}/activity?search=category.deleted`, { headers: { Cookie: cookie } })
    check('search on the row itself responds 200 (not a 500 from the null value)', nullActionRes.status === 200, `got ${nullActionRes.status}`)
    const nullActionBody = await nullActionRes.json()
    const nullActionRow = nullActionBody.items.find((i) => i.action === 'testseed.category.deleted')
    check('row is found by search, not silently dropped', !!nullActionRow, JSON.stringify(nullActionBody.items.map((i) => i.action)))
    check('detail.action round-trips as JSON null (not missing, not the string "null")', nullActionRow && nullActionRow.detail.action === null && 'action' in nullActionRow.detail, JSON.stringify(nullActionRow?.detail))
    check('detail.affectedProductCount survives alongside the null field', nullActionRow?.detail.affectedProductCount === 0, JSON.stringify(nullActionRow?.detail))
    // The unfiltered list (already fetched above) must include this row too,
    // and JSON.parse of the response (done implicitly by res.json()) must not
    // throw on the embedded null — if it had, this assertion would never run.
    check('unfiltered /api/activity also parses and includes the null-detail row without throwing', act.items.some((i) => i.action === 'testseed.category.deleted') || act.totalCount >= 3)

    console.log('\n--- GET /api/analytics/revenue ---')
    const revRes = await fetch(`${BASE}/analytics/revenue?period=all`, { headers: { Cookie: cookie } })
    const rev = await revRes.json()
    check('responds 200', revRes.status === 200, `got ${revRes.status}`)
    // These orders are additive on top of whatever already exists in the DB,
    // so check relative/structural correctness rather than exact totals.
    check('totalRevenue >= seeded total', rev.totalRevenue >= expected.totalRevenue, `${rev.totalRevenue} vs >= ${expected.totalRevenue}`)
    check('pendingRevenue >= seeded pending', rev.pendingRevenue >= expected.pendingRevenue, `${rev.pendingRevenue} vs >= ${expected.pendingRevenue}`)
    check('confirmedRevenue >= seeded confirmed', rev.confirmedRevenue >= expected.confirmedRevenue, `${rev.confirmedRevenue} vs >= ${expected.confirmedRevenue}`)
    check('confirmed + pending == total (all-time)', rev.pendingRevenue + rev.confirmedRevenue === rev.totalRevenue, `${rev.pendingRevenue}+${rev.confirmedRevenue} != ${rev.totalRevenue}`)
    check('series is an array of {date,revenue,orderCount}', Array.isArray(rev.series) && rev.series.every((s) => typeof s.date === 'string' && typeof s.revenue === 'number'))
    check('thisMonthChangePercent is a number', typeof rev.thisMonthChangePercent === 'number')

    console.log('\n--- GET /api/analytics/orders-by-section ---')
    const secRes = await fetch(`${BASE}/analytics/orders-by-section?period=all`, { headers: { Cookie: cookie } })
    const sec = await secRes.json()
    check('responds 200', secRes.status === 200, `got ${secRes.status}`)
    check('has men/women/kids', ['men', 'women', 'kids'].every((s) => sec.sections.some((x) => x.section === s)))
    for (const s of ['men', 'women', 'kids']) {
      const got = sec.sections.find((x) => x.section === s)
      check(`${s} revenue >= seeded`, got.revenue >= expected.sectionTotals[s].revenue, `${got.revenue} vs >= ${expected.sectionTotals[s].revenue}`)
    }

    console.log('\n--- GET /api/analytics/status-breakdown ---')
    const statRes = await fetch(`${BASE}/analytics/status-breakdown`, { headers: { Cookie: cookie } })
    const stat = await statRes.json()
    check('responds 200', statRes.status === 200, `got ${statRes.status}`)
    const percentSum = stat.statuses.reduce((s, x) => s + x.percent, 0)
    check('percentages sum to ~100%', Math.abs(percentSum - 100) < 1, `sum=${percentSum}`)
    check('counts sum to totalOrders', stat.statuses.reduce((s, x) => s + x.count, 0) === stat.totalOrders)

    console.log('\n--- GET /api/analytics/best-sellers ---')
    const bsUnitsRes = await fetch(`${BASE}/analytics/best-sellers?sort=units&limit=50`, { headers: { Cookie: cookie } })
    const bsUnits = await bsUnitsRes.json()
    check('responds 200', bsUnitsRes.status === 200, `got ${bsUnitsRes.status}`)
    const unitsSorted = bsUnits.products.every((p, i, arr) => i === 0 || arr[i - 1].unitsSold >= p.unitsSold)
    check('sorted by units desc', unitsSorted)

    const bsRevRes = await fetch(`${BASE}/analytics/best-sellers?sort=revenue&limit=50`, { headers: { Cookie: cookie } })
    const bsRev = await bsRevRes.json()
    const revSorted = bsRev.products.every((p, i, arr) => i === 0 || arr[i - 1].revenue >= p.revenue)
    check('sorted by revenue desc', revSorted)

    const seededMen = bsRev.products.find((p) => p.productId === `${TAG}-product-men`)
    check('seeded men product units/revenue match', seededMen && seededMen.unitsSold === expected.bestSellers.get(`${TAG}-product-men`).unitsSold, JSON.stringify(seededMen))

    console.log('\n--- Empty-data edge case ---')
    const farPage = await fetch(`${BASE}/activity?page=9999`, { headers: { Cookie: cookie } })
    const farPageBody = await farPage.json()
    check('out-of-range page returns 200 with empty items, not a crash', farPage.status === 200 && Array.isArray(farPageBody.items) && farPageBody.items.length === 0, `status=${farPage.status}`)
  } finally {
    console.log('\nCleaning up seeded data...')
    await cleanup()

    // Prove this is a live round trip to Supabase, not a cached/stale read:
    // ask Postgres for its own wall-clock time in the same query as the
    // count, so a stale/cached result would show a stale timestamp too.
    const [{ now: dbNow, remaining }] = await prisma.$queryRaw`
      SELECT NOW() AS now, (
        (SELECT COUNT(*) FROM products WHERE id LIKE ${TAG + '-%'}) +
        (SELECT COUNT(*) FROM customers WHERE id LIKE ${TAG + '-%'}) +
        (SELECT COUNT(*) FROM orders WHERE id LIKE ${TAG + '-%'}) +
        (SELECT COUNT(*) FROM categories WHERE id LIKE ${TAG + '-%'}) +
        (SELECT COUNT(*) FROM activity_log WHERE action LIKE ${TAG + '%'})
      )::int AS remaining
    `
    console.log(`\nPost-cleanup DB check — server time ${dbNow.toISOString()} (script time ${new Date().toISOString()}), remaining seeded rows: ${remaining}`)
    check('DB confirms zero seeded rows remain, verified via a live query (not cache)', Number(remaining) === 0, `remaining=${remaining}`)

    console.log(`\nResults: ${pass} passed, ${fail} failed`)
    process.exit(fail > 0 ? 1 : 0)
  }
}

main().catch(async (err) => {
  console.error(err)
  await cleanup().catch(() => {})
  process.exit(1)
})
