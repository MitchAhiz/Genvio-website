const { Router } = require('express')
const { getConfig, getAllConfig, setConfigBulk, getConfigHistory, PAGE_SLUG_TO_KEY } = require('../services/configService')
const { requireAdminAuth } = require('../middleware/auth')
const { cleanEmail } = require('../utils/sanitize')
const { logActivity } = require('../utils/logActivity')

const router = Router()

const SECTION_KEYS = ['men', 'women', 'kids']
const MAX_QUICK_LINKS = 12
const MAX_SUB_LINKS = 10
const MAX_BRANDS = 20
const MAX_LABEL_LEN = 50
const MAX_HEADING_LEN = 40
const MAX_URL_LEN = 500

// Matches any ASCII control character (incl. tab/newline) or plain space —
// URLs and labels should never carry these, and stripping them is how
// javascript:alert(1)\n-style smuggling via whitespace gets caught even
// though the scheme check below already blocks the javascript: case itself.
const CONTROL_OR_WHITESPACE = /[\x00-\x20\x7F]/

// Internal paths ("/shop/men") and absolute http(s) URLs only. Rejects
// javascript:/data:/vbscript: (fail the protocol check), protocol-relative
// "//evil.com" (a leading "/" is required but a second "/" is not allowed),
// and anything containing whitespace or control characters.
function isValidUrl(v) {
  if (typeof v !== 'string') return false
  const s = v.trim()
  if (!s || s.length > MAX_URL_LEN) return false
  if (CONTROL_OR_WHITESPACE.test(s)) return false
  if (s.startsWith('/')) return !s.startsWith('//')
  let parsed
  try {
    parsed = new URL(s)
  } catch {
    return false
  }
  return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname
}

function isValidLabel(v, maxLen = MAX_LABEL_LEN) {
  return typeof v === 'string' && !!v.trim() && v.trim().length <= maxLen
}

// A single link entry shared by quickLinks and sectionLinks[*].subLinks.
// Returns { ok, value, error }.
function validateLink(v, context) {
  if (!v || typeof v !== 'object') return { ok: false, error: `${context}: each link must be an object` }
  const { id, label, url, external, newTab, enabled, sortOrder } = v
  if (typeof id !== 'string' || !id.trim()) return { ok: false, error: `${context}: link id is required` }
  if (!isValidLabel(label)) return { ok: false, error: `${context}: label must be 1-${MAX_LABEL_LEN} characters` }
  if (!isValidUrl(url)) return { ok: false, error: `${context}: url must be an internal path ("/...") or an http(s) URL` }
  if (typeof enabled !== 'boolean') return { ok: false, error: `${context}: enabled must be true/false` }
  if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) return { ok: false, error: `${context}: sortOrder must be a number` }
  return {
    ok: true,
    value: {
      id: id.trim(),
      label: label.trim(),
      url: url.trim(),
      external: !!external,
      newTab: !!newTab,
      enabled,
      sortOrder,
    },
  }
}

function validateLinkList(list, max, context) {
  if (!Array.isArray(list)) return { ok: false, error: `${context}: must be a list` }
  if (list.length > max) return { ok: false, error: `${context}: at most ${max} links allowed` }
  const out = []
  for (const item of list) {
    const result = validateLink(item, context)
    if (!result.ok) return result
    out.push(result.value)
  }
  return { ok: true, value: out }
}

