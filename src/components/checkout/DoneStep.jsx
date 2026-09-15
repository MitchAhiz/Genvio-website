import { useState } from 'react'
import Price from '../Price'
import Field from './Field'
import { AddressLines } from './SummaryStep'
import SaveDetailsOffer from './SaveDetailsOffer'
import { updateOrderDelivery } from '../../api/orders'
import { formatNgPhone } from '../../utils/phone'
import { NIGERIAN_STATES } from '../../data/nigerianStates'

const primary =
  'w-full h-12 rounded-md bg-cta text-on-cta text-sm font-semibold tracking-[0.02em] shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] hover:bg-cta-hover active:translate-y-px active:shadow-none disabled:bg-transparent disabled:text-muted disabled:border disabled:border-line disabled:shadow-none disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform] duration-300'
const quiet =
  'h-11 px-4 rounded-md border border-line text-sm font-medium text-ink-soft hover:text-ink hover:border-accent transition-colors duration-300 disabled:opacity-50'

function Row({ label, children }) {
  return (
    <div className="py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-0.5 text-sm text-ink leading-relaxed">{children}</div>
    </div>
  )
}

const emptyDraft = { name: '', address: { street: '', city: '', state: '' } }

export default function DoneStep({ order, setOrder, saveState, active, onDone }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!order) return null

  const startEdit = () => {
    setDraft({ name: order.customer.name, address: { ...order.address } })
    setError('')
    setEditing(true)
  }

  const setAddress = (patch) => setDraft((d) => ({ ...d, address: { ...d.address, ...patch } }))

  const save = async () => {
    if (draft.name.trim().length < 2) {
      setError('Enter the recipient’s full name')
      return
    }
    if (draft.address.street.trim().length < 3 || draft.address.city.trim().length < 2 || !draft.address.state) {
      setError('Enter a street address, city and state')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updateOrderDelivery(order.id, order.reference, {
        name: draft.name.trim(),
        address: {
          street: draft.address.street.trim(),
          city: draft.address.city.trim(),
          state: draft.address.state,
        },
      })
      setOrder(updated)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Couldn’t save the delivery details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 sm:px-8 pb-6 sm:pb-8">
      <div className="flex flex-col items-center text-center pt-1">
        {active && (
          <span className="success-disc w-14 h-14 rounded-full bg-accent text-on-accent flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m5 12 4.5 4.5L19 7" />
            </svg>
          </span>
        )}
        <p className="mt-4 text-sm text-ink-soft max-w-xs leading-relaxed">
          We’ll verify your payment and process your order. Keep this reference to hand.
        </p>
        <p className="mt-3 font-display text-2xl sm:text-3xl text-ink tracking-[0.04em] tabular-nums select-all">
          {order.reference}
        </p>
      </div>

      <section className="mt-6 rounded-md border border-line bg-ground px-4 py-3.5" aria-labelledby="delivery-heading">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id="delivery-heading" className="text-sm font-medium text-ink">
              Delivery details for logistics
            </h3>
            <p className="mt-0.5 text-xs text-muted">This is what the courier will see.</p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="shrink-0 text-xs text-ink-soft hover:text-ink underline underline-offset-4 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <Field
              label="Full name"
              name="edit-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <Field
              label="Delivery address"
              name="edit-street"
              as="textarea"
              rows={2}
              value={draft.address.street}
              onChange={(e) => setAddress({ street: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="City"
                name="edit-city"
                value={draft.address.city}
                onChange={(e) => setAddress({ city: e.target.value })}
              />
              <Field
                label="State"
                name="edit-state"
                as="select"
                data-empty={draft.address.state ? undefined : 'true'}
                value={draft.address.state}
                onChange={(e) => setAddress({ state: e.target.value })}
              >
                <option value="">Choose…</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Field>
            </div>
            {error && (
              <p className="text-xs text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2.5 pt-1">
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className={quiet}>
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="h-11 px-5 rounded-md bg-cta text-on-cta text-sm font-semibold hover:bg-cta-hover active:translate-y-px transition-[background-color,transform] duration-300 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-ink leading-relaxed">
            <p className="font-medium">{order.customer.name}</p>
            <AddressLines address={order.address} />
            <p className="text-muted tabular-nums mt-0.5">{formatNgPhone(order.customer.phone)}</p>
          </div>
        )}
      </section>

      {!editing && <SaveDetailsOffer order={order} saveState={saveState} />}

      <div className="mt-5 divide-y divide-line border-y border-line">
        <Row label="Total">
          <span className="font-display text-xl">
            <Price amount={order.total} />
          </span>
        </Row>
      </div>

      <div className="mt-8">
        <button type="button" onClick={onDone} className={primary}>
          Done
        </button>
      </div>
    </div>
  )
}
