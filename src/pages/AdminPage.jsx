import { useState, useEffect } from 'react'
import AdminLayout from './admin/AdminLayout'
import LoginForm from '../components/auth/LoginForm'
import { useNoIndex } from '../hooks/useNoIndex'
import { apiFetch } from '../api/client'

// ── Root ──
//
// This gate is the only thing standing between LoginForm and the admin
// shell (AdminLayout + its nested /admin/* routes). Everything past login
// used to be a single inline Dashboard here; TASK-06 replaced it with the
// router-based shell, and Tasks 07-11 fill in each tab's real content.

export default function AdminPage() {
  useNoIndex()
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) return null
  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <AdminLayout onLogout={() => setAuthed(false)} />
}