function validateFooterConfig(v) {
  if (!v || typeof v !== 'object') return { ok: false, error: 'footer_config must be an object' }

  const headings = v.headings
  if (!headings || typeof headings !== 'object') return { ok: false, error: 'headings is required' }
  const { quickLinks: qh, categories: ch, brands: bh } = headings
  for (const [name, val] of [['quickLinks', qh], ['categories', ch], ['brands', bh]]) {
    if (!isValidLabel(val, MAX_HEADING_LEN)) {
      return { ok: false, error: `heading "${name}" must be 1-${MAX_HEADING_LEN} characters` }
    }
  }

  const quickLinksResult = validateLinkList(v.quickLinks, MAX_QUICK_LINKS, 'quickLinks')
  if (!quickLinksResult.ok) return quickLinksResult

  const sectionLinks = {}
  if (!v.sectionLinks || typeof v.sectionLinks !== 'object') return { ok: false, error: 'sectionLinks is required' }
  if (Object.keys(v.sectionLinks).length !== SECTION_KEYS.length) {
    return { ok: false, error: `sectionLinks must have exactly these keys: ${SECTION_KEYS.join(', ')}` }
  }
  for (const key of SECTION_KEYS) {
    const entry = v.sectionLinks[key]
    if (!entry || typeof entry !== 'object') return { ok: false, error: `sectionLinks.${key} is required` }
    if (typeof entry.enabled !== 'boolean') return { ok: false, error: `sectionLinks.${key}.enabled must be true/false` }
    if (!isValidLabel(entry.label)) return { ok: false, error: `sectionLinks.${key}.label must be 1-${MAX_LABEL_LEN} characters` }
    if (!isValidUrl(entry.url)) return { ok: false, error: `sectionLinks.${key}.url is invalid` }
    const subLinksResult = validateLinkList(entry.subLinks, MAX_SUB_LINKS, `sectionLinks.${key}.subLinks`)
    if (!subLinksResult.ok) return subLinksResult
    sectionLinks[key] = { enabled: entry.enabled, label: entry.label.trim(), url: entry.url.trim(), subLinks: subLinksResult.value }
  }

  const brandsCfg = v.brands
  if (!brandsCfg || typeof brandsCfg !== 'object') return { ok: false, error: 'brands is required' }
  if (typeof brandsCfg.maxCount !== 'number' || !Number.isInteger(brandsCfg.maxCount) || brandsCfg.maxCount < 1 || brandsCfg.maxCount > MAX_BRANDS) {
    return { ok: false, error: `brands.maxCount must be an integer from 1 to ${MAX_BRANDS}` }
  }
  if (!Array.isArray(brandsCfg.items)) return { ok: false, error: 'brands.items must be a list' }
  if (brandsCfg.items.length > MAX_BRANDS) return { ok: false, error: `brands.items: at most ${MAX_BRANDS} brands allowed` }
  const brandItems = []
  const seenBrandKeys = new Set()
  for (const item of brandsCfg.items) {
    if (!item || typeof item !== 'object') return { ok: false, error: 'brands.items: each brand must be an object' }
    const { id, name, sortOrder } = item
    if (typeof id !== 'string' || !id.trim()) return { ok: false, error: 'brands.items: brand id is required' }
    if (!isValidLabel(name)) return { ok: false, error: `brands.items: brand name must be 1-${MAX_LABEL_LEN} characters` }
    if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) return { ok: false, error: 'brands.items: sortOrder must be a number' }
    const trimmedName = name.trim()
    const dedupeKey = trimmedName.toLowerCase()
    if (seenBrandKeys.has(dedupeKey)) return { ok: false, error: `brands.items: duplicate brand "${trimmedName}" (case-insensitive)` }
    seenBrandKeys.add(dedupeKey)
    brandItems.push({ id: id.trim(), name: trimmedName, sortOrder })
  }

  return {
    ok: true,
    value: {
      headings: { quickLinks: qh.trim(), categories: ch.trim(), brands: bh.trim() },
      quickLinks: quickLinksResult.value,
      sectionLinks,
      brands: { maxCount: brandsCfg.maxCount, items: brandItems },
    },
  }
}

const MAX_PAGE_TITLE_LEN = 100
const MAX_PAGE_BLOCKS = 40
const MAX_HEADING_TEXT_LEN = 100
const MAX_PARAGRAPH_TEXT_LEN = 2000

// Structured content for a static page (About, Refund & Returns): a title
// plus an ordered list of heading/paragraph blocks. No raw HTML is ever
// accepted — the frontend only ever renders block.text as a text node, so
// there's no markup to sanitize and nothing to inject.
function validatePageConfig(v) {
  if (!v || typeof v !== 'object') return { ok: false, error: 'page content must be an object' }
  if (!isValidLabel(v.title, MAX_PAGE_TITLE_LEN)) {
    return { ok: false, error: `title must be 1-${MAX_PAGE_TITLE_LEN} characters` }
  }
  if (!Array.isArray(v.blocks)) return { ok: false, error: 'blocks must be a list' }
  if (v.blocks.length === 0) return { ok: false, error: 'at least one block is required' }
  if (v.blocks.length > MAX_PAGE_BLOCKS) return { ok: false, error: `at most ${MAX_PAGE_BLOCKS} blocks allowed` }

  const blocks = []
  for (const block of v.blocks) {
    if (!block || typeof block !== 'object') return { ok: false, error: 'each block must be an object' }
    const { id, type, text } = block
    if (typeof id !== 'string' || !id.trim()) return { ok: false, error: 'block id is required' }
    if (type !== 'heading' && type !== 'paragraph') return { ok: false, error: 'block type must be "heading" or "paragraph"' }
    const maxLen = type === 'heading' ? MAX_HEADING_TEXT_LEN : MAX_PARAGRAPH_TEXT_LEN
    if (typeof text !== 'string' || !text.trim() || text.trim().length > maxLen) {
      return { ok: false, error: `${type} text must be 1-${maxLen} characters` }
    }
    blocks.push({ id: id.trim(), type, text: text.trim() })
  }

  return { ok: true, value: { title: v.title.trim(), blocks } }
}

