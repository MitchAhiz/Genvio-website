import products from '../data/products'

export function getProducts() {
  return products
}

export function getProductBySlug(slug) {
  return products.find((p) => p.slug === slug) || null
}

export function getCategories() {
  const cats = [...new Set(products.map((p) => p.category))]
  return cats
}

export function getInventory(productId) {
  const product = products.find((p) => p.id === productId)
  if (!product) return null
  return product.variants.map((v) => ({
    colour: v.colour,
    sizes: v.sizes,
    totalStock: Object.values(v.sizes).reduce((a, b) => a + b, 0),
  }))
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
