import { useEffect, useState } from 'react'
import { getUploadCapabilities } from '../api/admin'

// { aiCards, aiSuggestions } | null while loading. Never hardcode either
// flag in a component — always branch on this live response.
// `enabled` gates the fetch: the endpoint is admin-authed, so callers must
// pass false until sign-in completes, or a pre-login 401 gets stuck as `error`.
export function useUploadCapabilities(enabled = true) {
  const [capabilities, setCapabilities] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getUploadCapabilities()
      .then((data) => { if (!cancelled) setCapabilities(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load upload capabilities') })
    return () => { cancelled = true }
  }, [enabled])

  return { capabilities, error }
}
