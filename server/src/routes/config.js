const { Router } = require('express')
const { getConfig, getAllConfig, setConfigBulk, getConfigHistory } = require('../services/configService')
const { requireAdminAuth } = require('../middleware/auth')
const { cleanEmail } = require('../utils/sanitize')
const { logActivity } = require('../utils/logActivity')

const router = Router()

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
  notification_email: (v) => {
    const email = cleanEmail(v)
    return email ? { ok: true, value: email } : { ok: false }
  },
  bank_account_name: (v) => (typeof v === 'string' && v.trim() ? { ok: true, value: v.trim().slice(0, 200) } : { ok: false }),
  bank_account_number: (v) => (typeof v === 'string' && v.trim() ? { ok: true, value: v.trim().slice(0, 40) } : { ok: false }),
  bank_name: (v) => (typeof v === 'string' && v.trim() ? { ok: true, value: v.trim().slice(0, 200) } : { ok: false }),
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
    })
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
      if (!result.ok) return res.status(400).json({ error: `Invalid value for ${key}` })
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
