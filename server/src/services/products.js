const prisma = require('../db')
const { logActivity } = require('../utils/logActivity')

const productWithRelations = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    include: { sizes: true },
  },
  category: true,
}

// --- Read ---

async function getProducts({ category, section, includeDrafts = false } = {}) {
  const where = {}
  if (!includeDrafts) where.status = 'published'
  if (category) where.category = { name: category }
  if (section) where.section = section

  return prisma.product.findMany({
    where,
    include: productWithRelations,
    orderBy: { createdAt: 'desc' },
  })
}

async function getProductBySlug(slug) {
  return prisma.product.findUnique({
    where: { slug },
    include: productWithRelations,
  })
}

async function getProductById(id) {
  return prisma.product.findUnique({
    where: { id },
    include: productWithRelations,
  })
}

// Upload-flow dedup lookup. Query the database directly so the staff page
// never needs to load the catalogue, and include drafts because an existing
// unfinished product must not be mistaken for a new one.
async function searchUploadProducts(query) {
  const term = String(query || '').trim()
  if (term.length < 2) return []

  const products = await prisma.product.findMany({
    where: { name: { contains: term, mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      brand: true,
      slug: true,
      price: true,
      section: true,
      status: true,
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      variants: {
        select: {
          id: true,
          colour: true,
          imageUrl: true,
          sizes: { select: { id: true, size: true, quantity: true, reservedQuantity: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
    take: 10,
  })
  return products
}

async function getCategories({ section } = {}) {
  const where = { status: 'published', categoryId: { not: null } }
  if (section) where.section = section
  const results = await prisma.product.findMany({
    where,
    select: { category: { select: { name: true } } },
    distinct: ['categoryId'],
  })
  return results.map((r) => r.category.name).sort((a, b) => a.localeCompare(b))
}

// Distinct brand names across published products, trimmed and deduped
// case-insensitively (e.g. "zara" and "Zara" collapse to one entry), for the
// admin Footer settings brand picker.
async function getBrands() {
  const results = await prisma.product.findMany({
    where: { status: 'published' },
    select: { brand: true },
    distinct: ['brand'],
  })
  const seen = new Map()
  for (const { brand } of results) {
    const trimmed = (brand || '').trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!seen.has(key)) seen.set(key, trimmed)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

async function getInventory(productId) {
  const variants = await prisma.productVariant.findMany({
    where: { productId },
    include: { sizes: true },
  })
  return variants.map((v) => ({
    colour: v.colour,
    sizes: Object.fromEntries(v.sizes.map((s) => [s.size, s.quantity])),
  }))
}

// --- Write ---

async function resolveUniqueSlug(baseSlug) {
  const existing = await prisma.product.findUnique({ where: { slug: baseSlug } })
  if (!existing) return baseSlug

  let suffix = 2
  while (true) {
    const candidate = `${baseSlug}-${suffix}`
    const found = await prisma.product.findUnique({ where: { slug: candidate } })
    if (!found) return candidate
    suffix++
  }
}

// categoryId comes straight from the client on both create and update; the
// DB foreign key (products_category_id_fkey) would eventually reject a bad
// id anyway, but only as an unhandled 500 — checked here first so a
// mistyped/stale id gets a clean 400 instead, same pattern as
// subcategories.js's categoryExists() / sizeRanges.js's validScope().
async function categoryExists(categoryId) {
  return Boolean(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))
}

async function createProduct({ slug, name, brand, categoryId, price, section = 'women' }) {
  if (categoryId && !(await categoryExists(categoryId))) {
    return { ok: false, error: 'categoryId is not a valid category' }
  }
  const uniqueSlug = await resolveUniqueSlug(slug)
  const product = await prisma.product.create({
    data: { slug: uniqueSlug, name, brand, categoryId, price, section, status: 'draft' },
    include: productWithRelations,
  })
  return { ok: true, product }
}

// Thrown inside the updateProduct transaction to reject a reserved-stock
// violation, or an invalid categoryId, without leaking a raw Prisma/
// transaction error to the caller.
class UpdateProductError extends Error {}

async function updateProduct(id, { name, brand, price, section, categoryId, status, variants }) {
  try {
    if (categoryId && !(await categoryExists(categoryId))) {
      throw new UpdateProductError('categoryId is not a valid category')
    }
    await prisma.$transaction(async (tx) => {
      const updates = {}
      if (name !== undefined) updates.name = name
      if (brand !== undefined) updates.brand = brand
      if (price !== undefined) updates.price = price
      if (section !== undefined) updates.section = section
      if (categoryId !== undefined) updates.categoryId = categoryId || null
      if (status === 'draft') updates.status = 'draft'

      if (Object.keys(updates).length > 0) {
        await tx.product.update({ where: { id }, data: updates })
      }

      if (variants && Array.isArray(variants)) {
        for (const v of variants) {
          if (v.id) {
            const variantUpdates = {}
            if (v.colour !== undefined) variantUpdates.colour = v.colour
            if (v.imageUrl !== undefined) variantUpdates.imageUrl = v.imageUrl
            if (Object.keys(variantUpdates).length > 0) {
              await tx.productVariant.update({ where: { id: v.id }, data: variantUpdates })
            }
            if (v.sizes && Array.isArray(v.sizes)) {
              for (const s of v.sizes) {
                if (s.id) {
                  const current = await tx.variantSize.findUnique({
                    where: { id: s.id },
                    select: { size: true, reservedQuantity: true },
                  })
                  if (current && s.quantity < current.reservedQuantity) {
                    throw new UpdateProductError(
                      `Can't set quantity to ${s.quantity} for size ${current.size} — ${current.reservedQuantity} units are currently reserved by pending orders`
                    )
                  }
                  await tx.variantSize.update({
                    where: { id: s.id },
                    data: { size: s.size, quantity: s.quantity },
                  })
                } else {
                  await tx.variantSize.create({
                    data: { variantId: v.id, size: s.size, quantity: s.quantity },
                  })
                }
              }
            }
          } else {
            const created = await tx.productVariant.create({
              data: {
                productId: id,
                colour: v.colour,
                imageUrl: v.imageUrl || null,
              },
            })
            if (v.sizes && Array.isArray(v.sizes)) {
              for (const s of v.sizes) {
                await tx.variantSize.create({
                  data: { variantId: created.id, size: s.size, quantity: s.quantity },
                })
              }
            }
          }
        }
      }

    })
  } catch (err) {
    if (err instanceof UpdateProductError) return { ok: false, error: err.message }
    throw err
  }

  if (status === 'published') {
    const result = await publishProduct(id)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, product: result.product }
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: productWithRelations,
  })
  return { ok: true, product }
}

async function addImages(productId, urls) {
  const existing = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: 'desc' },
    take: 1,
  })
  let nextOrder = existing.length > 0 ? existing[0].sortOrder + 1 : 0

  const created = []
  for (const url of urls) {
    const img = await prisma.productImage.create({
      data: { productId, url, sortOrder: nextOrder++ },
    })
    created.push(img)
  }
  return created
}

async function publishProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productWithRelations,
  })
  if (!product) return { ok: false, error: 'Product not found' }
  if (product.status === 'published') return { ok: false, error: 'Product is already published' }
  if (product.images.length === 0) return { ok: false, error: 'Cannot publish: product has no images' }
  if (product.variants.length === 0) return { ok: false, error: 'Cannot publish: product has no colour variants' }

  const hasAnySizes = product.variants.some((v) => v.sizes.length > 0)
  if (!hasAnySizes) return { ok: false, error: 'Cannot publish: no sizes defined on any variant' }

  const updated = await prisma.product.update({
    where: { id },
    data: { status: 'published' },
    include: productWithRelations,
  })
  return { ok: true, product: updated }
}

