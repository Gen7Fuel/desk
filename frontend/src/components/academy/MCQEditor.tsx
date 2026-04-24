import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react'

export interface MCQOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface MCQContent {
  question: string
  options: MCQOption[]
  explanation: string
}

interface Props {
  content: MCQContent
  onChange: (content: MCQContent) => void
}

export function MCQEditor({ content, onChange }: Props) {
  const update = (patch: Partial<MCQContent>) =>
    onChange({ ...content, ...patch })

  const addOption = () =>
    update({
      options: [
        ...content.options,
        { id: crypto.randomUUID(), text: '', isCorrect: false },
      ],
    })

  const updateOption = (id: string, patch: Partial<MCQOption>) =>
    update({
      options: content.options.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    })

  const toggleCorrect = (id: string) =>
    update({
      options: content.options.map((o) =>
        o.id === id ? { ...o, isCorrect: !o.isCorrect } : o,
      ),
    })

  const removeOption = (id: string) =>
    update({ options: content.options.filter((o) => o.id !== id) })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Question</Label>
        <Textarea
          placeholder="Enter the question"
          value={content.question}
          onChange={(e) => update({ question: e.target.value })}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Options</Label>
        <p className="text-xs text-muted-foreground">
          Click the circle to mark correct answer(s).
        </p>
        {content.options.map((option) => (
          <div key={option.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCorrect(option.id)}
              className="shrink-0 text-muted-foreground hover:text-primary"
            >
              {option.isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
            <Input
              className={cn(option.isCorrect && 'border-primary')}
              placeholder="Option text"
              value={option.text}
              onChange={(e) => updateOption(option.id, { text: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeOption(option.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addOption}>
          <Plus className="mr-1 h-3 w-3" />
          Add Option
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Explanation (optional)</Label>
        <Textarea
          placeholder="Shown after answering"
          value={content.explanation}
          onChange={(e) => update({ explanation: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  )
}

export const defaultMCQContent = (): MCQContent => ({
  question: '',
  options: [
    { id: crypto.randomUUID(), text: '', isCorrect: false },
    { id: crypto.randomUUID(), text: '', isCorrect: false },
  ],
  explanation: '',
})
