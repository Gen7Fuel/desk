import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileVideo,
  Image,
  Pause,
  Play,
  Search,
  Square,
  Upload,
  X,
} from 'lucide-react'
import type { AcademyMediaFile } from '@/lib/academy-api'
import { getAcademyMedia, uploadAcademyMedia } from '@/lib/academy-api'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/academy/media')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('academy.courses', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif',
])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'mov'])

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`
  return `${bytes} B`
}

function fmtTime(s: number): string {
  if (!isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = getExt(name)
  if (VIDEO_EXTS.has(ext)) return <FileVideo className="h-4 w-4 text-blue-500" />
  if (IMAGE_EXTS.has(ext)) return <Image className="h-4 w-4 text-green-500" />
  return <Image className="h-4 w-4 text-muted-foreground" />
}

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Reset when src changes
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [src])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  function stop() {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = 0
    setPlaying(false)
    setCurrentTime(0)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current
    if (!v) return
    const t = Number(e.target.value)
    v.currentTime = t
    setCurrentTime(t)
  }

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={videoRef}
        src={src}
        className="w-full rounded-md bg-black"
        onTimeUpdate={() =>
          setCurrentTime(videoRef.current?.currentTime ?? 0)
        }
        onDurationChange={() =>
          setDuration(videoRef.current?.duration ?? 0)
        }
        onEnded={() => {
          setPlaying(false)
          setCurrentTime(0)
          if (videoRef.current) videoRef.current.currentTime = 0
        }}
      />

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.01}
        value={currentTime}
        onChange={handleSeek}
        className="w-full cursor-pointer accent-primary"
      />

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={togglePlay}>
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button size="sm" variant="outline" onClick={stop}>
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      </div>
    </div>
  )
}

function PreviewPanel({
  file,
  onClose,
}: {
  file: AcademyMediaFile
  onClose: () => void
}) {
  const ext = getExt(file.name)
  const isVideo = VIDEO_EXTS.has(ext)
  const isImage = IMAGE_EXTS.has(ext)

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="truncate font-mono text-sm font-medium" title={file.name}>
          {file.name}
        </span>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-4">
        {isVideo && <VideoPlayer key={file.url} src={file.url} />}

        {isImage && (
          <img
            src={file.url}
            alt={file.name}
            className="w-full rounded-md object-contain"
          />
        )}

        {!isVideo && !isImage && (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            No preview available
          </div>
        )}

        {/* Metadata */}
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Size</dt>
            <dd>{formatSize(file.size)}</dd>
          </div>
          {file.contentType && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-mono text-xs">{file.contentType}</dd>
            </div>
          )}
          {file.lastModified && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Modified</dt>
              <dd>{new Date(file.lastModified).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<AcademyMediaFile | null>(null)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['academy-media'],
    queryFn: getAcademyMedia,
  })

  const files = (data ?? []).filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadError('')
    try {
      await uploadAcademyMedia(file)
      await queryClient.invalidateQueries({ queryKey: ['academy-media'] })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: file browser ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">Academy Media</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>

        {uploadError && (
          <p className="mx-6 mb-2 text-sm text-destructive">{uploadError}</p>
        )}

        {/* Search */}
        <div className="relative mx-6 mb-4">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {error && (
            <p className="text-sm text-red-500">Failed to load media.</p>
          )}

          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
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
                    className={`cursor-pointer ${selectedFile?.fullPath === file.fullPath ? 'bg-muted' : ''}`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <TableCell>
                      <FileTypeIcon name={file.name} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {file.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatSize(file.size)}
                    </TableCell>
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
        </div>
      </div>

      {/* ── Right: preview panel ── */}
      {selectedFile && (
        <div className="w-[420px] shrink-0">
          <PreviewPanel
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
          />
        </div>
      )}
    </div>
  )
}
