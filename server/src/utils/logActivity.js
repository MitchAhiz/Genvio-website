const prisma = require('../db')

// Fire-and-forget: callers await it for ordering in tests, but a logging
// failure must never break the write it's describing.
async function logActivity(action, entityType, entityId, detail) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        entityType,
        entityId: entityId != null ? String(entityId) : null,
        detail: detail ?? undefined,
      },
    })
  } catch (err) {
    console.error('logActivity failed:', err)
  }
}

module.exports = { logActivity }
