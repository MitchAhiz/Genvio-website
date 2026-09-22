import { apiFetch, jsonOptions, withQuery } from './client'

// What the checkout may know before a PIN is given: whether this number has
// ordered before, and whether anything is saved behind a PIN. Never any
// personal data.
export function lookupCustomer(phone) {
  return apiFetch(withQuery('/api/customers/lookup', { phone }))
}

// The only call that returns saved details, and only for the right PIN.
// Resolves { verified, name?, address?, locked? }.
export function verifyPin(phone, pin) {
  return apiFetch('/api/customers/verify-pin', jsonOptions('POST', { phone, pin }))
}

// Both post-order calls carry the order reference as proof the caller placed it.
export function saveDetails({ phone, pin, name, address, reference }) {
  return apiFetch('/api/customers/save-details', jsonOptions('POST', { phone, pin, name, address, reference }))
}

export function declineSaveDetails({ phone, reference }) {
  return apiFetch('/api/customers/decline-save', jsonOptions('POST', { phone, reference }))
}

export function createOrder({ phone, name, address, items, total, deliveryZone }) {
  return apiFetch('/api/orders', jsonOptions('POST', { phone, name, address, items, total, deliveryZone }))
}

// Correct the delivery details (name + address) the courier will see.
export function updateOrderDelivery(orderId, reference, { name, address }) {
  return apiFetch(
    `/api/orders/${encodeURIComponent(orderId)}/delivery`,
    jsonOptions('PATCH', { reference, name, address })
  )
}

export function getPaymentConfig() {
  return apiFetch('/api/config/payment')
}
