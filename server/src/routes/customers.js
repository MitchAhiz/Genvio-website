const { Router } = require('express')
const {
  lookupCustomer,
  verifyPin,
  saveDetailsWithPin,
  declineSavingDetails,
} = require('../services/customers')
const { orderProvesPhone } = require('../services/orders')
const { cleanText, normalizePhone, cleanAddress } = require('../utils/sanitize')
const { rateLimit } = require('../middleware/rateLimit')

const router = Router()

const PIN_PATTERN = /^\d{4}$/

// Nothing in this file logs a request body: these routes carry PINs.

function phoneFrom(source) {
  return (req) => normalizePhone(String((source === 'query' ? req.query : req.body || {}).phone || ''))
}

// Public. Answers two questions and no more: has this number ordered before,
// and is there anything saved behind a PIN. No name, no address, no history.
// Always 200 so a probe can't read anything off the status code either.
router.get(
  '/customers/lookup',
  rateLimit({ name: 'lookup', limit: 20, windowMs: 10 * 60 * 1000 }),
  async (req, res, next) => {
    try {
      const phone = normalizePhone(String(req.query.phone || ''))
      if (!phone) return res.status(400).json({ error: 'Enter a valid Nigerian mobile number' })
      res.json(await lookupCustomer(phone))
    } catch (err) {
      next(err)
    }
  }
)

// Public. The ONLY route that returns saved personal data, and only in
// exchange for the right PIN. Limited per phone number, not per caller, so
// one number can't be ground down from many addresses.
router.post(
  '/customers/verify-pin',
  rateLimit({ name: 'verify-pin', limit: 10, windowMs: 10 * 60 * 1000, key: phoneFrom('body') }),
  async (req, res, next) => {
    try {
      const phone = normalizePhone(String(req.body?.phone || ''))
      const pin = String(req.body?.pin || '')
      if (!phone) return res.status(400).json({ error: 'Enter a valid Nigerian mobile number' })
      if (!PIN_PATTERN.test(pin)) return res.status(400).json({ error: 'Enter your 4-digit PIN' })
      res.json(await verifyPin(phone, pin))
    } catch (err) {
      next(err)
    }
  }
)

// Public, but gated: the caller must hold an order reference belonging to
// this phone number, so knowing a number alone can never set or overwrite
// somebody else's PIN.
router.post(
  '/customers/save-details',
  rateLimit({ name: 'save-details', limit: 10, windowMs: 10 * 60 * 1000, key: phoneFrom('body') }),
  async (req, res, next) => {
    try {
      const body = req.body || {}
      const phone = normalizePhone(String(body.phone || ''))
      const pin = String(body.pin || '')
      const reference = cleanText(body.reference, 40)
      const name = cleanText(body.name, 80)
      const address = cleanAddress(body.address)

      if (!phone) return res.status(400).json({ error: 'Enter a valid Nigerian mobile number' })
      if (!PIN_PATTERN.test(pin)) return res.status(400).json({ error: 'Choose a 4-digit PIN' })
      if (name.length < 2) return res.status(400).json({ error: 'Enter your full name' })
      if (!address) return res.status(400).json({ error: 'Enter a street address, city and state' })
      if (!(await orderProvesPhone(reference, phone))) {
        return res.status(403).json({ error: 'This request could not be verified against your order.' })
      }

      await saveDetailsWithPin({ phone, pin, name, address })
      res.json({ saved: true })
    } catch (err) {
      next(err)
    }
  }
)

// Public, same gate. Remembers that they said no, so the prompt stops asking.
router.post(
  '/customers/decline-save',
  rateLimit({ name: 'decline-save', limit: 10, windowMs: 10 * 60 * 1000, key: phoneFrom('body') }),
  async (req, res, next) => {
    try {
      const phone = normalizePhone(String(req.body?.phone || ''))
      const reference = cleanText(req.body?.reference, 40)
      if (!phone) return res.status(400).json({ error: 'Enter a valid Nigerian mobile number' })
      if (!(await orderProvesPhone(reference, phone))) {
        return res.status(403).json({ error: 'This request could not be verified against your order.' })
      }
      await declineSavingDetails(phone)
      res.json({ optedOut: true })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
