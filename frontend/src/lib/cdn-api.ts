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
  const res = await fetch(`${CDN_BASE}/cdn/delete/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CDN_TOKEN}` },
  })
  if (!res.ok) throw new Error('Failed to delete file')
}

export function getCdnDownloadUrl(filename: string): string {
  return `${CDN_BASE}/cdn/download/${encodeURIComponent(filename)}`
}

export async function exportAllCdnFiles(
  onProgress?: (downloaded: number, total: number) => void,
): Promise<Blob> {
  // Fetch all pages to collect every filename
  const first = await getCdnFiles(1)
  let allFiles = [...first.files]
  for (let p = 2; p <= first.totalPages; p++) {
    const page = await getCdnFiles(p)
    allFiles = allFiles.concat(page.files)
  }

  // Lazy-import jszip only when needed
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i]
    const res = await fetch(`${CDN_BASE}/cdn/download/${encodeURIComponent(file.filename)}`, {
      headers: { Authorization: `Bearer ${CDN_TOKEN}` },
    })
    if (!res.ok) throw new Error(`Failed to download ${file.filename}`)
    zip.file(file.filename, await res.arrayBuffer())
    onProgress?.(i + 1, allFiles.length)
  }

  return zip.generateAsync({ type: 'blob' })
}
