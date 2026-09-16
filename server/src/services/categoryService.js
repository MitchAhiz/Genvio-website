const prisma = require('../db')
const { logActivity } = require('../utils/logActivity')

async function getCategories({ section } = {}) {
  const where = {}
  if (section) where.section = section

  const categories = await prisma.category.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { products: true } } },
  })

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    section: c.section,
    createdAt: c.createdAt,
    productCount: c._count.products,
  }))
}

async function getProductCount(id) {
  return prisma.product.count({ where: { categoryId: id } })
}

async function createCategory({ name, section }) {
  const category = await prisma.category.create({ data: { name, section } })
  await logActivity('category.created', 'category', category.id, { name, section })
  return category
}

async function renameCategory(id, name) {
  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Category not found' }

  const updated = await prisma.category.update({ where: { id }, data: { name } })
  await logActivity('category.renamed', 'category', id, { from: existing.name, to: name })
  return { ok: true, category: updated }
}

async function deleteCategory(id, { action, reassignTo } = {}) {
  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Category not found' }

  const affectedProductCount = await prisma.product.count({ where: { categoryId: id } })

  if (affectedProductCount > 0) {
    if (action !== 'reassign' && action !== 'unpublish') {
      return { ok: false, error: 'action must be "reassign" or "unpublish"' }
    }

    if (action === 'reassign') {
      if (reassignTo === id) {
        return { ok: false, error: 'reassignTo cannot be the category being deleted' }
      }
      if (!reassignTo) {
        return { ok: false, error: 'reassignTo is required when action is "reassign"' }
      }
      const target = await prisma.category.findUnique({ where: { id: reassignTo } })
      if (!target || target.section !== existing.section) {
        return { ok: false, error: 'reassignTo must be a valid category id in the same section' }
      }
    }
  } else if (action !== undefined && action !== 'reassign' && action !== 'unpublish') {
    return { ok: false, error: 'action must be "reassign" or "unpublish"' }
  }

  await prisma.$transaction(async (tx) => {
    if (affectedProductCount > 0) {
      if (action === 'reassign') {
        await tx.product.updateMany({
          where: { categoryId: id },
          data: { categoryId: reassignTo },
        })
      } else {
        await tx.product.updateMany({
          where: { categoryId: id },
          data: { status: 'draft', categoryId: null },
        })
      }
    }
    await tx.category.delete({ where: { id } })
  })

  await logActivity('category.deleted', 'category', id, { action: action ?? null, affectedProductCount })
  return { ok: true }
}

module.exports = {
  getCategories,
  getProductCount,
  createCategory,
  renameCategory,
  deleteCategory,
}
