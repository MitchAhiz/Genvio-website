import { apiFetch, jsonOptions } from './client'

// Admin: correct the delivery details on any order, paid or not. The admin
// route bypasses the customer delivery lock and writes only to Order.address
// (including the per-order recipientName) — never the shared Customer record.
export function updateOrderDeliveryAdmin(orderId, { name, address }) {
  return apiFetch(
    `/api/admin/orders/${encodeURIComponent(orderId)}/delivery`,
    jsonOptions('PATCH', { name, address })
  )
}