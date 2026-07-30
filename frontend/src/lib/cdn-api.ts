const CDN_BASE = import.meta.env.VITE_CDN_BASE as string

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
  const { apiFetch } = await import('@/lib/api')
  const res = await apiFetch(`/api/cdn/files?page=${page}`)
  const data = await res.json()
  if (!res.ok)
    throw new Error(data?.message ?? `Failed to fetch CDN files (${res.status})`)
  return data
}

export async function deleteCdnFile(filename: string): Promise<void> {
  const { apiFetch } = await import('@/lib/api')
  const res = await apiFetch(`/api/cdn/delete/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.message ?? `Failed to delete file (${res.status})`)
  }
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
  const data = await res.json()
  if (!res.ok)
    throw new Error(
      data?.message ?? `Failed to fetch export months (${res.status})`,
    )
  return data.months
}

export async function deleteCdnMonth(
  month: string,
): Promise<{ message: string; deleted: number; total: number }> {
  const { apiFetch } = await import('@/lib/api')
  const res = await apiFetch(
    `/api/cdn/delete-month?month=${encodeURIComponent(month)}`,
    { method: 'DELETE' },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? `Delete failed (${res.status})`)
  return data
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
