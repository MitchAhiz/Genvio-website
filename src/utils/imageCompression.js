import imageCompression from 'browser-image-compression'
import heic2any from 'heic2any'

// Product photos (raw camera shots and staff-supplied card images) are
// encoded to WebP, not JPEG — smaller at equal quality, and the storage
// path never needs to carry two image codecs for the same purpose. This is
// deliberately different from the receipts version of this utility (JPEG,
// 2000px) since receipts are read once by a human reviewer and product
// photos are served to every storefront visitor.
const MAX_DIMENSION = 1200
const WEBP_QUALITY = 0.82
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB, must match the server-side limit

function isHeic(file) {
  const name = file.name.toLowerCase()
  return file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')
}

// Compresses a product photo before upload: HEIC -> JPEG (browser-image-
// compression can't read HEIC directly) -> resized to max 1200px on the
// longest side, re-encoded as WebP. If any step fails, the best file so
// far (the original, or the HEIC->JPEG conversion if that part succeeded)
// is returned rather than blocking the upload.
export async function compressProductImage(file) {
  let working = file
  try {
    if (isHeic(file)) {
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
      const blob = Array.isArray(converted) ? converted[0] : converted
      working = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' })
    }

    const compressed = await imageCompression(working, {
      maxWidthOrHeight: MAX_DIMENSION,
      initialQuality: WEBP_QUALITY,
      fileType: 'image/webp',
      useWebWorker: true,
    })
    return new File([compressed], working.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })
  } catch (err) {
    console.error('[imageCompression] product image compression failed, using best file so far:', err)
    return working
  }
}

export function isFileTooLarge(file, maxBytes = MAX_UPLOAD_BYTES) {
  return file.size > maxBytes
}
