const CDN_BASE = 'https://app.gen7fuel.com'
const CDN_TOKEN = 'ede76ab3d1bfcdbaf17c99751df9539dc7f6c00265a80a7073b52db572a4fbea'

export interface CdnFile {
  filename: string
  size: number
  lastModified: string
}

export async function getCdnFiles(): Promise<Array<CdnFile>> {
  const res = await fetch(`${CDN_BASE}/cdn/files`, {
    headers: { Authorization: `Bearer ${CDN_TOKEN}` },
  })
  if (!res.ok) throw new Error('Failed to fetch CDN files')
  return res.json()
}

export async function deleteCdnFile(filename: string): Promise<void> {
  const res = await fetch(`${CDN_BASE}/cdn/delete/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CDN_TOKEN}` },
  })
  if (!res.ok) throw new Error('Failed to delete file')
}

export function getCdnDownloadUrl(filename: string): string {
  return `${CDN_BASE}/cdn/download/${encodeURIComponent(filename)}`
}
