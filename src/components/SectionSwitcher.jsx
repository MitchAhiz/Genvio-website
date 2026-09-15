import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import { SECTIONS, sectionPath } from '../sections'

// Persistent Men · Women · Kids control. Lives in the sticky retail header so
// it is reachable at any scroll depth. Switching is a navigation; the theme
// follows the route, and the rule under the active label takes the new
// section's accent.
export default function SectionSwitcher() {
  return (
    <nav aria-label="Shop sections" className="flex items-center gap-2.5 sm:gap-3.5">
      {SECTIONS.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 && (
            <span aria-hidden="true" className="text-muted/60 text-xs select-none">
              ·
            </span>
          )}
          <NavLink
            to={sectionPath(s.key)}
            className={({ isActive }) => `section-tab${isActive ? ' is-active' : ''}`}
          >
            {s.label}
          </NavLink>
        </Fragment>
      ))}
    </nav>
  )
}
