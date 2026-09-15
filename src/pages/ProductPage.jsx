import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getProductBySlug, formatPrice } from '../api/products'
import { productPath, sectionPath } from '../sections'
import { useBag } from '../hooks/useBag'
import ImageViewer from '../components/ImageViewer'
import Price from '../components/Price'
import { ChevronLeftIcon } from '../components/icons'

export default function ProductPage() {
  const { section, slug } = useParams()
  const navigate = useNavigate()
  const { addItem } = useBag()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedColour, setSelectedColour] = useState(null)
  const [quantities, setQuantities] = useState({})
  const [currentImg, setCurrentImg] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    getProductBySlug(slug)
      .then((p) => {
        setProduct(p)
        setSelectedColour(p?.variants[0]?.colour ?? null)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return <p className="max-w-7xl mx-auto px-4 py-20 text-center text-sm text-muted">Loading…</p>
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-muted">Product not found</p>
        <button onClick={() => navigate(sectionPath(section))} className="mt-4 text-sm text-ink-soft underline underline-offset-4">
          Back to catalogue
        </button>
      </div>
    )
  }

  // A product opened under the wrong section (old link, search) moves to its own.
  if (product.section !== section) {
    return <Navigate to={productPath(product)} replace />
  }

  const variant = product.variants.find((v) => v.colour === selectedColour)
  const sizes = variant ? Object.entries(variant.sizes) : []
  const images = variant ? [variant.image, ...product.images.filter((img) => img !== variant.image)] : product.images

  const setQty = (size, val) => {
    const max = variant.sizes[size]
    const qty = Math.max(0, Math.min(max, Number(val) || 0))
    setQuantities((prev) => ({ ...prev, [size]: qty }))
  }

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0)
  const totalPrice = totalQty * product.price

  const handleAdd = () => {
    for (const [size, qty] of Object.entries(quantities)) {
      if (qty > 0) addItem({ product, colour: selectedColour, size, qty })
    }
    setQuantities({})
  }

  const handleColourChange = (colour) => {
    setSelectedColour(colour)
    setQuantities({})
    setCurrentImg(0)
  }

  return (
    <div className="max-w-7xl mx-auto pb-16">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 px-4 pt-4 text-sm text-muted hover:text-ink transition-colors"
      >
        <ChevronLeftIcon />
        Back
      </button>

      <div className="lg:grid lg:grid-cols-2 lg:gap-10 px-4 pt-2 sm:pt-4">
        {/* Image gallery */}
        <div>
          <button
            type="button"
            className="block w-full aspect-[3/4] rounded-md overflow-hidden bg-surface ring-1 ring-line/70 cursor-zoom-in"
            onClick={() => setViewerOpen(true)}
            aria-label="Open image viewer"
          >
            <img
              src={images[currentImg]}
              alt={`${product.name} — ${selectedColour ?? ''}`}
              className="w-full h-full object-cover"
            />
          </button>
          {images.length > 1 && (
            <div className="flex gap-2 mt-2 sm:mt-3 overflow-x-auto scrollbar-none">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImg(i)}
                  aria-label={`Image ${i + 1} of ${images.length}`}
                  aria-current={currentImg === i}
                  className={`w-14 h-[4.5rem] sm:w-16 sm:h-20 rounded-md overflow-hidden shrink-0 ring-1 transition-[box-shadow,opacity] duration-300 ${
                    currentImg === i ? 'ring-accent opacity-100' : 'ring-line/70 opacity-70 hover:opacity-100 hover:ring-accent/60'
                  }`}
                >
                  <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="mt-5 lg:mt-0 lg:sticky lg:top-20 lg:self-start">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium leading-[1.05] tracking-[-0.015em] text-ink text-balance">
            {product.name}
          </h1>
          <p className="mt-2 text-[13px] sm:text-sm text-muted">{product.brand}</p>
          <p className="font-display text-2xl sm:text-3xl text-ink-soft mt-3">
            <Price amount={product.price} />
          </p>

          {/* Colour selector */}
          {product.variants.length > 0 && (
            <div className="mt-4 sm:mt-6">
              <p className="text-sm font-medium text-ink mb-2">
                Colour: <span className="text-muted font-normal">{selectedColour}</span>
              </p>
              <div className="flex gap-2.5">
                {product.variants.map((v) => (
                  <button
                    key={v.colour}
                    onClick={() => handleColourChange(v.colour)}
                    className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full ring-1 ring-line ring-offset-2 ring-offset-ground transition-[box-shadow,transform] duration-300 ${
                      selectedColour === v.colour ? 'ring-accent ring-2 scale-105' : 'hover:ring-accent/60'
                    }`}
                    style={{ backgroundColor: v.hex }}
                    aria-label={v.colour}
                    aria-pressed={selectedColour === v.colour}
                    title={v.colour}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Size/quantity grid */}
          <div className="mt-4 sm:mt-6">
            <p className="text-sm font-medium text-ink mb-2 sm:mb-3">Select sizes & quantities</p>
            {sizes.length === 0 ? (
              <p className="text-sm text-muted">No sizes available for this colour.</p>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {sizes.map(([size, stock]) => (
                  <div key={size} className="flex items-center gap-3 sm:gap-4 py-1">
                    <span className="text-sm font-medium w-12 sm:w-14 tabular-nums">{size}</span>
                    <div className="flex-1 flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center border border-line rounded-lg overflow-hidden bg-elevated">
                        <button
                          onClick={() => setQty(size, (quantities[size] || 0) - 1)}
                          disabled={!quantities[size]}
                          aria-label={`Fewer ${size}`}
                          className="px-3 py-2.5 sm:px-2.5 sm:py-1.5 text-muted hover:text-ink disabled:opacity-30 text-sm"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={stock}
                          value={quantities[size] || ''}
                          onChange={(e) => setQty(size, e.target.value)}
                          disabled={stock === 0}
                          placeholder="0"
                          aria-label={`Quantity for ${size}`}
                          className="w-10 sm:w-12 text-center text-sm py-2.5 sm:py-1.5 bg-transparent border-x border-line disabled:opacity-30 focus:outline-none"
                        />
                        <button
                          onClick={() => setQty(size, (quantities[size] || 0) + 1)}
                          disabled={stock === 0 || (quantities[size] || 0) >= stock}
                          aria-label={`More ${size}`}
                          className="px-3 py-2.5 sm:px-2.5 sm:py-1.5 text-muted hover:text-ink disabled:opacity-30 text-sm"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[11px] sm:text-xs text-muted tabular-nums">
                        {stock > 0 ? `${stock} avail` : 'Out'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add to bag */}
          <div className="mt-6 sm:mt-8 sticky bottom-0 -mx-4 px-4 py-3 sm:py-4 bg-ground/92 backdrop-blur-sm border-t border-line/60 lg:static lg:m-0 lg:p-0 lg:bg-transparent lg:border-0 lg:backdrop-blur-none">
            <button
              onClick={handleAdd}
              disabled={totalQty === 0}
              className="w-full h-13 sm:h-12 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover hover:shadow-[0_8px_20px_-6px_rgb(0_0_0/0.4)] active:translate-y-px active:shadow-none disabled:bg-transparent disabled:text-muted disabled:border disabled:border-line disabled:shadow-none disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform] duration-300"
            >
              {totalQty > 0
                ? `Add to Bag — ${totalQty} ${totalQty === 1 ? 'item' : 'items'} · ${formatPrice(totalPrice)}`
                : 'Select sizes to add'}
            </button>
          </div>
        </div>
      </div>

      {viewerOpen && <ImageViewer images={images} startIndex={currentImg} onClose={() => setViewerOpen(false)} />}
    </div>
  )
}
