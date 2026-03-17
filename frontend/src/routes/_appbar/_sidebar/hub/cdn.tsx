import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Search, Trash2, Upload, X } from 'lucide-react'
import type {CdnFile} from '@/lib/cdn-api';
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CdnExportMonth } from '@/lib/cdn-api'
import { backupCdnMonth, deleteCdnFile, getCdnExportMonths, getCdnDownloadUrl, getCdnFiles, searchCdnFiles } from '@/lib/cdn-api'

export const Route = createFileRoute('/_appbar/_sidebar/hub/cdn')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.cdn', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`
  return `${bytes} B`
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

function RouteComponent() {
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<CdnFile | null>(null)
  const [page, setPage] = useState(1)
  const [exportOpen, setExportOpen] = useState(false)
  const [months, setMonths] = useState<CdnExportMonth[]>([])
  const [loadingMonths, setLoadingMonths] = useState(false)
  const [backingUpMonth, setBackingUpMonth] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<CdnFile | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  async function openExportDialog() {
    setExportOpen(true)
    setLoadingMonths(true)
    try {
      setMonths(await getCdnExportMonths())
    } catch (err) {
      console.error('Failed to load months:', err)
      alert(`Failed to load months: ${err instanceof Error ? err.message : String(err)}`)
      setExportOpen(false)
    } finally {
      setLoadingMonths(false)
    }
  }

  async function handleBackupMonth(month: string) {
    setBackingUpMonth(month)
    try {
      const message = await backupCdnMonth(month)
      alert(message)
    } catch (err) {
      console.error('Backup failed:', err)
      alert(`Backup failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBackingUpMonth(null)
    }
  }

  const isSearching = searchQuery.length > 0

  const { data, isLoading, error } = useQuery({
    queryKey: isSearching ? ['cdn-search', searchQuery] : ['cdn-files', page],
    queryFn: () => isSearching ? searchCdnFiles(searchQuery) : getCdnFiles(page),
  })

  const files = data?.files || []
  const totalFiles = data?.totalFiles || 0
  const totalPages = isSearching ? 1 : (data as any)?.totalPages || 0
  const currentPage = isSearching ? 1 : (data as any)?.currentPage || 0

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => deleteCdnFile(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isSearching ? ['cdn-search', searchQuery] : ['cdn-files', page] })
      setPendingDelete(null)
    },
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">CDN Panel</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {totalFiles} file{totalFiles !== 1 ? 's' : ''}
          </span>
          <Button variant="outline" size="sm" onClick={openExportDialog} disabled={isLoading}>
            <Upload className="h-4 w-4" />
            Backup
          </Button>
        </div>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search files…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8 pr-8"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-500">Failed to load files.</p>}

      {!isLoading && !error && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No files found.
                  </TableCell>
                </TableRow>
              )}
              {files.map((file) => (
                <TableRow
                  key={file.filename}
                  className="cursor-pointer"
                  onClick={() => setPreviewFile(file)}
                >
                  <TableCell className="font-mono text-sm">{file.filename}</TableCell>
                  <TableCell className="text-sm">{formatSize(file.size)}</TableCell>
                  <TableCell className="text-sm">{new Date(file.lastModified).toLocaleString()}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(getCdnDownloadUrl(file.filename), '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      {can('hub.cdn', 'delete') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDelete(file)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isSearching && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!data || currentPage <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!data || currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null) }}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-3xl w-full rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="font-mono text-sm font-medium truncate">{previewFile?.filename}</DialogTitle>
            {previewFile && (() => {
              const ext = previewFile.filename.split('.').pop()?.toLowerCase() ?? ''
              const isImage = IMAGE_EXTS.has(ext)
              return isImage ? (
                <img
                  src={getCdnDownloadUrl(previewFile.filename)}
                  alt={previewFile.filename}
                  className="mt-4 max-h-[70vh] w-full rounded object-contain"
                />
              ) : (
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div><span className="font-medium text-foreground">Type</span>: {ext.toUpperCase() || 'Unknown'}</div>
                  <div><span className="font-medium text-foreground">Size</span>: {formatSize(previewFile.size)}</div>
                  <div><span className="font-medium text-foreground">Last Modified</span>: {new Date(previewFile.lastModified).toLocaleString()}</div>
                </div>
              )
            })()}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={(open) => { if (!open && !backingUpMonth) setExportOpen(false) }}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-md w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg max-h-[80vh] overflow-y-auto">
            <DialogTitle className="text-base font-semibold">Backup by Month</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Back up CDN files to Azure Storage as a .tar archive per month.
            </DialogDescription>
            {loadingMonths && <p className="text-sm text-muted-foreground">Loading months…</p>}
            {!loadingMonths && months.length === 0 && <p className="text-sm text-muted-foreground">No files found.</p>}
            {!loadingMonths && months.length > 0 && (
              <div className="space-y-2">
                {months.map((m) => (
                  <div key={m.month} className="flex items-center justify-between rounded border px-3 py-2">
                    <div>
                      <span className="text-sm font-medium">{m.month}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {m.fileCount} file{m.fileCount !== 1 ? 's' : ''} · {formatSize(m.totalSize)}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!backingUpMonth}
                      onClick={() => handleBackupMonth(m.month)}
                    >
                      <Upload className="h-3 w-3" />
                      {backingUpMonth === m.month ? 'Backing up…' : 'Backup'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" disabled={!!backingUpMonth}>Close</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold">Delete file?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will permanently delete <strong className="font-mono">{pendingDelete?.filename}</strong>. This action cannot be undone.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => { if (pendingDelete) deleteMutation.mutate(pendingDelete.filename) }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
