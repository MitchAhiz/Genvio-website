// Unit tests for the /upload form's server-side save path
// (server/src/services/uploadProducts.js) — POST /api/admin/upload/products
// and POST /api/admin/upload/restock. See product-upload-project.md §4.
//
// The Prisma client (`../db`) is swapped for an in-memory fake before
// uploadProducts.js is required, same pattern as test/products.test.js.
// Unlike that fake, $transaction here snapshots the store, runs the
// callback against a working copy, and only commits the copy back if the
// callback resolves — a throw leaves the real store untouched. This lets
// the "mid-transaction failure writes nothing" test verify real rollback
// semantics, not just "validation ran before any write call happened".

const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

process.env.SUPABASE_URL = 'https://project-ref.supabase.co'
process.env.PRODUCT_IMAGES_BUCKET = 'product-images'

const GOOD_IMAGE_URL = 'https://project-ref.supabase.co/storage/v1/object/public/product-images/card/2026/09/img1.jpg'

// ---------------------------------------------------------------------------
// Fake Prisma client with snapshot/rollback $transaction
// ---------------------------------------------------------------------------

let store

function freshStore() {
  return {
    idCounter: 0,
    products: {},
    categories: {},
    subcategories: {},
    sizeRanges: {}, // key: `${categoryId}:${subcategoryId}`
    variants: {},
    variantImages: {},
    variantSizes: {},
  }
}

function clone(v) {
  return v == null ? v : structuredClone(v)
}

function makeTx(state) {
  return {
    product: {
      async findUnique({ where }) {
        if (where.id) return clone(state.products[where.id]) ?? null
        if (where.slug) {
          const found = Object.values(state.products).find((p) => p.slug === where.slug)
          return found ? clone(found) : null
        }
        return null
      },
      async findFirst({ where }) {
        const needle = where.brand.equals.toLowerCase()
        const found = Object.values(state.products).find((p) => p.brand.toLowerCase() === needle)
        return found ? clone(found) : null
      },
      async create({ data }) {
        const id = `prod-${++state.idCounter}`
        const row = { id, ...data }
        state.products[id] = row
        return clone(row)
      },
    },
    subcategory: {
      async findUnique({ where, include }) {
        const sub = state.subcategories[where.id]
        if (!sub) return null
        const result = clone(sub)
        if (include?.category) result.category = clone(state.categories[sub.categoryId])
        return result
      },
    },
    sizeRange: {
      async findUnique({ where }) {
        const { categoryId, subcategoryId } = where.categoryId_subcategoryId
        const row = state.sizeRanges[`${categoryId}:${subcategoryId}`]
        return row ? clone(row) : null
      },
    },
    productVariant: {
      async create({ data }) {
        const id = `var-${++state.idCounter}`
        const row = { id, ...data }
        state.variants[id] = row
        return clone(row)
      },
      async findUnique({ where, include }) {
        const v = state.variants[where.id]
        if (!v) return null
        const result = clone(v)
        if (include?.product) result.product = clone(state.products[v.productId])
        return result
      },
      async findMany({ where, select }) {
        const rows = Object.values(state.variants).filter((v) => v.productId === where.productId)
        if (!select) return rows.map(clone)
        return rows.map((r) => {
          const out = {}
          for (const key of Object.keys(select)) out[key] = r[key]
          return out
        })
      },
    },
    variantImage: {
      async create({ data }) {
        const id = `vi-${++state.idCounter}`
        const row = { id, ...data }
        state.variantImages[id] = row
        return clone(row)
      },
      async createMany({ data }) {
        for (const row of data) {
          const id = `vi-${++state.idCounter}`
          state.variantImages[id] = { id, ...row }
        }
        return { count: data.length }
      },
    },
    variantSize: {
      async create({ data }) {
        // Test-only failure hook: lets the rollback test simulate a
        // mid-transaction DB error without a real database.
        if (data.size === 'TRIGGER_FAIL') throw new Error('simulated DB failure')
        const id = `vs-${++state.idCounter}`
        const row = { id, updatedBy: null, ...data }
        state.variantSizes[id] = row
        return clone(row)
      },
      async createMany({ data }) {
        // Same test-only failure hook as create() above, applied per row —
        // a single bad row aborts the whole createMany, same as a real DB
        // statement failure would abort the surrounding transaction.
        if (data.some((row) => row.size === 'TRIGGER_FAIL')) {
          throw new Error('simulated DB failure')
        }
        for (const row of data) {
          const id = `vs-${++state.idCounter}`
          state.variantSizes[id] = { id, updatedBy: null, ...row }
        }
        return { count: data.length }
      },
      async findFirst({ where }) {
        const found = Object.values(state.variantSizes).find(
          (s) => s.variantId === where.variantId && s.size === where.size
        )
        return found ? clone(found) : null
      },
      async update({ where, data }) {
        const existing = state.variantSizes[where.id]
        if (!existing) throw new Error(`no variantSize ${where.id}`)
        if (data.quantity && typeof data.quantity === 'object' && 'increment' in data.quantity) {
          existing.quantity += data.quantity.increment
        } else if (data.quantity !== undefined) {
          existing.quantity = data.quantity
        }
        if (data.updatedBy !== undefined) existing.updatedBy = data.updatedBy
        return clone(existing)
      },
    },
  }
}

