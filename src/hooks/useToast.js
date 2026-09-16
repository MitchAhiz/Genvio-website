import { useContext } from 'react'
import { ToastContext } from '../components/admin/Toast'

// useToast().show('Product saved', 'success')
// Types: 'success' | 'error' | 'warning' | 'info' (defaults to 'info')
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
