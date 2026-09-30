// Unit tests for the card-prompt loader (server/src/ai/cardPrompts.js).
// Tests loadPromptFile directly against throwaway temp files — never
// touching the real card-front-women.txt / card-back-women.txt, so a
// bug here can't be masked by (or accidentally corrupt) the real prompts.

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { loadPromptFile, FRONT_PROMPT, BACK_PROMPT, CARD_GENERATION_CONFIG } = require('../src/ai/cardPrompts')

function tempFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-prompt-test-'))
  const file = path.join(dir, 'prompt.txt')
  if (contents !== undefined) fs.writeFileSync(file, contents)
  return file
}

test('loadPromptFile throws loudly when the file does not exist', () => {
  const missingFile = path.join(os.tmpdir(), `definitely-does-not-exist-${Date.now()}.txt`)
  assert.throws(() => loadPromptFile(missingFile), /missing or unreadable/)
})

test('loadPromptFile throws loudly when the file is empty', () => {
  const file = tempFile('')
  assert.throws(() => loadPromptFile(file), /empty/)
})

test('loadPromptFile throws loudly when the file is only whitespace', () => {
  const file = tempFile('   \n\n\t  ')
  assert.throws(() => loadPromptFile(file), /empty/)
})

test('loadPromptFile returns the trimmed file contents when present and non-empty', () => {
  const file = tempFile('  Some prompt text.  \n')
  assert.equal(loadPromptFile(file), 'Some prompt text.')
})

test('the real FRONT_PROMPT and BACK_PROMPT loaded at module load are non-empty strings', () => {
  assert.equal(typeof FRONT_PROMPT, 'string')
  assert.ok(FRONT_PROMPT.length > 0)
  assert.equal(typeof BACK_PROMPT, 'string')
  assert.ok(BACK_PROMPT.length > 0)
  // Sanity check these are the actual owner-approved prompts, not placeholders.
  assert.match(FRONT_PROMPT, /Nigerian/)
  assert.match(BACK_PROMPT, /IMAGE 1/)
  assert.match(BACK_PROMPT, /IMAGE 2/)
})

test('CARD_GENERATION_CONFIG pins model, aspectRatio and outputMimeType', () => {
  assert.equal(typeof CARD_GENERATION_CONFIG.model, 'string')
  assert.equal(typeof CARD_GENERATION_CONFIG.aspectRatio, 'string')
  assert.equal(typeof CARD_GENERATION_CONFIG.outputMimeType, 'string')
})

test('the configured aspect ratio is portrait (height > width) — width:height format', () => {
  const [width, height] = CARD_GENERATION_CONFIG.aspectRatio.split(':').map(Number)
  assert.ok(Number.isFinite(width) && Number.isFinite(height), `unparseable aspect ratio: ${CARD_GENERATION_CONFIG.aspectRatio}`)
  assert.ok(height > width, `aspectRatio "${CARD_GENERATION_CONFIG.aspectRatio}" is not portrait (width:height, height must exceed width)`)
})
