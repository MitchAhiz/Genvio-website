import { useState, useMemo, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getProducts, getCategories } from '../api/products'
import { SECTIONS, getSection, sectionPath } from '../sections'
import CategoryPills from '../components/CategoryPills'
import ProductCard from '../components/ProductCard'
import SortSelect from '../components/SortSelect'

export default function CataloguePage() {
  const { section } = useParams()
  const meta = getSection(section)
  // Footer "Top Brands" links land here as /shop/:section?brand=Name — a
  // plain query param rather than route/local state since it needs to
  // survive the /shop index-page redirect into whichever section is last
  // visited, before this component even exists yet.
  const [searchParams] = useSearchParams()
  const brandFilter = searchParams.get('brand')
  const categoryFilter = searchParams.get('category')

  const [activeCategory, setActiveCategory] = useState(null)
  const [sort, setSort] = useState('newest')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setActiveCategory(null)
    Promise.all([getProducts({ section }), getCategories({ section })])
      .then(([prods, cats]) => {
        if (cancelled) return
        setProducts(prods)
        setCategories(cats)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load catalogue:', err)
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [section])

  // Footer sub-links (e.g. Women -> Dresses) land here as ?category=Name,
  // matched case-insensitively against the section's real category list so
  // it composes with pill selection and doesn't depend on fetch timing.
  useEffect(() => {
    if (!categoryFilter || categories.length === 0) return
    const match = categories.find((c) => c.toLowerCase() === categoryFilter.toLowerCase())
    if (match) setActiveCategory(match)
  }, [categoryFilter, categories])

  const filtered = useMemo(() => {
    let list = activeCategory ? products.filter((p) => p.category === activeCategory) : products
    if (brandFilter) {
      const needle = brandFilter.toLowerCase()
      list = list.filter((p) => (p.brand || '').toLowerCase() === needle)
    }

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
  }, [products, activeCategory, sort, brandFilter])

  const otherSections = SECTIONS.filter((s) => s.key !== section)
  const grid = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14'

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <div className="pt-10 pb-6 sm:pt-16 sm:pb-10 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-medium tracking-[-0.02em] text-ink text-balance">
            {meta.label}
          </h1>
          <p className="mt-3 max-w-md font-display italic text-lg sm:text-xl leading-snug text-ink-soft text-balance">{meta.blurb}</p>
        </div>
        {!loading && !failed && products.length > 0 && (
          <p className="text-sm text-muted tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'}
          </p>
        )}
      </div>

      <div className="sticky top-[5.5rem] sm:top-14 z-30 bg-ground/92 backdrop-blur-sm border-y border-line/70 transition-[background-color,border-color] duration-[400ms] ease-out-expo">
        <div className="flex items-center gap-3 py-3 pr-4 sm:pr-6">
          <CategoryPills categories={categories} active={activeCategory} onSelect={setActiveCategory} />
          <div className="shrink-0">
            <SortSelect value={sort} onChange={setSort} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`px-4 sm:px-6 pt-8 sm:pt-12 ${grid}`} aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] rounded-md bg-surface" />
              <div className="mt-4 h-2 w-1/3 rounded bg-surface" />
              <div className="mt-2.5 h-3 w-2/3 rounded bg-surface" />
              <div className="mt-2.5 h-3 w-1/4 rounded bg-surface" />
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className="px-4 py-28 text-center">
          <p className="font-display text-xl text-ink">The catalogue couldn't be loaded</p>
          <p className="mt-2 text-sm text-muted">Check your connection and try again.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="px-4 py-28 text-center">
          <p className="font-display text-2xl sm:text-3xl text-ink text-balance">The {meta.label} collection is coming soon</p>
          <p className="mt-3 text-sm text-muted">Nothing has been published in this section yet.</p>
          <div className="mt-8 flex justify-center gap-2.5">
            {otherSections.map((s) => (
              <Link
                key={s.key}
                to={sectionPath(s.key)}
                className="h-10 px-5 inline-flex items-center rounded-full border border-line text-[13px] font-medium tracking-[0.04em] text-ink-soft hover:border-accent hover:text-ink transition-colors duration-300"
              >
                Browse {s.label}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={`px-4 sm:px-6 pt-8 sm:pt-12 ${grid}`}>
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-muted py-24 text-sm">
              {brandFilter ? `No ${meta.label.toLowerCase()} pieces from ${brandFilter}` : 'No pieces in this category'}
            </p>
          )}
        </>
      )}
    </div>
  )
}
