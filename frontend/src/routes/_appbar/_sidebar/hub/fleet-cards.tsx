import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  FLEET_CARD_STATUSES,
  type FleetCard,
  type FleetCardStatus,
  createFleetCard,
  deleteFleetCard,
  formatCardNumber,
  getFleetCards,
  updateFleetCard,
} from '@/lib/fleet-card-api'
import { can } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/_appbar/_sidebar/hub/fleet-cards')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.fleetCards', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const STATUS_BADGE: Record<FleetCardStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  lost: 'bg-red-100 text-red-800',
  cancelled: 'bg-yellow-100 text-yellow-800',
}

const EMPTY_FORM = {
  cardNumber: '',
  accountName: '',
  driverName: '',
  numberPlate: '',
  makeModel: '',
  status: 'active' as FleetCardStatus,
  notes: '',
}

type FormState = typeof EMPTY_FORM

function formatCardInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function CardForm({
  initial,
  onSubmit,
  isPending,
  onCancel,
  title,
  description,
}: {
  initial: FormState
  onSubmit: (data: FormState) => void
  isPending: boolean
  onCancel: () => void
  title: string
  description?: string
}) {
  const [form, setForm] = useState<FormState>(initial)

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleCardNumberChange(raw: string) {
    set('cardNumber', formatCardInput(raw))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ ...form, cardNumber: form.cardNumber.replace(/\s/g, '') })
  }

  const digits = form.cardNumber.replace(/\s/g, '')
  const cardValid = digits.length === 16

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription>{description}</DialogDescription>
        )}
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="cardNumber">Card Number</Label>
          <Input
            id="cardNumber"
            placeholder="XXXX XXXX XXXX XXXX"
            value={form.cardNumber}
            onChange={(e) => handleCardNumberChange(e.target.value)}
            className="font-mono tracking-widest"
            required
          />
          {form.cardNumber && !cardValid && (
            <p className="text-xs text-destructive">Must be exactly 16 digits</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="accountName">Account Name</Label>
          <Input
            id="accountName"
            value={form.accountName}
            onChange={(e) => set('accountName', e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="driverName">Driver Name</Label>
          <Input
            id="driverName"
            value={form.driverName}
            onChange={(e) => set('driverName', e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="numberPlate">Number Plate</Label>
          <Input
            id="numberPlate"
            value={form.numberPlate}
            onChange={(e) => set('numberPlate', e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="makeModel">Make &amp; Model</Label>
          <Input
            id="makeModel"
            value={form.makeModel}
            onChange={(e) => set('makeModel', e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => set('status', v)}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FLEET_CARD_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional notes…"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !cardValid}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCard, setEditCard] = useState<FleetCard | null>(null)
  const [deleteCard, setDeleteCard] = useState<FleetCard | null>(null)

  const { data: cards = [], isLoading, error } = useQuery({
    queryKey: ['fleet-cards'],
    queryFn: getFleetCards,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fleet-cards'] })

  const createMutation = useMutation({
    mutationFn: createFleetCard,
    onSuccess: () => { invalidate(); setCreateOpen(false) },
    onError: (err) => alert(err instanceof Error ? err.message : 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<FleetCard, '_id' | 'createdAt' | 'updatedAt'>> }) =>
      updateFleetCard(id, data),
    onSuccess: () => { invalidate(); setEditCard(null) },
    onError: (err) => alert(err instanceof Error ? err.message : 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFleetCard(id),
    onSuccess: () => { invalidate(); setDeleteCard(null) },
    onError: (err) => alert(err instanceof Error ? err.message : 'Failed to delete'),
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Fleet Cards</h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} card{cards.length !== 1 ? 's' : ''}
          </p>
        </div>
        {can('hub.fleetCards', 'create') && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Card
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">Failed to load fleet cards.</p>
      )}

      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Card Number</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Make &amp; Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-muted-foreground"
                >
                  No fleet cards found.
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => (
              <TableRow key={card._id}>
                <TableCell className="font-mono tracking-widest text-sm">
                  {formatCardNumber(card.cardNumber)}
                </TableCell>
                <TableCell>{card.accountName}</TableCell>
                <TableCell>{card.driverName}</TableCell>
                <TableCell>{card.numberPlate}</TableCell>
                <TableCell>{card.makeModel}</TableCell>
                <TableCell>
                  <Badge
                    className={`capitalize ${STATUS_BADGE[card.status]}`}
                    variant="outline"
                  >
                    {card.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {card.notes || '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {can('hub.fleetCards', 'update') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditCard(card)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {can('hub.fleetCards', 'delete') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteCard(card)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg">
            <CardForm
              title="Add Fleet Card"
              initial={EMPTY_FORM}
              isPending={createMutation.isPending}
              onCancel={() => setCreateOpen(false)}
              onSubmit={(data) => createMutation.mutate(data)}
            />
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editCard}
        onOpenChange={(open) => { if (!open) setEditCard(null) }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg">
            {editCard && (
              <CardForm
                title="Edit Fleet Card"
                initial={{
                  cardNumber: formatCardNumber(editCard.cardNumber),
                  accountName: editCard.accountName,
                  driverName: editCard.driverName,
                  numberPlate: editCard.numberPlate,
                  makeModel: editCard.makeModel,
                  status: editCard.status,
                  notes: editCard.notes,
                }}
                isPending={updateMutation.isPending}
                onCancel={() => setEditCard(null)}
                onSubmit={(data) =>
                  updateMutation.mutate({ id: editCard._id, data })
                }
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteCard}
        onOpenChange={(open) => { if (!open) setDeleteCard(null) }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogHeader>
              <DialogTitle>Delete Fleet Card?</DialogTitle>
              <DialogDescription>
                This will permanently delete the card{' '}
                <strong className="font-mono">
                  {deleteCard ? formatCardNumber(deleteCard.cardNumber) : ''}
                </strong>{' '}
                assigned to <strong>{deleteCard?.driverName}</strong>. This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (deleteCard) deleteMutation.mutate(deleteCard._id)
                }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
