import { useEffect, useState } from 'react'
import { getUploadCapabilities } from '../api/admin'

// { aiCards, aiSuggestions } | null while loading. Never hardcode either
// flag in a component — always branch on this live response.
export function useUploadCapabilities() {
  const [capabilities, setCapabilities] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getUploadCapabilities()
      .then((data) => { if (!cancelled) setCapabilities(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load upload capabilities') })
    return () => { cancelled = true }
  }, [])

  return { capabilities, error }
}
