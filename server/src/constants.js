// Display order: Men → Women → Kids.
const SECTIONS = ['men', 'women', 'kids']

function isValidSection(value) {
  return SECTIONS.includes(value)
}

module.exports = { SECTIONS, isValidSection }
