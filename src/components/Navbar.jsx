import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useBag } from '../hooks/useBag'
import SearchOverlay from './SearchOverlay'
import SectionSwitcher from './SectionSwitcher'
import { SearchIcon, BagIcon } from './icons'

// Retail header. Fixed heights (h-12 + h-10 on mobile, h-14 on sm+) so the
// catalogue's sticky filter row can sit exactly beneath it.
export default function Navbar() {
  const { itemCount } = useBag()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 bg-ground/90 backdrop-blur-sm border-b border-line transition-[background-color,border-color] duration-[400ms] ease-out-expo">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-12 sm:h-14 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center">
            <Link
              to="/"
              className="font-display text-[17px] sm:text-xl font-semibold tracking-wide text-ink whitespace-nowrap justify-self-start"
            >
              Genvio Exotic Apparel
            </Link>

            <div className="hidden sm:block">
              <SectionSwitcher />
            </div>

            <div className="flex items-center gap-1 justify-self-end">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="p-2 rounded-full text-ink-soft hover:text-ink hover:bg-surface transition-colors"
              >
                <SearchIcon />
              </button>

              <Link
                to="/shop/bag"
                className="relative flex items-center gap-1.5 p-2 rounded-full text-ink-soft hover:text-ink hover:bg-surface transition-colors"
                aria-label={`Bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
              >
                <BagIcon />
                {itemCount > 0 && (
                  <span className="text-[11px] font-semibold tabular-nums bg-ink text-ground rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="sm:hidden h-10 flex items-start justify-center">
            <SectionSwitcher />
          </div>
        </div>
      </header>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  )
}
