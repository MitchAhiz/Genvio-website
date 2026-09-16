const prisma = require('../db')
const { logActivity } = require('../utils/logActivity')

async function getSubcategories({ section } = {}) {
  const where = {}
  if (section) where.section = section

  const subcategories = await prisma.subcategory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { products: true } } },
  })

  return subcategories.map((s) => ({
    id: s.id,
    name: s.name,
    section: s.section,
    createdAt: s.createdAt,
    productCount: s._count.products,
  }))
}

async function getProductCount(id) {
  return prisma.product.count({ where: { subcategoryId: id } })
}

async function createSubcategory({ name, section }) {
  const subcategory = await prisma.subcategory.create({ data: { name, section } })
  await logActivity('subcategory.created', 'subcategory', subcategory.id, { name, section })
  return subcategory
}

async function renameSubcategory(id, name) {
  const existing = await prisma.subcategory.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Sub-category not found' }

  const updated = await prisma.subcategory.update({ where: { id }, data: { name } })
  await logActivity('subcategory.renamed', 'subcategory', id, { from: existing.name, to: name })
  return { ok: true, subcategory: updated }
}

async function deleteSubcategory(id, { action, reassignTo } = {}) {
  const existing = await prisma.subcategory.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Sub-category not found' }

  const affectedProductCount = await prisma.product.count({ where: { subcategoryId: id } })

  if (affectedProductCount > 0) {
    if (action !== 'reassign' && action !== 'unpublish') {
      return { ok: false, error: 'action must be "reassign" or "unpublish"' }
    }

    if (action === 'reassign') {
      if (reassignTo === id) {
        return { ok: false, error: 'reassignTo cannot be the sub-category being deleted' }
      }
      if (!reassignTo) {
        return { ok: false, error: 'reassignTo is required when action is "reassign"' }
      }
      const target = await prisma.subcategory.findUnique({ where: { id: reassignTo } })
      if (!target || target.section !== existing.section) {
        return { ok: false, error: 'reassignTo must be a valid sub-category id in the same section' }
      }
    }
  } else if (action !== undefined && action !== 'reassign' && action !== 'unpublish') {
    return { ok: false, error: 'action must be "reassign" or "unpublish"' }
  }

  await prisma.$transaction(async (tx) => {
    if (affectedProductCount > 0) {
      if (action === 'reassign') {
        await tx.product.updateMany({
          where: { subcategoryId: id },
          data: { subcategoryId: reassignTo },
        })
      } else {
        await tx.product.updateMany({
          where: { subcategoryId: id },
          data: { status: 'draft', subcategoryId: null },
        })
      }
    }
    await tx.subcategory.delete({ where: { id } })
  })

  await logActivity('subcategory.deleted', 'subcategory', id, { action: action ?? null, affectedProductCount })
  return { ok: true }
}

module.exports = {
  getSubcategories,
  getProductCount,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
}
