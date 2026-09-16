import { createContext, useCallback, useRef, useState } from 'react'
import { CheckIcon, CloseIcon } from '../icons'

export const ToastContext = createContext(null)

const AUTO_DISMISS_MS = 4000

const TYPE_STYLE = {
  success: { border: 'border-emerald-200', icon: 'text-emerald-600', bg: 'bg-emerald-50' },
  error: { border: 'border-red-200', icon: 'text-red-600', bg: 'bg-red-50' },
  warning: { border: 'border-amber-200', icon: 'text-amber-600', bg: 'bg-amber-50' },
  info: { border: 'border-slate-200', icon: 'text-slate-600', bg: 'bg-slate-50' },
}

function TypeIcon({ type }) {
  const cls = `w-5 h-5 shrink-0 ${TYPE_STYLE[type].icon}`
  if (type === 'success') return <CheckIcon className={cls} />
  if (type === 'error') return <CloseIcon className={cls} />
  if (type === 'warning') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden="true">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

function Toast({ toast, onDismiss }) {
  const style = TYPE_STYLE[toast.type] || TYPE_STYLE.info
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2.5 w-full max-w-sm rounded-lg border ${style.border} ${style.bg} bg-white px-4 py-3 shadow-md`}
    >
      <TypeIcon type={toast.type} />
      <p className="flex-1 text-sm text-slate-700 leading-snug pt-0.5">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 -m-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    timers.current.set(id, timer)
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed inset-x-0 bottom-4 z-[1200] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto sm:bottom-4">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
