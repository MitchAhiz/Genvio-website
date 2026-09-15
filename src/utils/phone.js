// Nigerian mobile numbers. Mirrors server/src/utils/sanitize.js.

export function digitsOnly(input) {
  return String(input || '').replace(/\D/g, '')
}

// '0801 234 5678' | '+234 801…' | '801…' → '08012345678', or null if not valid.
export function normalizeNgPhone(input) {
  let d = digitsOnly(input)
  if (d.length === 13 && d.startsWith('234')) d = '0' + d.slice(3)
  if (d.length === 10 && /^[789]/.test(d)) d = '0' + d
  return /^0[789][01]\d{8}$/.test(d) ? d : null
}

// Groups as the number is typed: 0801 234 5678.
export function formatNgPhone(input) {
  const d = digitsOnly(input).slice(0, 13)
  if (d.startsWith('234')) {
    const rest = d.slice(3)
    return ['+234', rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 10)].filter(Boolean).join(' ')
  }
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(' ')
}
