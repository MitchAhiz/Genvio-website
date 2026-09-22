import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getWholesaleImages, getWholesaleCategories } from '../api/wholesale'
import { useTheme } from '../hooks/useTheme'
import CategoryPills from '../components/CategoryPills'
import ImageViewer from '../components/ImageViewer'
import { ArrowRightIcon } from '../components/icons'
import Footer from '../components/Footer'

export default function WholesalePage() {
  useTheme('wholesale')

  const [images, setImages] = useState([])
  const [categories, setCategories] = useState([])
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)

  useEffect(() => {
    document.title = 'Wholesale — Genvio Exotic Apparel'
  }, [])

  useEffect(() => {
    setLoading(true)
    setFailed(false)
    Promise.all([getWholesaleImages(), getWholesaleCategories()])
      .then(([imgs, cats]) => {
        setImages(imgs)
        setCategories(cats)
      })
      .catch((err) => {
        console.error('Failed to load lookbook:', err)
        setFailed(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(
    () => (active ? images.filter((img) => img.category === active) : images),
    [images, active]
  )
  const viewerImages = useMemo(() => visible.map((img) => img.url), [visible])

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="sticky top-0 z-40 bg-ground/90 backdrop-blur-sm border-b border-line transition-[background-color,border-color] duration-[400ms] ease-out-expo">
        <div className="max-w-7xl mx-auto px-4 h-12 sm:h-14 flex items-center justify-between gap-4">
          <Link to="/" className="font-display text-[17px] sm:text-xl font-semibold tracking-wide text-ink whitespace-nowrap">
            Genvio Exotic Apparel
          </Link>
          <Link
            to="/shop"
            className="group inline-flex items-center gap-1.5 text-[13px] sm:text-sm font-medium text-ink-soft hover:text-ink transition-colors"
          >
            Shop
            <ArrowRightIcon size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto pb-20">
        <div className="pt-8 pb-5 px-4 sm:pt-12 sm:pb-8">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-ink tracking-[-0.01em] text-balance">
            Wholesale Lookbook
          </h1>
          <p className="mt-3 max-w-md font-display italic text-lg sm:text-xl leading-snug text-ink-soft text-balance">
            A visual reference for trade buyers. Browse the range, then get in touch with the pieces you want.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="sticky top-12 sm:top-14 z-30 bg-ground/90 backdrop-blur-sm border-b border-line/60">
            <div className="py-2.5 pr-4">
              <CategoryPills categories={categories} active={active} onSelect={setActive} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="px-4 pt-6 columns-2 md:columns-3 xl:columns-4 gap-3 sm:gap-4 [column-fill:balance]" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="mb-3 sm:mb-4 break-inside-avoid rounded-lg bg-surface animate-pulse"
                style={{ aspectRatio: i % 3 === 0 ? '3 / 4' : i % 3 === 1 ? '4 / 5' : '1 / 1' }}
              />
            ))}
          </div>
        ) : failed ? (
          <p className="px-4 py-24 text-center text-sm text-muted">
            The lookbook couldn't be loaded. Check your connection and try again.
          </p>
        ) : visible.length === 0 ? (
          <div className="px-4 py-24 text-center">
            <p className="font-display text-xl text-ink">Nothing here yet</p>
            <p className="mt-2 text-sm text-muted">
              {active ? 'No images in this category.' : 'The lookbook is being prepared.'}
            </p>
          </div>
        ) : (
          <div className="px-4 pt-6 columns-2 md:columns-3 xl:columns-4 gap-3 sm:gap-4 [column-fill:balance]">
            {visible.map((img, i) => (
              <figure key={img.id} className="mb-3 sm:mb-4 break-inside-avoid">
                <button
                  type="button"
                  onClick={() => setViewerIndex(i)}
                  className="group block w-full overflow-hidden rounded-lg bg-surface"
                  aria-label={img.caption ? `View: ${img.caption}` : `View image ${i + 1}`}
                >
                  <img
                    src={img.url}
                    alt={img.caption || ''}
                    loading={i < 6 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto block transition-transform duration-700 ease-out-expo group-hover:scale-[1.02]"
                  />
                </button>
                {(img.caption || img.category) && (
                  <figcaption className="mt-2 px-0.5 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    {img.caption && <span className="text-[13px] text-ink-soft leading-snug">{img.caption}</span>}
                    {img.category && <span className="shrink-0 text-xs text-muted">{img.category}</span>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </main>

      {viewerIndex !== null && (
        <ImageViewer images={viewerImages} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}

      <Footer />
    </div>
  )
}
