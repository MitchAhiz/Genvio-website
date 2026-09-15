// One icon system: 24-unit grid, 1.5 stroke, round joins.
const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function SearchIcon({ size = 20, ...props }) {
  return (
    <svg {...base} width={size} height={size} {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function BagIcon({ size = 20, ...props }) {
  return (
    <svg {...base} width={size} height={size} {...props}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

export function ArrowRightIcon({ size = 20, ...props }) {
  return (
    <svg {...base} width={size} height={size} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 16, ...props }) {
  return (
    <svg {...base} width={size} height={size} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 16, ...props }) {
  return (
    <svg {...base} width={size} height={size} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function CloseIcon({ size = 18, ...props }) {
  return (
    <svg {...base} width={size} height={size} {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function CheckIcon({ size = 20, ...props }) {
  return (
    <svg {...base} width={size} height={size} {...props}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  )
}
