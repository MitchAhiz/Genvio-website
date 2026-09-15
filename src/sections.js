// Retail sections, in display order. Each has its own catalogue and theme;
// all share one bag.
export const SECTIONS = [
  { key: 'men', label: 'Men', blurb: 'Tailoring, shirting and outerwear with a confident line.' },
  { key: 'women', label: 'Women', blurb: 'Dresses, separates and occasion pieces, cut to be worn well.' },
  { key: 'kids', label: 'Kids', blurb: 'Everyday and occasion wear, sized by age from 2–3Y up.' },
]

export const DEFAULT_SECTION = 'men'

export function isSection(key) {
  return SECTIONS.some((s) => s.key === key)
}

export function getSection(key) {
  return SECTIONS.find((s) => s.key === key) || SECTIONS[0]
}

const STORAGE_KEY = 'genvio:last-section'

export function getLastSection() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isSection(stored) ? stored : DEFAULT_SECTION
  } catch {
    return DEFAULT_SECTION
  }
}

export function rememberSection(key) {
  try {
    if (isSection(key)) localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // storage unavailable (private mode etc.) — nothing to do
  }
}

export function sectionPath(key) {
  return `/shop/${key}`
}

export function productPath(product) {
  return `/shop/${product.section || DEFAULT_SECTION}/product/${product.slug}`
}
