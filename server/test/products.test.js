// Unit tests for updateProduct's reserved-stock guard
// (server/src/services/products.js). Confirms the fix described in
// prisma/migrations/20260924121000_add_subcategories_and_size_ranges:
// an admin edit that would drop a size's quantity below its current
// reservedQuantity is rejected with a clear error, never silently clamped.
//
// The Prisma client (`../db`) is swapped for an in-memory fake before
// products.js is required, so nothing touches a real database — same
// pattern as test/delivery-lock.test.js. $transaction just runs the
// callback against the same fake, since none of these tests need real
// transactional rollback semantics to prove the guard fires before any
// write lands.

const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

// ---------------------------------------------------------------------------
// Fake Prisma client
// ---------------------------------------------------------------------------

let variantSizes // Map<id, { id, variantId, size, quantity, reservedQuantity }>
let products // Map<id, { id, ...fields }>

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}

function makeTx() {
  return {
    product: {
      async update({ where, data }) {
        const existing = products.get(where.id)
        products.set(where.id, { ...existing, ...data })
        return clone(products.get(where.id))
      },
    },
    productVariant: {
      async update({ where, data }) {
        return { id: where.id, ...data }
      },
      async create({ data }) {
        return { id: 'new-variant-id', ...data }
      },
    },
    variantSize: {
      async findUnique({ where, select }) {
        const row = variantSizes.get(where.id)
        if (!row) return null
        if (!select) return clone(row)
        const out = {}
        for (const key of Object.keys(select)) out[key] = row[key]
        return out
      },
      async update({ where, data }) {
        const existing = variantSizes.get(where.id)
        if (!existing) throw new Error(`no variantSize ${where.id}`)
        const merged = { ...existing, ...data }
        variantSizes.set(where.id, merged)
        return clone(merged)
      },
      async create({ data }) {
        const id = `vs-${variantSizes.size + 1}`
        const row = { id, reservedQuantity: 0, ...data }
        variantSizes.set(id, row)
        return clone(row)
      },
    },
  }
}

const prismaStub = {
  async $transaction(fn) {
    return fn(makeTx())
  },
  product: {
    async findUnique({ where }) {
      const existing = products.get(where.id)
      if (!existing) return null
      return clone({ ...existing, images: [], variants: [], category: null })
    },
  },
}

const dbPath = require.resolve(path.join(__dirname, '..', 'src', 'db.js'))
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: prismaStub }

const { updateProduct } = require(path.join(__dirname, '..', 'src', 'services', 'products.js'))

beforeEach(() => {
  variantSizes = new Map()
  products = new Map()
  products.set('prod-1', { id: 'prod-1', name: 'Satin Midi Dress' })
})

function seedSize({ id = 'vs-1', variantId = 'var-1', size = 'M', quantity = 10, reservedQuantity = 5 } = {}) {
  variantSizes.set(id, { id, variantId, size, quantity, reservedQuantity })
  return variantSizes.get(id)
}

// ---------------------------------------------------------------------------
// a. Reject: new quantity would drop below reservedQuantity
// ---------------------------------------------------------------------------

test('updateProduct rejects a quantity drop below reservedQuantity, with a clear error and no silent clamping', async () => {
  seedSize({ id: 'vs-1', size: 'M', quantity: 10, reservedQuantity: 5 })

  const result = await updateProduct('prod-1', {
    variants: [{ id: 'var-1', sizes: [{ id: 'vs-1', size: 'M', quantity: 3 }] }],
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /reserved/i)
  assert.match(result.error, /\bM\b/)
  assert.match(result.error, /5/)

  // No silent clamping: the stored quantity must be untouched, not floored
  // at reservedQuantity or anything else.
  assert.equal(variantSizes.get('vs-1').quantity, 10)
})

// ---------------------------------------------------------------------------
// b. Allow: new quantity >= reservedQuantity
// ---------------------------------------------------------------------------

test('updateProduct allows a quantity update that stays at or above reservedQuantity', async () => {
  seedSize({ id: 'vs-1', size: 'M', quantity: 10, reservedQuantity: 5 })

  const result = await updateProduct('prod-1', {
    variants: [{ id: 'var-1', sizes: [{ id: 'vs-1', size: 'M', quantity: 5 }] }],
  })

  assert.equal(result.ok, true)
  assert.equal(variantSizes.get('vs-1').quantity, 5)
})

test('updateProduct allows raising quantity well above reservedQuantity', async () => {
  seedSize({ id: 'vs-1', size: 'M', quantity: 10, reservedQuantity: 5 })

  const result = await updateProduct('prod-1', {
    variants: [{ id: 'var-1', sizes: [{ id: 'vs-1', size: 'M', quantity: 20 }] }],
  })

  assert.equal(result.ok, true)
  assert.equal(variantSizes.get('vs-1').quantity, 20)
})

// ---------------------------------------------------------------------------
// c. reservedQuantity itself: updateProduct's payload never carries a
// reservedQuantity field (it's only set elsewhere, e.g. order reservation
// logic) — so there is no separate "update reservedQuantity" code path in
// this function to test. Confirm it stays untouched by an ordinary size
// update, since that's the guarantee the guard depends on.
// ---------------------------------------------------------------------------

test('updateProduct never modifies reservedQuantity itself — it is not part of this payload', async () => {
  seedSize({ id: 'vs-1', size: 'M', quantity: 10, reservedQuantity: 5 })

  const result = await updateProduct('prod-1', {
    variants: [{ id: 'var-1', sizes: [{ id: 'vs-1', size: 'M', quantity: 8 }] }],
  })

  assert.equal(result.ok, true)
  assert.equal(variantSizes.get('vs-1').reservedQuantity, 5)
})

// ---------------------------------------------------------------------------
// Untouched sizes with no matching id in the guard check.
// ---------------------------------------------------------------------------

test('updateProduct guard only fires for the size actually being updated, others are unaffected', async () => {
  seedSize({ id: 'vs-1', size: 'M', quantity: 10, reservedQuantity: 5 })
  seedSize({ id: 'vs-2', size: 'L', quantity: 2, reservedQuantity: 4 }) // already over-reserved, untouched

  const result = await updateProduct('prod-1', {
    variants: [{ id: 'var-1', sizes: [{ id: 'vs-1', size: 'M', quantity: 5 }] }],
  })

  assert.equal(result.ok, true)
  assert.equal(variantSizes.get('vs-2').quantity, 2) // untouched, guard never evaluated it
})
