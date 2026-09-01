import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getProductBySlug, formatPrice } from '../api/products'
import { useBag } from '../hooks/useBag'
import ImageViewer from '../components/ImageViewer'

export default function ProductPage() {
  const { slug } = useParams()
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
    return <p className="max-w-7xl mx-auto px-4 py-20 text-center text-sm text-muted">Loading...</p>
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-muted">Product not found</p>
        <button onClick={() => navigate('/')} className="mt-4 text-sm text-brown underline">
          Back to catalogue
        </button>
      </div>
    )
  }

  const variant = product.variants.find((v) => v.colour === selectedColour)
  const sizes = Object.entries(variant.sizes)
  const images = [variant.image, ...product.images.filter((img) => img !== variant.image)]

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
        className="flex items-center gap-1 px-4 pt-4 text-sm text-muted hover:text-charcoal transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>

      <div className="lg:grid lg:grid-cols-2 lg:gap-10 px-4 pt-2 sm:pt-4">
        {/* Image gallery */}
        <div>
          <div
            className="aspect-[3/4] rounded-lg sm:rounded-xl overflow-hidden bg-surface cursor-pointer"
            onClick={() => setViewerOpen(true)}
          >
            <img
              src={images[currentImg]}
              alt={`${product.name} — ${selectedColour}`}
              className="w-full h-full object-cover"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-2 sm:mt-3 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImg(i)}
                  className={`w-14 h-[4.5rem] sm:w-16 sm:h-20 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${
                    currentImg === i ? 'border-charcoal' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="mt-4 lg:mt-0">
          <p className="text-xs uppercase tracking-wider text-muted">{product.brand}</p>
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-charcoal mt-1">
            {product.name}
          </h1>
          <p className="text-lg sm:text-xl font-semibold text-brown mt-1.5">{formatPrice(product.price)}</p>

          {/* Colour selector */}
          <div className="mt-4 sm:mt-6">
            <p className="text-sm font-medium text-charcoal mb-2">
              Colour: <span className="text-muted font-normal">{selectedColour}</span>
            </p>
            <div className="flex gap-2.5">
              {product.variants.map((v) => (
                <button
                  key={v.colour}
                  onClick={() => handleColourChange(v.colour)}
                  className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full border-2 transition-all ${
                    selectedColour === v.colour ? 'border-charcoal scale-110' : 'border-border hover:border-dusty-rose'
                  }`}
                  style={{ backgroundColor: v.hex }}
                  aria-label={v.colour}
                  title={v.colour}
                />
              ))}
            </div>
          </div>

          {/* Size/quantity grid */}
          <div className="mt-4 sm:mt-6">
            <p className="text-sm font-medium text-charcoal mb-2 sm:mb-3">Select sizes & quantities</p>
            <div className="space-y-1.5 sm:space-y-2">
              {sizes.map(([size, stock]) => (
                <div key={size} className="flex items-center gap-3 sm:gap-4 py-1">
                  <span className="text-sm font-medium w-8 sm:w-10">{size}</span>
                  <div className="flex-1 flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setQty(size, (quantities[size] || 0) - 1)}
                        disabled={!quantities[size]}
                        className="px-3 py-2.5 sm:px-2.5 sm:py-1.5 text-muted hover:text-charcoal disabled:opacity-30 text-sm"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={stock}
                        value={quantities[size] || ''}
                        onChange={(e) => setQty(size, e.target.value)}
                        disabled={stock === 0}
                        placeholder="0"
                        className="w-10 sm:w-12 text-center text-sm py-2.5 sm:py-1.5 bg-transparent border-x border-border disabled:opacity-30 focus:outline-none"
                      />
                      <button
                        onClick={() => setQty(size, (quantities[size] || 0) + 1)}
                        disabled={stock === 0 || (quantities[size] || 0) >= stock}
                        className="px-3 py-2.5 sm:px-2.5 sm:py-1.5 text-muted hover:text-charcoal disabled:opacity-30 text-sm"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[11px] sm:text-xs text-muted">
                      {stock > 0 ? `${stock} avail` : 'Out'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add to bag */}
          <div className="mt-6 sm:mt-8 sticky bottom-3 sm:bottom-4">
            <button
              onClick={handleAdd}
              disabled={totalQty === 0}
              className="w-full py-3.5 sm:py-3 rounded-xl bg-charcoal text-cream text-sm font-semibold hover:bg-brown transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-px shadow-lg"
            >
              {totalQty > 0
                ? `Add to Bag — ${totalQty} ${totalQty === 1 ? 'item' : 'items'} · ${formatPrice(totalPrice)}`
                : 'Select sizes to add'}
            </button>
          </div>
        </div>
      </div>

      {viewerOpen && (
        <ImageViewer images={images} startIndex={currentImg} onClose={() => setViewerOpen(false)} />
      )}
    </div>
  )
}
