import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Trash2 } from 'lucide-react'
import type {CdnFile} from '@/lib/cdn-api';
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
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
import {  deleteCdnFile, getCdnDownloadUrl, getCdnFiles } from '@/lib/cdn-api'

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

function RouteComponent() {
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<CdnFile | null>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['cdn-files', page],
    queryFn: () => getCdnFiles(page),
  })
  
  const files = data?.files || []

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => deleteCdnFile(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cdn-files', page] })
      setPendingDelete(null)
    },
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">CDN Panel</h1>
        <span className="text-sm text-muted-foreground">
          {data?.totalFiles || 0} file{data?.totalFiles !== 1 ? 's' : ''}
        </span>
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
                <TableRow key={file.filename}>
                  <TableCell className="font-mono text-sm">{file.filename}</TableCell>
                  <TableCell className="text-sm">{formatSize(file.size)}</TableCell>
                  <TableCell className="text-sm">{new Date(file.lastModified).toLocaleString()}</TableCell>
                  <TableCell>
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

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {data?.currentPage || 0} of {data?.totalPages || 0}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={!data || data.currentPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!data || data.currentPage >= data.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

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
