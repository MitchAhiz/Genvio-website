import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useTheme } from '../hooks/useTheme'
import { ArrowRightIcon } from '../components/icons'
import Footer from '../components/Footer'

// Renders admin-authored content (server/src/routes/config.js's
// validatePageConfig) for /about and /refund-policy. Blocks are printed as
// plain text nodes only — never dangerouslySetInnerHTML — so there is no
// markup/injection surface regardless of what an admin types.
export default function StaticPage({ slug, fallbackTitle }) {
  useTheme('gate')
  const [page, setPage] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/config/page/${slug}`)
      .then((data) => {
        if (!cancelled) setPage(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    document.title = `${page?.title || fallbackTitle} — Genvio Exotic Apparel`
  }, [page, fallbackTitle])

  return (
    <div className="min-h-screen bg-ground text-ink flex flex-col">
      <header className="sticky top-0 z-40 bg-ground/90 backdrop-blur-sm border-b border-line">
        <div className="max-w-3xl mx-auto px-4 h-12 sm:h-14 flex items-center justify-between gap-4">
          <Link to="/" className="font-display text-[17px] sm:text-xl font-semibold tracking-wide text-ink whitespace-nowrap">
            Genvio Exotic Apparel
          </Link>
          <Link
            to="/shop"
            className="group inline-flex items-center gap-1.5 text-[13px] sm:text-sm font-medium text-ink-soft hover:text-ink transition-colors"
          >
            Shop
            <ArrowRightIcon size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 sm:py-16 flex-1 w-full">
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-ink tracking-[-0.01em] text-balance">
          {page?.title || fallbackTitle}
        </h1>

        {failed && (
          <p className="mt-6 text-sm text-muted">This page couldn't be loaded. Check your connection and try again.</p>
        )}

        {page && (
          <div className="mt-8 space-y-5">
            {page.blocks.map((block) =>
              block.type === 'heading' ? (
                <h2 key={block.id} className="font-display text-xl sm:text-2xl font-medium text-ink pt-2">
                  {block.text}
                </h2>
              ) : (
                <p key={block.id} className="text-[15px] leading-relaxed text-ink-soft text-balance">
                  {block.text}
                </p>
              )
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
