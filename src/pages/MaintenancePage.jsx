import { useEffect } from 'react'

export default function MaintenancePage() {
  useEffect(() => {
    document.title = 'Genvio Exotic Apparel — Back soon'
  }, [])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-ground text-ink px-6 text-center">
      <p className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-ink">Genvio</p>
      <p className="mt-2 text-[11px] sm:text-[12px] font-medium uppercase tracking-[0.42em] text-ink-soft">
        Exotic Apparel
      </p>
      <p className="mt-8 text-sm sm:text-base text-muted max-w-sm">
        We'll be back soon. The shop is offline for a short while — thanks for your patience.
      </p>
    </div>
  )
}
