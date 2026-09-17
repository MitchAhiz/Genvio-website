import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiFetch } from '../api/client'

const SiteConfigContext = createContext()

// Re-check periodically and on window focus so an admin toggling maintenance
// mode or checkout doesn't require existing visitors to hard-refresh.
const REFRESH_MS = 3 * 60 * 1000

export function SiteConfigProvider({ children }) {
  const { pathname } = useLocation()
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    apiFetch('/api/config/site')
      .then(setConfig)
      .catch(() => {
        // network blip — keep serving the last known config (or the default
        // fully-open one) rather than blocking the site
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (isAdmin) {
      setLoading(false)
      return
    }
    refresh()
    const interval = setInterval(refresh, REFRESH_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [isAdmin, refresh])

  return (
    <SiteConfigContext.Provider value={{ config, loading, isAdmin }}>
      {children}
    </SiteConfigContext.Provider>
  )
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext)
  if (!ctx) throw new Error('useSiteConfig must be used within SiteConfigProvider')
  return ctx
}
