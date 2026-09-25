const bcrypt = require('bcryptjs')
const prisma = require('../db')

const BCRYPT_COST = 10
const MAX_PIN_ATTEMPTS = 3
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

// Wrong-PIN counters, in memory and per phone. This is the "lock out the
// auto-fill for this session" rule, not a permanent block: the entry ages out
// and a customer can always type their details in by hand instead.
const attempts = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [phone, entry] of attempts) {
    if (now - entry.last > ATTEMPT_WINDOW_MS) attempts.delete(phone)
  }
}, 5 * 60 * 1000).unref()

function attemptState(phone) {
  const entry = attempts.get(phone)
  if (!entry || Date.now() - entry.last > ATTEMPT_WINDOW_MS) return { count: 0 }
  return entry
}

function recordFailure(phone) {
  const entry = attemptState(phone)
  const next = { count: entry.count + 1, last: Date.now() }
  attempts.set(phone, next)
  return next.count
}

function clearFailures(phone) {
  attempts.delete(phone)
}

// What the checkout may know before a PIN is given: whether this number has
// ordered before, and whether there is anything to unlock. Never more.
async function lookupCustomer(phone) {
  const found = await prisma.customer.findUnique({
    where: { phone },
    select: { detailsSaved: true, pinHash: true },
  })
  return {
    exists: Boolean(found),
    hasSavedDetails: Boolean(found?.detailsSaved && found?.pinHash),
  }
}

// The single path by which saved personal data comes back out, and only in
// exchange for the right PIN.
async function verifyPin(phone, pin) {
  if (attemptState(phone).count >= MAX_PIN_ATTEMPTS) {
    return { verified: false, locked: true }
  }

  const customer = await prisma.customer.findUnique({
    where: { phone },
    select: { name: true, address: true, pinHash: true, detailsSaved: true },
  })

  // Compare against a dummy hash when there is nothing to unlock, so a probe
  // cannot tell "no saved details" from "wrong PIN" by how long we take.
  const hash = customer?.detailsSaved && customer.pinHash ? customer.pinHash : null
  const ok = await bcrypt.compare(pin, hash || '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin')

  if (!hash || !ok) {
    const count = recordFailure(phone)
    return { verified: false, locked: count >= MAX_PIN_ATTEMPTS }
  }

  clearFailures(phone)
  return { verified: true, name: customer.name, address: customer.address }
}

async function saveDetailsWithPin({ phone, pin, name, address }) {
  const pinHash = await bcrypt.hash(pin, BCRYPT_COST)
  await prisma.customer.update({
    where: { phone },
    data: { name, address, pinHash, detailsSaved: true, saveOptedOut: false },
  })
  clearFailures(phone)
}

async function declineSavingDetails(phone) {
  await prisma.customer.update({
    where: { phone },
    data: { saveOptedOut: true },
  })
}

// The record is kept so the admin can group orders by customer. It is written
// from what the customer typed on this order, and never read back to the
// frontend except through verifyPin.
async function upsertCustomer({ phone, name, email, isWhatsapp, address }) {
  return prisma.customer.upsert({
    where: { phone },
    create: { phone, name, email, isWhatsapp, address },
    update: { name, email, isWhatsapp, address },
  })
}

module.exports = {
  MAX_PIN_ATTEMPTS,
  lookupCustomer,
  verifyPin,
  saveDetailsWithPin,
  declineSavingDetails,
  upsertCustomer,
}
