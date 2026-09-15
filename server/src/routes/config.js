const { Router } = require('express')

const router = Router()

// Public. Bank details live in env vars so the client can change them without
// a code deploy.
router.get('/config/payment', (_req, res) => {
  const bankName = (process.env.BANK_NAME || '').trim()
  const accountNumber = (process.env.BANK_ACCOUNT_NUMBER || '').trim()
  const accountName = (process.env.BANK_ACCOUNT_NAME || '').trim()
  if (!bankName || !accountNumber || !accountName) {
    return res.status(503).json({ error: 'Payment details are not configured yet' })
  }
  res.json({ method: 'bank_transfer', bankName, accountNumber, accountName })
})

module.exports = router
