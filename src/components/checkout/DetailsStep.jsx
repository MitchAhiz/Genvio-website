import { useEffect, useRef, useState } from 'react'
import Field from './Field'
import PinInput from './PinInput'
import TabGroup from './TabGroup'
import { lookupCustomer, verifyPin } from '../../api/orders'
import { normalizeNgPhone, formatNgPhone, digitsOnly } from '../../utils/phone'
import { NIGERIAN_STATES } from '../../data/nigerianStates'
import { CheckIcon } from '../icons'

const LAGOS_ZONES = [
  { value: 'mainland', label: 'Lagos Mainland' },
  { value: 'island', label: 'Lagos Island' },
]

const primary =
  'w-full h-12 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover active:translate-y-px active:shadow-none disabled:bg-transparent disabled:text-muted disabled:border disabled:border-line disabled:shadow-none disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform] duration-300'

function validate(d) {
  const errors = {}
  if (!normalizeNgPhone(d.phone)) errors.phone = 'Enter a valid Nigerian mobile number, e.g. 0801 234 5678'
  if (d.name.trim().length < 2) errors.name = 'Enter your full name'
  if (d.address.street.trim().length < 3) errors.street = 'Enter your street address'
  if (d.address.city.trim().length < 2) errors.city = 'Enter your city'
  if (!d.address.state) errors.state = 'Choose your state'
  if (d.address.state === 'Lagos' && !d.deliveryZone) errors.deliveryZone = 'Choose Lagos Mainland or Lagos Island'
  return errors
}

