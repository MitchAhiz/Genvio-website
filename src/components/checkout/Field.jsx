import { ChevronDownIcon } from '../icons'

// Underlined form field. `as` = 'input' | 'textarea' | 'select'.
// The select is the only variant that needs a positioning wrapper, for its
// chevron; everything else sits directly in the label.
export default function Field({
  label,
  hint,
  error,
  revealed = false,
  revealIndex = 0,
  as = 'input',
  className = '',
  children,
  ...inputProps
}) {
  const Tag = as
  const id = inputProps.id || inputProps.name
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const control = (
    <Tag id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps}>
      {children}
    </Tag>
  )

  return (
    <div className={className}>
      <label
        className={`field${error ? ' is-invalid' : ''}${revealed ? ' is-revealed' : ''}`}
        style={revealed ? { '--reveal-step': revealIndex } : undefined}
      >
        <span className="field-label">{label}</span>
        {as === 'select' ? (
          <span className="relative block">
            {control}
            <ChevronDownIcon
              size={14}
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted"
            />
          </span>
        ) : (
          control
        )}
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
