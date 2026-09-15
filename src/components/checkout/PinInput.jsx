import { useEffect, useRef } from 'react'

const LENGTH = 4

// Four masked boxes that advance themselves. `value` is the PIN so far, so
// the parent owns it and can clear it after a wrong attempt.
export default function PinInput({ value, onChange, onComplete, disabled, wrong, autoFocus, label, idPrefix = 'pin' }) {
  const refs = useRef([])
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('')

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => refs.current[0]?.focus({ preventScroll: true }), 120)
      return () => clearTimeout(t)
    }
  }, [autoFocus])

  // Back to the first empty box after the parent clears a wrong attempt.
  useEffect(() => {
    if (wrong) refs.current[0]?.focus({ preventScroll: true })
  }, [wrong])

  const commit = (next) => {
    onChange(next)
    if (next.length === LENGTH) onComplete?.(next)
  }

  const handleChange = (i) => (e) => {
    const typed = e.target.value.replace(/\D/g, '')
    if (!typed) return
    // Taking the last character lets a filled box be typed over.
    const chars = value.split('')
    chars[i] = typed[typed.length - 1]
    const next = chars.join('').slice(0, LENGTH)
    commit(next)
    if (i < LENGTH - 1) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i) => (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const chars = value.padEnd(LENGTH, ' ').split('')
      if (chars[i] !== ' ') {
        chars[i] = ' '
        onChange(chars.join('').trimEnd())
      } else if (i > 0) {
        chars[i - 1] = ' '
        onChange(chars.join('').trimEnd())
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      refs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return
    e.preventDefault()
    commit(pasted)
    refs.current[Math.min(pasted.length, LENGTH - 1)]?.focus()
  }

  return (
    <div
      className={`pin-boxes flex gap-2.5${wrong ? ' is-wrong' : ''}`}
      role="group"
      aria-label={label || 'PIN'}
      onPaste={handlePaste}
    >
      {Array.from({ length: LENGTH }).map((_, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          ref={(el) => (refs.current[i] = el)}
          className="pin-box"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          data-filled={digits[i] !== ' ' ? 'true' : undefined}
          value={digits[i] === ' ' ? '' : digits[i]}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}
