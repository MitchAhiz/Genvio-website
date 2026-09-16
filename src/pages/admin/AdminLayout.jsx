import { NavLink, Outlet } from 'react-router-dom'
import { ToastProvider } from '../../components/admin/Toast'
import { post } from '../../api/admin'

// One icon set for the admin nav — 24-unit grid, 1.5 stroke, matching the
// public site's icon system (src/components/icons.jsx) but kept local since
// admin is deliberately outside the shared design system (see DESIGN.md).
const NAV_ITEMS = [
  {
    to: '/admin/products',
    label: 'Products',
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.9 7.5 12 12.5 3.1 7.5" />
        <path d="M12 22V12.5" />
        <path d="m3.3 7 8-4.5a1.4 1.4 0 0 1 1.4 0l8 4.5a1.4 1.4 0 0 1 .7 1.2v7.6a1.4 1.4 0 0 1-.7 1.2l-8 4.5a1.4 1.4 0 0 1-1.4 0l-8-4.5a1.4 1.4 0 0 1-.7-1.2V8.2A1.4 1.4 0 0 1 3.3 7Z" />
      </svg>
    ),
  },
  {
    to: '/admin/orders',
    label: 'Orders',
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M7 15v4" />
        <path d="M12 11v8" />
        <path d="M17 6v13" />
      </svg>
    ),
  },
  {
    to: '/admin/wholesale',
    label: 'Wholesale',
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/admin/settings',
    label: 'Settings',
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
]

function SidebarLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </NavLink>
  )
}

function TabBarLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
          isActive ? 'text-slate-900' : 'text-slate-400'
        }`
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  )
}

function AdminShell({ onLogout }) {
  const handleLogout = async () => {
    await post('/api/auth/logout').catch(() => {})
    onLogout()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-slate-200 bg-white px-3 py-5 md:flex">
          <h1 className="px-2 font-display text-lg font-semibold text-slate-900">Genvio Admin</h1>
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </nav>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Sign Out
          </button>
        </aside>

        {/* Main content */}
        <div className="flex min-h-screen flex-1 flex-col md:ml-56">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <h1 className="font-display text-base font-semibold text-slate-900">Genvio Admin</h1>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-slate-500"
            >
              Sign Out
            </button>
          </header>

          <main className="flex-1 px-4 py-5 pb-20 md:px-8 md:py-8 md:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
        {NAV_ITEMS.map((item) => (
          <TabBarLink key={item.to} {...item} />
        ))}
      </nav>
    </div>
  )
}

export default function AdminLayout({ onLogout }) {
  return (
    <ToastProvider>
      <AdminShell onLogout={onLogout} />
    </ToastProvider>
  )
}
