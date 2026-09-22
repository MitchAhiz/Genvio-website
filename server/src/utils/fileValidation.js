// Server-side receipt file validation. Sniffs the real file bytes rather
// than trusting the client's declared MIME type or the filename extension.
const { fileTypeFromBuffer } = require('file-type')

const MAX_BYTES = 20 * 1024 * 1024 // 20MB, must match the frontend limit and any host body-size limit

// ext -> accepted MIME(s) as reported by file-type's magic-byte sniffing.
const ALLOWED = {
  jpg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  heic: ['image/heic', 'image/heif'],
  pdf: ['application/pdf'],
}

const ALLOWED_MIMES = new Set(Object.values(ALLOWED).flat())

async function validateReceiptFile(buffer, declaredFilename) {
  if (buffer.length > MAX_BYTES) {
    return { ok: false, error: 'This file is too large. Try a screenshot of the receipt instead.' }
  }

  // PDFs: file-type detects the %PDF- signature reliably from the buffer.
  const detected = await fileTypeFromBuffer(buffer)
  if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
    return { ok: false, error: 'Unsupported file type. Upload a JPG, PNG, WEBP, HEIC image or a PDF.' }
  }

  return { ok: true, mime: detected.mime, ext: detected.ext, filename: declaredFilename }
}

module.exports = { validateReceiptFile, MAX_BYTES, ALLOWED_MIMES }