const prismaStub = {
  // The real client's second arg ({ maxWait, timeout }) is a live-DB
  // concern only — the fake ignores it, since nothing here can time out.
  async $transaction(fn, _options) {
    const working = structuredClone(store)
    const result = await fn(makeTx(working))
    // Only reached if fn didn't throw — commit the working copy back.
    Object.assign(store, working)
    return result
  },
}

const dbPath = require.resolve(path.join(__dirname, '..', 'src', 'db.js'))
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: prismaStub }

const { createUploadProduct, restockVariant } = require(
  path.join(__dirname, '..', 'src', 'services', 'uploadProducts.js')
)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

beforeEach(() => {
  store = freshStore()
  store.categories['cat-women'] = { id: 'cat-women', name: 'Women' }
  store.subcategories['sub-dresses'] = { id: 'sub-dresses', categoryId: 'cat-women', name: 'Dresses' }
  store.sizeRanges['cat-women:sub-dresses'] = {
    categoryId: 'cat-women',
    subcategoryId: 'sub-dresses',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
  }
})

function goodColour(overrides = {}) {
  return {
    colourName: 'Burgundy',
    images: [{ url: GOOD_IMAGE_URL, provenance: 'ai-generated' }],
    sizes: [{ size: 'M', quantity: 5 }],
    ...overrides,
  }
}

