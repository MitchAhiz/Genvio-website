// Mirrors the server's fee resolution (server/src/routes/orders.js) so the
// storefront can preview the same amount the backend will charge. The
// backend never trusts this value — it recomputes independently.
export function deliveryFeeFor({ deliveryZone, address }, config) {
  if (!config) return 0
  if (address?.state === 'Lagos') {
    return Number(config[deliveryZone === 'island' ? 'delivery_island_fee' : 'delivery_mainland_fee']) || 0
  }
  return Number(config.delivery_interstate_fee) || 0
}

export function deliveryLabelFor({ deliveryZone, address }) {
  if (address?.state === 'Lagos') {
    return deliveryZone === 'island' ? 'Lagos Island delivery' : 'Lagos Mainland delivery'
  }
  return 'Interstate delivery'
}
