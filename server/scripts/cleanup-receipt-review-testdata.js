// Deletes every row created by seed-receipt-review-testdata.js (matched by
// the "testseed-review" tag in customer email/name) plus their uploaded
// storage objects, then verifies zero rows remain.
//
// Usage: node scripts/cleanup-receipt-review-testdata.js

require('dotenv').config()

const prisma = require('../src/db')
const { deleteReceiptFile } = require('../src/services/storage')

const TAG = 'testseed-review'

async function main() {
  const customers = await prisma.customer.findMany({
    where: { OR: [{ email: { contains: TAG } }, { name: { contains: TAG } }] },
    include: { orders: { include: { receipts: true } } },
  })

  const orderIds = []
  const customerIds = []
  const storageKeys = []

  for (const c of customers) {
    customerIds.push(c.id)
    for (const o of c.orders) {
      orderIds.push(o.id)
      for (const r of o.receipts) storageKeys.push(r.storageKey)
    }
  }

  console.log(`Found ${customerIds.length} testseed customer(s), ${orderIds.length} order(s), ${storageKeys.length} receipt file(s).`)

  for (const key of storageKeys) {
    try {
      await deleteReceiptFile(key)
      console.log(`  deleted storage object: ${key}`)
    } catch (err) {
      console.error(`  failed to delete storage object ${key}:`, err.message)
    }
  }

  if (orderIds.length) {
    await prisma.paymentReceipt.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
  }
  if (customerIds.length) {
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } })
  }

  const remainingCustomers = await prisma.customer.count({ where: { OR: [{ email: { contains: TAG } }, { name: { contains: TAG } }] } })
  const remainingOrders = await prisma.order.count({ where: { id: { in: orderIds } } })
  const remainingReceipts = await prisma.paymentReceipt.count({ where: { orderId: { in: orderIds } } })

  console.log(`\nAfter cleanup — customers: ${remainingCustomers}, orders: ${remainingOrders}, receipts: ${remainingReceipts}`)
  console.log(`Verified via Postgres NOW(): ${(await prisma.$queryRaw`SELECT NOW()`)[0].now}`)

  await prisma.$disconnect()
  process.exit(remainingCustomers || remainingOrders || remainingReceipts ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
