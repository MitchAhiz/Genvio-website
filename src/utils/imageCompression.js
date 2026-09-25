import imageCompression from 'browser-image-compression'
import heic2any from 'heic2any'

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.8
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB, must match the server-side limit

function isHeic(file) {
  const name = file.name.toLowerCase()
  return file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')
}

export function isPdf(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

// Compresses a receipt photo before upload: HEIC -> JPEG, resized to max
// 2000px on the longest side, JPEG quality ~0.8. PDFs pass through
// untouched. If any step fails, the best file so far (the original, or the
// HEIC->JPEG conversion if that part succeeded) is returned rather than
// blocking the upload — a failed compression should never stop a customer
// from submitting their receipt.
export async function compressReceiptImage(file) {
  if (isPdf(file)) return file

  let working = file
  try {
    if (isHeic(file)) {
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY })
      const blob = Array.isArray(converted) ? converted[0] : converted
      working = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' })
    }

    const compressed = await imageCompression(working, {
      maxWidthOrHeight: MAX_DIMENSION,
      initialQuality: JPEG_QUALITY,
      fileType: 'image/jpeg',
      useWebWorker: true,
    })
    return new File([compressed], working.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch (err) {
    console.error('[imageCompression] compression failed, using best file so far:', err)
    return working
  }
}

export function isFileTooLarge(file, maxBytes = MAX_UPLOAD_BYTES) {
  return file.size > maxBytes
}
