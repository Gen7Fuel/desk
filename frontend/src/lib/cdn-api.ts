const CDN_BASE = import.meta.env.VITE_CDN_BASE as string
const CDN_TOKEN = import.meta.env.VITE_CDN_ADMIN_TOKEN as string

export interface CdnFile {
  filename: string
  size: number
  lastModified: string
}

export interface CdnFileList {
  files: Array<CdnFile>
  totalFiles: number
  totalPages: number
  currentPage: number
}

export async function getCdnFiles(page = 1): Promise<CdnFileList> {
  const res = await fetch(`${CDN_BASE}/cdn/files?page=${page}`, {
    headers: { Authorization: `Bearer ${CDN_TOKEN}` },
  })
  if (!res.ok) throw new Error('Failed to fetch CDN files')
  return res.json()
}

export async function deleteCdnFile(filename: string): Promise<void> {
  const res = await fetch(
    `${CDN_BASE}/cdn/delete/${encodeURIComponent(filename)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${CDN_TOKEN}` },
    },
  )
  if (!res.ok) throw new Error('Failed to delete file')
}

export function getCdnDownloadUrl(filename: string): string {
  return `${CDN_BASE}/cdn/download/${encodeURIComponent(filename)}`
}

export interface CdnExportMonth {
  month: string
  fileCount: number
  totalSize: number
}

export async function searchCdnFiles(
  q: string,
): Promise<{ files: Array<CdnFile>; totalFiles: number }> {
  const { apiFetch } = await import('@/lib/api')
  const res = await apiFetch(`/api/cdn/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export async function getCdnExportMonths(): Promise<Array<CdnExportMonth>> {
  const { apiFetch } = await import('@/lib/api')
  const res = await apiFetch('/api/cdn/export/months')
  if (!res.ok) throw new Error('Failed to fetch export months')
  const data = await res.json()
  return data.months
}

export async function backupCdnMonth(month: string): Promise<string> {
  const { apiFetch } = await import('@/lib/api')
  const res = await apiFetch(
    `/api/cdn/backup?month=${encodeURIComponent(month)}`,
    {
      method: 'POST',
    },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? `Backup failed (${res.status})`)
  return data.message
}
