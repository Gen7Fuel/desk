import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileVideo } from 'lucide-react'
import { getAcademyMedia, getAcademyMediaSasUrl } from '@/lib/academy-api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface VideoContent {
  url: string
  title: string
  description: string
}

interface Props {
  content: VideoContent
  onChange: (content: VideoContent) => void
}

const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'mov'])

function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (fullPath: string) => Promise<void>
}) {
  const [selecting, setSelecting] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['academy-media'],
    queryFn: getAcademyMedia,
    enabled: open,
  })

  const videoFiles = (data ?? []).filter((f) => VIDEO_EXTS.has(getExt(f.name)))

  async function handleSelect(fullPath: string) {
    setSelecting(fullPath)
    try {
      await onSelect(fullPath)
    } finally {
      setSelecting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Video from Media Library</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading media…</p>
        )}

        {!isLoading && videoFiles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No video files found in the media library.
          </p>
        )}

        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {videoFiles.map((file) => (
            <button
              key={file.fullPath}
              disabled={!!selecting}
              onClick={() => void handleSelect(file.fullPath)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              <FileVideo className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="flex-1 truncate font-mono">{file.name}</span>
              {selecting === file.fullPath && (
                <span className="text-xs text-muted-foreground">Loading…</span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function VideoEditor({ content, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const update = (patch: Partial<VideoContent>) =>
    onChange({ ...content, ...patch })

  // Derive a display name from the stored URL
  const selectedName = content.url
    ? decodeURIComponent(
        content.url.split('/').pop()?.split('?')[0] ?? content.url,
      )
    : null

  async function handleSelect(fullPath: string) {
    const url = await getAcademyMediaSasUrl(fullPath)
    update({ url })
    setPickerOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Video</Label>

        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span
            className="flex-1 truncate text-sm text-muted-foreground"
            title={selectedName ?? undefined}
          >
            {selectedName ?? 'No video selected'}
          </span>
          {content.url && (
            <button
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => update({ url: '' })}
            >
              Clear
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setPickerOpen(true)}
        >
          Select from Media Library
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input
          placeholder="Video title"
          value={content.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          placeholder="Optional description or transcript"
          value={content.description}
          onChange={(e) => update({ description: e.target.value })}
          rows={4}
        />
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  )
}

export const defaultVideoContent = (): VideoContent => ({
  url: '',
  title: '',
  description: '',
})
