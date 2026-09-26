import { useState } from 'react'
import { ApiError } from '../../api/client'
import { generateCard } from '../../api/admin'
import { compressProductImage, isFileTooLarge } from '../../utils/imageCompression'
import { uploadProductFile } from '../../utils/uploadToStorage'

// Turns a thrown ApiError from generate-card into an inline message, never
// letting it bubble to a page-level boundary — a failure here must never
// unmount this component and lose the staff member's already-captured
// photos. 503 AI_CARDS_DISABLED and 429 rate-limit both get their own
// wording; anything else falls back to the error's own message.
function describeGenerateCardError(err) {
  if (err instanceof ApiError && err.status === 503) {
    return "AI card generation isn't switched on right now. Use \"Use a card I already have\" instead."
  }
  if (err instanceof ApiError && err.status === 429) {
    return 'Image generation is temporarily unavailable — try again shortly.'
  }
  return err.message || 'Something went wrong generating the card.'
}

function PhotoSlot({ label, required, preview, onChange, disabled }) {
  return (
    <label
      className={`relative flex h-36 w-28 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-2 text-center text-xs text-slate-500 ${
        preview ? 'border-solid border-slate-900 p-0' : 'border-slate-300 bg-slate-50'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      {preview ? (
        <img src={preview} alt={label} className="h-full w-full rounded-lg object-cover" />
      ) : (
        <span>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onChange(file)
          e.target.value = ''
        }}
      />
    </label>
  )
}

function GeneratedCard({ label, url, approved, onApprove, onRegenerate, busy }) {
  return (
    <div className="flex w-36 flex-col items-center gap-2">
      <div className={`relative h-44 w-36 overflow-hidden rounded-lg border-2 ${approved ? 'border-emerald-600' : 'border-slate-200'}`}>
        {busy ? (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400">Generating…</div>
        ) : url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {!busy && url && (
        <div className="flex gap-1.5">
          <button type="button" onClick={onRegenerate} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
            ↻ Regenerate
          </button>
          {!approved && (
            <button type="button" onClick={onApprove} className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white">
              ✓ Approve
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Mode A: shoot a front (required) and optional back photo; Gemini
// generates a product card from each. The back card is generated strictly
// after the front card is approved — enforced here as an explicit guard
// (frontCard.approved), not just an assumption about call order.
function ShootMode({ onApproved }) {
  const [frontFile, setFrontFile] = useState(null)
  const [frontPreview, setFrontPreview] = useState(null)
  const [frontRawUrl, setFrontRawUrl] = useState(null)
  const [frontCardUrl, setFrontCardUrl] = useState(null)
  const [frontApproved, setFrontApproved] = useState(false)
  const [frontBusy, setFrontBusy] = useState(false)
  const [frontError, setFrontError] = useState('')

  const [backFile, setBackFile] = useState(null)
  const [backPreview, setBackPreview] = useState(null)
  const [backRawUrl, setBackRawUrl] = useState(null)
  const [backCardUrl, setBackCardUrl] = useState(null)
  const [backApproved, setBackApproved] = useState(false)
  const [backBusy, setBackBusy] = useState(false)
  const [backError, setBackError] = useState('')

  const pickFront = async (file) => {
    if (isFileTooLarge(file)) { setFrontError('That photo is too large.'); return }
    setFrontError('')
    setFrontPreview(URL.createObjectURL(file))
    const compressed = await compressProductImage(file)
    setFrontFile(compressed)
    // A new front photo invalidates any card already generated for the old one.
    setFrontRawUrl(null)
    setFrontCardUrl(null)
    setFrontApproved(false)
  }

  const pickBack = async (file) => {
    if (isFileTooLarge(file)) { setBackError('That photo is too large.'); return }
    setBackError('')
    setBackPreview(URL.createObjectURL(file))
    const compressed = await compressProductImage(file)
    setBackFile(compressed)
    setBackRawUrl(null)
    setBackCardUrl(null)
    setBackApproved(false)
  }

  const generateFront = async () => {
    if (!frontFile) return
    setFrontBusy(true)
    setFrontError('')
    try {
      // Sign-before-upload: a fresh signed URL is requested immediately
      // before this specific push, even on regenerate with an already
      // known frontRawUrl re-used only for the Gemini call, never re-signed
      // needlessly — but the raw photo itself is only ever pushed once.
      let rawUrl = frontRawUrl
      if (!rawUrl) {
        rawUrl = await uploadProductFile(frontFile, 'raw')
        setFrontRawUrl(rawUrl)
      }
      const { url } = await generateCard(rawUrl, 'front')
      setFrontCardUrl(url)
      setFrontApproved(false)
      // A regenerated front card invalidates any back card already
      // generated against the previous one — force it to be redone.
      setBackCardUrl(null)
      setBackApproved(false)
    } catch (err) {
      setFrontError(describeGenerateCardError(err))
    } finally {
      setFrontBusy(false)
    }
  }

  const generateBack = async () => {
    if (!backFile || !frontApproved || !frontCardUrl) return
    setBackBusy(true)
    setBackError('')
    try {
      let rawUrl = backRawUrl
      if (!rawUrl) {
        rawUrl = await uploadProductFile(backFile, 'raw')
        setBackRawUrl(rawUrl)
      }
      const { url } = await generateCard(rawUrl, 'back', frontCardUrl)
      setBackCardUrl(url)
      setBackApproved(false)
    } catch (err) {
      setBackError(describeGenerateCardError(err))
    } finally {
      setBackBusy(false)
    }
  }

  const canContinue = frontApproved && (!backFile || backApproved)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <PhotoSlot label="Front photo" required preview={frontPreview} onChange={pickFront} />
        <PhotoSlot label="Back photo (optional)" preview={backPreview} onChange={pickBack} />
      </div>

      <button
        type="button"
        onClick={generateFront}
        disabled={!frontFile || frontBusy}
        className="w-fit rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {frontCardUrl ? 'Regenerate front card' : 'Generate front card'}
      </button>
      {frontError && <p className="text-xs text-red-600">{frontError}</p>}

      {(frontCardUrl || frontBusy) && (
        <GeneratedCard
          label="Product card (front)"
          url={frontCardUrl}
          approved={frontApproved}
          busy={frontBusy}
          onApprove={() => setFrontApproved(true)}
          onRegenerate={generateFront}
        />
      )}

      {/* Back card generation is guarded: hidden entirely until the front
          card is approved, never just implied by call order. */}
      {frontApproved && backFile && (
        <>
          <button
            type="button"
            onClick={generateBack}
            disabled={backBusy}
            className="w-fit rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {backCardUrl ? 'Regenerate back card' : 'Generate back card'}
          </button>
          {backError && <p className="text-xs text-red-600">{backError}</p>}
          {(backCardUrl || backBusy) && (
            <GeneratedCard
              label="Gallery card (back)"
              url={backCardUrl}
              approved={backApproved}
              busy={backBusy}
              onApprove={() => setBackApproved(true)}
              onRegenerate={generateBack}
            />
          )}
        </>
      )}

      <button
        type="button"
        disabled={!canContinue}
        onClick={() =>
          onApproved({
            images: [
              { url: frontCardUrl, provenance: 'ai-generated' },
              ...(backCardUrl ? [{ url: backCardUrl, provenance: 'ai-generated' }] : []),
            ],
            rawFrontUrl: frontRawUrl,
            rawBackUrl: backRawUrl,
          })
        }
        className="w-fit rounded-md border border-slate-900 px-3 py-1.5 text-sm font-medium text-slate-900 disabled:opacity-40"
      >
        Continue with {backCardUrl ? 'these cards' : 'this card'} →
      </button>
    </div>
  )
}

// Mode B: staff already has finished card image(s) — up to 3, used as-is.
// Each is uploaded (signed, individually) the moment it's picked; no AI
// call is ever made on these.
function ReadyMode({ onApproved }) {
  const [slots, setSlots] = useState([null, null, null]) // { preview, url, uploading, error }

  const pickSlot = async (index, file) => {
    if (isFileTooLarge(file)) {
      setSlots((prev) => prev.map((s, i) => (i === index ? { preview: null, url: null, uploading: false, error: 'That image is too large.' } : s)))
      return
    }
    const preview = URL.createObjectURL(file)
    setSlots((prev) => prev.map((s, i) => (i === index ? { preview, url: null, uploading: true, error: '' } : s)))
    try {
      const compressed = await compressProductImage(file)
      const url = await uploadProductFile(compressed, 'card')
      setSlots((prev) => prev.map((s, i) => (i === index ? { preview, url, uploading: false, error: '' } : s)))
    } catch (err) {
      setSlots((prev) => prev.map((s, i) => (i === index ? { preview, url: null, uploading: false, error: err.message || 'Upload failed' } : s)))
    }
  }

  const uploaded = slots.filter((s) => s?.url)
  const canContinue = Boolean(slots[0]?.url)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <PhotoSlot
            key={i}
            label={i === 0 ? 'Product card' : `Extra image ${i + 1} (optional)`}
            required={i === 0}
            preview={slots[i]?.preview}
            disabled={slots[i]?.uploading}
            onChange={(file) => pickSlot(i, file)}
          />
        ))}
      </div>
      {slots.map((s, i) => s?.uploading && <p key={i} className="text-xs text-slate-400">Uploading image {i + 1}…</p>)}
      {slots.map((s, i) => s?.error && <p key={i} className="text-xs text-red-600">{s.error}</p>)}

      <button
        type="button"
        disabled={!canContinue}
        onClick={() =>
          onApproved({
            images: uploaded.map((s) => ({ url: s.url, provenance: 'staff-supplied' })),
            rawFrontUrl: null,
            rawBackUrl: null,
          })
        }
        className="w-fit rounded-md border border-slate-900 px-3 py-1.5 text-sm font-medium text-slate-900 disabled:opacity-40"
      >
        Use these images →
      </button>
    </div>
  )
}

export default function PhotoStep({ capabilities, onApproved }) {
  const aiCards = Boolean(capabilities?.aiCards)
  const [mode, setMode] = useState(aiCards ? 'shoot' : 'ready')

  return (
    <div className="flex flex-col gap-4">
      {aiCards && (
        <div className="flex overflow-hidden rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('shoot')}
            className={`flex-1 px-3 py-2 text-sm font-medium ${mode === 'shoot' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
          >
            📷 Shoot photos
          </button>
          <button
            type="button"
            onClick={() => setMode('ready')}
            className={`flex-1 px-3 py-2 text-sm font-medium ${mode === 'ready' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
          >
            🖼 Use a card I already have
          </button>
        </div>
      )}

      {mode === 'shoot' && aiCards ? <ShootMode onApproved={onApproved} /> : <ReadyMode onApproved={onApproved} />}
    </div>
  )
}
