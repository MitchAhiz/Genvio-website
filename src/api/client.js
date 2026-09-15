export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// VITE_MOCK_API=1 serves local fixtures instead of the backend (dev only).
const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK_API === '1'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch(path, options = {}) {
  if (USE_MOCK) {
    const { mockFetch } = await import('./mock')
    await new Promise((r) => setTimeout(r, 250))
    return mockFetch(path, options)
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
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
