import { useState, useEffect, useCallback } from 'react'

export default function ImageViewer({ images, startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex)

  const prev = useCallback(() => setCurrent((i) => (i > 0 ? i - 1 : images.length - 1)), [images.length])
  const next = useCallback(() => setCurrent((i) => (i < images.length - 1 ? i + 1 : 0)), [images.length])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, prev, next])

  return (
    <div className="fixed inset-0 z-50 bg-charcoal/95 flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 p-2 text-cream/80 hover:text-cream"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        {images.length > 1 && (
          <>
            <button onClick={prev} aria-label="Previous" className="absolute left-3 p-2 text-cream/70 hover:text-cream">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button onClick={next} aria-label="Next" className="absolute right-3 p-2 text-cream/70 hover:text-cream">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </>
        )}

        <img
          src={images[current]}
          alt={`Image ${current + 1}`}
          className="max-w-full max-h-[90vh] object-contain"
        />

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-cream/70 text-sm font-medium">
          {current + 1} / {images.length}
        </div>
      </div>
    </div>
  )
}