function goodInput(overrides = {}) {
  return {
    brand: 'Zara',
    name: 'Linen Wrap Dress',
    subcategoryId: 'sub-dresses',
    price: 32500,
    colours: [goodColour()],
    adminEmail: 'staff@genvio.test',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. Mid-transaction failure writes nothing
// ---------------------------------------------------------------------------

test('a mid-transaction failure rolls back every write — nothing lands', async () => {
  const input = goodInput({
    colours: [
      goodColour({ colourName: 'Burgundy' }),
      goodColour({ colourName: 'Black', sizes: [{ size: 'M', quantity: 3 }, { size: 'TRIGGER_FAIL', quantity: 1 }] }),
    ],
  })
  // TRIGGER_FAIL must pass the size-range check to reach the write loop.
  store.sizeRanges['cat-women:sub-dresses'].sizes.push('TRIGGER_FAIL')

  // A genuine DB-level failure (not a validation UploadError) propagates
  // rather than being swallowed — same as products.js's updateProduct.
  await assert.rejects(() => createUploadProduct(input), /simulated DB failure/)
  assert.deepEqual(store.products, {})
  assert.deepEqual(store.variants, {})
  assert.deepEqual(store.variantImages, {})
  assert.deepEqual(store.variantSizes, {})
})

// ---------------------------------------------------------------------------
// 2. Client-sent categoryId is ignored, derived from subcategory instead
// ---------------------------------------------------------------------------

test('a client-supplied categoryId is ignored — categoryId is derived from the subcategory', async () => {
  const input = goodInput({ categoryId: 'some-other-category-the-client-made-up' })

  const result = await createUploadProduct(input)

  assert.equal(result.ok, true)
  assert.equal(result.product.categoryId, 'cat-women')
  assert.notEqual(result.product.categoryId, 'some-other-category-the-client-made-up')
})

// ---------------------------------------------------------------------------
// 3. Brand "zara " reuses existing "ZARA"
// ---------------------------------------------------------------------------

test('brand normalisation reuses an existing brand\'s exact spelling, case-insensitively', async () => {
  store.products['prod-existing'] = {
    id: 'prod-existing',
    slug: 'zara-something-else',
    brand: 'ZARA',
    name: 'Something Else',
    price: 1000,
    section: 'women',
    status: 'published',
    categoryId: 'cat-women',
    subcategoryId: 'sub-dresses',
  }

  const result = await createUploadProduct(goodInput({ brand: 'zara ' }))

  assert.equal(result.ok, true)
  assert.equal(result.product.brand, 'ZARA')
})

// ---------------------------------------------------------------------------
// 4. Size not in range is rejected; missing SizeRange gives the clear message
// ---------------------------------------------------------------------------

test('a size outside the configured SizeRange is rejected', async () => {
  const result = await createUploadProduct(
    goodInput({ colours: [goodColour({ sizes: [{ size: 'XXL', quantity: 1 }] })] })
  )

  assert.equal(result.ok, false)
  assert.match(result.error, /size range/i)
  assert.deepEqual(store.variantSizes, {})
})

test('no SizeRange configured for the sub-category gives the clear message', async () => {
  delete store.sizeRanges['cat-women:sub-dresses']

  const result = await createUploadProduct(goodInput())

  assert.equal(result.ok, false)
  assert.equal(result.error, 'No size range is set up for this sub-category yet.')
})

// ---------------------------------------------------------------------------
// 5. Non-Supabase or http image URL is rejected
// ---------------------------------------------------------------------------

test('an http (non-https) image URL is rejected', async () => {
  const result = await createUploadProduct(
    goodInput({
      colours: [goodColour({ images: [{ url: 'http://project-ref.supabase.co/x.jpg', provenance: 'ai-generated' }] })],
    })
  )
  assert.equal(result.ok, false)
  assert.match(result.error, /https/i)
})

test('an image URL on a non-Supabase host is rejected', async () => {
  const result = await createUploadProduct(
    goodInput({
      colours: [goodColour({ images: [{ url: 'https://evil.example.com/x.jpg', provenance: 'ai-generated' }] })],
    })
  )
  assert.equal(result.ok, false)
  assert.match(result.error, /supabase/i)
})

test('a lookalike host ("supabase.co.evil.com") is rejected — exact host match, not substring', async () => {
  const result = await createUploadProduct(
    goodInput({
      colours: [
        goodColour({
          images: [
            { url: 'https://project-ref.supabase.co.evil.com/storage/v1/object/public/product-images/x.jpg', provenance: 'ai-generated' },
          ],
        }),
      ],
    })
  )
  assert.equal(result.ok, false)
})

test('a URL on the right host but in a different Storage bucket is rejected', async () => {
  const result = await createUploadProduct(
    goodInput({
      colours: [
        goodColour({
          images: [
            { url: 'https://project-ref.supabase.co/storage/v1/object/public/payment-receipts/x.jpg', provenance: 'ai-generated' },
          ],
        }),
      ],
    })
  )
  assert.equal(result.ok, false)
})

test('a URL on the right host but a different (private/sign) path is rejected', async () => {
  const result = await createUploadProduct(
    goodInput({
      colours: [
        goodColour({
          images: [
            { url: 'https://project-ref.supabase.co/storage/v1/object/sign/product-images/x.jpg', provenance: 'ai-generated' },
          ],
        }),
      ],
    })
  )
  assert.equal(result.ok, false)
})

// ---------------------------------------------------------------------------
// 6. Duplicate colour on an existing product is rejected
// ---------------------------------------------------------------------------

test('adding a colour that already exists on the product (case-insensitive) is rejected', async () => {
  store.products['prod-1'] = {
    id: 'prod-1',
    slug: 'zara-linen-wrap-dress',
    brand: 'ZARA',
    name: 'Linen Wrap Dress',
    price: 32500,
    section: 'women',
    status: 'published',
    categoryId: 'cat-women',
    subcategoryId: 'sub-dresses',
  }
  store.variants['var-existing'] = {
    id: 'var-existing',
    productId: 'prod-1',
    colour: 'Burgundy',
    imageUrl: 'https://project-ref.supabase.co/x.jpg',
  }

  const result = await createUploadProduct({
    productId: 'prod-1',
    colours: [goodColour({ colourName: 'burgundy' })], // same name, different case
    adminEmail: 'staff@genvio.test',
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /already exists/i)
  assert.deepEqual(store.variantImages, {})
})

test('client-sent brand/name/price/subcategoryId are ignored when adding a colour to an existing product', async () => {
  store.products['prod-1'] = {
    id: 'prod-1',
    slug: 'zara-linen-wrap-dress',
    brand: 'ZARA',
    name: 'Linen Wrap Dress',
    price: 32500,
    section: 'women',
    status: 'published',
    categoryId: 'cat-women',
    subcategoryId: 'sub-dresses',
  }

  const result = await createUploadProduct({
    productId: 'prod-1',
    brand: 'Some Other Brand',
    name: 'Some Other Name',
    price: 1,
    subcategoryId: 'some-other-subcategory',
    colours: [goodColour({ colourName: 'Black' })],
    adminEmail: 'staff@genvio.test',
  })

  assert.equal(result.ok, true)
  assert.equal(result.product.brand, 'ZARA')
  assert.equal(result.product.name, 'Linen Wrap Dress')
  assert.equal(result.product.price, 32500)
  assert.equal(result.product.subcategoryId, 'sub-dresses')
})

// ---------------------------------------------------------------------------
// 7. Restock uses an atomic increment
// ---------------------------------------------------------------------------

test('restock increments existing stock atomically, never read-then-write', async () => {
  store.products['prod-1'] = {
    id: 'prod-1',
    categoryId: 'cat-women',
    subcategoryId: 'sub-dresses',
  }
  store.variants['var-1'] = { id: 'var-1', productId: 'prod-1', colour: 'Burgundy' }
  store.variantSizes['vs-1'] = { id: 'vs-1', variantId: 'var-1', size: 'M', quantity: 10, updatedBy: null }

  const result = await restockVariant({
    variantId: 'var-1',
    sizes: [{ size: 'M', quantity: 4 }],
    adminEmail: 'staff@genvio.test',
  })

  assert.equal(result.ok, true)
  assert.equal(store.variantSizes['vs-1'].quantity, 14)
  assert.equal(store.variantSizes['vs-1'].updatedBy, 'staff@genvio.test')
})

test('restock inserts a fresh row for a size with no existing stock row, if it is in range', async () => {
  store.products['prod-1'] = {
    id: 'prod-1',
    categoryId: 'cat-women',
    subcategoryId: 'sub-dresses',
  }
  store.variants['var-1'] = { id: 'var-1', productId: 'prod-1', colour: 'Burgundy' }

  const result = await restockVariant({
    variantId: 'var-1',
    sizes: [{ size: 'S', quantity: 6 }],
    adminEmail: 'staff@genvio.test',
  })

  assert.equal(result.ok, true)
  const created = Object.values(store.variantSizes).find((s) => s.variantId === 'var-1' && s.size === 'S')
  assert.equal(created.quantity, 6)
})

test('restock rejects a size that is not in the SizeRange', async () => {
  store.products['prod-1'] = {
    id: 'prod-1',
    categoryId: 'cat-women',
    subcategoryId: 'sub-dresses',
  }
  store.variants['var-1'] = { id: 'var-1', productId: 'prod-1', colour: 'Burgundy' }

  const result = await restockVariant({
    variantId: 'var-1',
    sizes: [{ size: 'XXL', quantity: 4 }],
    adminEmail: 'staff@genvio.test',
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /size range/i)
})

// ---------------------------------------------------------------------------
// Price must be a whole number greater than 0
// ---------------------------------------------------------------------------

test('a non-integer price is rejected with the exact message', async () => {
  const result = await createUploadProduct(goodInput({ price: 325.5 }))

  assert.equal(result.ok, false)
  assert.equal(result.error, 'Price must be a whole number greater than 0')
  assert.deepEqual(store.products, {})
})

test('a zero or negative price is rejected with the exact message', async () => {
  const result = await createUploadProduct(goodInput({ price: 0 }))

  assert.equal(result.ok, false)
  assert.equal(result.error, 'Price must be a whole number greater than 0')
})

// ---------------------------------------------------------------------------
// Duplicate sizes within one request are rejected — createUploadProduct
// ---------------------------------------------------------------------------

test('createUploadProduct rejects a colour that lists the same size twice', async () => {
  const result = await createUploadProduct(
    goodInput({
      colours: [goodColour({ sizes: [{ size: 'M', quantity: 3 }, { size: 'M', quantity: 2 }] })],
    })
  )

  assert.equal(result.ok, false)
  assert.equal(result.error, 'Size "M" is listed twice')
  assert.deepEqual(store.variantSizes, {})
})

// ---------------------------------------------------------------------------
// Duplicate sizes within one request are rejected — restockVariant
// ---------------------------------------------------------------------------

test('restockVariant rejects a request that lists the same size twice', async () => {
  store.products['prod-1'] = {
    id: 'prod-1',
    categoryId: 'cat-women',
    subcategoryId: 'sub-dresses',
  }
  store.variants['var-1'] = { id: 'var-1', productId: 'prod-1', colour: 'Burgundy' }
  store.variantSizes['vs-1'] = { id: 'vs-1', variantId: 'var-1', size: 'M', quantity: 10, updatedBy: null }

  const result = await restockVariant({
    variantId: 'var-1',
    sizes: [{ size: 'M', quantity: 2 }, { size: 'M', quantity: 3 }],
    adminEmail: 'staff@genvio.test',
  })

  assert.equal(result.ok, false)
  assert.equal(result.error, 'Size "M" is listed twice')
  // Untouched: the duplicate is caught before either increment runs.
  assert.equal(store.variantSizes['vs-1'].quantity, 10)
})

// ---------------------------------------------------------------------------
// At most 10 colours per request
// ---------------------------------------------------------------------------

test('more than 10 colours in one request is rejected', async () => {
  const colours = Array.from({ length: 11 }, (_, i) => goodColour({ colourName: `Colour ${i}` }))

  const result = await createUploadProduct(goodInput({ colours }))

  assert.equal(result.ok, false)
  assert.equal(result.error, 'At most 10 colours can be saved at once')
  assert.deepEqual(store.products, {})
})

test('exactly 10 colours in one request is accepted', async () => {
  const colours = Array.from({ length: 10 }, (_, i) => goodColour({ colourName: `Colour ${i}` }))

  const result = await createUploadProduct(goodInput({ colours }))

  assert.equal(result.ok, true)
  assert.equal(Object.values(store.variants).length, 10)
})
