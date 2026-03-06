import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCategories } from '@/lib/category-api'
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  type Subscription,
} from '@/lib/subscription-api'

export const Route = createFileRoute('/_appbar/_sidebar/subscriptions/list')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('subscriptions.list', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

type FormMode = 'add' | 'edit' | null

function toDateInput(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString()
}

function calcEndDate(cycle: string): string {
  const d = new Date()
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

function RouteComponent() {
  const queryClient = useQueryClient()

  const { data: subscriptions, isLoading, isError, error } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: getSubscriptions,
  })

  const { data: categories } = useQuery({
    queryKey: ['subscriptionCategories'],
    queryFn: getCategories,
  })

  const [formMode, setFormMode] = useState<FormMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formCategory, setFormCategory] = useState('')
  const [formIdentifier, setFormIdentifier] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formBillingCycle, setFormBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [formEndDate, setFormEndDate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  function closeForm() {
    setFormMode(null)
    setEditingId(null)
    setFormCategory('')
    setFormIdentifier('')
    setFormPrice('')
    setFormBillingCycle('monthly')
    setFormEndDate('')
    setFormNotes('')
    saveMutation.reset()
    deleteMutation.reset()
  }

  function openAdd() {
    setFormMode('add')
    setEditingId(null)
    setFormCategory('')
    setFormIdentifier('')
    setFormPrice('')
    setFormBillingCycle('monthly')
    setFormEndDate(calcEndDate('monthly'))
    setFormNotes('')
    saveMutation.reset()
    deleteMutation.reset()
  }

  function openEdit(sub: Subscription) {
    setFormMode('edit')
    setEditingId(sub._id)
    setFormCategory(sub.category)
    setFormIdentifier(sub.identifier)
    setFormPrice(String(sub.price))
    setFormBillingCycle(sub.billing_cycle)
    setFormEndDate(toDateInput(sub.end_date))
    setFormNotes(sub.notes ?? '')
    saveMutation.reset()
    deleteMutation.reset()
  }

  function handleBillingCycleChange(cycle: 'monthly' | 'yearly') {
    setFormBillingCycle(cycle)
    setFormEndDate(calcEndDate(cycle))
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        category: formCategory,
        identifier: formIdentifier.trim(),
        price: parseFloat(formPrice),
        billing_cycle: formBillingCycle,
        end_date: formEndDate,
        notes: formNotes.trim() || undefined,
      }
      if (formMode === 'edit' && editingId) {
        return updateSubscription(editingId, payload)
      }
      return createSubscription(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSubscription(editingId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      closeForm()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formCategory || !formIdentifier.trim() || !formPrice || !formEndDate) return
    if (saveMutation.isPending || deleteMutation.isPending) return
    saveMutation.mutate()
  }

  const showForm = formMode !== null
  const isPending = saveMutation.isPending || deleteMutation.isPending
  const mutationError =
    (saveMutation.isError ? (saveMutation.error as Error)?.message : null) ||
    (deleteMutation.isError ? (deleteMutation.error as Error)?.message : null)

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-xl font-semibold">Subscriptions</h2>
          <Button
            variant={formMode === 'add' ? 'outline' : 'default'}
            size="icon"
            className="h-6 w-6"
            onClick={() => (formMode === 'add' ? closeForm() : openAdd())}
          >
            {formMode === 'add' ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : isError ? (
          <p className="text-destructive">{(error as Error)?.message ?? 'Failed to load subscriptions.'}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Renews</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!subscriptions || subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No subscriptions yet.
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((sub) => (
                  <TableRow
                    key={sub._id}
                    className={cn(
                      'cursor-pointer hover:bg-accent/50',
                      formMode === 'edit' && editingId === sub._id && 'bg-accent/80',
                    )}
                    onClick={() => openEdit(sub)}
                  >
                    <TableCell className="font-medium">{sub.category}</TableCell>
                    <TableCell>{sub.identifier}</TableCell>
                    <TableCell>{sub.price}</TableCell>
                    <TableCell className="capitalize">{sub.billing_cycle}</TableCell>
                    <TableCell>{formatDate(sub.end_date)}</TableCell>
                    <TableCell className="text-muted-foreground">{sub.notes || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Slide-in form */}
      <div
        className={cn(
          'shrink-0 overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
          showForm ? 'w-80' : 'w-0 border-l-0',
        )}
      >
        {showForm && (
          <form onSubmit={handleSubmit} className="flex h-full w-80 flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">
              {formMode === 'edit' ? 'Edit Subscription' : 'New Subscription'}
            </h3>

            <Select value={formCategory} onValueChange={setFormCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat._id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Identifier (username / email)"
              value={formIdentifier}
              onChange={(e) => setFormIdentifier(e.target.value)}
            />

            <Input
              placeholder="Price"
              type="number"
              min="0"
              step="0.01"
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
            />

            <div className="flex rounded-md border overflow-hidden">
              {(['monthly', 'yearly'] as const).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  className={cn(
                    'flex-1 py-1.5 text-sm capitalize transition-colors',
                    formBillingCycle === cycle
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-accent',
                  )}
                  onClick={() => handleBillingCycleChange(cycle)}
                >
                  {cycle}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Renewal date</label>
              <Input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
              />
            </div>

            <Input
              placeholder="Notes (optional)"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />

            {mutationError && (
              <p className="text-sm text-destructive">{mutationError}</p>
            )}

            <Button type="submit" className="mt-1" disabled={isPending}>
              {saveMutation.isPending
                ? formMode === 'edit' ? 'Updating...' : 'Adding...'
                : formMode === 'edit' ? 'Update' : 'Add'}
            </Button>

            {formMode === 'edit' && (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
