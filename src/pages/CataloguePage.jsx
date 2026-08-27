import { useState, useMemo } from 'react'
import { getProducts, getCategories } from '../api/products'
import CategoryPills from '../components/CategoryPills'
import ProductCard from '../components/ProductCard'
import SortSelect from '../components/SortSelect'

export default function CataloguePage() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [sort, setSort] = useState('newest')
  const products = getProducts()
  const categories = getCategories()

  const filtered = useMemo(() => {
    let list = activeCategory
      ? products.filter((p) => p.category === activeCategory)
      : products

    switch (sort) {
      case 'price-asc':
        list = [...list].sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        list = [...list].sort((a, b) => b.price - a.price)
        break
      case 'name':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name))
        break
      default:
        list = [...list].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
    }
    return list
  }, [products, activeCategory, sort])

  return (
    <div className="max-w-7xl mx-auto pb-16">
      <div className="pt-6 pb-4 px-4">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-charcoal">
          New Collection
        </h1>
        <p className="text-sm text-muted mt-1">Curated wholesale pieces for your store</p>
      </div>

      <div className="sticky top-12 sm:top-14 z-30 bg-cream/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-2 py-2.5 pr-4">
          <CategoryPills categories={categories} active={activeCategory} onSelect={setActiveCategory} />
          <div className="shrink-0 pr-1">
            <SortSelect value={sort} onChange={setSort} />
          </div>
        </div>
      </div>

      <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted py-20 text-sm">No products in this category</p>
      )}
    </div>
  )
}
