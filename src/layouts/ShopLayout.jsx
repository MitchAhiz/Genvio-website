import { useEffect } from 'react'
import { Outlet, Navigate, useParams, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useTheme } from '../hooks/useTheme'
import { useSiteConfig } from '../hooks/useSiteConfig'
import { isSection, getLastSection, getSection, getVisibleSections, rememberSection, sectionPath } from '../sections'

// Wraps every /shop/* route. The theme is derived from the :section param;
// section-less routes (the shared bag) keep the last visited section's theme.
export default function ShopLayout() {
  const { section: raw } = useParams()
  const section = isSection(raw) ? raw : getLastSection()

  useTheme(section)

  useEffect(() => {
    if (isSection(raw)) rememberSection(raw)
    document.title = `${getSection(section).label} — Genvio Exotic Apparel`
  }, [raw, section])

  return (
    <div className="min-h-screen bg-ground text-ink transition-[background-color,color] duration-[400ms] ease-out-expo">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

// /shop → the last section visited (Women by default), or the first visible
// section if that one has since been hidden.
export function ShopIndexRedirect() {
  const { config } = useSiteConfig()
  const { search } = useLocation()
  const visible = getVisibleSections(config?.section_visibility)
  const last = getLastSection()
  const fallback = visible.some((s) => s.key === last) ? last : visible[0]?.key
  return <Navigate to={fallback ? `${sectionPath(fallback)}${search}` : '/'} replace />
}

// /shop/:section — rejects unknown or admin-hidden sections.
export function SectionGuard() {
  const { section } = useParams()
  const { config } = useSiteConfig()
  const { search } = useLocation()
  const visible = getVisibleSections(config?.section_visibility)
  if (!isSection(section) || !visible.some((s) => s.key === section)) {
    return <Navigate to={visible[0] ? `${sectionPath(visible[0].key)}${search}` : '/'} replace />
  }
  return <Outlet />
}
