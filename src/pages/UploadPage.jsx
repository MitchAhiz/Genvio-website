import { useEffect, useMemo, useState } from 'react'
import { getAdminCategories, createUploadProduct, restockUploadColour } from '../api/admin'
import { apiFetch } from '../api/client'
import { useUploadCapabilities } from '../hooks/useUploadCapabilities'
import { useNoIndex } from '../hooks/useNoIndex'
import LoginForm from '../components/auth/LoginForm'
import RestockBar from '../components/upload/RestockBar'
import PhotoStep from '../components/upload/PhotoStep'
import DetailsStep from '../components/upload/DetailsStep'
import StockStep from '../components/upload/StockStep'
import ReviewStep from '../components/upload/ReviewStep'

const STEPS = ['Photos', 'Details', 'Stock', 'Review']

// Same auth-gate shape as AdminPage.jsx: GET /api/auth/me, null while
// pending. Returns the setter too (like useState) so a successful
// LoginForm sign-in can flip straight into the upload flow, the same way
// AdminPage flips into AdminLayout — never a redirect to /admin.
function useAuthGate() {
  const [authed, setAuthed] = useState(null)
  useEffect(() => {
    apiFetch('/api/auth/me').then(() => setAuthed(true)).catch(() => setAuthed(false))
  }, [])
  return [authed, setAuthed]
}

function StepRail({ step, colourCount }) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Upload steps">
      {STEPS.map((label, i) => (
        <div
          key={label}
          className={`min-w-[70px] flex-1 rounded-md px-2 py-1.5 text-center text-xs font-semibold ${
            i === step ? 'border border-slate-900 bg-slate-900 text-white' : i < step ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
          }`}
        >
          {i + 1}. {label}
        </div>
      ))}
      {colourCount > 0 && step < 2 && (
        <span className="ml-1 shrink-0 self-center text-xs text-slate-400">{colourCount} colour{colourCount === 1 ? '' : 's'} added</span>
      )}
    </nav>
  )
}

