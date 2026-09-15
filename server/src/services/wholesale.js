const prisma = require('../db')

async function getWholesaleImages({ category } = {}) {
  const where = {}
  if (category) where.category = category
  return prisma.wholesaleImage.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
}

async function getWholesaleCategories() {
  const rows = await prisma.wholesaleImage.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  return rows.map((r) => r.category).filter(Boolean)
}

async function addWholesaleImage({ url, caption, category }) {
  const last = await prisma.wholesaleImage.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  return prisma.wholesaleImage.create({
    data: {
      url,
      caption: caption?.trim() || null,
      category: category?.trim() || null,
      sortOrder: last ? last.sortOrder + 1 : 0,
    },
  })
}

async function deleteWholesaleImage(id) {
  const existing = await prisma.wholesaleImage.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Image not found' }
  await prisma.wholesaleImage.delete({ where: { id } })
  return { ok: true }
}

module.exports = {
  getWholesaleImages,
  getWholesaleCategories,
  addWholesaleImage,
  deleteWholesaleImage,
}
