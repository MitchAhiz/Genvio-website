import { apiFetch, withQuery } from './client'

export async function getWholesaleImages({ category } = {}) {
  return apiFetch(withQuery('/api/wholesale', { category }))
}

export async function getWholesaleCategories() {
  return apiFetch('/api/wholesale/categories')
}