// Focus is owned by CheckoutOverlay, which moves it to the first control of
// whichever panel is active — the phone field here.
export default function DetailsStep({ details, setDetails, onContinue }) {
  const [errors, setErrors] = useState({})
  // 'idle' | 'looking' | 'known' | 'new' | 'error'
  const [lookup, setLookup] = useState('idle')
  // The PIN offer sits above the form and never blocks it: the fields stay
  // visible and typeable the whole time, so skipping costs nothing.
  const [pinOffer, setPinOffer] = useState(null) // null | 'open' | 'unlocked' | 'skipped' | 'locked'
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinWrong, setPinWrong] = useState(false)
  const [checking, setChecking] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const lastLookedUp = useRef(null)

  const set = (patch) => setDetails((d) => ({ ...d, ...patch }))
  const setAddress = (patch) => setDetails((d) => ({ ...d, address: { ...d.address, ...patch } }))
  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))

  // Ask once per complete number: has it ordered before, and is anything
  // saved behind a PIN.
  useEffect(() => {
    const phone = normalizeNgPhone(details.phone)
    if (!phone || phone === lastLookedUp.current) return
    lastLookedUp.current = phone
    let cancelled = false
    setLookup('looking')
    const t = setTimeout(async () => {
      try {
        const { exists, hasSavedDetails } = await lookupCustomer(phone)
        if (cancelled) return
        setLookup(exists ? 'known' : 'new')
        if (hasSavedDetails) {
          setPinOffer('open')
          setPin('')
          setPinError('')
        } else {
          setPinOffer(null)
        }
      } catch {
        if (!cancelled) setLookup('error')
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [details.phone])

  const handlePhone = (e) => {
    const digits = digitsOnly(e.target.value).slice(0, 13)
    set({ phone: digits })
    clearError('phone')
    if (!normalizeNgPhone(digits)) {
      lastLookedUp.current = null
      setLookup('idle')
      setPinOffer(null)
      setPin('')
      setPinError('')
    }
  }

  const submitPin = async (entered) => {
    const phone = normalizeNgPhone(details.phone)
    if (!phone || checking) return
    setChecking(true)
    setPinError('')
    setPinWrong(false)
    try {
      const res = await verifyPin(phone, entered)
      if (res.verified) {
        setDetails((d) => ({
          ...d,
          name: res.name || d.name,
          address: {
            street: res.address?.street || d.address.street,
            city: res.address?.city || d.address.city,
            state: res.address?.state || d.address.state,
          },
        }))
        setErrors({})
        setPinOffer('unlocked')
        setRevealed(true)
        setTimeout(() => setRevealed(false), 600)
      } else if (res.locked) {
        setPinOffer('locked')
        setPin('')
      } else {
        setPin('')
        setPinWrong(true)
        setPinError('Incorrect PIN. Try again, or skip and enter your details below.')
        setTimeout(() => setPinWrong(false), 400)
      }
    } catch (err) {
      setPinError(err.message || 'We couldn’t check that PIN. Enter your details below instead.')
    } finally {
      setChecking(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const next = validate(details)
    setErrors(next)
    if (Object.keys(next).length === 0) onContinue()
    else document.getElementById(Object.keys(next)[0])?.focus()
  }

  const phoneHint =
    lookup === 'looking'
      ? 'Just a moment…'
      : lookup === 'error'
        ? 'We couldn’t check that number, but you can still continue.'
        : 'We’ll use this to confirm your order — e.g. 0801 234 5678.'

  const showGreeting = lookup === 'known' && !pinOffer

  return (
    <form onSubmit={submit} noValidate className="px-5 sm:px-8 pb-6 sm:pb-8">
      <div className="pt-1">
        <label className={`field${errors.phone ? ' is-invalid' : ''}`}>
          <span className="field-label">Phone number</span>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            value={formatNgPhone(details.phone)}
            onChange={handlePhone}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby="phone-hint"
            className="!text-2xl sm:!text-3xl !font-medium !tracking-[0.04em] tabular-nums !py-2"
          />
        </label>
        <div id="phone-hint" className="mt-2 min-h-5" aria-live="polite">
          {showGreeting ? (
            <p className="text-sm text-ink">Welcome back! 👋</p>
          ) : errors.phone ? (
            <p className="text-xs text-danger">{errors.phone}</p>
          ) : (
            <p className="text-xs text-muted">{phoneHint}</p>
          )}
        </div>
      </div>

      {/* The PIN offer. Never blocks the form beneath it. */}
      {pinOffer === 'open' && (
        <div className="mt-6 rounded-md border border-line bg-ground px-4 py-4" aria-live="polite">
          <p className="text-sm text-ink">
            Welcome back! Enter your 4-digit PIN to load your saved details.
          </p>
          <div className="mt-3.5">
            <PinInput
              value={pin}
              onChange={(v) => {
                setPin(v)
                setPinError('')
              }}
              onComplete={submitPin}
              disabled={checking}
              wrong={pinWrong}
              autoFocus
              label="Your 4-digit PIN"
            />
          </div>
          <div className="mt-3 min-h-5">
            {checking ? (
              <p className="text-xs text-muted">Checking…</p>
            ) : pinError ? (
              <p className="text-xs text-danger">{pinError}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setPinOffer('skipped')}
            className="mt-1 text-xs text-ink-soft hover:text-ink underline underline-offset-4 transition-colors"
          >
            Skip and enter details manually
          </button>
        </div>
      )}

      {pinOffer === 'unlocked' && (
        <p className="mt-6 inline-flex items-center gap-1.5 text-sm text-ink">
          <span className="inline-flex w-5 h-5 rounded-full bg-accent text-on-accent items-center justify-center">
            <CheckIcon size={12} />
          </span>
          Saved details loaded — check them over below.
        </p>
      )}

      {pinOffer === 'locked' && (
        <p className="mt-6 text-sm text-ink-soft">
          That’s three tries — enter your details below instead. Your PIN will work again next time.
        </p>
      )}

      <div className="mt-5 space-y-5">
        <Field
          label="Full name"
          name="name"
          autoComplete="name"
          value={details.name}
          onChange={(e) => {
            set({ name: e.target.value })
            clearError('name')
          }}
          error={errors.name}
          revealed={revealed}
          revealIndex={0}
        />
      </div>

      <p className="mt-6 text-xs text-muted">
        (Delivery fees for Lagos Mainland, Lagos Island, and interstate delivery apply — set by admin)
      </p>

      <div className="mt-3 rounded-md border border-line bg-ground px-4 py-3">
        <p className="text-[13px] leading-relaxed text-ink-soft">
          These details will be shared with our logistics partner for delivery.
        </p>
      </div>

      <div className="mt-5 space-y-5">
        <Field
          label="Delivery address"
          name="street"
          as="textarea"
          rows={2}
          autoComplete="street-address"
          placeholder="Street, building, landmark"
          value={details.address.street}
          onChange={(e) => {
            setAddress({ street: e.target.value })
            clearError('street')
          }}
          error={errors.street}
          revealed={revealed}
          revealIndex={1}
        />
        <div className="grid grid-cols-2 gap-5">
          <Field
            label="City"
            name="city"
            autoComplete="address-level2"
            value={details.address.city}
            onChange={(e) => {
              setAddress({ city: e.target.value })
              clearError('city')
            }}
            error={errors.city}
            revealed={revealed}
            revealIndex={2}
          />
          <Field
            label="State"
            name="state"
            as="select"
            autoComplete="address-level1"
            data-empty={details.address.state ? undefined : 'true'}
            value={details.address.state}
            onChange={(e) => {
              const state = e.target.value
              setAddress({ state })
              clearError('state')
              if (state !== 'Lagos' && details.deliveryZone) set({ deliveryZone: '' })
            }}
            error={errors.state}
            revealed={revealed}
            revealIndex={3}
          >
            <option value="">Choose…</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Field>
        </div>

        {details.address.state === 'Lagos' && (
          <TabGroup
            label="Delivery zone"
            error={errors.deliveryZone}
            value={details.deliveryZone}
            options={LAGOS_ZONES}
            onChange={(v) => {
              set({ deliveryZone: v })
              clearError('deliveryZone')
            }}
          />
        )}
      </div>

      <div className="mt-8">
        <button type="submit" className={primary}>
          Continue
        </button>
      </div>
    </form>
  )
}
