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
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import type { DragEndEvent } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface OrderingItem {
  id: string
  text: string
}

export interface OrderingContent {
  prompt: string
  items: Array<OrderingItem>
}

interface SortableRowProps {
  item: OrderingItem
  index: number
  onChange: (text: string) => void
  onDelete: () => void
}

function SortableRow({ item, index, onChange, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
        {index + 1}
      </span>
      <Input
        value={item.text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Item ${index + 1}`}
      />
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

interface Props {
  content: OrderingContent
  onChange: (content: OrderingContent) => void
}

export function OrderingEditor({ content, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = content.items.findIndex((i) => i.id === active.id)
    const newIndex = content.items.findIndex((i) => i.id === over.id)
    onChange({
      ...content,
      items: arrayMove(content.items, oldIndex, newIndex),
    })
  }

  const addItem = () =>
    onChange({
      ...content,
      items: [...content.items, { id: crypto.randomUUID(), text: '' }],
    })

  const updateItem = (id: string, text: string) =>
    onChange({
      ...content,
      items: content.items.map((i) => (i.id === id ? { ...i, text } : i)),
    })

  const deleteItem = (id: string) =>
    onChange({ ...content, items: content.items.filter((i) => i.id !== id) })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Prompt</Label>
        <Textarea
          placeholder="Arrange the following steps in the correct order..."
          value={content.prompt}
          onChange={(e) => onChange({ ...content, prompt: e.target.value })}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Items (in correct order)</Label>
        <p className="text-xs text-muted-foreground">
          Drag to set the correct sequence. Hub users will see these shuffled.
        </p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={content.items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {content.items.map((item, index) => (
              <SortableRow
                key={item.id}
                item={item}
                index={index}
                onChange={(text) => updateItem(item.id, text)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-1 h-3 w-3" />
          Add Item
        </Button>
      </div>
    </div>
  )
}

export const defaultOrderingContent = (): OrderingContent => ({
  prompt: '',
  items: [
    { id: crypto.randomUUID(), text: '' },
    { id: crypto.randomUUID(), text: '' },
    { id: crypto.randomUUID(), text: '' },
  ],
})
