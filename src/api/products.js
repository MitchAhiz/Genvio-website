import { apiFetch, withQuery } from './client'

// Uploaded products keep their gallery on the variant (VariantImage rows,
// sortOrder 0 first), and sortOrder 0 is also copied to variant.imageUrl —
// so lead with imageUrl and drop the duplicate.
function variantImages(v) {
  if (!v) return []
  const urls = (v.images || []).map((img) => img.url)
  const all = v.imageUrl ? [v.imageUrl, ...urls] : urls
  return [...new Set(all)]
}

function transformProduct(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category?.name || '',
    section: p.section || 'women',
    price: p.price,
    isNew: Date.now() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
    images: p.images.length ? p.images.map((img) => img.url) : variantImages(p.variants[0]),
    variants: p.variants.map((v) => ({
      colour: v.colour,
      hex: v.hex || '#888888',
      image: v.imageUrl || (p.images[0]?.url ?? ''),
      images: variantImages(v),
      sizes: Object.fromEntries(v.sizes.map((s) => [s.size, s.quantity])),
    })),
  }
}

// getProducts({ section: 'women', category: 'Tops' }) — both optional.
export async function getProducts({ section, category } = {}) {
  const data = await apiFetch(withQuery('/api/products', { section, category }))
  return data.map(transformProduct)
}

export async function getProductBySlug(slug) {
  const data = await apiFetch(`/api/products/${encodeURIComponent(slug)}`)
  return transformProduct(data)
}

export async function getCategories({ section } = {}) {
  return apiFetch(withQuery('/api/categories', { section }))
}

export async function getInventory(productId) {
  return apiFetch(`/api/inventory/${encodeURIComponent(productId)}`)
}

// Known adult sizes sort in this order; anything else (e.g. kids' "2-3Y",
// "4-5Y") keeps the order it was entered in, which is how the admin lists it.
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

export function getSizeRange(variants) {
  const available = []
  for (const v of variants) {
    for (const [size, qty] of Object.entries(v.sizes)) {
      if (qty > 0 && !available.includes(size)) available.push(size)
    }
  }
  if (available.length === 0) return ''

  const rank = (s) => {
    const i = SIZE_ORDER.indexOf(String(s).toUpperCase())
    return i === -1 ? SIZE_ORDER.length : i
  }
  const ordered = [...available].sort((a, b) => rank(a) - rank(b))
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  return first === last ? first : `${first} – ${last}`
}

export function formatPrice(amount) {
  return '₦' + amount.toLocaleString('en-NG')
}
