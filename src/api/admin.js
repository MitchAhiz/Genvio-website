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

export function del(path) {
  return apiFetch(path, { method: 'DELETE' })
}
