// Server-side save path for the /upload form (product-upload-project.md
// §4). Deliberately separate from createProduct/updateProduct in
// products.js — those still back the existing admin ProductModal and are
// untouched by this file.
const prisma = require('../db')
const { isValidSection } = require('../constants')

const ALLOWED_PROVENANCE = new Set(['ai-generated', 'staff-supplied'])
const MAX_IMAGES_PER_COLOUR = 3
const MAX_COLOURS_PER_REQUEST = 10
// Free-tier Supabase latency + a multi-colour save doing several sequential
// creates means Prisma's 5s/2s defaults are too tight — see
// product-upload-project.md §5b / the transaction review that flagged this.
const TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 20000 }

// Thrown inside a transaction to reject with a clean, caller-facing
// message and status code, without leaking a raw Prisma error.
class UploadError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function collapseWhitespace(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function resolveUniqueSlug(tx, baseSlug) {
  let candidate = baseSlug || 'product'
  let suffix = 2
  while (await tx.product.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${baseSlug}-${suffix}`
    suffix++
  }
  return candidate
}

// Trim + collapse whitespace, then reuse an existing brand's exact
// spelling if one matches case-insensitively — so "zara " and "ZARA"
// never end up as two different brand strings.
async function normalizeBrand(tx, rawBrand) {
  const trimmed = collapseWhitespace(rawBrand)
  if (!trimmed) throw new UploadError(400, 'brand is required')
  const existing = await tx.product.findFirst({
    where: { brand: { equals: trimmed, mode: 'insensitive' } },
    select: { brand: true },
  })
  return existing ? existing.brand : trimmed
}

// Exact host match (never includes()/substring — that would let
// "supabase.co.evil.com" through) AND the path must sit under this
// server's own public product-images bucket — so a URL for some other
// bucket, or some other path on the right host, is rejected too.
function isSupabaseStorageUrl(url) {
  if (typeof url !== 'string') return false
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const base = process.env.SUPABASE_URL
  if (!base) return false
  let expectedHost
  try {
    expectedHost = new URL(base).host
  } catch {
    return false
  }
  if (parsed.host !== expectedHost) return false

  const bucket = process.env.PRODUCT_IMAGES_BUCKET
  if (!bucket) return false
  const expectedPrefix = `/storage/v1/object/public/${bucket}/`
  return parsed.pathname.startsWith(expectedPrefix)
}

// Validates one colour block's shape (images, sizes) against the allowed
// size labels for this product's sub-category, and against colour names
// already used on the product (existing + earlier in this same request).
// Throws UploadError on the first problem found.
function validateColour(colour, allowedSizes, seenColourNames) {
  const colourName = collapseWhitespace(colour?.colourName)
  if (!colourName) throw new UploadError(400, 'Each colour requires a colourName')

  const key = colourName.toLowerCase()
  if (seenColourNames.has(key)) {
    throw new UploadError(400, `Colour "${colourName}" already exists on this product`)
  }
  seenColourNames.add(key)

  const images = colour?.images
  if (!Array.isArray(images) || images.length === 0) {
    throw new UploadError(400, `Colour "${colourName}" needs at least one image`)
  }
  if (images.length > MAX_IMAGES_PER_COLOUR) {
    throw new UploadError(400, `Colour "${colourName}" can have at most ${MAX_IMAGES_PER_COLOUR} images`)
  }
  for (const img of images) {
    if (!isSupabaseStorageUrl(img?.url)) {
      throw new UploadError(400, `Image URL for colour "${colourName}" must be https and hosted on our Supabase storage`)
    }
    if (!ALLOWED_PROVENANCE.has(img?.provenance)) {
      throw new UploadError(400, `Image provenance for colour "${colourName}" must be 'ai-generated' or 'staff-supplied'`)
    }
  }

  for (const rawUrl of [colour?.rawFrontUrl, colour?.rawBackUrl]) {
    if (rawUrl != null && !isSupabaseStorageUrl(rawUrl)) {
      throw new UploadError(400, `Raw photo URL for colour "${colourName}" must be https and hosted on our Supabase storage`)
    }
  }

  const sizes = colour?.sizes
  if (!Array.isArray(sizes) || sizes.length === 0) {
    throw new UploadError(400, `Colour "${colourName}" needs at least one size`)
  }
  const seenSizes = new Set()
  for (const s of sizes) {
    if (seenSizes.has(s?.size)) {
      throw new UploadError(400, `Size "${s?.size}" is listed twice`)
    }
    seenSizes.add(s?.size)
    if (!allowedSizes.has(s?.size)) {
      throw new UploadError(400, `Size "${s?.size}" is not in the size range for this sub-category`)
    }
    if (!Number.isInteger(s?.quantity) || s.quantity < 0) {
      throw new UploadError(400, `quantity for size "${s?.size}" must be a non-negative integer`)
    }
  }

  return colourName
}

// productId present -> add colours to that existing product (brand/name/
// subcategory/price come from the existing row; client-sent values for
// those fields are ignored). productId absent -> create a brand new
// product with its first colour(s).
async function createUploadProduct({ productId, brand, name, subcategoryId, price, colours, adminEmail }) {
  if (!Array.isArray(colours) || colours.length === 0) {
    return { ok: false, status: 400, error: 'At least one colour is required' }
  }
  if (colours.length > MAX_COLOURS_PER_REQUEST) {
    return { ok: false, status: 400, error: 'At most 10 colours can be saved at once' }
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      let categoryId
      let resolvedSubcategoryId
      let baseProduct
      let sectionForNewProduct
      const seenColourNames = new Set()

      if (productId) {
        baseProduct = await tx.product.findUnique({ where: { id: productId } })
        if (!baseProduct) throw new UploadError(404, 'Product not found')
        categoryId = baseProduct.categoryId
        resolvedSubcategoryId = baseProduct.subcategoryId
        if (!categoryId || !resolvedSubcategoryId) {
          throw new UploadError(400, 'This product has no category/sub-category set yet')
        }
        const existingVariants = await tx.productVariant.findMany({
          where: { productId },
          select: { colour: true },
        })
        for (const v of existingVariants) seenColourNames.add(v.colour.toLowerCase())
      } else {
        if (!brand || !name || !subcategoryId || price == null) {
          throw new UploadError(400, 'brand, name, subcategoryId and price are required to create a new product')
        }
        if (!Number.isInteger(price) || price <= 0) {
          throw new UploadError(400, 'Price must be a whole number greater than 0')
        }
        const subcategory = await tx.subcategory.findUnique({
          where: { id: subcategoryId },
          include: { category: true },
        })
        if (!subcategory) throw new UploadError(400, 'subcategoryId is not a valid subcategory')
        categoryId = subcategory.categoryId
        resolvedSubcategoryId = subcategory.id
        sectionForNewProduct = collapseWhitespace(subcategory.category.name).toLowerCase()
        if (!isValidSection(sectionForNewProduct)) {
          throw new UploadError(400, 'Category does not map to a known section (Men/Women/Kids)')
        }
      }

      const sizeRange = await tx.sizeRange.findUnique({
        where: { categoryId_subcategoryId: { categoryId, subcategoryId: resolvedSubcategoryId } },
      })
      if (!sizeRange) throw new UploadError(400, 'No size range is set up for this sub-category yet.')
      const allowedSizes = new Set(sizeRange.sizes)

      const colourNames = colours.map((c) => validateColour(c, allowedSizes, seenColourNames))

      if (!productId) {
        const normalizedBrand = await normalizeBrand(tx, brand)
        const trimmedName = collapseWhitespace(name)
        const baseSlug = slugify(`${normalizedBrand}-${trimmedName}`)
        const slug = await resolveUniqueSlug(tx, baseSlug)

        baseProduct = await tx.product.create({
          data: {
            slug,
            name: trimmedName,
            brand: normalizedBrand,
            price,
            section: sectionForNewProduct,
            categoryId,
            subcategoryId: resolvedSubcategoryId,
            status: 'published',
            createdBy: adminEmail,
          },
        })
      }

      for (let i = 0; i < colours.length; i++) {
        const colour = colours[i]
        const variant = await tx.productVariant.create({
          data: {
            productId: baseProduct.id,
            colour: colourNames[i],
            imageUrl: colour.images[0].url,
            rawFrontUrl: colour.rawFrontUrl || null,
            rawBackUrl: colour.rawBackUrl || null,
            createdBy: adminEmail,
          },
        })

        await tx.variantImage.createMany({
          data: colour.images.map((img, sortOrder) => ({
            variantId: variant.id,
            url: img.url,
            sortOrder,
            provenance: img.provenance,
            createdBy: adminEmail,
          })),
        })

        await tx.variantSize.createMany({
          data: colour.sizes.map((s) => ({
            variantId: variant.id,
            size: s.size,
            quantity: s.quantity,
          })),
        })
      }

      return tx.product.findUnique({
        where: { id: baseProduct.id },
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
          variants: { include: { sizes: true, images: { orderBy: { sortOrder: 'asc' } } } },
        },
      })
    }, TRANSACTION_OPTIONS)

    return { ok: true, product }
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, status: err.status, error: err.message }
    throw err
  }
}

// { variantId, sizes: [{ size, quantity }] } — quantity is units received,
// added to whatever is already there via an atomic DB increment. A size
// with no existing row is inserted fresh, provided it's in the SizeRange.
async function restockVariant({ variantId, sizes, adminEmail }) {
  if (!variantId) return { ok: false, status: 400, error: 'variantId is required' }
  if (!Array.isArray(sizes) || sizes.length === 0) {
    return { ok: false, status: 400, error: 'sizes must be a non-empty array' }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      })
      if (!variant) throw new UploadError(404, 'Variant not found')

      const { categoryId, subcategoryId } = variant.product
      if (!categoryId || !subcategoryId) {
        throw new UploadError(400, 'This product has no category/sub-category set yet')
      }
      const sizeRange = await tx.sizeRange.findUnique({
        where: { categoryId_subcategoryId: { categoryId, subcategoryId } },
      })
      if (!sizeRange) throw new UploadError(400, 'No size range is set up for this sub-category yet.')
      const allowedSizes = new Set(sizeRange.sizes)

      const rows = []
      const seenSizes = new Set()
      for (const s of sizes) {
        if (seenSizes.has(s?.size)) {
          throw new UploadError(400, `Size "${s?.size}" is listed twice`)
        }
        seenSizes.add(s?.size)
        if (!allowedSizes.has(s?.size)) {
          throw new UploadError(400, `Size "${s?.size}" is not in the size range for this product`)
        }
        if (!Number.isInteger(s?.quantity) || s.quantity < 0) {
          throw new UploadError(400, `quantity for size "${s?.size}" must be a non-negative integer`)
        }

        const existing = await tx.variantSize.findFirst({ where: { variantId, size: s.size } })
        if (existing) {
          rows.push(
            await tx.variantSize.update({
              where: { id: existing.id },
              data: { quantity: { increment: s.quantity }, updatedBy: adminEmail },
            })
          )
        } else {
          rows.push(
            await tx.variantSize.create({
              data: { variantId, size: s.size, quantity: s.quantity, updatedBy: adminEmail },
            })
          )
        }
      }
      return rows
    }, TRANSACTION_OPTIONS)

    return { ok: true, sizes: updated }
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, status: err.status, error: err.message }
    throw err
  }
}

module.exports = { createUploadProduct, restockVariant, UploadError, isSupabaseStorageUrl }
