import { Link } from 'react-router-dom'
import { formatPrice, getSizeRange } from '../api/products'
import { useState } from 'react'
import QuickAdd from './QuickAdd'

export default function ProductCard({ product }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const sizeRange = getSizeRange(product.variants)
  const colourCount = product.variants.length

  return (
    <div className="group">
      <Link to={`/product/${product.slug}`} className="block">
        <div className="aspect-[3/4] overflow-hidden rounded-lg sm:rounded-xl bg-surface">
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        </div>
      </Link>

      <div className="mt-2 px-0.5">
        <p className="text-xs uppercase tracking-wider text-muted">{product.brand}</p>
        <Link to={`/product/${product.slug}`}>
          <h3 className="text-[13px] sm:text-sm font-medium text-charcoal mt-0.5 leading-snug">{product.name}</h3>
        </Link>
        <p className="text-[13px] sm:text-sm font-semibold text-brown mt-0.5">{formatPrice(product.price)}</p>
        <p className="text-[11px] sm:text-xs text-muted mt-0.5">
          {colourCount} {colourCount === 1 ? 'colour' : 'colours'} · {sizeRange}
        </p>

        <button
          onClick={() => setQuickAddOpen(true)}
          className="mt-1.5 sm:mt-2 w-full py-2.5 text-[13px] sm:text-sm font-medium text-charcoal bg-surface hover:bg-blush/40 rounded-lg transition-colors active:translate-y-px"
        >
          Add to Bag
        </button>
      </div>

      {quickAddOpen && (
        <QuickAdd product={product} onClose={() => setQuickAddOpen(false)} />
      )}
    </div>
  )
}
