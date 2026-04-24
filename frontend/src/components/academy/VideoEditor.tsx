import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface VideoContent {
  url: string
  title: string
  description: string
}

interface Props {
  content: VideoContent
  onChange: (content: VideoContent) => void
}

export function VideoEditor({ content, onChange }: Props) {
  const update = (patch: Partial<VideoContent>) =>
    onChange({ ...content, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Video URL</Label>
        <Input
          placeholder="https://..."
          value={content.url}
          onChange={(e) => update({ url: e.target.value })}
        />
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
    </div>
  )
}

export const defaultVideoContent = (): VideoContent => ({
  url: '',
  title: '',
  description: '',
})
