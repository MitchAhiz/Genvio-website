const API_BASE = 'http://localhost:4000'

function transformProduct(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    price: p.price,
    isNew: Date.now() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
    images: p.images.map((img) => img.url),
    variants: p.variants.map((v) => ({
      colour: v.colour,
      hex: v.hex || '#888888',
      image: v.imageUrl || (p.images[0]?.url ?? ''),
      sizes: Object.fromEntries(v.sizes.map((s) => [s.size, s.quantity])),
    })),
  }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export async function getProducts() {
  const data = await apiFetch('/api/products')
  return data.map(transformProduct)
}

export async function getProductBySlug(slug) {
  const data = await apiFetch(`/api/products/${encodeURIComponent(slug)}`)
  return transformProduct(data)
}

export async function getCategories() {
  return apiFetch('/api/categories')
}

export async function getInventory(productId) {
  return apiFetch(`/api/inventory/${encodeURIComponent(productId)}`)
}

export function getSizeRange(variants) {
  const allSizes = ['XS', 'S', 'M', 'L', 'XL']
  const available = new Set()
  for (const v of variants) {
    for (const [size, qty] of Object.entries(v.sizes)) {
      if (qty > 0) available.add(size)
    }
  }
  const first = allSizes.find((s) => available.has(s))
  const last = allSizes.findLast((s) => available.has(s))
  return first && last ? `${first}–${last}` : ''
}

export function formatPrice(amount) {
  return '₦' + amount.toLocaleString('en-NG')
}
