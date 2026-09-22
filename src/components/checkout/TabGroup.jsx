// Reuses the app's existing underline tab language (.section-tab, see
// SectionSwitcher) for an in-form choice instead of introducing a new
// segmented-control pattern.
export default function TabGroup({ label, error, options, value, onChange }) {
  return (
    <div>
      <span className="field-label block">{label}</span>
      <div role="radiogroup" aria-label={label} className="mt-1 flex items-center gap-6">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`section-tab min-h-11 flex items-center${value === opt.value ? ' is-active' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
    </div>
  )
}
