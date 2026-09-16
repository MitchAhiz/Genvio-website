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