const VALIDATORS = {
  maintenance_mode: (v) => (typeof v === 'boolean' ? { ok: true, value: v } : { ok: false }),
  checkout_enabled: (v) => (typeof v === 'boolean' ? { ok: true, value: v } : { ok: false }),
  section_visibility: (v) => {
    if (!v || typeof v !== 'object') return { ok: false }
    const keys = ['men', 'women', 'kids', 'wholesale']
    if (Object.keys(v).length !== keys.length) return { ok: false }
    for (const k of keys) if (typeof v[k] !== 'boolean') return { ok: false }
    const value = {}
    for (const k of keys) value[k] = v[k]
    return { ok: true, value }
  },
  min_order_amount: (v) => {
    if (v === null) return { ok: true, value: null }
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return { ok: true, value: v }
    return { ok: false }
  },
  delivery_mainland_fee: (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? { ok: true, value: v } : { ok: false }),
  delivery_island_fee: (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? { ok: true, value: v } : { ok: false }),
  delivery_interstate_fee: (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? { ok: true, value: v } : { ok: false }),
  notification_email: (v) => {
    const email = cleanEmail(v)
    return email ? { ok: true, value: email } : { ok: false }
  },
  bank_account_name: (v) => (typeof v === 'string' && v.trim() ? { ok: true, value: v.trim().slice(0, 200) } : { ok: false }),
  bank_account_number: (v) => (typeof v === 'string' && v.trim() ? { ok: true, value: v.trim().slice(0, 40) } : { ok: false }),
  bank_name: (v) => (typeof v === 'string' && v.trim() ? { ok: true, value: v.trim().slice(0, 200) } : { ok: false }),
  footer_config: validateFooterConfig,
  page_about: validatePageConfig,
  page_refund_policy: validatePageConfig,
}

// Public. Bank details live in site_config so the client can change them from
// the admin panel without a code deploy. .env values are only a one-time seed
// for whichever fields have never been set in the database.
router.get('/config/payment', async (_req, res, next) => {
  try {
    const bankName = await getConfig('bank_name')
    const accountNumber = await getConfig('bank_account_number')
    const accountName = await getConfig('bank_account_name')
    if (!bankName || !accountNumber || !accountName) {
      return res.status(503).json({ error: 'Payment details are not configured yet' })
    }
    res.json({ method: 'bank_transfer', bankName, accountNumber, accountName })
  } catch (err) {
    next(err)
  }
})

// Public. Read by the storefront on load to gate maintenance mode, section
// visibility, and checkout availability.
router.get('/config/site', async (_req, res, next) => {
  try {
    const config = await getAllConfig()
    res.json({
      maintenance_mode: config.maintenance_mode,
      section_visibility: config.section_visibility,
      checkout_enabled: config.checkout_enabled,
      min_order_amount: config.min_order_amount,
      delivery_mainland_fee: config.delivery_mainland_fee,
      delivery_island_fee: config.delivery_island_fee,
      delivery_interstate_fee: config.delivery_interstate_fee,
      footer_config: config.footer_config,
    })
  } catch (err) {
    next(err)
  }
})

// Public. Static page content (About, Refund & Returns) for the storefront
// pages at /about and /refund-policy. Only the two known slugs are readable
// here — this must never become a generic "read any config key by name"
// route, since other keys (bank_account_number etc.) are sensitive.
router.get('/config/page/:slug', async (req, res, next) => {
  try {
    const key = PAGE_SLUG_TO_KEY[req.params.slug]
    if (!key) return res.status(404).json({ error: 'Unknown page' })
    res.json(await getConfig(key))
  } catch (err) {
    next(err)
  }
})

// Admin: full config snapshot for the Settings tab, including bank details.
router.get('/config/all', requireAdminAuth, async (_req, res, next) => {
  try {
    res.json(await getAllConfig())
  } catch (err) {
    next(err)
  }
})

// Admin: recent config_change_history entries for the Settings tab's
// Change History display. Bank fields are the intended default scope
// (?keys=bank_account_name,bank_account_number,bank_name) — old/new
// values are deliberately omitted from the response, matching
// config.updated's activity-log precedent of never surfacing
// bank_account_number's actual value, even to an authenticated admin
// over this read path.
router.get('/config/history', requireAdminAuth, async (req, res, next) => {
  try {
    const keys = typeof req.query.keys === 'string' && req.query.keys.trim()
      ? req.query.keys.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 3))
    const rows = await getConfigHistory({ keys, limit })
    res.json(rows.map((r) => ({ id: r.id, key: r.key, changedAt: r.changedAt })))
  } catch (err) {
    next(err)
  }
})

// Admin: bulk-update any subset of known config keys.
router.patch('/config', requireAdminAuth, async (req, res, next) => {
  try {
    const body = req.body || {}
    const keys = Object.keys(body)
    if (keys.length === 0) return res.status(400).json({ error: 'No config keys provided' })

    const unknown = keys.filter((k) => !VALIDATORS[k])
    if (unknown.length > 0) {
      return res.status(400).json({ error: `Unknown config key(s): ${unknown.join(', ')}` })
    }

    const toWrite = {}
    for (const key of keys) {
      const result = VALIDATORS[key](body[key])
      if (!result.ok) return res.status(400).json({ error: result.error || `Invalid value for ${key}` })
      toWrite[key] = result.value
    }

    await setConfigBulk(toWrite)

    // Key names only — never the values (bank_account_number especially).
    await logActivity('config.updated', 'config', null, { keys })
    res.json(await getAllConfig())
  } catch (err) {
    next(err)
  }
})

module.exports = router
// Exposed for server/test/footer-config.test.js — router is a function
// object, so it can carry this without changing how Express uses it.
module.exports.validateFooterConfig = validateFooterConfig
module.exports.validatePageConfig = validatePageConfig
