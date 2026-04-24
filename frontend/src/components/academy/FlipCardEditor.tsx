import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { uploadAcademyAsset } from '@/lib/academy-api'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export interface FlipCardSide {
  text: string
  imageUrl: string
}

export interface FlipCardContent {
  front: FlipCardSide
  back: FlipCardSide
}

interface SideEditorProps {
  label: string
  side: FlipCardSide
  onChange: (side: FlipCardSide) => void
}

function SideEditor({ label, side, onChange }: SideEditorProps) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await uploadAcademyAsset(file)
      onChange({ ...side, imageUrl: url })
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">{label}</p>
      <div className="space-y-1.5">
        <Label className="text-xs">Text</Label>
        <Textarea
          placeholder={`${label} text`}
          value={side.text}
          onChange={(e) => onChange({ ...side, text: e.target.value })}
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Image (optional)</Label>
        {side.imageUrl ? (
          <div className="relative">
            <img
              src={side.imageUrl}
              alt={label}
              className="h-32 w-full rounded-md object-cover"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute right-1 top-1 h-6 w-6"
              onClick={() => onChange({ ...side, imageUrl: '' })}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <ImagePlus className="mr-1 h-3 w-3" />
            )}
            Upload image
          </Button>
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
    </div>
  )
}

interface Props {
  content: FlipCardContent
  onChange: (content: FlipCardContent) => void
}

export function FlipCardEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <SideEditor
        label="Front"
        side={content.front}
        onChange={(front) => onChange({ ...content, front })}
      />
      <SideEditor
        label="Back"
        side={content.back}
        onChange={(back) => onChange({ ...content, back })}
      />
    </div>
  )
}

export const defaultFlipCardContent = (): FlipCardContent => ({
  front: { text: '', imageUrl: '' },
  back: { text: '', imageUrl: '' },
})
