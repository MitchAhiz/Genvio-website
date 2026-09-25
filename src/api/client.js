// `??` (not `||`) so an explicitly empty VITE_API_URL — used in production to
// route through the same-origin Vercel proxy in vercel.json, keeping the
// session cookie first-party for Safari — isn't treated as "unset" and
// silently overridden by the localhost fallback.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

// VITE_MOCK_API=1 serves local fixtures instead of the backend (dev only).
const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK_API === '1'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

// Double-submit CSRF: the server pairs admin_session with a second, readable
// (non-httpOnly) csrf_token cookie on login (see server/src/middleware/csrf.js).
// We read it back here and echo it as a header on every write request — a
// cross-site page can trigger the request (cookies ride along automatically)
// but can't read this cookie to forge the header, since cookies aren't
// readable cross-origin.
function readCsrfCookie() {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

export async function apiFetch(path, options = {}) {
  if (USE_MOCK) {
    const { mockFetch } = await import('./mock')
    await new Promise((r) => setTimeout(r, 250))
    return mockFetch(path, options)
  }
  const method = (options.method || 'GET').toUpperCase()
  const headers = { ...options.headers }
  if (WRITE_METHODS.has(method)) {
    const csrfToken = readCsrfCookie()
    if (csrfToken) headers['x-csrf-token'] = csrfToken
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })
  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(message, res.status)
  }
  return res.json()
}

export function jsonOptions(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function withQuery(path, params = {}) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value)
  }
  const query = qs.toString()
  return query ? `${path}?${query}` : path
}
