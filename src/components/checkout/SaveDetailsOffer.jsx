import { useState } from 'react'
import PinInput from './PinInput'
import { saveDetails, declineSaveDetails } from '../../api/orders'
import { CheckIcon } from '../icons'

const solid =
  'h-11 px-5 rounded-md bg-cta text-on-cta text-sm font-semibold hover:bg-cta-hover active:translate-y-px transition-[background-color,transform] duration-300 disabled:opacity-60'
const quiet =
  'h-11 px-4 rounded-md border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-accent transition-colors duration-300 disabled:opacity-50'

// Offered after the order is placed, never before, and never as a blocker.
// `saveState` comes from the order: 'offer' (never asked), 'opted_out'
// (asked and declined — only a quiet way back in), 'saved' (nothing to do).
export default function SaveDetailsOffer({ order, saveState }) {
  const initial = saveState === 'offer' ? 'offer' : saveState === 'opted_out' ? 'link' : 'hidden'
  const [stage, setStage] = useState(initial) // offer | link | enter | confirm | done | hidden
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [wrong, setWrong] = useState(false)
  const [busy, setBusy] = useState(false)

  if (stage === 'hidden') return null

  const startPin = () => {
    setPin('')
    setConfirmPin('')
    setError('')
    setStage('enter')
  }

  const decline = async () => {
    setStage('hidden')
    try {
      await declineSaveDetails({ phone: order.customer.phone, reference: order.reference })
    } catch {
      // Declining is a preference, not a transaction — if it fails we simply
      // ask again next time rather than bothering them about it now.
    }
  }

  const submitConfirm = async (entered) => {
    if (entered !== pin) {
      setConfirmPin('')
      setWrong(true)
      setError('Those PINs don’t match. Try again.')
      setTimeout(() => setWrong(false), 400)
      return
    }
    setBusy(true)
    setError('')
    try {
      await saveDetails({
        phone: order.customer.phone,
        pin,
        name: order.customer.name,
        address: order.address,
        reference: order.reference,
      })
      setStage('done')
    } catch (err) {
      setError(err.message || 'We couldn’t save your details. You can try again next time.')
    } finally {
      setBusy(false)
    }
  }

  // Opted out previously — a quiet way back in, nothing more.
  if (stage === 'link') {
    return (
      <button
        type="button"
        onClick={startPin}
        className="mt-4 text-xs text-ink-soft hover:text-ink underline underline-offset-4 transition-colors"
      >
        Save details for next time
      </button>
    )
  }

  if (stage === 'done') {
    return (
      <p className="save-card mt-5 inline-flex items-center gap-1.5 text-sm text-ink">
        <span className="inline-flex w-5 h-5 rounded-full bg-accent text-on-accent items-center justify-center">
          <CheckIcon size={12} />
        </span>
        Saved. Next time, your PIN fills this in.
      </p>
    )
  }

  const entering = stage === 'enter' || stage === 'confirm'

  return (
    <section className="save-card mt-5 rounded-md border border-line bg-ground px-4 py-4">
      {stage === 'offer' && (
        <>
          <p className="text-sm text-ink">Want faster checkout next time?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            Save your details with a 4-digit PIN and we’ll fill them in for you.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button type="button" onClick={startPin} className={solid}>
              Save my details
            </button>
            <button type="button" onClick={decline} className={quiet}>
              No thanks
            </button>
          </div>
        </>
      )}

      {entering && (
        <>
          <p className="text-sm text-ink">
            {stage === 'enter' ? 'Choose a 4-digit PIN' : 'Enter it once more'}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            {stage === 'enter'
              ? 'You’ll use it to load your details next time.'
              : 'Just to be sure you’ll remember it.'}
          </p>
          <div className="mt-3.5">
            {stage === 'enter' ? (
              <PinInput
                key="enter"
                idPrefix="set-pin"
                value={pin}
                onChange={(v) => {
                  setPin(v)
                  setError('')
                }}
                onComplete={() => setStage('confirm')}
                autoFocus
                label="Choose a 4-digit PIN"
              />
            ) : (
              <PinInput
                key="confirm"
                idPrefix="confirm-pin"
                value={confirmPin}
                onChange={(v) => {
                  setConfirmPin(v)
                  setError('')
                }}
                onComplete={submitConfirm}
                disabled={busy}
                wrong={wrong}
                autoFocus
                label="Confirm your PIN"
              />
            )}
          </div>
          <div className="mt-3 min-h-5">
            {busy ? (
              <p className="text-xs text-muted">Saving…</p>
            ) : error ? (
              <p className="text-xs text-danger">{error}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setStage(initial === 'link' ? 'link' : 'offer')}
            disabled={busy}
            className="mt-1 text-xs text-ink-soft hover:text-ink underline underline-offset-4 transition-colors"
          >
            Cancel
          </button>
        </>
      )}
    </section>
  )
}
