import { Link } from 'react-router-dom'
import { getSizeRange } from '../api/products'
import { productPath } from '../sections'
import { useState } from 'react'
import QuickAdd from './QuickAdd'
import Price from './Price'

export default function ProductCard({ product }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const sizeRange = getSizeRange(product.variants)
  const colourCount = product.variants.length
  const href = productPath(product)

  return (
    <article className="group">
      <Link to={href} className="block relative">
        <div className="aspect-[3/4] overflow-hidden rounded-md bg-surface ring-1 ring-line/70 group-hover:ring-accent/60 transition-[box-shadow,background-color] duration-500 ease-out-expo">
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-[1200ms] ease-out-expo"
          />
        </div>
        {product.isNew && (
          <span className="absolute top-3 left-3 h-6 px-2.5 inline-flex items-center rounded-sm bg-accent-soft text-ink text-[11px] font-medium">
            New
          </span>
        )}
      </Link>

      <div className="mt-3.5 sm:mt-4 px-0.5">
        <Link to={href} className="block">
          <h3 className="text-[14px] sm:text-[15px] font-medium leading-snug text-ink text-balance">{product.name}</h3>
        </Link>
        <p className="mt-1 text-[12px] sm:text-[13px] text-muted">{product.brand}</p>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <p className="font-display text-lg sm:text-xl text-ink-soft">
            <Price amount={product.price} />
          </p>
          <p className="text-[11px] sm:text-xs text-muted truncate">
            {colourCount} {colourCount === 1 ? 'colour' : 'colours'}
            {sizeRange ? ` · ${sizeRange}` : ''}
          </p>
        </div>

        <button
          onClick={() => setQuickAddOpen(true)}
          className="mt-3.5 w-full h-10 rounded-md border border-accent/50 bg-transparent text-[13px] font-medium tracking-[0.02em] text-ink shadow-[0_1px_0_0_rgb(0_0_0/0.03)] hover:bg-accent-soft hover:border-accent hover:shadow-[0_3px_8px_-3px_rgb(0_0_0/0.25)] active:translate-y-px active:shadow-none transition-[background-color,border-color,color,box-shadow,transform] duration-300"
        >
          Add to Bag
        </button>
      </div>

      {quickAddOpen && <QuickAdd product={product} onClose={() => setQuickAddOpen(false)} />}
    </article>
  )
}
