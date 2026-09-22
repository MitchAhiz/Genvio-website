import { Link, useLocation } from 'react-router-dom'
import { useSiteConfig } from '../hooks/useSiteConfig'
import { SECTIONS } from '../sections'

// Mirrors server/src/services/configService.js's FOOTER_CONFIG_DEFAULT.
// Used only when /api/config/site hasn't loaded (or failed) — the server
// value is the source of truth and is deep-merged over this same shape, so
// this footer never renders `undefined`.
const DEFAULT_FOOTER_CONFIG = {
  headings: { quickLinks: 'Quick Links', categories: 'Top Categories', brands: 'Top Brands' },
  quickLinks: [
    { id: 'ql-about', label: 'About', url: '/about', external: false, newTab: false, enabled: true, sortOrder: 0 },
    { id: 'ql-all-categories', label: 'All Categories', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 1 },
    { id: 'ql-brands', label: 'Brands', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 2 },
    { id: 'ql-refunds', label: 'Refund and Returns Policy', url: '/refund-policy', external: false, newTab: false, enabled: true, sortOrder: 3 },
    { id: 'ql-new-arrivals', label: 'New Arrivals', url: '/shop', external: false, newTab: false, enabled: true, sortOrder: 4 },
  ],
  sectionLinks: {
    men: { enabled: true, label: 'Men', url: '/shop/men', subLinks: [] },
    women: { enabled: true, label: 'Women', url: '/shop/women', subLinks: [] },
    kids: { enabled: true, label: 'Kids', url: '/shop/kids', subLinks: [] },
  },
  brands: {
    maxCount: 5,
    items: [
      { id: 'brand-zara', name: 'Zara', sortOrder: 0 },
      { id: 'brand-object', name: 'Object', sortOrder: 1 },
      { id: 'brand-vila', name: 'Vila', sortOrder: 2 },
      { id: 'brand-boohoo', name: 'Boohoo', sortOrder: 3 },
      { id: 'brand-asos', name: 'ASOS', sortOrder: 4 },
    ],
  },
}

const SECTION_KEY_PATTERN = new RegExp(`^/shop/(${SECTIONS.map((s) => s.key).join('|')})(?:/|$)`)

function currentSectionFromPath(pathname) {
  const match = pathname.match(SECTION_KEY_PATTERN)
  return match ? match[1] : null
}

function byOrder(a, b) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
}

// Plain internal links use <Link> for client-side routing; external URLs or
// anything the admin flagged "open in new tab" use a real <a> so it behaves
// like a normal browser link (new tab, no SPA history entry).
function FooterLink({ label, url, external, newTab, className }) {
  if (external || newTab) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    )
  }
  return (
    <Link to={url} className={className}>
      {label}
    </Link>
  )
}

const LINK_CLASS = 'text-sm text-white/70 hover:text-white transition-colors duration-200'
const SUBLINK_CLASS = 'text-sm text-white/55 hover:text-white transition-colors duration-200'
const SECTION_HEADING_LINK_CLASS = 'text-sm font-semibold text-white hover:text-white/80 transition-colors duration-200'
const GROUP_HEADING_CLASS = 'text-sm font-bold uppercase tracking-[0.08em] text-white'

export default function Footer() {
  const { config } = useSiteConfig()
  const { pathname } = useLocation()
  const footer = config?.footer_config || DEFAULT_FOOTER_CONFIG

  const currentSection = currentSectionFromPath(pathname)
  const sectionKeys = currentSection
    ? SECTIONS.map((s) => s.key).filter((k) => k !== currentSection)
    : SECTIONS.map((s) => s.key)

  const quickLinks = (footer.quickLinks || []).filter((l) => l.enabled).sort(byOrder)

  const sectionGroups = sectionKeys
    .map((key) => ({ key, ...footer.sectionLinks?.[key] }))
    .filter((entry) => entry.enabled)
    .map((entry) => ({ ...entry, subLinks: (entry.subLinks || []).filter((s) => s.enabled).sort(byOrder) }))

  const maxBrands = footer.brands?.maxCount ?? DEFAULT_FOOTER_CONFIG.brands.maxCount
  const brandItems = [...(footer.brands?.items || [])].sort(byOrder).slice(0, maxBrands)

  const hasQuickLinks = quickLinks.length > 0
  const hasSectionLinks = sectionGroups.length > 0
  const hasBrands = brandItems.length > 0

  if (!hasQuickLinks && !hasSectionLinks && !hasBrands) return null

  const headings = footer.headings || DEFAULT_FOOTER_CONFIG.headings

  return (
    <footer className="bg-black text-white">
      {/* pb-28 on mobile gives the last row of links room to breathe above
          any fixed bottom UI (e.g. a WhatsApp button), even though none
          exists in this codebase today. */}
      <div className="mx-auto max-w-7xl px-6 pb-28 pt-14 sm:px-8 sm:pb-16 sm:pt-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {hasQuickLinks && (
            <div>
              <h3 className={GROUP_HEADING_CLASS}>{headings.quickLinks}</h3>
              <ul className="mt-5 space-y-3.5">
                {quickLinks.map((link) => (
                  <li key={link.id}>
                    <FooterLink {...link} className={LINK_CLASS} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasSectionLinks && (
            <div>
              <h3 className={GROUP_HEADING_CLASS}>{headings.categories}</h3>
              <div className="mt-5 space-y-5">
                {sectionGroups.map((entry) => (
                  <div key={entry.key}>
                    <FooterLink label={entry.label} url={entry.url} external={false} newTab={false} className={SECTION_HEADING_LINK_CLASS} />
                    {entry.subLinks.length > 0 && (
                      <ul className="mt-2.5 space-y-2.5">
                        {entry.subLinks.map((sub) => (
                          <li key={sub.id}>
                            <FooterLink {...sub} className={SUBLINK_CLASS} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasBrands && (
            <div>
              <h3 className={GROUP_HEADING_CLASS}>{headings.brands}</h3>
              <ul className="mt-5 space-y-3.5">
                {brandItems.map((brand) => (
                  <li key={brand.id}>
                    <Link to={`/shop?brand=${encodeURIComponent(brand.name)}`} className={LINK_CLASS}>
                      {brand.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
