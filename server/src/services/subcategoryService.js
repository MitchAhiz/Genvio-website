// Mirrors server/src/services/categoryService.js exactly: same shape, same
// reassign-or-unpublish delete gate. See the commit that introduced Category
// (20260916090000_rename_subcategory_to_category) for why that pattern
// exists — it isn't being reinvented here.
const prisma = require('../db')
const { logActivity } = require('../utils/logActivity')

async function getSubcategories({ categoryId } = {}) {
  const where = {}
  if (categoryId) where.categoryId = categoryId

  const subcategories = await prisma.subcategory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { products: true } } },
  })

  return subcategories.map((s) => ({
    id: s.id,
    categoryId: s.categoryId,
    name: s.name,
    createdAt: s.createdAt,
    productCount: s._count.products,
  }))
}

async function getProductCount(id) {
  return prisma.product.count({ where: { subcategoryId: id } })
}

async function createSubcategory({ categoryId, name, createdBy }) {
  const subcategory = await prisma.subcategory.create({ data: { categoryId, name, createdBy } })
  await logActivity('subcategory.created', 'subcategory', subcategory.id, { categoryId, name, createdBy })
  return subcategory
}

async function renameSubcategory(id, name) {
  const existing = await prisma.subcategory.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Subcategory not found' }

  const updated = await prisma.subcategory.update({ where: { id }, data: { name } })
  await logActivity('subcategory.renamed', 'subcategory', id, { from: existing.name, to: name })
  return { ok: true, subcategory: updated }
}

async function deleteSubcategory(id, { action, reassignTo } = {}) {
  const existing = await prisma.subcategory.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Subcategory not found' }

  const affectedProductCount = await prisma.product.count({ where: { subcategoryId: id } })

  if (affectedProductCount > 0) {
    if (action !== 'reassign' && action !== 'unpublish') {
      return { ok: false, error: 'action must be "reassign" or "unpublish"' }
    }

    if (action === 'reassign') {
      if (reassignTo === id) {
        return { ok: false, error: 'reassignTo cannot be the subcategory being deleted' }
      }
      if (!reassignTo) {
        return { ok: false, error: 'reassignTo is required when action is "reassign"' }
      }
      const target = await prisma.subcategory.findUnique({ where: { id: reassignTo } })
      if (!target || target.categoryId !== existing.categoryId) {
        return { ok: false, error: 'reassignTo must be a valid subcategory id under the same category' }
      }
    }
  } else if (action !== undefined && action !== 'reassign' && action !== 'unpublish') {
    return { ok: false, error: 'action must be "reassign" or "unpublish"' }
  }

  // A size range keyed to this subcategory has no meaning once it's gone —
  // deleted in the same transaction regardless of the product action chosen.
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
    await tx.sizeRange.deleteMany({ where: { subcategoryId: id } })
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
