import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type FeedbackType = 'correct' | 'close' | 'wrong'

export interface MCQOption {
  id: string
  text: string
  isCorrect: boolean
  feedbackType?: FeedbackType
  feedback?: string
}

export interface MCQContent {
  question: string
  options: Array<MCQOption>
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
        {
          id: crypto.randomUUID(),
          text: '',
          isCorrect: false,
          feedbackType: 'wrong',
          feedback: '',
        },
      ],
    })

  const updateOption = (id: string, patch: Partial<MCQOption>) =>
    update({
      options: content.options.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    })

  const toggleCorrect = (id: string) => {
    const opt = content.options.find((o) => o.id === id)
    if (!opt) return
    const willBeCorrect = !opt.isCorrect
    update({
      options: content.options.map((o) =>
        o.id === id
          ? {
              ...o,
              isCorrect: willBeCorrect,
              feedbackType: willBeCorrect ? 'correct' : 'wrong',
            }
          : o,
      ),
    })
  }

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

      <div className="space-y-3">
        <div>
          <Label>Options</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Click the circle to mark correct answer(s). Set feedback text shown
            in the modal when the option is selected.
          </p>
        </div>

        {content.options.map((option) => (
          <div key={option.id} className="rounded-lg border p-3 space-y-2.5">
            {/* Option row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(option.id)}
                className="shrink-0 text-muted-foreground hover:text-primary"
                title={
                  option.isCorrect ? 'Mark as incorrect' : 'Mark as correct'
                }
              >
                {option.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <Input
                className={cn('flex-1', option.isCorrect && 'border-primary')}
                placeholder="Option text"
                value={option.text}
                onChange={(e) =>
                  updateOption(option.id, { text: e.target.value })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeOption(option.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Feedback type toggle — only for incorrect options */}
            {!option.isCorrect && (
              <div className="flex items-center gap-2 pl-7">
                <span className="text-xs text-muted-foreground shrink-0">
                  Modal color:
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateOption(option.id, { feedbackType: 'wrong' })
                    }
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                      (option.feedbackType ?? 'wrong') === 'wrong'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-50 text-red-500 hover:bg-red-100',
                    )}
                  >
                    Wrong
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateOption(option.id, { feedbackType: 'close' })
                    }
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                      option.feedbackType === 'close'
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-50 text-orange-500 hover:bg-orange-100',
                    )}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Feedback text */}
            <div className="pl-7">
              <Textarea
                placeholder={
                  option.isCorrect
                    ? 'Feedback shown in the modal when this correct answer is selected…'
                    : 'Feedback shown in the modal when this answer is selected…'
                }
                value={option.feedback ?? ''}
                onChange={(e) =>
                  updateOption(option.id, { feedback: e.target.value })
                }
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addOption}>
          <Plus className="mr-1 h-3 w-3" />
          Add Option
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Explanation (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Shown after answering — mainly used for multi-select questions.
        </p>
        <Textarea
          placeholder="Shown after checking answer"
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
    {
      id: crypto.randomUUID(),
      text: '',
      isCorrect: false,
      feedbackType: 'wrong',
      feedback: '',
    },
    {
      id: crypto.randomUUID(),
      text: '',
      isCorrect: false,
      feedbackType: 'wrong',
      feedback: '',
    },
  ],
  explanation: '',
})
