const prisma = require('../db')

const productWithRelations = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    include: { sizes: true },
  },
}

// --- Read ---

async function getProducts({ category, status = 'published' } = {}) {
  const where = { status }
  if (category) where.category = category

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

async function getCategories() {
  const results = await prisma.product.findMany({
    where: { status: 'published' },
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

async function createProduct({ slug, name, brand, category, price }) {
  const uniqueSlug = await resolveUniqueSlug(slug)
  return prisma.product.create({
    data: { slug: uniqueSlug, name, brand, category, price, status: 'draft' },
    include: productWithRelations,
  })
}

async function updateProduct(id, { name, brand, category, price, variants }) {
  return prisma.$transaction(async (tx) => {
    const updates = {}
    if (name !== undefined) updates.name = name
    if (brand !== undefined) updates.brand = brand
    if (category !== undefined) updates.category = category
    if (price !== undefined) updates.price = price

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

    return tx.product.findUnique({
      where: { id },
      include: productWithRelations,
    })
  })
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
  deleteProduct,
  deleteImage,
  deleteVariant,
  deleteVariantSize,
}
