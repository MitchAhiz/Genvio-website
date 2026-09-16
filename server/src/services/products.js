const prisma = require('../db')
const { logActivity } = require('../utils/logActivity')

const productWithRelations = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    include: { sizes: true },
  },
  subcategory: true,
}

// --- Read ---

async function getProducts({ category, section, includeDrafts = false } = {}) {
  const where = {}
  if (!includeDrafts) where.status = 'published'
  if (category) where.category = category
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

async function getCategories({ section } = {}) {
  const where = { status: 'published' }
  if (section) where.section = section
  const results = await prisma.product.findMany({
    where,
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  return results.map((r) => r.category)
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

async function createProduct({ slug, name, brand, category, price, section = 'women' }) {
  const uniqueSlug = await resolveUniqueSlug(slug)
  return prisma.product.create({
    data: { slug: uniqueSlug, name, brand, category, price, section, status: 'draft' },
    include: productWithRelations,
  })
}

async function updateProduct(id, { name, brand, category, price, section, subcategoryId, status, variants }) {
  await prisma.$transaction(async (tx) => {
    const updates = {}
    if (name !== undefined) updates.name = name
    if (brand !== undefined) updates.brand = brand
    if (category !== undefined) updates.category = category
    if (price !== undefined) updates.price = price
    if (section !== undefined) updates.section = section
    if (subcategoryId !== undefined) updates.subcategoryId = subcategoryId || null
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
  getCategories,
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
