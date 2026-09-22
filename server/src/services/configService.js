const prisma = require('../db')

// site_config.value is stored as a JSON-encoded string regardless of the
// underlying type (boolean, number, object, string) so one column can hold
// all config shapes.
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
}

function defaultFor(key) {
  const def = DEFAULTS[key]
  return typeof def === 'function' ? def() : def
}

function decode(row) {
  try {
    return JSON.parse(row.value)
  } catch {
    return row.value
  }
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

module.exports = { getConfig, getAllConfig, setConfig, setConfigBulk, getConfigHistory, DEFAULT_KEYS: Object.keys(DEFAULTS) }
