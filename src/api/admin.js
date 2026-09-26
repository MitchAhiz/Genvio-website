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
export const searchUploadProducts = (q) => get('/api/admin/upload/products', { q })
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

// --- Categories ---

export const getAdminCategories = (section) => get('/api/admin/categories', section ? { section } : undefined)
export const createCategory = (name, section) => post('/api/admin/categories', { name, section })
export const updateCategory = (id, name) => patch(`/api/admin/categories/${id}`, { name })
export const deleteCategory = (id, action, reassignTo) => del(`/api/admin/categories/${id}`, { action, reassignTo })
export const getCategoryProductCount = (id) => get(`/api/admin/categories/${id}/product-count`)

// --- Subcategories ---

export const getSubcategories = (categoryId) => get('/api/admin/subcategories', { categoryId })
export const createSubcategory = (categoryId, name) => post('/api/admin/subcategories', { categoryId, name })
export const updateSubcategory = (id, name) => patch(`/api/admin/subcategories/${id}`, { name })
export const deleteSubcategory = (id, action, reassignTo) => del(`/api/admin/subcategories/${id}`, { action, reassignTo })
export const getSubcategoryProductCount = (id) => get(`/api/admin/subcategories/${id}/product-count`)

// --- Size ranges ---

export const getSizeRange = (categoryId, subcategoryId) =>
  get('/api/admin/size-ranges', { category: categoryId, subcategory: subcategoryId })
export const saveSizeRange = (categoryId, subcategoryId, sizes) =>
  apiFetch('/api/admin/size-ranges', jsonOptions('PUT', { categoryId, subcategoryId, sizes }))

// --- Brands ---

export const getAdminBrands = () => get('/api/admin/brands')

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

// --- Settings ---

export const getAllConfig = () => get('/api/config/all')
// No dedicated PATCH /api/config/payment route exists (see HANDOFF.md
// Task 05 notes) — the generic PATCH /api/config already accepts and
// validates bank_account_name/bank_account_number/bank_name.
export const updateConfig = (data) => patch('/api/config', data)
export const getActivityLog = (page, search) => get('/api/activity', { page, search })
export const getConfigHistory = (keys, limit) => get('/api/config/history', { keys: keys?.join(','), limit })

// --- Session & Auth ---
// Reuses the same endpoints the OTP login flow already calls
// (server/src/routes/auth.js) — no new auth backend added here.

export const getCurrentSession = () => get('/api/auth/me')
export const logoutAdmin = () => post('/api/auth/logout')
export const invalidateAllSessions = () => post('/api/auth/invalidate-all')
