import { useEffect } from 'react'

// This app is a single-page app with one shared index.html for every
// route, so a static <meta name="robots"> in index.html would noindex the
// entire storefront. Staff-only pages (/upload, /admin) inject their own
// tag on mount and remove it on unmount instead — scoped to exactly the
// routes that need it. robots.txt (public/robots.txt) covers crawlers that
// don't execute JS before reading meta tags; this covers ones that do.
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => { document.head.removeChild(meta) }
  }, [])
}
