import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { useSiteConfig } from '../hooks/useSiteConfig'
import { ArrowRightIcon } from '../components/icons'

// Placeholder photography — swap for the client's own campaign imagery.
const DOORS = [
  {
    to: '/shop',
    word: 'Shop',
    blurb: 'Men, Women and Kids — one bag across all three.',
    image: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=1800&q=80&auto=format&fit=crop',
    alt: 'A man in a black bomber and tan trousers seated in a round window',
    position: 'object-[50%_30%]',
  },
  {
    to: '/wholesale',
    word: 'Wholesale',
    blurb: 'The lookbook for trade buyers.',
    image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1800&q=80&auto=format&fit=crop',
    alt: 'Knitwear in oatmeal and camel hanging on a rail',
    position: 'object-[60%_45%]',
  },
]

export default function LandingPage() {
  useTheme('gate')
  const { config } = useSiteConfig()
  const doors = config?.section_visibility?.wholesale === false
    ? DOORS.filter((d) => d.to !== '/wholesale')
    : DOORS
  useEffect(() => {
    document.title = 'Genvio Exotic Apparel'
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-ground text-ink overflow-hidden">
      <header className="px-6 pt-9 pb-7 sm:pt-12 sm:pb-9 md:pt-14 md:pb-11 text-center">
        <h1 className="gate-rise font-display font-medium leading-[0.9] tracking-[-0.025em] text-[clamp(3.75rem,12vw,9.5rem)] text-ink">
          Genvio
        </h1>
        <p className="gate-rise gate-rise-2 mt-3 sm:mt-4 text-[11px] sm:text-[12px] md:text-[13px] font-medium uppercase tracking-[0.42em] text-ink-soft">
          Exotic Apparel
        </p>
      </header>

      <div className="gate flex-1 flex flex-col md:flex-row gap-px bg-line">
        {doors.map((door) => (
          <Link
            key={door.to}
            to={door.to}
            className="door group relative flex-1 min-h-[40dvh] md:min-h-0 overflow-hidden bg-surface outline-offset-[-4px]"
          >
            <img
              src={door.image}
              alt={door.alt}
              className={`absolute inset-0 w-full h-full object-cover ${door.position}`}
              loading="eager"
              decoding="async"
            />

            <div className="door-content absolute inset-x-0 bottom-0 border-t border-line bg-ground/85 group-hover:bg-ground/95 transition-[background-color] duration-500 ease-out-expo px-5 py-5 sm:px-7 sm:py-6 md:px-9 md:py-7 lg:px-11 lg:py-9 flex items-end justify-between gap-6">
              <div className="min-w-0">
                <span className="block font-display font-medium text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-[-0.02em] text-ink">
                  {door.word}
                </span>
                <span className="mt-2.5 sm:mt-3 block text-[13px] sm:text-sm text-ink-soft text-balance">{door.blurb}</span>
              </div>
              <ArrowRightIcon
                size={28}
                className="shrink-0 mb-1 text-ink-soft transition-[transform,color] duration-500 ease-out-expo group-hover:translate-x-2 group-hover:text-ink"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
