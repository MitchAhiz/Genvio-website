// Gemini calls for the /upload form (product-upload-project.md §3):
// (1) product-card image generation, (2) colour-name suggestion,
// (3) product-name suggestion (garment description only — brand is
// prepended client-side). Uses the official @google/genai SDK.
//
// GEMINI_API_KEY is optional at the process level — callers (routes/upload.js)
// check for it and return 503 before this module's functions are ever
// invoked, so nothing here needs its own "key missing" branch.
const { GoogleGenAI, ApiError, Type } = require('@google/genai')
const { FRONT_PROMPT, BACK_PROMPT, CARD_GENERATION_CONFIG } = require('../ai/cardPrompts')

// Text model with reliable JSON (responseSchema) mode, used for the
// colour/name suggestion call. gemini-2.5-flash is no longer available to
// this key (confirmed via a live call, which 404s with "no longer
// available to new users" and points at this model) — verified working
// live before committing.
const TEXT_MODEL = 'gemini-3.8-flash'

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

// A 429 whose quota violation reports "limit: 0" means this project's
// tier permits ZERO requests for that model — not a real, temporary
// rate/quota problem that a retry could fix (confirmed live: both
// gemini-2.5-flash-image and gemini-3.1-flash-image return exactly this
// on the free tier). Callers should treat this as "the feature isn't
// switched on" (503 AI_CARDS_DISABLED), never the friendly "try again
// shortly" 429 — retrying a hard 0 limit only wastes the request.
function isZeroLimitQuotaError(err) {
  return isQuotaError(err) && /\blimit:\s*0\b/i.test(err?.message || '')
}

// view: 'front' | 'back' — picks the loaded prompt (card-front-women.txt
// / card-back-women.txt). images: an ORDERED array of { buffer, mimeType }
// — for 'front' this is [sourcePhoto]; for 'back' this is
// [backPhoto, approvedFrontCard], since the back prompt refers to them
// positionally as IMAGE 1 / IMAGE 2. Every image is already fetched
// server-side by the caller (routes/upload.js only ever fetches URLs
// that passed isSupabaseStorageUrl — this function never fetches
// anything itself). Returns the generated image's raw bytes + mime
// type; the caller uploads them to Storage. Throws on failure — quota
// errors are recognizable via isQuotaError so the route can give the
// friendly §3 message.
async function generateProductCardImage({ view, images }) {
  const promptText = view === 'back' ? BACK_PROMPT : FRONT_PROMPT
  const parts = [
    { text: promptText },
    ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.buffer.toString('base64') } })),
  ]

  const response = await ai().models.generateContent({
    model: CARD_GENERATION_CONFIG.model,
    contents: [{ role: 'user', parts }],
    config: {
      imageConfig: { aspectRatio: CARD_GENERATION_CONFIG.aspectRatio },
      httpOptions: { timeout: IMAGE_GENERATION_TIMEOUT_MS },
    },
  })

  const responseParts = response?.candidates?.[0]?.content?.parts || []
  const imagePart = responseParts.find((p) => p.inlineData?.data)
  if (!imagePart) throw new Error('Gemini did not return an image')

  return {
    data: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || CARD_GENERATION_CONFIG.outputMimeType,
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
  isZeroLimitQuotaError,
  TEXT_MODEL,
}
