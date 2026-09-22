// Exercises validatePageConfig — guards the About / Refund & Returns page
// content saved from Admin Settings (server/src/routes/config.js).
const test = require('node:test')
const assert = require('node:assert/strict')
const { validatePageConfig } = require('../src/routes/config')

const VALID_PAGE = {
  title: 'About Us',
  blocks: [
    { id: 'b1', type: 'heading', text: 'Our Story' },
    { id: 'b2', type: 'paragraph', text: 'We make clothes.' },
  ],
}

test('a well-formed page passes', () => {
  const result = validatePageConfig(VALID_PAGE)
  assert.equal(result.ok, true, result.error)
})

test('empty title is rejected', () => {
  const result = validatePageConfig({ ...VALID_PAGE, title: '   ' })
  assert.equal(result.ok, false)
})

test('no blocks is rejected', () => {
  const result = validatePageConfig({ ...VALID_PAGE, blocks: [] })
  assert.equal(result.ok, false)
})

test('41 blocks exceeds the 40 max', () => {
  const blocks = Array.from({ length: 41 }, (_, i) => ({ id: `b${i}`, type: 'paragraph', text: 'x' }))
  const result = validatePageConfig({ ...VALID_PAGE, blocks })
  assert.equal(result.ok, false)
})

test('unknown block type is rejected', () => {
  const result = validatePageConfig({ ...VALID_PAGE, blocks: [{ id: 'b1', type: 'image', text: 'x' }] })
  assert.equal(result.ok, false)
})

test('raw HTML in block text is stored as inert text, not rejected', () => {
  // Not a security requirement to reject it — the renderer only ever prints
  // block.text as a text node, so markup here can't execute. This just
  // documents that expectation.
  const result = validatePageConfig({ ...VALID_PAGE, blocks: [{ id: 'b1', type: 'paragraph', text: '<script>alert(1)</script>' }] })
  assert.equal(result.ok, true)
  assert.equal(result.value.blocks[0].text, '<script>alert(1)</script>')
})

test('heading text over 100 chars is rejected', () => {
  const result = validatePageConfig({ ...VALID_PAGE, blocks: [{ id: 'b1', type: 'heading', text: 'x'.repeat(101) }] })
  assert.equal(result.ok, false)
})
