import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Globe,
  GripVertical,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DragEndEvent } from '@dnd-kit/core'
import type {
  AcademyCourse,
  AcademyItem,
  AcademySection,
} from '@/lib/academy-api'
import { can } from '@/lib/permissions'
import {
  createCourse,
  getCourse,
  publishCourse,
  unpublishCourse,
  updateCourse,
  uploadAcademyAsset,
} from '@/lib/academy-api'
import { ItemEditorSheet } from '@/components/academy/ItemEditorSheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export const Route = createFileRoute(
  '/_appbar/_sidebar/academy/courses/$courseId',
)({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('academy.courses', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

// Local draft types with stable DnD IDs
type DraftItem = AcademyItem & { localId: string }
type DraftSection = Omit<AcademySection, 'items'> & {
  localId: string
  items: Array<DraftItem>
  expanded: boolean
}

function toLocalSection(s: AcademySection, index: number): DraftSection {
  return {
    ...s,
    localId: s._id ?? `new-section-${Date.now()}-${index}`,
    expanded: true,
    items: s.items.map((item, i) => ({
      ...item,
      localId: item._id ?? `new-item-${Date.now()}-${i}`,
    })),
  }
}

function fromDraftToPayload(
  draft: Omit<AcademyCourse, '_id' | 'createdAt' | 'updatedAt'> & {
    sections: Array<DraftSection>
  },
) {
  return {
    title: draft.title,
    description: draft.description,
    thumbnail: draft.thumbnail,
    status: draft.status,
    sections: draft.sections.map((s, si) => ({
      _id: s._id,
      title: s.title,
      order: si,
      type: s.type,
      items: s.items.map((item, ii) => ({
        _id: item._id,
        type: item.type,
        order: ii,
        content: item.content,
      })),
    })),
  }
}

const ITEM_TYPE_LABELS: Record<AcademyItem['type'], string> = {
  video: 'Video',
  mcq: 'MCQ',
  'flip-card': 'Flip Card',
  hotspot: 'Hotspot',
  ordering: 'Ordering',
  matching: 'Matching',
}

// ── Sortable item row ──────────────────────────────────────────────────────────
interface SortableItemRowProps {
  item: DraftItem
  onEdit: () => void
  onDelete: () => void
}

function SortableItemRow({ item, onEdit, onDelete }: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.localId })

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Badge variant="outline" className="shrink-0 text-xs">
        {ITEM_TYPE_LABELS[item.type]}
      </Badge>
      <span className="flex-1 truncate text-muted-foreground">
        {getItemSummary(item)}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function getItemSummary(item: DraftItem): string {
  const c = item.content
  switch (item.type) {
    case 'video':
      return (c.title as string) || (c.url as string) || 'Untitled video'
    case 'mcq':
      return (c.question as string) || 'Untitled question'
    case 'flip-card':
      return (
        ((c.front as Record<string, unknown>).text as string) ||
        'Untitled flip card'
      )
    case 'hotspot':
      return 'Hotspot image'
    case 'ordering':
      return (c.prompt as string) || 'Ordering activity'
    case 'matching':
      return (c.prompt as string) || 'Matching activity'
  }
}

// ── Sortable section card ──────────────────────────────────────────────────────
interface SortableSectionCardProps {
  section: DraftSection
  onUpdate: (patch: Partial<DraftSection>) => void
  onDelete: () => void
  onAddItem: () => void
  onEditItem: (item: DraftItem) => void
  onDeleteItem: (localId: string) => void
  onItemDragEnd: (event: DragEndEvent) => void
}

function SortableSectionCard({
  section,
  onUpdate,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onItemDragEnd,
}: SortableSectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: section.localId })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const itemSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="text-muted-foreground"
          onClick={() => onUpdate({ expanded: !section.expanded })}
        >
          {section.expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <Input
          className="h-8 flex-1 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0"
          value={section.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Section title"
        />
        <Select
          value={section.type}
          onValueChange={(v) => onUpdate({ type: v as 'lesson' | 'test' })}
        >
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lesson">Lesson</SelectItem>
            <SelectItem value="test">Test</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onAddItem}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Item
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Items */}
      {section.expanded && (
        <div className="space-y-1.5 border-t px-4 pb-3 pt-2">
          {section.items.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No items yet — click "Add Item" to start building.
            </p>
          ) : (
            <DndContext
              sensors={itemSensors}
              collisionDetection={closestCenter}
              onDragEnd={onItemDragEnd}
            >
              <SortableContext
                items={section.items.map((i) => i.localId)}
                strategy={verticalListSortingStrategy}
              >
                {section.items.map((item) => (
                  <SortableItemRow
                    key={item.localId}
                    item={item}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item.localId)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main builder page ──────────────────────────────────────────────────────────
function RouteComponent() {
  const { courseId } = Route.useParams()
  const isNew = courseId === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Draft state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [sections, setSections] = useState<Array<DraftSection>>([])
  const [loaded, setLoaded] = useState(isNew)

  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const thumbnailFileRef = useRef<HTMLInputElement>(null)

  const handleThumbnailUpload = async (file: File) => {
    setThumbnailUploading(true)
    try {
      const { url } = await uploadAcademyAsset(file)
      setThumbnail(url)
    } catch {
      toast.error('Upload failed')
    } finally {
      setThumbnailUploading(false)
    }
  }

  // Item editor sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DraftItem | null>(null)
  const [editingSectionLocalId, setEditingSectionLocalId] = useState<
    string | null
  >(null)

  // Load existing course
  const { data: courseData } = useQuery({
    queryKey: ['academy', 'course', courseId],
    queryFn: () => getCourse(courseId),
    enabled: !isNew,
  })

  useEffect(() => {
    if (courseData && !loaded) {
      setTitle(courseData.title)
      setDescription(courseData.description)
      setThumbnail(courseData.thumbnail)
      setStatus(courseData.status)
      setSections(courseData.sections.map(toLocalSection))
      setLoaded(true)
    }
  }, [courseData, loaded])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = fromDraftToPayload({
        title,
        description,
        thumbnail,
        status,
        sections,
      })
      if (isNew) return createCourse(payload)
      return updateCourse(courseId, payload)
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'courses'] })
      toast.success('Course saved')
      if (isNew) {
        navigate({
          to: '/academy/courses/$courseId',
          params: { courseId: saved._id },
          replace: true,
        })
      } else {
        queryClient.setQueryData(['academy', 'course', courseId], saved)
      }
    },
    onError: () => toast.error('Failed to save course'),
  })

  const publishMutation = useMutation({
    mutationFn: () =>
      status === 'published'
        ? unpublishCourse(courseId)
        : publishCourse(courseId),
    onSuccess: (saved) => {
      setStatus(saved.status)
      queryClient.invalidateQueries({ queryKey: ['academy', 'courses'] })
      toast.success(saved.status === 'published' ? 'Published' : 'Unpublished')
    },
    onError: () => toast.error('Failed to update publish status'),
  })

  // Section drag-and-drop
  const sectionSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.localId === active.id)
    const newIndex = sections.findIndex((s) => s.localId === over.id)
    setSections((prev) => arrayMove(prev, oldIndex, newIndex))
  }

  const addSection = () => {
    const localId = `new-section-${Date.now()}`
    setSections((prev) => [
      ...prev,
      {
        localId,
        title: 'New Section',
        order: prev.length,
        type: 'lesson',
        items: [],
        expanded: true,
      },
    ])
  }

  const updateSection = (localId: string, patch: Partial<DraftSection>) =>
    setSections((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)),
    )

  const deleteSection = (localId: string) =>
    setSections((prev) => prev.filter((s) => s.localId !== localId))

  const handleItemDragEnd = useCallback(
    (sectionLocalId: string, event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      setSections((prev) =>
        prev.map((s) => {
          if (s.localId !== sectionLocalId) return s
          const oldIndex = s.items.findIndex((i) => i.localId === active.id)
          const newIndex = s.items.findIndex((i) => i.localId === over.id)
          return { ...s, items: arrayMove(s.items, oldIndex, newIndex) }
        }),
      )
    },
    [],
  )

  const openAddItem = (sectionLocalId: string) => {
    setEditingSectionLocalId(sectionLocalId)
    setEditingItem(null)
    setSheetOpen(true)
  }

  const openEditItem = (sectionLocalId: string, item: DraftItem) => {
    setEditingSectionLocalId(sectionLocalId)
    setEditingItem(item)
    setSheetOpen(true)
  }

  const handleItemSave = (saved: AcademyItem) => {
    if (!editingSectionLocalId) return
    setSections((prev) =>
      prev.map((s) => {
        if (s.localId !== editingSectionLocalId) return s
        if (!editingItem) {
          // new item
          const newItem: DraftItem = {
            ...saved,
            localId: `new-item-${Date.now()}`,
            order: s.items.length,
          }
          return { ...s, items: [...s.items, newItem] }
        }
        // update existing
        return {
          ...s,
          items: s.items.map((i) =>
            i.localId === editingItem.localId
              ? { ...i, type: saved.type, content: saved.content }
              : i,
          ),
        }
      }),
    )
    setSheetOpen(false)
  }

  const deleteItem = (sectionLocalId: string, itemLocalId: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.localId === sectionLocalId
          ? { ...s, items: s.items.filter((i) => i.localId !== itemLocalId) }
          : s,
      ),
    )

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/academy/courses' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          className="h-8 flex-1 border-0 bg-transparent p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          placeholder="Course title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Badge variant={status === 'published' ? 'default' : 'secondary'}>
          {status}
        </Badge>
        {!isNew && can('academy.courses', 'update') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
          >
            {status === 'published' ? (
              <>
                <EyeOff className="mr-1 h-3.5 w-3.5" />
                Unpublish
              </>
            ) : (
              <>
                <Globe className="mr-1 h-3.5 w-3.5" />
                Publish
              </>
            )}
          </Button>
        )}
        {can('academy.courses', isNew ? 'create' : 'update') && (
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim()}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            Save
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Metadata */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="What will learners get from this course?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Thumbnail</Label>
              {thumbnail ? (
                <div className="relative">
                  <img
                    src={thumbnail}
                    alt="Thumbnail preview"
                    className="h-36 w-full rounded-md object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => setThumbnail('')}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={thumbnailUploading}
                    onClick={() => thumbnailFileRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {thumbnailUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <ImagePlus className="h-6 w-6" />
                    )}
                    {thumbnailUploading
                      ? 'Uploading…'
                      : 'Upload thumbnail image'}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    or paste a URL
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <Input
                    placeholder="https://..."
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                  />
                </div>
              )}
              <input
                ref={thumbnailFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleThumbnailUpload(file)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Sections
              </h2>
              <Button variant="outline" size="sm" onClick={addSection}>
                <Plus className="mr-1 h-3 w-3" />
                Add Section
              </Button>
            </div>

            {sections.length === 0 ? (
              <div
                className={cn(
                  'rounded-lg border-2 border-dashed p-10 text-center text-muted-foreground',
                )}
              >
                <p className="text-sm">No sections yet.</p>
                <p className="text-xs">
                  Add a section to start building your course.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sectionSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSectionDragEnd}
              >
                <SortableContext
                  items={sections.map((s) => s.localId)}
                  strategy={verticalListSortingStrategy}
                >
                  {sections.map((section) => (
                    <SortableSectionCard
                      key={section.localId}
                      section={section}
                      onUpdate={(patch) =>
                        updateSection(section.localId, patch)
                      }
                      onDelete={() => deleteSection(section.localId)}
                      onAddItem={() => openAddItem(section.localId)}
                      onEditItem={(item) => openEditItem(section.localId, item)}
                      onDeleteItem={(itemLocalId) =>
                        deleteItem(section.localId, itemLocalId)
                      }
                      onItemDragEnd={(e) =>
                        handleItemDragEnd(section.localId, e)
                      }
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Item editor sheet */}
      <ItemEditorSheet
        open={sheetOpen}
        item={editingItem}
        onSave={handleItemSave}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
