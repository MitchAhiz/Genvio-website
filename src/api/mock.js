// Dev-only fixtures, served when VITE_MOCK_API=1 (see client.js). Lets the UI
// be reviewed without the database. Photos are Unsplash placeholders.
const img = (id) => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`

const sizes = (map) => Object.entries(map).map(([size, quantity], i) => ({ id: `${size}-${i}`, size, quantity }))
const days = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

const PRODUCTS = [
  {
    id: 'm1', slug: 'unstructured-linen-blazer', name: 'Unstructured Linen Blazer', brand: 'Maison Noir',
    category: { name: 'Tailoring' }, section: 'men', price: 68000, status: 'published', createdAt: days(2),
    images: [{ id: 'm1a', url: img('1617137968427-85924c800a22'), sortOrder: 0 }],
    variants: [
      { id: 'm1v1', colour: 'Navy', hex: '#1F2A44', imageUrl: null, sizes: sizes({ S: 4, M: 6, L: 5, XL: 2 }) },
      { id: 'm1v2', colour: 'Sand', hex: '#D6C3A5', imageUrl: null, sizes: sizes({ S: 2, M: 3, L: 0, XL: 1 }) },
    ],
  },
  {
    id: 'm2', slug: 'brushed-cotton-crew', name: 'Brushed Cotton Crew', brand: 'Genvio', category: { name: 'Knitwear' },
    section: 'men', price: 24500, status: 'published', createdAt: days(20),
    images: [{ id: 'm2a', url: img('1516826957135-700dedea698c'), sortOrder: 0 }],
    variants: [{ id: 'm2v1', colour: 'Dusty Pink', hex: '#E8C4C4', imageUrl: null, sizes: sizes({ S: 3, M: 8, L: 6 }) }],
  },
  {
    id: 'm3', slug: 'washed-denim-five-pack', name: 'Washed Denim, Five Fits', brand: 'Atelier 9', category: { name: 'Denim' },
    section: 'men', price: 31000, status: 'published', createdAt: days(40),
    images: [{ id: 'm3a', url: img('1604176354204-9268737828e4'), sortOrder: 0 }],
    variants: [
      { id: 'm3v1', colour: 'Indigo', hex: '#2E3F63', imageUrl: null, sizes: sizes({ S: 5, M: 5, L: 5, XL: 5 }) },
      { id: 'm3v2', colour: 'Charcoal', hex: '#3A3A3A', imageUrl: null, sizes: sizes({ M: 2, L: 4 }) },
    ],
  },
  {
    id: 'm4', slug: 'bomber-in-black', name: 'Bomber in Black', brand: 'Maison Noir', category: { name: 'Outerwear' },
    section: 'men', price: 54000, status: 'published', createdAt: days(3),
    images: [{ id: 'm4a', url: img('1488161628813-04466f872be2'), sortOrder: 0 }],
    variants: [{ id: 'm4v1', colour: 'Black', hex: '#171717', imageUrl: null, sizes: sizes({ M: 3, L: 4, XL: 2 }) }],
  },
  {
    id: 'w1', slug: 'silk-wrap-blouse', name: 'Silk Wrap Blouse', brand: 'Maison Noir', category: { name: 'Tops' },
    section: 'women', price: 18500, status: 'published', createdAt: days(1),
    images: [{ id: 'w1a', url: img('1485968579580-b6d095142e6e'), sortOrder: 0 }, { id: 'w1b', url: img('1509631179647-0177331693ae'), sortOrder: 1 }],
    variants: [
      { id: 'w1v1', colour: 'Ivory', hex: '#F3EEE4', imageUrl: img('1485968579580-b6d095142e6e'), sizes: sizes({ XS: 3, S: 6, M: 10, L: 4, XL: 2 }) },
      { id: 'w1v2', colour: 'Dusty Rose', hex: '#D8A7B1', imageUrl: img('1509631179647-0177331693ae'), sizes: sizes({ XS: 1, S: 3, M: 5, L: 2 }) },
    ],
  },
  {
    id: 'w2', slug: 'pleated-midi-skirt', name: 'Pleated Midi Skirt', brand: 'Genvio', category: { name: 'Skirts' },
    section: 'women', price: 27000, status: 'published', createdAt: days(12),
    images: [{ id: 'w2a', url: img('1509631179647-0177331693ae'), sortOrder: 0 }],
    variants: [{ id: 'w2v1', colour: 'Plum', hex: '#3B1F35', imageUrl: null, sizes: sizes({ S: 4, M: 7, L: 3 }) }],
  },
  {
    id: 'w3', slug: 'knit-wrap-cardigan', name: 'Knit Wrap Cardigan', brand: 'Atelier 9', category: { name: 'Knitwear' },
    section: 'women', price: 32500, status: 'published', createdAt: days(30),
    images: [{ id: 'w3a', url: img('1558769132-cb1aea458c5e'), sortOrder: 0 }],
    variants: [{ id: 'w3v1', colour: 'Oat', hex: '#D9CDB8', imageUrl: null, sizes: sizes({ XS: 2, S: 2, M: 4, L: 2 }) }],
  },
  {
    id: 'k1', slug: 'everyday-sweatshirt-set', name: 'Everyday Sweatshirt Set', brand: 'Genvio Kids', category: { name: 'Sets' },
    section: 'kids', price: 12500, status: 'published', createdAt: days(4),
    images: [{ id: 'k1a', url: img('1620799140408-edc6dcb6d633'), sortOrder: 0 }],
    variants: [
      { id: 'k1v1', colour: 'White', hex: '#FFFFFF', imageUrl: null, sizes: sizes({ '2-3Y': 6, '4-5Y': 8, '6-7Y': 5, '8-9Y': 2 }) },
      { id: 'k1v2', colour: 'Sage', hex: '#6F8068', imageUrl: null, sizes: sizes({ '2-3Y': 3, '4-5Y': 4, '6-7Y': 0 }) },
    ],
  },
  {
    id: 'k2', slug: 'party-dress-in-gold', name: 'Party Dress in Gold', brand: 'Atelier 9', category: { name: 'Occasion' },
    section: 'kids', price: 16000, status: 'published', createdAt: days(9),
    images: [{ id: 'k2a', url: img('1520006403909-838d6b92c22e'), sortOrder: 0 }],
    variants: [{ id: 'k2v1', colour: 'Gold', hex: '#F3D9A4', imageUrl: null, sizes: sizes({ '4-5Y': 5, '6-7Y': 6, '8-9Y': 4 }) }],
  },
]

const WHOLESALE = [
  { id: 'l1', url: img('1558769132-cb1aea458c5e'), caption: 'Knit programme, autumn', category: 'Knitwear', sortOrder: 0 },
  { id: 'l2', url: img('1490481651871-ab68de25d43d'), caption: 'Linen and cotton separates', category: 'Separates', sortOrder: 1 },
  { id: 'l3', url: img('1604176354204-9268737828e4'), caption: 'Denim, five washes', category: 'Denim', sortOrder: 2 },
  { id: 'l4', url: img('1617137968427-85924c800a22'), caption: 'Tailoring, navy and charcoal', category: 'Tailoring', sortOrder: 3 },
  { id: 'l5', url: img('1485968579580-b6d095142e6e'), caption: 'Silk blouses, ivory and rose', category: 'Separates', sortOrder: 4 },
  { id: 'l6', url: img('1520006403909-838d6b92c22e'), caption: 'Printed rail', category: 'Prints', sortOrder: 5 },
  { id: 'l7', url: img('1620799140408-edc6dcb6d633'), caption: null, category: 'Kids', sortOrder: 6 },
  { id: 'l8', url: img('1509631179647-0177331693ae'), caption: 'Rose set', category: 'Separates', sortOrder: 7 },
]

// Customer records. Only `exists` / `hasSavedDetails` are ever exposed by the
// lookup; name and address come back solely through verify-pin, and only for
// the right PIN. `pin` is plaintext here because this is a dev fixture — the
// real backend stores a bcrypt hash and never returns it.
const CUSTOMERS = {
  // Has saved details behind PIN 1234.
  '08012345678': {
    name: 'Adaeze Okafor',
    address: { street: '14 Bourdillon Road, Ikoyi', city: 'Lagos', state: 'Lagos' },
    pin: '1234',
    detailsSaved: true,
    saveOptedOut: false,
  },
  // Ordered before, declined saving.
  '08023456789': { name: 'Tunde Bakare', address: null, pin: null, detailsSaved: false, saveOptedOut: true },
}

const MAX_PIN_ATTEMPTS = 3
const pinAttempts = {}

// Synthetic bank details — the real ones come from server env vars.
const PAYMENT = {
  method: 'bank_transfer',
  bankName: 'Guaranty Trust Bank',
  accountNumber: '0123456789',
  accountName: 'Genvio Exotic Apparel Ltd',
}

const ORDERS = []

function fail(status, message) {
  const err = new Error(message)
  err.status = status
  throw err
}

function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('234')) d = '0' + d.slice(3)
  if (d.length === 10 && /^[789]/.test(d)) d = '0' + d
  return /^0[789][01]\d{8}$/.test(d) ? d : null
}

export function mockFetch(path, options = {}) {
  const url = new URL(path, 'http://mock')
  const q = url.searchParams
  const p = url.pathname
  const method = (options.method || 'GET').toUpperCase()
  const body = options.body ? JSON.parse(options.body) : {}
  const published = PRODUCTS.filter((x) => x.status === 'published')

  if (p === '/api/customers/lookup') {
    const phone = normalizePhone(q.get('phone'))
    if (!phone) fail(400, 'Enter a valid Nigerian mobile number')
    const c = CUSTOMERS[phone]
    return { exists: Boolean(c), hasSavedDetails: Boolean(c?.detailsSaved && c?.pin) }
  }
  if (p === '/api/customers/verify-pin' && method === 'POST') {
    const phone = normalizePhone(body.phone)
    if (!phone) fail(400, 'Enter a valid Nigerian mobile number')
    if (!/^\d{4}$/.test(String(body.pin || ''))) fail(400, 'Enter your 4-digit PIN')
    if ((pinAttempts[phone] || 0) >= MAX_PIN_ATTEMPTS) return { verified: false, locked: true }
    const c = CUSTOMERS[phone]
    if (!c?.detailsSaved || c.pin !== body.pin) {
      pinAttempts[phone] = (pinAttempts[phone] || 0) + 1
      return { verified: false, locked: pinAttempts[phone] >= MAX_PIN_ATTEMPTS }
    }
    pinAttempts[phone] = 0
    return { verified: true, name: c.name, address: c.address }
  }
  if (p === '/api/customers/save-details' && method === 'POST') {
    const phone = normalizePhone(body.phone)
    if (!phone) fail(400, 'Enter a valid Nigerian mobile number')
    if (!/^\d{4}$/.test(String(body.pin || ''))) fail(400, 'Choose a 4-digit PIN')
    if (!ORDERS.some((o) => o.reference === body.reference && o.customer.phone === phone)) {
      fail(403, 'This request could not be verified against your order.')
    }
    CUSTOMERS[phone] = {
      name: body.name,
      address: body.address,
      pin: body.pin,
      detailsSaved: true,
      saveOptedOut: false,
    }
    pinAttempts[phone] = 0
    return { saved: true }
  }
  if (p === '/api/customers/decline-save' && method === 'POST') {
    const phone = normalizePhone(body.phone)
    if (!phone) fail(400, 'Enter a valid Nigerian mobile number')
    if (!ORDERS.some((o) => o.reference === body.reference && o.customer.phone === phone)) {
      fail(403, 'This request could not be verified against your order.')
    }
    CUSTOMERS[phone] = { ...(CUSTOMERS[phone] || { name: '', address: null, pin: null, detailsSaved: false }), saveOptedOut: true }
    return { optedOut: true }
  }
  if (p === '/api/config/payment') return PAYMENT
  if (p === '/api/orders' && method === 'POST') {
    const phone = normalizePhone(body.phone)
    if (!phone) fail(400, 'Enter a valid Nigerian mobile number')
    const prior = CUSTOMERS[phone]
    const saveState = prior?.detailsSaved && prior?.pin ? 'saved' : prior?.saveOptedOut ? 'opted_out' : 'offer'
    CUSTOMERS[phone] = {
      name: body.name,
      address: body.address,
      pin: prior?.pin ?? null,
      detailsSaved: Boolean(prior?.detailsSaved),
      saveOptedOut: Boolean(prior?.saveOptedOut),
    }
    const d = new Date()
    const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
    const order = {
      id: `ord_${ORDERS.length + 1}`,
      reference: `GEA-${stamp}-${String(ORDERS.length + 1).padStart(3, '0')}`,
      status: 'pending_payment',
      paymentMethod: 'bank_transfer',
      total: body.total,
      items: body.items,
      address: body.address,
      customer: { name: body.name, phone },
      saveState,
      createdAt: d.toISOString(),
    }
    ORDERS.push(order)
    return order
  }
  const deliveryMatch = p.match(/^\/api\/orders\/([^/]+)\/delivery$/)
  if (deliveryMatch && method === 'PATCH') {
    const order = ORDERS.find((o) => o.id === decodeURIComponent(deliveryMatch[1]))
    if (!order || order.reference !== body.reference) fail(404, 'Order not found')
    order.address = body.address
    order.customer = { ...order.customer, name: body.name }
    return order
  }

  if (p === '/api/products') {
    let list = published
    if (q.get('section')) list = list.filter((x) => x.section === q.get('section'))
    if (q.get('category')) list = list.filter((x) => x.category.name === q.get('category'))
    return list
  }
  if (p.startsWith('/api/products/')) {
    const slug = decodeURIComponent(p.slice('/api/products/'.length))
    const found = PRODUCTS.find((x) => x.slug === slug)
    if (!found) fail(404, 'Product not found')
    return found
  }
  if (p === '/api/categories') {
    let list = published
    if (q.get('section')) list = list.filter((x) => x.section === q.get('section'))
    return [...new Set(list.map((x) => x.category.name))].sort()
  }
  if (p === '/api/wholesale') {
    return q.get('category') ? WHOLESALE.filter((x) => x.category === q.get('category')) : WHOLESALE
  }
  if (p === '/api/wholesale/categories') {
    return [...new Set(WHOLESALE.map((x) => x.category).filter(Boolean))].sort()
  }
  fail(404, `Not found (${p})`)
}
