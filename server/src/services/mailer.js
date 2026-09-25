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
// Brevo does not publish an exact attachment-size limit in its API reference
// or transactional docs (checked at the time this was written — worth
// reconfirming in the Brevo dashboard/support if this ever bounces). This is
// a deliberately conservative cutoff: most third-party ESP limits for a
// combined message + attachments sit around 10MB, and base64 encoding adds
// ~33% overhead, so capping the raw file at 7MB keeps the encoded payload
// (plus the HTML body) safely under that.
const MAX_EMAIL_ATTACHMENT_BYTES = 7 * 1024 * 1024

function frontendOrderLink(orderId) {
  const base = (process.env.FRONTEND_URL || 'https://genvio-website.vercel.app').replace(/\/$/, '')
  return `${base}/admin/orders?order=${orderId}`
}

async function sendBrevoEmail({ to, subject, html, attachment }) {
  if (!process.env.BREVO_API_KEY) {
    console.error(`[mailer] BREVO_API_KEY is not set — skipping "${subject}"`)
    return { sent: false }
  }
  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: 'Genvio Orders', email: process.env.MAIL_FROM || 'exoticapparels0105@gmail.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(attachment ? { attachment: [attachment] } : {}),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Brevo responded ${res.status}: ${body}`)
  }
  return { sent: true }
}

function itemsTable(items) {
  const rows = items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.name || i.productId)}</td><td>${escapeHtml(i.colour || '')}</td><td>${escapeHtml(i.size || '')}</td><td>${i.qty}</td><td>${formatNaira(i.unitPrice)}</td></tr>`
    )
    .join('')
  return `<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Item</th><th>Colour</th><th>Size</th><th>Qty</th><th>Unit price</th></tr></thead><tbody>${rows}</tbody></table>`
}

// Admin alert: a receipt was uploaded and needs manual verification.
// Attaches the file when it's under MAX_EMAIL_ATTACHMENT_BYTES; otherwise
// sends the admin link with a note that the file was too large to attach —
// never blocks on attachment size.
async function sendReceiptUploadedEmail(order, { buffer, mime, filename, isDuplicate }) {
  const recipient = await getConfig('notification_email')
  if (!recipient) {
    console.error(`[mailer] no notification_email configured — skipping receipt alert for ${order.reference}`)
    return
  }

  const tooLarge = buffer.length > MAX_EMAIL_ATTACHMENT_BYTES
  const attachment = tooLarge ? undefined : { name: filename, content: buffer.toString('base64') }

  const html = `
    <h2>Receipt uploaded: Order ${escapeHtml(order.reference)}</h2>
    ${isDuplicate ? '<p style="color:#b91c1c;font-weight:bold;">⚠ This receipt file matches one already uploaded to a different order — check for a possible duplicate/reused receipt.</p>' : ''}
    <p><strong>${escapeHtml(order.customer.name)}</strong></p>
    <p>${escapeHtml(order.customer.phone)}${order.customer.isWhatsapp ? ' (on WhatsApp)' : ''}</p>
    <p>${escapeHtml(order.customer.email || '')}</p>
    <p>Uploaded ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
    <h3>Order contents</h3>
    ${itemsTable(order.items)}
    <p><strong>Total expected: ${formatNaira(order.total)}</strong></p>
    ${tooLarge ? `<p><em>The receipt file (${(buffer.length / 1024 / 1024).toFixed(1)}MB) was too large to attach — view it in the admin instead.</em></p>` : ''}
    <p><a href="${frontendOrderLink(order.id)}">Open this order in the admin →</a></p>
  `

  try {
    await sendBrevoEmail({
      to: recipient,
      subject: `Receipt uploaded: Order ${order.reference} (${formatNaira(order.total)})`,
      html,
      attachment,
    })
  } catch (err) {
    console.error(`[mailer] failed to send receipt-uploaded alert for ${order.reference}:`, err)
    await logActivity('order.notification_failed', 'order', order.id, { type: 'receipt_uploaded', error: String(err.message || err) })
  }
}

async function sendReceiptReceivedEmail(order) {
  if (!order.customer.email) return
  try {
    await sendBrevoEmail({
      to: order.customer.email,
      subject: `We've received your receipt for order ${order.reference}`,
      html: `<p>Thanks — we've received your receipt for order <strong>${escapeHtml(order.reference)}</strong>. We're confirming your transfer and will update you by WhatsApp/phone and email once it's verified.</p>`,
    })
  } catch (err) {
    console.error(`[mailer] failed to send receipt-received email for ${order.reference}:`, err)
    await logActivity('order.notification_failed', 'order', order.id, { type: 'receipt_received', error: String(err.message || err) })
  }
}

async function sendOrderConfirmedEmail(order) {
  if (!order.customer.email) return
  try {
    await sendBrevoEmail({
      to: order.customer.email,
      subject: `Payment confirmed — order ${order.reference}`,
      html: `
        <h2>Payment confirmed</h2>
        <p>Thank you — your payment for order <strong>${escapeHtml(order.reference)}</strong> has been verified. We're processing your order now.</p>

        <h3>Delivery details</h3>
        <p><strong>${escapeHtml(order.address?.recipientName || order.customer.name)}</strong></p>
        <p>${escapeHtml(formatAddress(order.address))}</p>

        ${itemsTable(order.items)}
        <p><strong>Total: ${formatNaira(order.total)}</strong></p>
      `,
    })
  } catch (err) {
    console.error(`[mailer] failed to send confirmation email for ${order.reference}:`, err)
    await logActivity('order.notification_failed', 'order', order.id, { type: 'order_confirmed', error: String(err.message || err) })
  }
}

// The re-upload link carries the order token (not just the reference) so it
// works from any device — the token is what actually authorizes the upload,
// not something read out of localStorage on one browser.
async function sendOrderRejectedEmail(order, reason) {
  if (!order.customer.email) return
  const base = (process.env.FRONTEND_URL || 'https://genvio-website.vercel.app').replace(/\/$/, '')
  const reuploadLink = `${base}/shop/bag?reupload=${order.id}&token=${order.orderToken}`
  try {
    await sendBrevoEmail({
      to: order.customer.email,
      subject: `Order ${order.reference}: we couldn't verify your payment`,
      html: `
        <h2>We couldn't verify your payment</h2>
        <p>Order <strong>${escapeHtml(order.reference)}</strong>: ${escapeHtml(reason)}</p>
        <p><a href="${reuploadLink}">Upload a new receipt for this order →</a></p>
        <p style="color:#666;font-size:13px;">If you're on the device you used to place this order, you can also just reopen your checkout there — we'll recognize your order and take you straight to payment, no link needed.</p>
      `,
    })
  } catch (err) {
    console.error(`[mailer] failed to send rejection email for ${order.reference}:`, err)
    await logActivity('order.notification_failed', 'order', order.id, { type: 'order_rejected', error: String(err.message || err) })
  }
}

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

module.exports = {
  sendOrderNotification,
  sendReceiptUploadedEmail,
  sendReceiptReceivedEmail,
  sendOrderConfirmedEmail,
  sendOrderRejectedEmail,
}
