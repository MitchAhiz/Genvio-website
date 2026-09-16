const prisma = require('../db')
const { logActivity } = require('../utils/logActivity')

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
  const image = await prisma.wholesaleImage.create({
    data: {
      url,
      caption: caption?.trim() || null,
      category: category?.trim() || null,
      sortOrder: last ? last.sortOrder + 1 : 0,
    },
  })
  await logActivity('wholesale_image.created', 'wholesale_image', image.id, { category: image.category })
  return image
}

async function updateWholesaleImage(id, { url, caption, category }) {
  const existing = await prisma.wholesaleImage.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Image not found' }

  const data = {}
  if (url !== undefined) data.url = url
  if (caption !== undefined) data.caption = caption?.trim() || null
  if (category !== undefined) data.category = category?.trim() || null

  const image = await prisma.wholesaleImage.update({ where: { id }, data })
  await logActivity('wholesale_image.updated', 'wholesale_image', id, data)
  return { ok: true, image }
}

async function deleteWholesaleImage(id) {
  const existing = await prisma.wholesaleImage.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Image not found' }
  await prisma.wholesaleImage.delete({ where: { id } })
  await logActivity('wholesale_image.deleted', 'wholesale_image', id, { category: existing.category })
  return { ok: true }
}

async function reorderWholesaleImages(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: 'orderedIds must be a non-empty array' }
  }
  const existingCount = await prisma.wholesaleImage.count({ where: { id: { in: orderedIds } } })
  if (existingCount !== orderedIds.length) {
    return { ok: false, error: 'orderedIds contains an unknown image id' }
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.wholesaleImage.update({ where: { id }, data: { sortOrder: index } })
    )
  )
  await logActivity('wholesale_image.reordered', 'wholesale_image', null, { count: orderedIds.length })
  return { ok: true }
}

async function renameWholesaleCategory(name, newName) {
  const trimmedNew = newName?.trim()
  if (!trimmedNew) return { ok: false, error: 'newName is required' }
  const count = await prisma.wholesaleImage.count({ where: { category: name } })
  if (count === 0) return { ok: false, error: 'Category not found' }
  await prisma.wholesaleImage.updateMany({ where: { category: name }, data: { category: trimmedNew } })
  await logActivity('wholesale_category.renamed', 'wholesale_category', null, { from: name, to: trimmedNew })
  return { ok: true }
}

async function deleteWholesaleCategory(name, { action, reassignTo } = {}) {
  const affectedCount = await prisma.wholesaleImage.count({ where: { category: name } })
  if (affectedCount === 0) return { ok: false, error: 'Category not found' }

  if (action !== 'reassign' && action !== 'uncategorise') {
    return { ok: false, error: 'action must be "reassign" or "uncategorise"' }
  }
  if (action === 'reassign') {
    if (!reassignTo) return { ok: false, error: 'reassignTo is required when action is "reassign"' }
    if (reassignTo === name) return { ok: false, error: 'reassignTo cannot be the category being deleted' }
  }

  const newCategory = action === 'reassign' ? reassignTo : null
  await prisma.wholesaleImage.updateMany({ where: { category: name }, data: { category: newCategory } })
  await logActivity('wholesale_category.deleted', 'wholesale_category', null, { name, action, affectedCount })
  return { ok: true }
}

module.exports = {
  getWholesaleImages,
  getWholesaleCategories,
  addWholesaleImage,
  updateWholesaleImage,
  deleteWholesaleImage,
  reorderWholesaleImages,
  renameWholesaleCategory,
  deleteWholesaleCategory,
}
