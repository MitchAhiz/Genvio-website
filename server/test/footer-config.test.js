// Exercises server/src/routes/config.js's validateFooterConfig — the guard
// against a malformed or malicious footer_config admin save (bad URLs,
// oversized labels, too many items, duplicate brands, etc). Uses Node's
// built-in test runner (Node 18+) so it needs no new dependency.
// Run with: npm test  (from server/)
const test = require('node:test')
const assert = require('node:assert/strict')
const { validateFooterConfig } = require('../src/routes/config')

// Mirrors configService.js's FOOTER_CONFIG_DEFAULT — kept in sync by hand
// since it's not exported (that file's own default is the source of truth).
const DEFAULT_FOOTER_CONFIG = {
  headings: { quickLinks: 'Quick Links', categories: 'Top Categories', brands: 'Top Brands' },
  quickLinks: [
    { id: 'ql-about', label: 'About', url: '/', external: false, newTab: false, enabled: true, sortOrder: 0 },
    { id: 'ql-all-categories', label: 'All Categories', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 1 },
    { id: 'ql-brands', label: 'Brands', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 2 },
    { id: 'ql-refunds', label: 'Refund and Returns Policy', url: '/', external: false, newTab: false, enabled: true, sortOrder: 3 },
    { id: 'ql-new-arrivals', label: 'New Arrivals', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 4 },
  ],
  sectionLinks: {
    men: { enabled: true, label: 'Men', url: '/shop/men', subLinks: [] },
    women: { enabled: true, label: 'Women', url: '/shop/women', subLinks: [] },
    kids: { enabled: true, label: 'Kids', url: '/shop/kids', subLinks: [] },
  },
  brands: {
    maxCount: 5,
    items: [
      { id: 'brand-zara', name: 'Zara', sortOrder: 0 },
      { id: 'brand-object', name: 'Object', sortOrder: 1 },
      { id: 'brand-vila', name: 'Vila', sortOrder: 2 },
      { id: 'brand-boohoo', name: 'Boohoo', sortOrder: 3 },
      { id: 'brand-asos', name: 'ASOS', sortOrder: 4 },
    ],
  },
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

test('seeded defaults pass validation', () => {
  const result = validateFooterConfig(DEFAULT_FOOTER_CONFIG)
  assert.equal(result.ok, true, result.error)
})

test('empty label is rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.quickLinks[0].label = '   '
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('javascript: URL is rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.quickLinks[0].url = 'javascript:alert(1)'
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('data: and vbscript: URLs are rejected', () => {
  for (const scheme of ['data:text/html;base64,xx', 'vbscript:msgbox(1)']) {
    const bad = clone(DEFAULT_FOOTER_CONFIG)
    bad.quickLinks[0].url = scheme
    assert.equal(validateFooterConfig(bad).ok, false, scheme)
  }
})

test('protocol-relative "//evil.com" is rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.quickLinks[0].url = '//evil.com'
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('URL with embedded whitespace is rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.quickLinks[0].url = '/shop/ men'
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('over-long label (51 chars) is rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.quickLinks[0].label = 'x'.repeat(51)
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('over-long heading (41 chars) is rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.headings.quickLinks = 'x'.repeat(41)
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('13 quick links exceeds the 12 max', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.quickLinks = Array.from({ length: 13 }, (_, i) => ({
    id: `ql-${i}`, label: `Link ${i}`, url: '/shop', external: false, newTab: false, enabled: true, sortOrder: i,
  }))
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('11 sub-links exceeds the 10-per-section max', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.sectionLinks.women.subLinks = Array.from({ length: 11 }, (_, i) => ({
    id: `sub-${i}`, label: `Sub ${i}`, url: '/shop/women', external: false, newTab: false, enabled: true, sortOrder: i,
  }))
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('21 brands exceeds the 20 max', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.brands.items = Array.from({ length: 21 }, (_, i) => ({ id: `b-${i}`, name: `Brand ${i}`, sortOrder: i }))
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('duplicate brand names differing only by case are rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.brands.items = [
    { id: 'b-1', name: 'Zara', sortOrder: 0 },
    { id: 'b-2', name: 'zARA', sortOrder: 1 },
  ]
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('brands.maxCount out of range (21) is rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.brands.maxCount = 21
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('brands.maxCount must be an integer (2.5 rejected)', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  bad.brands.maxCount = 2.5
  assert.equal(validateFooterConfig(bad).ok, false)
})

test('missing sectionLinks key is rejected', () => {
  const bad = clone(DEFAULT_FOOTER_CONFIG)
  delete bad.sectionLinks.kids
  assert.equal(validateFooterConfig(bad).ok, false)
})
