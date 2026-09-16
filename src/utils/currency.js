import { createElement } from 'react'

// Comma-separated Naira amount, no symbol — for contexts that already
// carry their own ₦ (e.g. composed inline with other Inter text).
export function formatNaira(amount) {
  return Number(amount).toLocaleString('en-NG')
}

// Display-face Naira amount. Playfair Display has no ₦ glyph (see
// DESIGN.md / Price.jsx), so the sign renders in Inter at 0.95em, optically
// matched to whatever display face surrounds it, while the figures inherit
// the parent's font and stay tabular.
//
// Written with createElement (this file is .js, not .jsx) so it can live
// alongside the plain formatter per the admin shell task's file list.
export function NairaAmount({ value, className = '' }) {
  return createElement(
    'span',
    { className: `tabular-nums ${className}`.trim() },
    createElement(
      'span',
      { className: 'font-body text-[0.95em] font-normal tracking-[-0.02em] mr-[0.06em]' },
      '₦'
    ),
    formatNaira(value)
  )
}
