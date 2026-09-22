const { getConfig } = require('./configService')
const { logActivity } = require('../utils/logActivity')

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

// Matches the admin Orders page's date formatting (AdminOrders.jsx, OrderDetailDrawer.jsx).
function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

// order.address is stored as JSON ({ street, city, state }), not a plain
// string — matches the admin drawer's rendering.
function formatAddress(address) {
  if (!address) return ''
  if (typeof address === 'string') return address
  return [address.street, address.city, address.state].filter(Boolean).join(', ')
}

// Most webmail clients (Gmail, Outlook.com, etc.) strip <script> tags and
// inline event handlers, so a real click-to-copy button can't be relied on
// in the inbox. The reference is instead shown in a bordered, monospace box
// sized to its content so a single click/tap-and-hold reliably selects the
// whole thing — the closest thing to "copy with one action" HTML email
// supports everywhere. A best-effort JS button is layered on top for the
// clients that do allow it (e.g. Apple Mail); it degrades to a no-op link
// where scripts are stripped.
function orderEmailHtml(order) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.name || i.productId)}</td><td>${escapeHtml(i.colour || '')}</td><td>${escapeHtml(i.size || '')}</td><td>${i.qty}</td><td>${formatNaira(i.unitPrice)}</td></tr>`
    )
    .join('')

  const reference = escapeHtml(order.reference)

  return `
    <h2>New order</h2>
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:monospace;font-size:16px;border:1px solid #ccc;border-radius:4px;padding:8px 12px;background:#f7f7f7;user-select:all;">${reference}</td>
      <td style="padding-left:8px;">
        <button type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('${reference}')" style="font-family:sans-serif;font-size:13px;padding:8px 12px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;">Copy</button>
      </td>
    </tr></table>

    <p style="color:#666;">Placed ${escapeHtml(formatDateTime(order.createdAt))}</p>

    <h3>Delivery details</h3>
    <p><strong>${escapeHtml(order.address?.recipientName || order.customer.name)}</strong></p>
    <p>${escapeHtml(order.customer.phone)}</p>
    <p>${escapeHtml(formatAddress(order.address))}</p>

    <h3>Order contents</h3>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Item</th><th>Colour</th><th>Size</th><th>Qty</th><th>Unit price</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><strong>Total: ${formatNaira(order.total)}</strong></p>
  `
}

// Notifies whoever is currently configured as the order-alert recipient.
// Reads notification_email fresh from the DB on every send so a change in
// Settings takes effect on the very next order, not just after a redeploy.
async function sendOrderNotification(order) {
  const recipient = await getConfig('notification_email')
  console.log(`[mailer] resolved order-alert recipient: "${recipient}" (order ${order.reference})`)

  if (!recipient) {
    console.error(`[mailer] no notification_email configured — skipping alert for order ${order.reference}`)
    return
  }

  if (!process.env.BREVO_API_KEY) {
    console.error(`[mailer] BREVO_API_KEY is not set — skipping alert for order ${order.reference}`)
    return
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'Genvio Orders', email: process.env.MAIL_FROM || 'exoticapparels0105@gmail.com' },
        to: [{ email: recipient }],
        subject: `New order ${order.reference} — ${formatNaira(order.total)}`,
        htmlContent: orderEmailHtml(order),
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Brevo responded ${res.status}: ${body}`)
    }

    console.log(`[mailer] order alert sent to ${recipient} for order ${order.reference}`)
  } catch (err) {
    console.error(`[mailer] failed to send order alert for order ${order.reference}:`, err)
    await logActivity('order.notification_failed', 'order', order.id, { error: String(err.message || err) })
  }
}

module.exports = { sendOrderNotification }
