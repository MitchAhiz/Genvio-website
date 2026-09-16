const prisma = require('../db')
const { Prisma } = require('@prisma/client')

const PAGE_SIZE = 20

// Search matches action, entityType, or the JSON detail field's text content,
// case-insensitively — Prisma's JSON filters can't do that, so this goes raw.
async function listActivity({ page = 1, search = '' } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const term = typeof search === 'string' ? search.trim() : ''
  const offset = (pageNum - 1) * PAGE_SIZE

  const where = term
    ? Prisma.sql`WHERE action ILIKE ${'%' + term + '%'} OR entity_type ILIKE ${'%' + term + '%'} OR detail::text ILIKE ${'%' + term + '%'}`
    : Prisma.empty

  const [items, countRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT id, action, entity_type AS "entityType", entity_id AS "entityId", detail, created_at AS "createdAt"
      FROM activity_log
      ${where}
      ORDER BY created_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM activity_log ${where}`,
  ])

  const totalCount = countRows[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return { items, page: pageNum, totalPages, totalCount }
}

module.exports = { listActivity, PAGE_SIZE }
