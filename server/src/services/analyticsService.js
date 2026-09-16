const prisma = require('../db')

// Nigeria (WAT) is a fixed UTC+1 offset year-round — no DST to account for.
const WAT_OFFSET_MS = 60 * 60 * 1000

const PENDING_STATUSES = ['pending_payment']
const CONFIRMED_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered']

function watDateString(date) {
  const d = new Date(date.getTime() + WAT_OFFSET_MS)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function watTodayParts() {
  const d = new Date(Date.now() + WAT_OFFSET_MS)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }
}

// UTC instant corresponding to WAT midnight on the given (possibly
// out-of-range) y/m/d — JS Date normalizes month/day overflow for us.
function watMidnightUtc(y, m, d) {
  return new Date(Date.UTC(y, m, d) - WAT_OFFSET_MS)
}

function revenueSeriesStart(period) {
  const { y, m, d } = watTodayParts()
  if (period === '7d') return watMidnightUtc(y, m, d - 6)
  if (period === '3m') return watMidnightUtc(y, m - 3, d + 1)
  if (period === 'all') return null
  return watMidnightUtc(y, m, d - 29) // '30d' default
}

function sectionPeriodStart(period) {
  const { y, m, d } = watTodayParts()
  if (period === 'week') return watMidnightUtc(y, m, d - 6)
  if (period === 'all') return null
  return watMidnightUtc(y, m, 1) // 'month' default
}

async function getRevenue(period) {
  const validPeriods = ['7d', '30d', '3m', 'all']
  const seriesPeriod = validPeriods.includes(period) ? period : '30d'
  const seriesStart = revenueSeriesStart(seriesPeriod)

  // One query for everything: the cards are all-time/month/week aggregates
  // independent of the chart's period toggle, and order volume here doesn't
  // warrant per-metric queries.
  const orders = await prisma.order.findMany({
    select: { total: true, status: true, createdAt: true },
  })

  let totalRevenue = 0
  let pendingRevenue = 0
  let confirmedRevenue = 0
  const byDay = new Map()

  const { y, m, d } = watTodayParts()
  const monthStart = watMidnightUtc(y, m, 1)
  const lastMonthStart = watMidnightUtc(y, m - 1, 1)
  const lastMonthComparableEnd = watMidnightUtc(y, m - 1, d + 1)
  const weekStart = watMidnightUtc(y, m, d - 6)

  let thisMonthRevenue = 0
  let lastMonthComparableRevenue = 0
  let thisWeekRevenue = 0

  for (const o of orders) {
    totalRevenue += o.total
    if (PENDING_STATUSES.includes(o.status)) pendingRevenue += o.total
    else if (CONFIRMED_STATUSES.includes(o.status)) confirmedRevenue += o.total

    if (o.createdAt >= monthStart) thisMonthRevenue += o.total
    if (o.createdAt >= lastMonthStart && o.createdAt < lastMonthComparableEnd) lastMonthComparableRevenue += o.total
    if (o.createdAt >= weekStart) thisWeekRevenue += o.total

    if (!seriesStart || o.createdAt >= seriesStart) {
      const day = watDateString(o.createdAt)
      const bucket = byDay.get(day) || { revenue: 0, orderCount: 0 }
      bucket.revenue += o.total
      bucket.orderCount += 1
      byDay.set(day, bucket)
    }
  }

  const thisMonthChangePercent =
    lastMonthComparableRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthComparableRevenue) / lastMonthComparableRevenue) * 1000) / 10
      : thisMonthRevenue > 0
      ? 100
      : 0

  const series = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({ date, revenue: v.revenue, orderCount: v.orderCount }))

  return {
    series,
    totalRevenue,
    thisMonthRevenue,
    thisMonthChangePercent,
    thisWeekRevenue,
    pendingRevenue,
    confirmedRevenue,
  }
}

async function getOrdersBySection(period) {
  const validPeriods = ['week', 'month', 'all']
  const p = validPeriods.includes(period) ? period : 'month'
  const start = sectionPeriodStart(p)

  const orders = await prisma.order.findMany({
    where: start ? { createdAt: { gte: start } } : undefined,
    select: { items: true },
  })

  const productIds = new Set()
  for (const o of orders) {
    for (const item of Array.isArray(o.items) ? o.items : []) {
      if (item?.productId) productIds.add(item.productId)
    }
  }
  const products = productIds.size
    ? await prisma.product.findMany({
        where: { id: { in: [...productIds] } },
        select: { id: true, section: true },
      })
    : []
  const sectionById = new Map(products.map((p) => [p.id, p.section]))

  const totals = { men: { orderCount: 0, revenue: 0 }, women: { orderCount: 0, revenue: 0 }, kids: { orderCount: 0, revenue: 0 } }

  for (const o of orders) {
    const sectionsInOrder = new Set()
    for (const item of Array.isArray(o.items) ? o.items : []) {
      const section = item?.productId ? sectionById.get(item.productId) : null
      if (!section || !totals[section]) continue
      totals[section].revenue += item.qty * item.unitPrice
      sectionsInOrder.add(section)
    }
    for (const section of sectionsInOrder) totals[section].orderCount += 1
  }

  return {
    sections: Object.entries(totals).map(([section, v]) => ({ section, orderCount: v.orderCount, revenue: v.revenue })),
  }
}

async function getStatusBreakdown() {
  const grouped = await prisma.order.groupBy({
    by: ['status'],
    _count: { status: true },
  })
  const totalOrders = grouped.reduce((sum, g) => sum + g._count.status, 0)

  const statuses = grouped.map((g) => ({
    status: g.status,
    count: g._count.status,
    percent: totalOrders > 0 ? Math.round((g._count.status / totalOrders) * 1000) / 10 : 0,
  }))

  return { statuses, totalOrders }
}

async function getBestSellers({ sort, limit }) {
  const sortBy = sort === 'revenue' ? 'revenue' : 'units'
  const max = Number.isInteger(limit) && limit > 0 ? limit : 10

  const orders = await prisma.order.findMany({ select: { items: true } })

  const byProduct = new Map()
  for (const o of orders) {
    for (const item of Array.isArray(o.items) ? o.items : []) {
      const key = item?.productId || `name:${item?.name}`
      const entry = byProduct.get(key) || {
        productId: item?.productId || null,
        name: item?.name || 'Unknown',
        unitsSold: 0,
        revenue: 0,
      }
      entry.unitsSold += item.qty
      entry.revenue += item.qty * item.unitPrice
      byProduct.set(key, entry)
    }
  }

  const productIds = [...byProduct.values()].map((e) => e.productId).filter(Boolean)
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, section: true } })
    : []
  const productById = new Map(products.map((p) => [p.id, p]))

  const list = [...byProduct.values()].map((e) => {
    const product = e.productId ? productById.get(e.productId) : null
    return {
      productId: e.productId,
      name: product?.name || e.name,
      section: product?.section || null,
      unitsSold: e.unitsSold,
      revenue: e.revenue,
    }
  })

  list.sort((a, b) => (sortBy === 'revenue' ? b.revenue - a.revenue : b.unitsSold - a.unitsSold))

  return { products: list.slice(0, max) }
}

module.exports = { getRevenue, getOrdersBySection, getStatusBreakdown, getBestSellers }
