import { apiFetch, withQuery, API_BASE } from './client'

// Reopening the checkout modal on a pending order (see CheckoutOverlay's
// localStorage restore) — token-gated, same as the upload itself.
export function lookupOrder(id, token) {
  return apiFetch(withQuery('/api/orders/lookup', { id, token }))
}

// Multipart upload — not apiFetch/jsonOptions, both because this is
// FormData rather than JSON and to get real upload progress via XHR
// (fetch's upload-progress story is still inconsistent across browsers).
export function uploadReceipt(orderId, orderToken, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/orders/${orderId}/receipts`)
    xhr.withCredentials = true

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total)
    }

    xhr.onload = () => {
      let data = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        // non-JSON body — data stays null, generic message below is used
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
      } else {
        reject(new Error(data?.error || `Upload failed (${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload. Please try again.'))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))

    const form = new FormData()
    form.append('orderToken', orderToken)
    form.append('receipt', file, file.name)
    xhr.send(form)
  })
}
