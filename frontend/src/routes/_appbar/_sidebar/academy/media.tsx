import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileVideo, Image, Search, X } from 'lucide-react'
import type { AcademyMediaFile } from '@/lib/academy-api'
import { getAcademyMedia } from '@/lib/academy-api'
import { can } from '@/lib/permissions'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/_appbar/_sidebar/academy/media')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('academy.courses', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'mov'])

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`
  return `${bytes} B`
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = getExt(name)
  if (VIDEO_EXTS.has(ext)) return <FileVideo className="h-4 w-4 text-blue-500" />
  if (IMAGE_EXTS.has(ext)) return <Image className="h-4 w-4 text-green-500" />
  return <Image className="h-4 w-4 text-muted-foreground" />
}

function MediaPreview({ file }: { file: AcademyMediaFile }) {
  const ext = getExt(file.name)
  if (VIDEO_EXTS.has(ext)) {
    return (
      <video
        src={file.url}
        controls
        className="mt-4 max-h-[70vh] w-full rounded"
      />
    )
  }
  if (IMAGE_EXTS.has(ext)) {
    return (
      <img
        src={file.url}
        alt={file.name}
        className="mt-4 max-h-[70vh] w-full rounded object-contain"
      />
    )
  }
  return (
    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
      <div>
        <span className="font-medium text-foreground">Type</span>:{' '}
        {ext.toUpperCase() || 'Unknown'}
      </div>
      <div>
        <span className="font-medium text-foreground">Size</span>:{' '}
        {formatSize(file.size)}
      </div>
      {file.lastModified && (
        <div>
          <span className="font-medium text-foreground">Last Modified</span>:{' '}
          {new Date(file.lastModified).toLocaleString()}
        </div>
      )}
    </div>
  )
}

function RouteComponent() {
  const [previewFile, setPreviewFile] = useState<AcademyMediaFile | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['academy-media'],
    queryFn: getAcademyMedia,
  })

  const files = (data ?? []).filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Academy Media</h1>
        <span className="text-sm text-muted-foreground">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-8"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-500">Failed to load media.</p>}

      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Last Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-sm text-muted-foreground"
                >
                  No files found.
                </TableCell>
              </TableRow>
            )}
            {files.map((file) => (
              <TableRow
                key={file.fullPath}
                className="cursor-pointer"
                onClick={() => setPreviewFile(file)}
              >
                <TableCell>
                  <FileTypeIcon name={file.name} />
                </TableCell>
                <TableCell className="font-mono text-sm">{file.name}</TableCell>
                <TableCell className="text-sm">{formatSize(file.size)}</TableCell>
                <TableCell className="text-sm">
                  {file.lastModified
                    ? new Date(file.lastModified).toLocaleString()
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={!!previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-3xl w-full rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="font-mono text-sm font-medium truncate">
              {previewFile?.name}
            </DialogTitle>
            {previewFile && <MediaPreview file={previewFile} />}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
