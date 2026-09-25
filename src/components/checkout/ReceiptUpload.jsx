import { useRef, useState } from 'react'
import { uploadReceipt } from '../../api/receipts'
import { compressReceiptImage, isFileTooLarge, isPdf, MAX_UPLOAD_BYTES } from '../../utils/imageCompression'
import { FileIcon, UploadIcon } from '../icons'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'

const primary =
  'w-full h-12 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover active:translate-y-px active:shadow-none disabled:bg-transparent disabled:text-muted disabled:border disabled:border-line disabled:shadow-none disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform] duration-300'

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// Already-uploaded state, shown when reopening a pending_verification order
// (see CheckoutOverlay's localStorage restore) — the receipt exists, no
// picker needed unless the customer wants to replace it.
function AlreadyUploaded({ receipt, onReplace }) {
  return (
    <div className="rounded-lg border border-line bg-ground px-5 py-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex w-10 h-10 rounded-md bg-surface items-center justify-center text-ink-soft shrink-0">
          <FileIcon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">{receipt.originalFilename}</p>
          <p className="text-xs text-muted">Uploaded — we're reviewing it</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReplace}
        className="mt-4 text-xs text-ink-soft hover:text-ink underline underline-offset-4 transition-colors"
      >
        Upload a different receipt instead
      </button>
    </div>
  )
}

export default function ReceiptUpload({ order, onUploaded }) {
  const existingReceipt = order?.receipts?.[0]
  const alreadyPending = order?.status === 'pending_verification' && existingReceipt
  const [replacing, setReplacing] = useState(false)

  const inputRef = useRef(null)
  const previewUrlRef = useRef(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [status, setStatus] = useState('idle') // idle | compressing | ready | uploading | error
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const resetFile = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setFile(null)
    setPreviewUrl(null)
    setStatus('idle')
    setProgress(0)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handlePick = async (e) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    setError('')
    setStatus('compressing')

    let processed = picked
    if (!isPdf(picked)) {
      processed = await compressReceiptImage(picked)
    }

    if (isFileTooLarge(processed, MAX_UPLOAD_BYTES)) {
      setStatus('error')
      setError('This file is too large. Try a screenshot of the receipt instead.')
      return
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = isPdf(processed) ? null : URL.createObjectURL(processed)
    previewUrlRef.current = url

    setFile(processed)
    setPreviewUrl(url)
    setStatus('ready')
  }

  const submit = async () => {
    if (!file || !order) return
    setStatus('uploading')
    setError('')
    setProgress(0)
    try {
      const updated = await uploadReceipt(order.id, order.orderToken, file, setProgress)
      onUploaded(updated)
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Upload failed. Please try again.')
    }
  }

  if (alreadyPending && !replacing) {
    return <AlreadyUploaded receipt={existingReceipt} onReplace={() => setReplacing(true)} />
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handlePick}
        className="sr-only"
        id="receipt-file"
      />

      {status === 'idle' ? (
        <label
          htmlFor="receipt-file"
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line px-5 py-10 text-center cursor-pointer hover:border-accent transition-colors"
        >
          <UploadIcon size={22} className="text-muted" />
          <span className="text-sm font-medium text-ink">Choose a receipt file</span>
          <span className="text-xs text-muted">JPG, PNG, WEBP, HEIC or PDF</span>
        </label>
      ) : status === 'compressing' ? (
        <div className="rounded-lg border border-line bg-ground px-5 py-10 text-center">
          <p className="text-sm text-muted">Preparing your file…</p>
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-ground px-5 py-5">
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="w-12 h-12 rounded-md object-cover ring-1 ring-line/70 shrink-0" />
            ) : (
              <span className="inline-flex w-12 h-12 rounded-md bg-surface items-center justify-center text-ink-soft shrink-0">
                <FileIcon size={20} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{file?.name}</p>
              <p className="text-xs text-muted">{file ? formatBytes(file.size) : ''}</p>
            </div>
            {status !== 'uploading' && (
              <button
                type="button"
                onClick={resetFile}
                className="shrink-0 text-xs text-ink-soft hover:text-ink underline underline-offset-4 transition-colors"
              >
                Change
              </button>
            )}
          </div>

          {status === 'uploading' && (
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full bg-accent transition-[width] duration-200"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">Uploading… {Math.round(progress * 100)}%</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
          {status === 'error' && file && (
            <button type="button" onClick={submit} className="shrink-0 text-xs text-ink-soft hover:text-ink underline underline-offset-4">
              Retry
            </button>
          )}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={submit}
          disabled={!file || status === 'uploading' || status === 'compressing'}
          className={primary}
        >
          {status === 'uploading' ? 'Uploading…' : 'Submit receipt'}
        </button>
      </div>
    </div>
  )
}
