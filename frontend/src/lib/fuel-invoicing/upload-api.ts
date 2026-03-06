export async function uploadToAzure(
  base64: string,
  filename: string,
): Promise<{ ok: boolean; message: string }> {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

  const rebuiltFile = new File([bytes], filename, { type: 'application/pdf' })
  const formData = new FormData()
  formData.append('file', rebuiltFile)

  const res = await fetch('/api/fuel-invoicing/upload', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    return { ok: false, message: body?.message ?? 'Upload failed.' }
  }

  return { ok: true, message: 'File uploaded successfully.' }
}
