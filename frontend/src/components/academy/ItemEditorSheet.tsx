import { useState } from 'react'
import { VideoEditor, defaultVideoContent } from './VideoEditor'
import { MCQEditor, defaultMCQContent } from './MCQEditor'
import { FlipCardEditor, defaultFlipCardContent } from './FlipCardEditor'
import { HotspotEditor, defaultHotspotContent } from './HotspotEditor'
import { OrderingEditor, defaultOrderingContent } from './OrderingEditor'
import { MatchingEditor, defaultMatchingContent } from './MatchingEditor'
import type { AcademyItem } from '@/lib/academy-api'
import type { VideoContent } from './VideoEditor'
import type { MCQContent } from './MCQEditor'
import type { FlipCardContent } from './FlipCardEditor'
import type { HotspotContent } from './HotspotEditor'
import type { OrderingContent } from './OrderingEditor'
import type { MatchingContent } from './MatchingEditor'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const ITEM_TYPES: Array<{ value: AcademyItem['type']; label: string }> = [
  { value: 'video', label: 'Video' },
  { value: 'mcq', label: 'Multiple Choice (MCQ)' },
  { value: 'flip-card', label: 'Flip Card' },
  { value: 'hotspot', label: 'Hotspot on Image' },
  { value: 'ordering', label: 'Ordering' },
  { value: 'matching', label: 'Matching' },
]

function defaultContent(type: AcademyItem['type']): Record<string, unknown> {
  switch (type) {
    case 'video':
      return defaultVideoContent() as unknown as Record<string, unknown>
    case 'mcq':
      return defaultMCQContent() as unknown as Record<string, unknown>
    case 'flip-card':
      return defaultFlipCardContent() as unknown as Record<string, unknown>
    case 'hotspot':
      return defaultHotspotContent() as unknown as Record<string, unknown>
    case 'ordering':
      return defaultOrderingContent() as unknown as Record<string, unknown>
    case 'matching':
      return defaultMatchingContent() as unknown as Record<string, unknown>
  }
}

interface Props {
  open: boolean
  item: AcademyItem | null
  onSave: (item: AcademyItem) => void
  onClose: () => void
}

export function ItemEditorSheet({ open, item, onSave, onClose }: Props) {
  const isNew = !item
  const [type, setType] = useState<AcademyItem['type']>(item?.type ?? 'video')
  const [content, setContent] = useState<Record<string, unknown>>(
    item?.content ?? defaultContent(type),
  )

  const handleTypeChange = (t: AcademyItem['type']) => {
    setType(t)
    setContent(defaultContent(t))
  }

  const handleSave = () => {
    onSave({
      ...item,
      type,
      order: item?.order ?? 0,
      content,
    })
  }

  const renderEditor = () => {
    switch (type) {
      case 'video':
        return (
          <VideoEditor
            content={content as unknown as VideoContent}
            onChange={(c) =>
              setContent(c as unknown as Record<string, unknown>)
            }
          />
        )
      case 'mcq':
        return (
          <MCQEditor
            content={content as unknown as MCQContent}
            onChange={(c) =>
              setContent(c as unknown as Record<string, unknown>)
            }
          />
        )
      case 'flip-card':
        return (
          <FlipCardEditor
            content={content as unknown as FlipCardContent}
            onChange={(c) =>
              setContent(c as unknown as Record<string, unknown>)
            }
          />
        )
      case 'hotspot':
        return (
          <HotspotEditor
            content={content as unknown as HotspotContent}
            onChange={(c) =>
              setContent(c as unknown as Record<string, unknown>)
            }
          />
        )
      case 'ordering':
        return (
          <OrderingEditor
            content={content as unknown as OrderingContent}
            onChange={(c) =>
              setContent(c as unknown as Record<string, unknown>)
            }
          />
        )
      case 'matching':
        return (
          <MatchingEditor
            content={content as unknown as MatchingContent}
            onChange={(c) =>
              setContent(c as unknown as Record<string, unknown>)
            }
          />
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? 'Add Item' : 'Edit Item'}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 py-4">
          <div className="space-y-1.5">
            <Label>Item Type</Label>
            <Select
              value={type}
              onValueChange={(v) => handleTypeChange(v as AcademyItem['type'])}
              disabled={!isNew}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isNew && (
              <p className="text-xs text-muted-foreground">
                Type cannot be changed after creation.
              </p>
            )}
          </div>

          {renderEditor()}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isNew ? 'Add Item' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
