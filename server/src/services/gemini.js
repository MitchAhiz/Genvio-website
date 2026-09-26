// Gemini calls for the /upload form (product-upload-project.md §3):
// (1) product-card image generation, (2) colour-name suggestion,
// (3) product-name suggestion (garment description only — brand is
// prepended client-side). Uses the official @google/genai SDK.
//
// GEMINI_API_KEY is optional at the process level — callers (routes/upload.js)
// check for it and return 503 before this module's functions are ever
// invoked, so nothing here needs its own "key missing" branch.
const { GoogleGenAI, ApiError, Type } = require('@google/genai')

// "Nano banana" — Gemini's current generateContent-based image model.
// Chosen over the gemini-3-pro-image-preview tier: preview models can be
// pulled or restricted without notice, and this endpoint needs to stay
// working on whatever tier the project's key has, not the newest preview.
const IMAGE_MODEL = 'gemini-2.5-flash-image'
// Stable text model with reliable JSON (responseSchema) mode — used for
// the colour/name suggestion call.
const TEXT_MODEL = 'gemini-2.5-flash'

// Lives server-side only — never exposed to staff, never editable through
// the UI. See product-upload-project.md §7. Used only in Mode A, once per
// uploaded photo.
const CARD_IMAGE_PROMPT = `
You are generating a product-card photo for an e-commerce clothing store.
Using the uploaded garment photo(s) as reference, generate a photorealistic
image of the SAME garment worn by a neutral studio model.

Rules — do not deviate:
- Preserve the garment's exact color, fabric texture, fit, and any visible
  logos or stitching from the source photo(s).
- Studio background: plain, light neutral grey (#f2f0eb).
- Lighting: soft, even, front-facing — no harsh shadows.
- Model: front-facing, neutral pose, face not the focus, cropped at
  chest-to-thigh unless the garment requires full length.
- Do not add accessories, jewelry, or props not present in the source photo.
- Output must look like a professional retail product photo, not an
  illustration or stylized render.
`

const SUGGEST_PROMPT = `Look at this clothing product photo. Suggest a short
colour name for the garment's dominant colour, and a short garment
description (garment type + notable style words only — no brand name,
since the brand is added separately). Examples of a good description:
"Linen Wrap Dress", "Slim Fit Chino Trousers", "Oversized Denim Jacket".`

const SUGGEST_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    colourName: { type: Type.STRING },
    garmentDescription: { type: Type.STRING },
  },
  required: ['colourName', 'garmentDescription'],
}

// 60s — image generation is the slow call; the SDK's HTTP default is much
// shorter, and free-tier latency plus a genuinely slow render can exceed it.
const IMAGE_GENERATION_TIMEOUT_MS = 60000
const SUGGEST_TIMEOUT_MS = 20000

let client = null
function ai() {
  if (!client) {
    // Callers must check GEMINI_API_KEY before reaching here (rule 1 in
    // routes/upload.js) — this is a second guard, not the primary one.
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return client
}

// True for Gemini's quota/rate-limit errors (HTTP 429, or the
// RESOURCE_EXHAUSTED status Google's API uses for the same condition) —
// the one error class callers should turn into a friendly retry message
// instead of a generic failure.
function isQuotaError(err) {
  if (err instanceof ApiError && err.status === 429) return true
  return /RESOURCE_EXHAUSTED|quota/i.test(err?.message || '')
}

// imageBuffer/mimeType are the source photo, already fetched server-side
// by the caller (routes/upload.js only ever fetches URLs that passed
// isSupabaseStorageUrl — this function never fetches anything itself).
// Returns the generated image's raw bytes + mime type; the caller uploads
// them to Storage. Throws on failure — quota errors are recognizable via
// isQuotaError so the route can give the friendly §3 message.
async function generateProductCardImage({ imageBuffer, mimeType }) {
  const response = await ai().models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: CARD_IMAGE_PROMPT }, { inlineData: { mimeType, data: imageBuffer.toString('base64') } }],
      },
    ],
    config: { httpOptions: { timeout: IMAGE_GENERATION_TIMEOUT_MS } },
  })

  const parts = response?.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p) => p.inlineData?.data)
  if (!imagePart) throw new Error('Gemini did not return an image')

  return {
    data: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  }
}

// Model output is untrusted text (rule 6) — the caller is responsible for
// sanitising/length-capping colourName and garmentDescription before using
// them for anything. This function only asks Gemini and parses its JSON.
async function suggestColourAndDescription({ imageBuffer, mimeType }) {
  const response = await ai().models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: SUGGEST_PROMPT }, { inlineData: { mimeType, data: imageBuffer.toString('base64') } }],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: SUGGEST_SCHEMA,
      httpOptions: { timeout: SUGGEST_TIMEOUT_MS },
    },
  })

  try {
    const parsed = JSON.parse(response.text)
    return {
      colourName: typeof parsed?.colourName === 'string' ? parsed.colourName : '',
      garmentDescription: typeof parsed?.garmentDescription === 'string' ? parsed.garmentDescription : '',
    }
  } catch {
    return { colourName: '', garmentDescription: '' }
  }
}

module.exports = {
  generateProductCardImage,
  suggestColourAndDescription,
  isQuotaError,
  IMAGE_MODEL,
  TEXT_MODEL,
  CARD_IMAGE_PROMPT,
}
