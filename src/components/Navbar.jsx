import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useBag } from '../hooks/useBag'
import SearchOverlay from './SearchOverlay'

export default function Navbar() {
  const { itemCount } = useBag()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <nav className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-12 sm:h-14 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-semibold tracking-wide text-charcoal">
            MARY
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="p-2 text-brown hover:text-charcoal transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            <Link
              to="/bag"
              className="flex items-center gap-1.5 p-2 text-brown hover:text-charcoal transition-colors"
              aria-label={`Shopping bag, ${itemCount} items`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {itemCount > 0 && (
                <span className="text-xs font-medium bg-charcoal text-cream rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  )
}
