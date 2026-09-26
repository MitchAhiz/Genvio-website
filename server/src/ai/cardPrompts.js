// Loads the owner-approved product-card prompts from disk, once, at
// server start — see product-upload-project.md §3/§7. To change the
// look of generated cards: edit the .txt file in ./prompts and restart
// the server. Never paste prompt text into code or docs; this file is
// the only thing that reads it.
//
// Scope: women's apparel only for now (product-upload-project.md's
// scope note) — hence "-women" in both filenames; a men's/kids' prompt
// pair would be added alongside these, not by editing them in place.
const fs = require('fs')
const path = require('path')

const PROMPTS_DIR = path.join(__dirname, 'prompts')

// Pinned here, next to the loader, so the owner has one place to look
// for "what generates a card and how": model name, the portrait aspect
// ratio closest to the 4:5 ecommerce standard that generateContent's
// ImageConfig.aspectRatio actually documents support for (1:1, 2:3, 3:2,
// 3:4, 4:3, 9:16, 16:9, 21:9 — see @google/genai's dist/genai.d.ts),
// and the output format.
//
// aspectRatio format is width:height, so 4:3 is LANDSCAPE (1.33) — a
// mistake caught after the first commit. The closest PORTRAIT value to
// the 4:5 (0.8) ecommerce standard is 3:4 (0.75); 2:3 (0.667) is the
// next-nearest and further off.
const CARD_GENERATION_CONFIG = {
  model: 'gemini-2.5-flash-image',
  aspectRatio: '3:4',
  outputMimeType: 'image/png',
}

// Exported standalone (not just called at module load) so it can be
// unit-tested against a throwaway file/dir without touching the real
// prompt files.
function loadPromptFile(filePath) {
  let contents
  try {
    contents = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    throw new Error(`Card prompt file is missing or unreadable: ${filePath} (${err.message})`)
  }
  const trimmed = contents.trim()
  if (!trimmed) {
    throw new Error(`Card prompt file is empty: ${filePath}`)
  }
  return trimmed
}

// Read once, at require time — i.e. at server start, since routes/upload.js
// (required by index.js) requires services/gemini.js, which requires this
// module. A missing/empty file throws synchronously here, so the server
// fails loudly at startup rather than 500ing on the first real request.
const FRONT_PROMPT = loadPromptFile(path.join(PROMPTS_DIR, 'card-front-women.txt'))
const BACK_PROMPT = loadPromptFile(path.join(PROMPTS_DIR, 'card-back-women.txt'))

module.exports = { FRONT_PROMPT, BACK_PROMPT, CARD_GENERATION_CONFIG, loadPromptFile }
