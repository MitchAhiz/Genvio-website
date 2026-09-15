// Input hygiene for customer-facing endpoints. Everything that reaches the
// database passes through here first.

// ASCII control characters (0x00–0x1F and 0x7F), built without escape
// sequences so the source file itself never contains them.
const CONTROL_CHARS = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']',
  'g'
)

function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Accepts 0801 234 5678, 08012345678, +2348012345678, 2348012345678, 8012345678.
// Returns the local 11-digit form, or null if it is not a Nigerian mobile number.
function normalizePhone(input) {
  if (typeof input !== 'string') return null
  let digits = input.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('234')) digits = '0' + digits.slice(3)
  if (digits.length === 10 && /^[789]/.test(digits)) digits = '0' + digits
  return /^0[789][01]\d{8}$/.test(digits) ? digits : null
}

// null = not given, undefined = given but invalid.
function cleanEmail(value) {
  const email = cleanText(value, 120).toLowerCase()
  if (!email) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : undefined
}

function cleanAddress(value) {
  if (!value || typeof value !== 'object') return null
  const street = cleanText(value.street, 200)
  const city = cleanText(value.city, 80)
  const state = cleanText(value.state, 80)
  if (street.length < 3 || city.length < 2 || state.length < 2) return null
  return { street, city, state }
}

// Snapshot of the bag. Only the fields the order needs are kept.
function cleanItems(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null
  const items = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null
    const qty = Number(raw.qty)
    const unitPrice = Number(raw.unitPrice)
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) return null
    if (!Number.isInteger(unitPrice) || unitPrice < 0 || unitPrice > 100_000_000) return null
    const name = cleanText(raw.name, 120)
    if (!name) return null
    items.push({
      productId: cleanText(raw.productId, 64) || null,
      name,
      brand: cleanText(raw.brand, 80) || null,
      colour: cleanText(raw.colour, 60) || null,
      size: cleanText(raw.size, 20) || null,
      image: typeof raw.image === 'string' && /^https?:\/\//i.test(raw.image) ? raw.image.slice(0, 500) : null,
      qty,
      unitPrice,
    })
  }
  return items
}

module.exports = { cleanText, normalizePhone, cleanEmail, cleanAddress, cleanItems }
