// Display-face price.
//
// Playfair Display genuinely has no U+20A6 — measured: its ₦ advance width is
// identical to Georgia's (the fallback) while other glyphs differ — so the
// sign is set in Inter and optically matched to the Playfair figures beside
// it. 0.95em lines Inter's cap height (0.727em) up with Playfair's (~0.70em);
// the small negative tracking closes the gap the substitution opens.
export default function Price({ amount, className = '' }) {
  return (
    <span className={`tabular-nums ${className}`}>
      <span className="font-body text-[0.95em] font-normal tracking-[-0.02em] mr-[0.06em]">₦</span>
      {amount.toLocaleString('en-NG')}
    </span>
  )
}
