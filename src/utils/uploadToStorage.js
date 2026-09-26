import { signUpload } from '../api/admin'

// Sign-then-push, called once per individual file. Never reuses a signed
// URL across images — POST /api/admin/upload/sign is called immediately
// before every single push to Storage (front photo, back photo, front
// card, back card, each Mode B upload), each for its own server-generated
// path. `kind` is 'raw' for a camera photo or 'card' for a finished
// product-card/gallery image (server-side folder label only).
export async function uploadProductFile(file, kind) {
  const { uploadUrl, publicUrl } = await signUpload(kind, file.type)
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) throw new Error(`Upload to storage failed (${res.status})`)
  return publicUrl
}
