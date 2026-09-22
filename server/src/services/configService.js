const prisma = require('../db')

// site_config.value is stored as a JSON-encoded string regardless of the
// underlying type (boolean, number, object, string) so one column can hold
// all config shapes.
// Seed footer content: matches the brief's "current footer" spec so the
// storefront footer looks complete before any admin ever saves.
const FOOTER_CONFIG_DEFAULT = {
  headings: { quickLinks: 'Quick Links', categories: 'Top Categories', brands: 'Top Brands' },
  quickLinks: [
    { id: 'ql-about', label: 'About', url: '/about', external: false, newTab: false, enabled: true, sortOrder: 0 },
    { id: 'ql-all-categories', label: 'All Categories', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 1 },
    { id: 'ql-brands', label: 'Brands', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 2 },
    { id: 'ql-refunds', label: 'Refund and Returns Policy', url: '/refund-policy', external: false, newTab: false, enabled: true, sortOrder: 3 },
    { id: 'ql-new-arrivals', label: 'New Arrivals', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 4 },
    { id: 'ql-wholesale', label: 'Wholesale', url: '/wholesale', external: false, newTab: false, enabled: true, sortOrder: 5 },
  ],
  sectionLinks: {
    men: { enabled: true, label: 'Men', url: '/shop/men', subLinks: [] },
    women: { enabled: true, label: 'Women', url: '/shop/women', subLinks: [] },
    kids: { enabled: true, label: 'Kids', url: '/shop/kids', subLinks: [] },
  },
  brands: {
    maxCount: 5,
    items: [
      { id: 'brand-zara', name: 'Zara', sortOrder: 0 },
      { id: 'brand-object', name: 'Object', sortOrder: 1 },
      { id: 'brand-vila', name: 'Vila', sortOrder: 2 },
      { id: 'brand-boohoo', name: 'Boohoo', sortOrder: 3 },
      { id: 'brand-asos', name: 'ASOS', sortOrder: 4 },
    ],
  },
}

// Seed content for the two static pages the Quick Links defaults point to.
// Blocks are structured ({type, text}) rather than free-form HTML — the
// renderer only ever prints text nodes, so there's no injection surface and
// no need to sanitize.
const PAGE_ABOUT_DEFAULT = {
  title: 'About Genvio Exotic Apparel',
  blocks: [
    { id: 'b-about-1', type: 'paragraph', text: 'Genvio Exotic Apparel is a premium fashion catalogue for Men, Women and Kids — pieces chosen for how they wear, not just how they photograph.' },
    { id: 'b-about-2', type: 'paragraph', text: "Browse the catalogue, add pieces to your bag, and send your order — we'll confirm by bank transfer and get it to you." },
  ],
}

const PAGE_REFUND_POLICY_DEFAULT = {
  title: 'Refund and Returns Policy',
  blocks: [
    { id: 'b-refund-1', type: 'heading', text: 'Returns' },
    { id: 'b-refund-2', type: 'paragraph', text: "Contact us within 7 days of delivery if an item isn't right. Items must be unworn, unwashed, and in their original condition with tags attached." },
    { id: 'b-refund-3', type: 'heading', text: 'Refunds' },
    { id: 'b-refund-4', type: 'paragraph', text: "Once we receive and inspect your return, we'll process a refund to your original payment method within 5-7 business days." },
  ],
}

const DEFAULTS = {
  maintenance_mode: false,
  section_visibility: { men: true, women: true, kids: true, wholesale: true },
  checkout_enabled: true,
  min_order_amount: null,
  delivery_mainland_fee: 0,
  delivery_island_fee: 0,
  delivery_interstate_fee: 0,
  notification_email: () => (process.env.ADMIN_EMAIL || '').trim(),
  bank_account_name: () => (process.env.BANK_ACCOUNT_NAME || '').trim(),
  bank_account_number: () => (process.env.BANK_ACCOUNT_NUMBER || '').trim(),
  bank_name: () => (process.env.BANK_NAME || '').trim(),
  footer_config: FOOTER_CONFIG_DEFAULT,
  page_about: PAGE_ABOUT_DEFAULT,
  page_refund_policy: PAGE_REFUND_POLICY_DEFAULT,
}

// slug (as used in the URL, /about and /refund-policy) -> site_config key.
const PAGE_SLUG_TO_KEY = { about: 'page_about', 'refund-policy': 'page_refund_policy' }

