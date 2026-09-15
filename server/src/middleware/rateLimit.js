// Small in-memory sliding-window limiter. Enough for a single-instance
// deploy; swap for a shared store if the API ever scales out.
//
// `key` picks what a window is counted against — the client IP by default,
// or something from the request (e.g. the phone number) when an endpoint
// should be limited per subject rather than per caller.

const buckets = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of buckets) {
    if (now - entry.last > 30 * 60 * 1000) buckets.delete(key)
  }
}, 5 * 60 * 1000).unref()

function rateLimit({ name, limit, windowMs, key }) {
  return (req, res, next) => {
    const subject = key ? key(req) : req.ip
    // A request with nothing to count against is let through; the route's own
    // validation rejects it a moment later.
    if (!subject) return next()

    const bucketKey = `${name}:${subject}`
    const now = Date.now()
    const entry = buckets.get(bucketKey) || { hits: [], last: now }
    entry.hits = entry.hits.filter((t) => now - t < windowMs)
    if (entry.hits.length >= limit) {
      const retryAfter = Math.ceil((entry.hits[0] + windowMs - now) / 1000)
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' })
    }
    entry.hits.push(now)
    entry.last = now
    buckets.set(bucketKey, entry)
    next()
  }
}

module.exports = { rateLimit }
