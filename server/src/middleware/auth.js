const { validateSession } = require('../services/auth')

function requireAdminAuth(req, res, next) {
  const token = req.cookies?.admin_session
  const session = validateSession(token)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.adminEmail = session.email
  next()
}

module.exports = { requireAdminAuth }
