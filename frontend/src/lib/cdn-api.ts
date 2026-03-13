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
  const url = `${CDN_BASE}/cdn/files?page=${page}`;
  console.log('Fetching CDN files from:', url);
  const res = await fetch(url, {
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
