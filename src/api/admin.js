import { apiFetch, jsonOptions, withQuery } from './client'

// Central client for every admin-facing API call. Built on the same
// apiFetch used by the public-facing api/ modules, which already sends
// credentials: 'include' on every request — required here since admin
// auth is cookie-based.

export function get(path, params) {
  return apiFetch(withQuery(path, params))
}

export function post(path, body) {
  return apiFetch(path, jsonOptions('POST', body))
}

export function patch(path, body) {
  return apiFetch(path, jsonOptions('PATCH', body))
}

export function del(path, body) {
  return apiFetch(path, body ? { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { method: 'DELETE' })
}

// --- Products ---

export const getAdminProducts = (params) => get('/api/products', { ...params, all: '1' })
export const createProduct = (data) => post('/api/products', data)
export const updateProduct = (id, data) => patch(`/api/products/${id}`, data)
export const deleteProduct = (id) => del(`/api/products/${id}`)
export const bulkUpdateProducts = (ids, action) => post('/api/products/bulk', { ids, action })
export const unpublishProduct = (id) => post(`/api/products/${id}/unpublish`)
export const addProductImages = (id, urls) => post(`/api/products/${id}/images`, { urls })
export const reorderProductImages = (id, order) => patch(`/api/products/${id}/images/reorder`, { order })
export const deleteProductImage = (imageId) => del(`/api/images/${imageId}`)
export const deleteProductVariant = (variantId) => del(`/api/variants/${variantId}`)
export const deleteVariantSize = (variantId, sizeId) => del(`/api/variants/${variantId}/sizes/${sizeId}`)

// --- Sub-categories ---

export const getSubcategories = (section) => get('/api/subcategories', section ? { section } : undefined)
export const createSubcategory = (name, section) => post('/api/subcategories', { name, section })
export const updateSubcategory = (id, name) => patch(`/api/subcategories/${id}`, { name })
export const deleteSubcategory = (id, action, reassignTo) => del(`/api/subcategories/${id}`, { action, reassignTo })
export const getSubcategoryProductCount = (id) => get(`/api/subcategories/${id}/product-count`)

// --- Orders ---

// No admin listing filters/pagination exist server-side yet — full list is
// fetched and filtered client-side, matching the task's accepted approach
// at current order volumes.
export const getOrders = () => get('/api/orders')
export const updateOrderStatus = (id, status) => patch(`/api/orders/${id}`, { status })
export const updateOrderNotes = (id, notes) => patch(`/api/orders/${id}/notes`, { notes })

// --- Analytics ---

export const getRevenueAnalytics = (period) => get('/api/analytics/revenue', { period })
export const getOrdersBySection = (period) => get('/api/analytics/orders-by-section', { period })
export const getStatusBreakdown = () => get('/api/analytics/status-breakdown')
export const getBestSellers = (sort, limit) => get('/api/analytics/best-sellers', { sort, limit })

// --- Wholesale ---

export const getWholesaleImagesAdmin = () => get('/api/wholesale')
export const getWholesaleCategoriesAdmin = () => get('/api/wholesale/categories')
export const createWholesaleImage = (data) => post('/api/wholesale', data)
export const updateWholesaleImage = (id, data) => patch(`/api/wholesale/${id}`, data)
export const deleteWholesaleImage = (id) => del(`/api/wholesale/${id}`)
export const reorderWholesaleImages = (orderedIds) => patch('/api/wholesale/reorder', { orderedIds })
export const renameWholesaleCategory = (name, newName) =>
  patch(`/api/wholesale/categories/${encodeURIComponent(name)}`, { name: newName })
export const deleteWholesaleCategory = (name, action, reassignTo) =>
  del(`/api/wholesale/categories/${encodeURIComponent(name)}`, { action, reassignTo })
