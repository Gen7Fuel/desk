import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface MatchingPair {
  id: string
  left: string
  right: string
}

export interface MatchingContent {
  prompt: string
  pairs: Array<MatchingPair>
}

interface Props {
  content: MatchingContent
  onChange: (content: MatchingContent) => void
}

export function MatchingEditor({ content, onChange }: Props) {
  const addPair = () =>
    onChange({
      ...content,
      pairs: [
        ...content.pairs,
        { id: crypto.randomUUID(), left: '', right: '' },
      ],
    })

  const updatePair = (id: string, patch: Partial<MatchingPair>) =>
    onChange({
      ...content,
      pairs: content.pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })

  const deletePair = (id: string) =>
    onChange({ ...content, pairs: content.pairs.filter((p) => p.id !== id) })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Prompt</Label>
        <Textarea
          placeholder="Match each item on the left to its corresponding item on the right..."
          value={content.prompt}
          onChange={(e) => onChange({ ...content, prompt: e.target.value })}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Label>Left column</Label>
          <Label>Right column</Label>
        </div>
        {content.pairs.map((pair) => (
          <div key={pair.id} className="flex items-center gap-2">
            <Input
              placeholder="Left item"
              value={pair.left}
              onChange={(e) => updatePair(pair.id, { left: e.target.value })}
            />
            <span className="shrink-0 text-muted-foreground">↔</span>
            <Input
              placeholder="Right item"
              value={pair.right}
              onChange={(e) => updatePair(pair.id, { right: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deletePair(pair.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addPair}>
          <Plus className="mr-1 h-3 w-3" />
          Add Pair
        </Button>
      </div>
    </div>
  )
}

export const defaultMatchingContent = (): MatchingContent => ({
  prompt: '',
  pairs: [
    { id: crypto.randomUUID(), left: '', right: '' },
    { id: crypto.randomUUID(), left: '', right: '' },
  ],
})