function defaultFor(key) {
  const def = DEFAULTS[key]
  return typeof def === 'function' ? def() : def
}

const SECTION_KEYS = ['men', 'women', 'kids']

// Deep-merges a saved footer_config over FOOTER_CONFIG_DEFAULT so a field
// missing from an older/partial saved value (e.g. before a new sub-field was
// added) falls back to its default instead of the page rendering `undefined`.
// Arrays (quickLinks, subLinks, brands.items) are taken whole from the saved
// value when present — they're admin-curated lists, not per-item defaults.
function mergeFooterConfig(saved) {
  if (!saved || typeof saved !== 'object') return FOOTER_CONFIG_DEFAULT
  const merged = {
    headings: { ...FOOTER_CONFIG_DEFAULT.headings, ...(saved.headings || {}) },
    quickLinks: Array.isArray(saved.quickLinks) ? saved.quickLinks : FOOTER_CONFIG_DEFAULT.quickLinks,
    sectionLinks: {},
    brands: {
      ...FOOTER_CONFIG_DEFAULT.brands,
      ...(saved.brands || {}),
      items: Array.isArray(saved.brands?.items) ? saved.brands.items : FOOTER_CONFIG_DEFAULT.brands.items,
    },
  }
  for (const key of SECTION_KEYS) {
    const defaultEntry = FOOTER_CONFIG_DEFAULT.sectionLinks[key]
    const savedEntry = saved.sectionLinks?.[key]
    merged.sectionLinks[key] = savedEntry
      ? { ...defaultEntry, ...savedEntry, subLinks: Array.isArray(savedEntry.subLinks) ? savedEntry.subLinks : defaultEntry.subLinks }
      : defaultEntry
  }
  return merged
}

function mergePageConfig(saved, key) {
  const def = DEFAULTS[key]
  if (!saved || typeof saved !== 'object') return def
  return {
    title: typeof saved.title === 'string' && saved.title.trim() ? saved.title : def.title,
    blocks: Array.isArray(saved.blocks) ? saved.blocks : def.blocks,
  }
}

function decode(row) {
  let value
  try {
    value = JSON.parse(row.value)
  } catch {
    value = row.value
  }
  if (row.key === 'footer_config') return mergeFooterConfig(value)
  if (row.key === 'page_about' || row.key === 'page_refund_policy') return mergePageConfig(value, row.key)
  return value
}

async function getConfig(key) {
  const row = await prisma.siteConfig.findUnique({ where: { key } })
  if (!row) return Object.prototype.hasOwnProperty.call(DEFAULTS, key) ? defaultFor(key) : null
  return decode(row)
}

async function getAllConfig() {
  const rows = await prisma.siteConfig.findMany()
  const result = {}
  for (const key of Object.keys(DEFAULTS)) result[key] = defaultFor(key)
  for (const row of rows) result[row.key] = decode(row)
  return result
}

async function setConfig(key, value) {
  const existing = await prisma.siteConfig.findUnique({ where: { key } })
  const newValue = JSON.stringify(value)
  const oldValue = existing ? existing.value : null

  const updated = await prisma.siteConfig.upsert({
    where: { key },
    update: { value: newValue },
    create: { key, value: newValue },
  })

  await prisma.configChangeHistory.create({
    data: { key, oldValue, newValue },
  })

  return decode(updated)
}

async function setConfigBulk(entries) {
  const results = {}
  for (const [key, value] of Object.entries(entries)) {
    results[key] = await setConfig(key, value)
  }
  return results
}

// Most-recent-first change history, optionally scoped to one or more keys
// (the Settings tab's Payment & Banking card only wants bank_* rows, not
// every config key ever changed). oldValue/newValue are left JSON-encoded
// as stored — decoding them is the caller's concern, matching how `decode`
// is only applied to the current-value read path above.
async function getConfigHistory({ keys, limit = 20 } = {}) {
  const where = Array.isArray(keys) && keys.length > 0 ? { key: { in: keys } } : undefined
  const rows = await prisma.configChangeHistory.findMany({
    where,
    orderBy: { changedAt: 'desc' },
    take: limit,
  })
  return rows
}

module.exports = {
  getConfig,
  getAllConfig,
  setConfig,
  setConfigBulk,
  getConfigHistory,
  DEFAULT_KEYS: Object.keys(DEFAULTS),
  PAGE_SLUG_TO_KEY,
}
