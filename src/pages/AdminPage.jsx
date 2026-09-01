import { useState, useEffect } from 'react'
import { formatPrice } from '../api/products'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function api(path, options = {}) {
  return fetch(`${API}${path}`, { credentials: 'include', ...options })
}

function jsonPatch(path, body) {
  return api(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function jsonPost(path, body) {
  return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

const S = {
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8A7B72', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  input: { width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.875rem', border: '1px solid #E8E2DB', borderRadius: 6, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' },
  btnPrimary: { padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: '#FAF7F2', background: '#2C2420', border: 'none', borderRadius: 6, cursor: 'pointer' },
  btnSecondary: { padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: '#8A7B72', background: 'none', border: '1px solid #E8E2DB', borderRadius: 6, cursor: 'pointer' },
  btnDanger: { padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#991B1B', background: 'none', border: '1px solid #FECACA', borderRadius: 4, cursor: 'pointer' },
  btnSmall: { padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#2C2420', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
  section: { padding: '1rem', background: '#F5F0EB', borderRadius: 8, marginBottom: '1rem' },
  sectionTitle: { fontSize: '0.8125rem', fontWeight: 600, color: '#2C2420', margin: '0 0 0.75rem' },
}

// ── Login Form ──

function LoginForm({ onLogin }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const requestOtp = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await jsonPost('/api/auth/request-otp', { email: email.trim() })
      const data = await res.json()
      if (res.ok) setStep('code')
      else setError(data.error || 'Failed to send code')
    } catch { setError('Network error. Is the server running?') }
    finally { setSending(false) }
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await jsonPost('/api/auth/verify-otp', { email: email.trim(), code: code.trim() })
      const data = await res.json()
      if (res.ok && data.success) onLogin()
      else setError(data.error || 'Verification failed')
    } catch { setError('Network error') }
    finally { setSending(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '2.5rem 2rem', background: '#fff', borderRadius: 12, border: '1px solid #E8E2DB' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.5rem', fontWeight: 600, color: '#2C2420', margin: '0 0 0.25rem' }}>Genvio Exotic Apparel Admin</h1>
        <p style={{ fontSize: '0.875rem', color: '#8A7B72', margin: '0 0 1.5rem' }}>
          {step === 'email' ? 'Enter your admin email to sign in' : 'Check your email for the 6-digit code'}
        </p>
        {error && <div style={{ padding: '0.625rem 0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: '0.8125rem', color: '#991B1B', marginBottom: '1rem' }}>{error}</div>}
        {step === 'email' ? (
          <form onSubmit={requestOtp}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required autoFocus style={{ ...S.input }} />
            <button type="submit" disabled={sending || !email.trim()} style={{ ...S.btnPrimary, width: '100%', marginTop: '0.75rem', padding: '0.625rem', opacity: sending ? 0.6 : 1 }}>{sending ? 'Sending...' : 'Send Code'}</button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required autoFocus maxLength={6} style={{ ...S.input, fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', letterSpacing: '0.2em' }} />
            <button type="submit" disabled={sending || code.length !== 6} style={{ ...S.btnPrimary, width: '100%', marginTop: '0.75rem', padding: '0.625rem', opacity: sending ? 0.6 : 1 }}>{sending ? 'Verifying...' : 'Verify & Sign In'}</button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError('') }} style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem', fontSize: '0.8125rem', color: '#8A7B72', background: 'none', border: 'none', cursor: 'pointer' }}>Use a different email</button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Product Edit Modal ──

function ProductEditModal({ product, onSave, onClose }) {
  const [name, setName] = useState(product.name)
  const [brand, setBrand] = useState(product.brand)
  const [category, setCategory] = useState(product.category)
  const [price, setPrice] = useState(product.price)
  const [variants, setVariants] = useState(product.variants.map(v => ({ ...v, sizes: v.sizes.map(s => ({ ...s })) })))
  const [images, setImages] = useState([...product.images])
  const [newImageUrl, setNewImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const saveBasicFields = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await jsonPatch(`/api/products/${product.id}`, { name, brand, category, price: Number(price) })
      if (!res.ok) { setError((await res.json()).error); return null }
      return await res.json()
    } catch { setError('Network error'); return null }
    finally { setSaving(false) }
  }

  const saveAll = async () => {
    const updated = await saveBasicFields()
    if (updated) onSave(updated)
  }

  // ── Variant operations ──

  const saveVariant = async (variant) => {
    const payload = variant.id
      ? { variants: [{ id: variant.id, colour: variant.colour, imageUrl: variant.imageUrl, sizes: variant.sizes.map(s => s.id ? { id: s.id, size: s.size, quantity: Number(s.quantity) } : { size: s.size, quantity: Number(s.quantity) }) }] }
      : { variants: [{ colour: variant.colour, imageUrl: variant.imageUrl || null, sizes: variant.sizes.map(s => ({ size: s.size, quantity: Number(s.quantity) })) }] }
    const res = await jsonPatch(`/api/products/${product.id}`, payload)
    if (!res.ok) { alert((await res.json()).error); return }
    const updated = await res.json()
    setVariants(updated.variants.map(v => ({ ...v, sizes: v.sizes.map(s => ({ ...s })) })))
    onSave(updated)
  }

  const deleteVariant = async (variantId) => {
    if (!confirm('Delete this colour variant and all its sizes?')) return
    const res = await api(`/api/variants/${variantId}`, { method: 'DELETE' })
    if (!res.ok) { alert((await res.json()).error); return }
    setVariants(prev => prev.filter(v => v.id !== variantId))
  }

  const addVariant = () => {
    setVariants(prev => [...prev, { id: null, colour: '', imageUrl: '', sizes: [], _new: true }])
  }

  const updateLocalVariant = (idx, field, value) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  // ── Size operations ──

  const deleteSize = async (variantId, sizeId) => {
    const res = await api(`/api/variants/${variantId}/sizes/${sizeId}`, { method: 'DELETE' })
    if (!res.ok) { alert((await res.json()).error); return }
    setVariants(prev => prev.map(v => v.id === variantId ? { ...v, sizes: v.sizes.filter(s => s.id !== sizeId) } : v))
  }

  const addLocalSize = (variantIdx) => {
    setVariants(prev => prev.map((v, i) => i === variantIdx ? { ...v, sizes: [...v.sizes, { id: null, size: '', quantity: 0 }] } : v))
  }

  const updateLocalSize = (variantIdx, sizeIdx, field, value) => {
    setVariants(prev => prev.map((v, vi) => vi === variantIdx ? { ...v, sizes: v.sizes.map((s, si) => si === sizeIdx ? { ...s, [field]: field === 'quantity' ? Number(value) || 0 : value } : s) } : v))
  }

  // ── Image operations ──

  const addImage = async () => {
    if (!newImageUrl.trim()) return
    const res = await jsonPost(`/api/products/${product.id}/images`, { urls: [newImageUrl.trim()] })
    if (!res.ok) { alert((await res.json()).error); return }
    const created = await res.json()
    setImages(prev => [...prev, ...created])
    setNewImageUrl('')
  }

  const deleteImage = async (imageId) => {
    const res = await api(`/api/images/${imageId}`, { method: 'DELETE' })
    if (!res.ok) { alert((await res.json()).error); return }
    setImages(prev => prev.filter(img => img.id !== imageId))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,32,0.5)', display: 'flex', alignItems: 'start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 700, background: '#fff', borderRadius: 12, border: '1px solid #E8E2DB', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C2420', margin: 0 }}>Edit: {product.name}</h2>
          <button onClick={onClose} style={S.btnSecondary}>Close</button>
        </div>

        {error && <div style={{ padding: '0.5rem 0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: '0.8125rem', color: '#991B1B', marginBottom: '1rem' }}>{error}</div>}

        {/* Basic Fields */}
        <div style={S.section}>
          <h3 style={S.sectionTitle}>Basic Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={S.label}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Brand</label>
              <input value={brand} onChange={e => setBrand(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Price (₦)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} style={S.input} />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <button onClick={saveAll} disabled={saving} style={S.btnPrimary}>{saving ? 'Saving...' : 'Save Basic Info'}</button>
          </div>
        </div>

        {/* Images */}
        <div style={S.section}>
          <h3 style={S.sectionTitle}>Images ({images.length})</h3>
          {images.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {images.map((img, i) => (
                <div key={img.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', padding: '0.375rem 0.5rem', borderRadius: 6, border: '1px solid #E8E2DB' }}>
                  <span style={{ fontSize: '0.75rem', color: '#8A7B72', minWidth: 20 }}>#{i + 1}</span>
                  <img src={img.url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} onError={e => { e.target.style.display = 'none' }} />
                  <span style={{ flex: 1, fontSize: '0.75rem', color: '#5C4A3E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.url}</span>
                  <button onClick={() => deleteImage(img.id)} style={S.btnDanger}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="https://..." style={{ ...S.input, flex: 1 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addImage() } }} />
            <button onClick={addImage} style={S.btnSmall}>Add</button>
          </div>
        </div>

        {/* Variants */}
        <div style={S.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ ...S.sectionTitle, margin: 0 }}>Colour Variants ({variants.length})</h3>
            <button onClick={addVariant} style={S.btnSmall}>+ Add Colour</button>
          </div>

          {variants.map((variant, vi) => (
            <div key={variant.id || `new-${vi}`} style={{ background: '#fff', border: '1px solid #E8E2DB', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Colour</label>
                  <input value={variant.colour} onChange={e => updateLocalVariant(vi, 'colour', e.target.value)} style={S.input} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Image URL</label>
                  <input value={variant.imageUrl || ''} onChange={e => updateLocalVariant(vi, 'imageUrl', e.target.value)} style={S.input} placeholder="optional" />
                </div>
                <button onClick={() => saveVariant(variant)} style={S.btnSmall}>Save</button>
                {variant.id && <button onClick={() => deleteVariant(variant.id)} style={S.btnDanger}>Delete</button>}
              </div>

              {/* Sizes */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8A7B72' }}>SIZES</span>
                  <button onClick={() => addLocalSize(vi)} style={{ ...S.btnSmall, fontSize: '0.6875rem', padding: '0.125rem 0.375rem' }}>+ Size</button>
                </div>
                {variant.sizes.length === 0 && <p style={{ fontSize: '0.75rem', color: '#8A7B72', margin: '0.25rem 0' }}>No sizes yet</p>}
                {variant.sizes.map((size, si) => (
                  <div key={size.id || `new-size-${si}`} style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <input value={size.size} onChange={e => updateLocalSize(vi, si, 'size', e.target.value)} placeholder="e.g. M" style={{ ...S.input, width: 60 }} />
                    <input type="number" value={size.quantity} onChange={e => updateLocalSize(vi, si, 'quantity', e.target.value)} placeholder="qty" style={{ ...S.input, width: 60 }} />
                    {size.id && <button onClick={() => deleteSize(variant.id, size.id)} style={{ ...S.btnDanger, fontSize: '0.6875rem' }}>x</button>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Product Row ──

function ProductRow({ product, onUpdate, onDelete, onEdit }) {
  const statusColor = product.status === 'published'
    ? { background: '#DEF7EC', color: '#03543F' }
    : { background: '#FEF3C7', color: '#92400E' }

  const handleDelete = async () => {
    if (!confirm(`Delete "${product.name}"?`)) return
    const res = await api(`/api/products/${product.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) onDelete(product.id)
    else alert(data.error || 'Failed to delete')
  }

  return (
    <tr style={{ borderBottom: '1px solid #E8E2DB' }}>
      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#2C2420' }}>{product.name}</td>
      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem', color: '#5C4A3E' }}>{formatPrice(product.price)}</td>
      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#8A7B72' }}>{product.category}</td>
      <td style={{ padding: '0.75rem 0.5rem' }}>
        <span style={{ ...statusColor, padding: '0.2rem 0.5rem', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 500 }}>{product.status}</span>
      </td>
      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#8A7B72' }}>
        {product.variants.length}c / {product.images.length}img
      </td>
      <td style={{ padding: '0.75rem 0.5rem', display: 'flex', gap: '0.375rem' }}>
        <button onClick={() => onEdit(product)} style={S.btnSecondary}>Edit</button>
        <button onClick={handleDelete} style={S.btnDanger}>Delete</button>
      </td>
    </tr>
  )
}

// ── Dashboard ──

function Dashboard({ onLogout }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const loadProducts = async () => {
    try {
      const res = await api('/api/products?all=1')
      if (res.ok) setProducts(await res.json())
    } catch (err) { console.error('Failed to load products:', err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadProducts() }, [])

  const handleUpdate = (updated) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
    if (editing?.id === updated.id) setEditing(updated)
  }

  const handleDelete = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const handleLogout = async () => {
    await api('/api/auth/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.5rem', fontWeight: 600, color: '#2C2420', margin: 0 }}>Genvio Exotic Apparel Admin</h1>
          <button onClick={handleLogout} style={{ ...S.btnSecondary, fontFamily: 'Inter, system-ui, sans-serif' }}>Sign Out</button>
        </div>

        {loading ? (
          <p style={{ color: '#8A7B72', fontSize: '0.875rem' }}>Loading products...</p>
        ) : products.length === 0 ? (
          <p style={{ color: '#8A7B72', fontSize: '0.875rem' }}>No products yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E2DB' }}>
              <thead>
                <tr style={{ background: '#F5F0EB', borderBottom: '1px solid #E8E2DB' }}>
                  {['Name', 'Price', 'Category', 'Status', 'Data', ''].map(h => (
                    <th key={h} style={{ padding: '0.625rem 0.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#8A7B72', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <ProductRow key={p.id} product={p} onUpdate={handleUpdate} onDelete={handleDelete} onEdit={setEditing} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ProductEditModal
          product={editing}
          onSave={handleUpdate}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ── Root ──

export default function AdminPage() {
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    api('/api/auth/me')
      .then(res => setAuthed(res.ok))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) return null
  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <Dashboard onLogout={() => setAuthed(false)} />
}
