const prisma = require('../db')
const { logActivity } = require('../utils/logActivity')

async function getSizeRange({ categoryId, subcategoryId }) {
  return prisma.sizeRange.findUnique({ where: { categoryId_subcategoryId: { categoryId, subcategoryId } } })
}

async function listSizeRanges({ categoryId } = {}) {
  const where = {}
  if (categoryId) where.categoryId = categoryId
  return prisma.sizeRange.findMany({ where, orderBy: { createdAt: 'desc' } })
}

async function upsertSizeRange({ categoryId, subcategoryId, sizes, adminEmail }) {
  const existing = await getSizeRange({ categoryId, subcategoryId })

  const result = await prisma.sizeRange.upsert({
    where: { categoryId_subcategoryId: { categoryId, subcategoryId } },
    create: { categoryId, subcategoryId, sizes, createdBy: adminEmail },
    update: { sizes, updatedBy: adminEmail },
  })

  await logActivity(existing ? 'sizeRange.updated' : 'sizeRange.created', 'sizeRange', result.id, {
    categoryId,
    subcategoryId,
    sizes,
  })
  return result
}

async function deleteSizeRange({ categoryId, subcategoryId }) {
  const existing = await getSizeRange({ categoryId, subcategoryId })
  if (!existing) return { ok: false, error: 'Size range not found' }
  await prisma.sizeRange.delete({ where: { id: existing.id } })
  await logActivity('sizeRange.deleted', 'sizeRange', existing.id, { categoryId, subcategoryId })
  return { ok: true }
}

module.exports = { getSizeRange, listSizeRanges, upsertSizeRange, deleteSizeRange }