async function unpublishProduct(id) {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return { ok: false, error: 'Product not found' }
  const updated = await prisma.product.update({
    where: { id },
    data: { status: 'draft' },
    include: productWithRelations,
  })
  return { ok: true, product: updated }
}

async function bulkUpdate(ids, action) {
  const results = []
  for (const id of ids) {
    if (action === 'publish') {
      const result = await publishProduct(id)
      results.push({ id, ok: result.ok, error: result.ok ? undefined : result.error })
    } else if (action === 'unpublish') {
      const result = await unpublishProduct(id)
      results.push({ id, ok: result.ok, error: result.ok ? undefined : result.error })
    } else if (action === 'delete') {
      try {
        await prisma.product.delete({ where: { id } })
        results.push({ id, ok: true })
      } catch (err) {
        results.push({ id, ok: false, error: 'Delete failed' })
      }
    }
  }
  await logActivity(`product.bulk_${action}`, 'product', null, { ids, results })
  return results
}

async function reorderImages(productId, orderedIds) {
  await prisma.$transaction(
    orderedIds.map((imageId, index) =>
      prisma.productImage.update({ where: { id: imageId }, data: { sortOrder: index } })
    )
  )
  return prisma.productImage.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } })
}

async function deleteProduct(id) {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return { ok: false, error: 'Product not found' }
  if (product.status === 'published') {
    return { ok: false, error: 'Cannot delete a published product. Unpublish it first or confirm deletion explicitly.' }
  }
  await prisma.product.delete({ where: { id } })
  return { ok: true }
}

async function deleteImage(imageId) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } })
  if (!image) return { ok: false, error: 'Image not found' }
  await prisma.productImage.delete({ where: { id: imageId } })
  return { ok: true }
}

async function deleteVariant(variantId) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } })
  if (!variant) return { ok: false, error: 'Variant not found' }
  await prisma.productVariant.delete({ where: { id: variantId } })
  return { ok: true }
}

async function deleteVariantSize(sizeId) {
  const size = await prisma.variantSize.findUnique({ where: { id: sizeId } })
  if (!size) return { ok: false, error: 'Size not found' }
  await prisma.variantSize.delete({ where: { id: sizeId } })
  return { ok: true }
}

module.exports = {
  getProducts,
  getProductBySlug,
  getProductById,
  searchUploadProducts,
  getCategories,
  getBrands,
  getInventory,
  createProduct,
  updateProduct,
  addImages,
  publishProduct,
  unpublishProduct,
  bulkUpdate,
  reorderImages,
  deleteProduct,
  deleteImage,
  deleteVariant,
  deleteVariantSize,
}
