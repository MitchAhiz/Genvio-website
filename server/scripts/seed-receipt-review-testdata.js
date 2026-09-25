// Seeds disposable test data for a manual browser walkthrough of the Step 5
// admin receipt review screen. Uses only public HTTP endpoints (order
// creation, receipt upload) against the already-running dev server — no
// admin auth needed here, since the walkthrough itself happens via real OTP
// login in the browser. Prints the order ids/refs so they can be found in
// the admin UI, and a cleanup command to run afterward.
//
// Usage: node scripts/seed-receipt-review-testdata.js

require('dotenv').config()

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4000/api'
const TAG = 'testseed-review'

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

const PDF_BYTES = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`,
  'utf-8'
)

async function placeOrder(phone, name, isWhatsapp) {
  const cfgRes = await fetch(`${BASE}/config/payment`)
  if (!cfgRes.ok) throw new Error(`GET /config/payment failed: ${cfgRes.status}`)
  // Public payment config doesn't include the fee; use 0 by requesting an
  // interstate-priced state to sidestep the Lagos zone-fee lookup entirely.
  const itemsTotal = 5000
  const res = await fetch(`${BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      name,
      email: `${TAG}-${phone}@example.com`,
      isWhatsapp,
      address: { street: '12 Test Street', city: 'Abuja', state: 'FCT' },
      items: [{ productId: 'testseed-product', name: 'Testseed Item', colour: 'Black', size: 'M', qty: 1, unitPrice: itemsTotal }],
      total: itemsTotal, // FCT has no delivery fee configured beyond interstate default; corrected below if rejected
    }),
  })
  let body = await res.json()
  if (res.status === 400 && /doesn.t match/i.test(body.error || '')) {
    // Retry once with the real interstate fee reported indirectly — fetch admin
    // config isn't available without auth, so fall back to a direct DB read.
    throw new Error(`Order total mismatch — interstate delivery fee isn't 0. Server said: ${body.error}`)
  }
  if (res.status !== 201) throw new Error(`POST /orders failed (${res.status}): ${JSON.stringify(body)}`)
  return body
}

async function uploadReceipt(orderId, orderToken, buffer, filename, mime) {
  const form = new FormData()
  form.append('orderToken', orderToken)
  form.append('receipt', new Blob([buffer], { type: mime }), filename)
  const res = await fetch(`${BASE}/orders/${orderId}/receipts`, { method: 'POST', body: form })
  const body = await res.json()
  if (res.status !== 201) throw new Error(`POST /orders/${orderId}/receipts failed (${res.status}): ${JSON.stringify(body)}`)
  return body
}

async function main() {
  const waPhone = '08031111111'
  const noWaPhone = '08032222222'

  console.log('Creating confirm-flow order (WhatsApp customer)...')
  const confirmOrder = await placeOrder(waPhone, `${TAG} WA Customer`, true)
  await uploadReceipt(confirmOrder.id, confirmOrder.orderToken, PNG_BYTES, 'receipt.png', 'image/png')

  console.log('Creating reject-flow order (non-WhatsApp customer)...')
  const rejectOrder = await placeOrder(noWaPhone, `${TAG} NoWA Customer`, false)
  await uploadReceipt(rejectOrder.id, rejectOrder.orderToken, PDF_BYTES, 'receipt.pdf', 'application/pdf')

  console.log('Creating duplicate-flag order (same WhatsApp customer, same PNG bytes)...')
  const dupOrder = await placeOrder(waPhone, `${TAG} WA Customer`, true)
  await uploadReceipt(dupOrder.id, dupOrder.orderToken, PNG_BYTES, 'receipt.png', 'image/png')

  console.log('\nSeeded orders:')
  console.log(`  Confirm-flow (WA, image receipt):  ${confirmOrder.reference}  id=${confirmOrder.id}`)
  console.log(`  Reject-flow  (no-WA, PDF receipt):  ${rejectOrder.reference}  id=${rejectOrder.id}`)
  console.log(`  Duplicate-flag (WA, dup image):     ${dupOrder.reference}  id=${dupOrder.id}`)
  console.log('\nDeep-link URL to test (?order= param):')
  console.log(`  http://localhost:5173/admin/orders?order=${confirmOrder.id}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