export default function UploadPage() {
  useNoIndex()
  const [authed, setAuthed] = useAuthGate()
  const { capabilities, error: capError } = useUploadCapabilities(authed === true)

  const [womenCategoryId, setWomenCategoryId] = useState(null)
  const [categoryStatus, setCategoryStatus] = useState('loading') // 'loading' | 'ready' | 'missing'
  useEffect(() => {
    if (authed !== true) return
    getAdminCategories('women')
      .then((cats) => {
        if (cats[0]?.id) {
          setWomenCategoryId(cats[0].id)
          setCategoryStatus('ready')
        } else {
          setCategoryStatus('missing')
        }
      })
      .catch(() => setCategoryStatus('missing'))
  }, [authed])

  const [mode, setMode] = useState('new') // 'new' | 'restock'
  const [step, setStep] = useState(0)
  const [lockedProduct, setLockedProduct] = useState(null) // { id: null|string, brand, name, subcategoryId, price }
  const [pendingImages, setPendingImages] = useState(null) // { images, rawFrontUrl, rawBackUrl } for the colour in progress
  const [blocks, setBlocks] = useState([]) // [{ key, colourName, images, rawFrontUrl, rawBackUrl, currentBySize, variantId? }]
  const [stockByBlock, setStockByBlock] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const reset = () => {
    setMode('new')
    setStep(0)
    setLockedProduct(null)
    setPendingImages(null)
    setBlocks([])
    setStockByBlock({})
    setSubmitError('')
  }

  const subcategoryId = lockedProduct?.subcategoryId || null

  // Restock side-door: skip photos and details entirely, jump to stock.
  const handleRestockPick = (product, variant) => {
    setMode('restock')
    setLockedProduct({
      id: product.id,
      brand: product.brand,
      name: product.name,
      subcategoryId: product.subcategory?.id,
      price: product.price,
      categoryId: product.category?.id,
    })
    const currentBySize = {}
    for (const s of variant.sizes) currentBySize[s.size] = s.quantity
    setBlocks([{ key: variant.id, colourName: variant.colour, currentBySize, variantId: variant.id }])
    setStockByBlock({})
    setStep(2)
  }

  const handlePhotosApproved = (payload) => {
    setPendingImages(payload)
    setStep(1)
  }

  const handleSaveColour = (payload) => {
    const key = `c${blocks.length + 1}-${Date.now()}`
    const newBlock = {
      key,
      colourName: payload.colourName,
      images: pendingImages.images,
      rawFrontUrl: pendingImages.rawFrontUrl,
      rawBackUrl: pendingImages.rawBackUrl,
      currentBySize: {},
    }
    setBlocks((prev) => [...prev, newBlock])
    setPendingImages(null)

    // Always (re-)set the full locked-product snapshot from this save —
    // covers the first colour, a later colour on the same product, and a
    // dedup adoption of a different existing product mid-session.
    setLockedProduct({
      id: payload.productId,
      brand: payload.brand,
      name: payload.name,
      subcategoryId: payload.subcategoryId,
      price: payload.price,
    })
  }

  const handleChangeStock = (blockKey, size, qty) => {
    setStockByBlock((prev) => ({ ...prev, [blockKey]: { ...prev[blockKey], [size]: qty } }))
  }

  const handleApprove = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      if (mode === 'restock') {
        const block = blocks[0]
        const sizes = Object.entries(stockByBlock[block.key] || {})
          .filter(([, qty]) => qty > 0)
          .map(([size, quantity]) => ({ size, quantity }))
        await restockUploadColour(block.variantId, sizes)
      } else {
        const colours = blocks.map((block) => ({
          colourName: block.colourName,
          images: block.images,
          rawFrontUrl: block.rawFrontUrl,
          rawBackUrl: block.rawBackUrl,
          sizes: Object.entries(stockByBlock[block.key] || {})
            .filter(([, qty]) => qty > 0)
            .map(([size, quantity]) => ({ size, quantity })),
        }))
        await createUploadProduct({
          productId: lockedProduct.id,
          brand: lockedProduct.brand,
          name: lockedProduct.name,
          subcategoryId: lockedProduct.subcategoryId,
          price: lockedProduct.price,
          colours,
        })
      }
      reset()
    } catch (err) {
      // Leave the review screen intact on failure so staff can retry
      // without redoing photos/details/stock.
      setSubmitError(err.message || 'Failed to submit — nothing was lost, try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const cardImageUrl = pendingImages?.images?.[0]?.url || null

  if (authed === null) return null
  if (!authed) {
    return <LoginForm title="Sign in to upload products" onLogin={() => setAuthed(true)} />
  }

  // Every field/step below (sub-category dropdown, size range) depends on a
  // "Women" category existing — without it the form would otherwise render
  // with a permanently-disabled, unexplained "Save colour" button instead
  // of telling staff what's actually missing.
  if (categoryStatus === 'missing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-900">No "Women" category configured</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Set one up under Admin → Products → Manage Categories before using this page.
          </p>
        </div>
      </div>
    )
  }
  if (categoryStatus === 'loading') return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Upload a product</h1>
        <p className="text-sm text-slate-500">Women's apparel — photos through to stock, in one flow.</p>
      </header>

      {capError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{capError}</div>}

      {step < 2 && (
        <div className="mb-4">
          <RestockBar onPickColour={handleRestockPick} />
        </div>
      )}

      <StepRail step={step} colourCount={blocks.length} />

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        {step === 0 && capabilities && (
          <PhotoStep capabilities={capabilities} onApproved={handlePhotosApproved} />
        )}

        {step === 1 && capabilities && (
          <>
            <DetailsStep
              capabilities={capabilities}
              categoryId={womenCategoryId}
              cardImageUrl={cardImageUrl}
              lockedProduct={lockedProduct}
              onSaveColour={handleSaveColour}
            />
            {blocks.length > 0 && (
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setStep(0)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  + Add another colour
                </button>
                <button type="button" onClick={() => setStep(2)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                  Continue to stock →
                </button>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <StockStep
            categoryId={mode === 'restock' ? lockedProduct.categoryId : womenCategoryId}
            subcategoryId={subcategoryId}
            blocks={blocks}
            stockByBlock={stockByBlock}
            onChangeStock={handleChangeStock}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <ReviewStep
            mode={mode}
            lockedProduct={lockedProduct}
            blocks={blocks}
            stockByBlock={stockByBlock}
            submitting={submitting}
            submitError={submitError}
            onApprove={handleApprove}
            onDiscard={reset}
          />
        )}
      </section>
    </div>
  )
}
