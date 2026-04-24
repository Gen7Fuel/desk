import { useRef, useState } from 'react'
import { ImagePlus, Loader2, MapPin, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { uploadAcademyAsset } from '@/lib/academy-api'

export interface Hotspot {
  id: string
  x: number
  y: number
  label: string
  description: string
}

export interface HotspotContent {
  imageUrl: string
  hotspots: Array<Hotspot>
}

interface Props {
  content: HotspotContent
  onChange: (content: HotspotContent) => void
}

export function HotspotEditor({ content, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const selected = content.hotspots.find((h) => h.id === selectedId) ?? null

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await uploadAcademyAsset(file)
      onChange({ ...content, imageUrl: url })
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return
    const rect = imageRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const newPin: Hotspot = {
      id: crypto.randomUUID(),
      x,
      y,
      label: 'New hotspot',
      description: '',
    }
    const updated = { ...content, hotspots: [...content.hotspots, newPin] }
    onChange(updated)
    setSelectedId(newPin.id)
  }

  const updateHotspot = (id: string, patch: Partial<Hotspot>) =>
    onChange({
      ...content,
      hotspots: content.hotspots.map((h) =>
        h.id === id ? { ...h, ...patch } : h,
      ),
    })

  const deleteHotspot = (id: string) => {
    onChange({
      ...content,
      hotspots: content.hotspots.filter((h) => h.id !== id),
    })
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="space-y-4">
      {!content.imageUrl ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10">
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Upload a background image, then click to place hotspots
          </p>
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" />
            )}
            Upload image
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Click on the image to place a hotspot
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ imageUrl: '', hotspots: [] })}
            >
              <X className="mr-1 h-3 w-3" />
              Remove image
            </Button>
          </div>
          <div
            ref={imageRef}
            className="relative cursor-crosshair overflow-hidden rounded-lg border"
            onClick={handleImageClick}
          >
            <img
              src={content.imageUrl}
              alt="Hotspot background"
              className="w-full"
              draggable={false}
            />
            {content.hotspots.map((pin) => (
              <button
                key={pin.id}
                type="button"
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-md transition-transform hover:scale-110"
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedId(pin.id === selectedId ? null : pin.id)
                }}
              >
                <MapPin className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Edit Hotspot</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => deleteHotspot(selected.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={selected.label}
              onChange={(e) =>
                updateHotspot(selected.id, { label: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={selected.description}
              onChange={(e) =>
                updateHotspot(selected.id, { description: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>
      )}

      {content.imageUrl && content.hotspots.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Click the image above to add hotspots
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export const defaultHotspotContent = (): HotspotContent => ({
  imageUrl: '',
  hotspots: [],
})
