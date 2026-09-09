import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Plus } from 'lucide-react'
import type { Shift, ShiftInput } from '@/lib/shifts-api'
import { createShift, listShifts, updateShift } from '@/lib/shifts-api'
import { can } from '@/lib/permissions'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const Route = createFileRoute('/_appbar/_sidebar/hub/shifts')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.shifts', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function toDateInputValue(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function formatDate(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-CA')
}

function formatNumber(value: number | undefined): string {
  if (value === undefined) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ---------------------------------------------------------------------------
// Add / edit dialog
// ---------------------------------------------------------------------------

type ShiftFormState = {
  site: string
  shift_number: string
  date: string
  canadian_cash_collected: string
  cash_back: string
  loyalty: string
  exempted_tax: string
  chequesCashedOut: string
  pinpadTotal: string
}

function emptyForm(defaultSite: string): ShiftFormState {
  return {
    site: defaultSite,
    shift_number: '',
    date: new Date().toISOString().slice(0, 10),
    canadian_cash_collected: '',
    cash_back: '',
    loyalty: '',
    exempted_tax: '',
    chequesCashedOut: '',
    pinpadTotal: '',
  }
}

function formFromShift(shift: Shift): ShiftFormState {
  return {
    site: shift.site,
    shift_number: shift.shift_number,
    date: toDateInputValue(shift.date),
    canadian_cash_collected:
      shift.canadian_cash_collected !== undefined
        ? String(shift.canadian_cash_collected)
        : '',
    cash_back: shift.cash_back !== undefined ? String(shift.cash_back) : '',
    loyalty: shift.loyalty !== undefined ? String(shift.loyalty) : '',
    exempted_tax:
      shift.exempted_tax !== undefined ? String(shift.exempted_tax) : '',
    chequesCashedOut:
      shift.chequesCashedOut !== undefined
        ? String(shift.chequesCashedOut)
        : '',
    pinpadTotal:
      shift.pinpadTotal !== undefined ? String(shift.pinpadTotal) : '',
  }
}

// Blank optional numeric fields are omitted; canadian_cash_collected is
// always sent (defaults to 0) since Hub's update route has no
// fallback-to-existing-value for that one field.
function toShiftInput(form: ShiftFormState): ShiftInput {
  const num = (raw: string): number | undefined => {
    const trimmed = raw.trim()
    if (trimmed === '') return undefined
    const n = Number(trimmed)
    return Number.isNaN(n) ? undefined : n
  }
  return {
    site: form.site,
    shift_number: form.shift_number.trim(),
    date: form.date,
    canadian_cash_collected: num(form.canadian_cash_collected) ?? 0,
    cash_back: num(form.cash_back),
    loyalty: num(form.loyalty),
    exempted_tax: num(form.exempted_tax),
    chequesCashedOut: num(form.chequesCashedOut),
    pinpadTotal: num(form.pinpadTotal),
  }
}

function ShiftForm({
  title,
  initial,
  onSubmit,
  onClose,
  isPending,
}: {
  title: string
  initial: ShiftFormState
  onSubmit: (data: ShiftInput) => void
  onClose: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<ShiftFormState>(initial)

  function set(field: keyof ShiftFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.site || !form.shift_number.trim() || !form.date) return
    onSubmit(toShiftInput(form))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Site</Label>
          <SitePicker
            value={form.site}
            onValueChange={(v) => set('site', v)}
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shift_number">Shift Number</Label>
          <Input
            id="shift_number"
            value={form.shift_number}
            onChange={(e) => set('shift_number', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="canadian_cash_collected">
            Canadian Cash Collected
          </Label>
          <Input
            id="canadian_cash_collected"
            type="number"
            step="0.01"
            value={form.canadian_cash_collected}
            onChange={(e) => set('canadian_cash_collected', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cash_back">Cash Back</Label>
          <Input
            id="cash_back"
            type="number"
            step="0.01"
            value={form.cash_back}
            onChange={(e) => set('cash_back', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loyalty">Loyalty</Label>
          <Input
            id="loyalty"
            type="number"
            step="0.01"
            value={form.loyalty}
            onChange={(e) => set('loyalty', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exempted_tax">Exempted Tax</Label>
          <Input
            id="exempted_tax"
            type="number"
            step="0.01"
            value={form.exempted_tax}
            onChange={(e) => set('exempted_tax', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="chequesCashedOut">Cheques Cashed Out</Label>
          <Input
            id="chequesCashedOut"
            type="number"
            step="0.01"
            value={form.chequesCashedOut}
            onChange={(e) => set('chequesCashedOut', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pinpadTotal">Pinpad Total</Label>
          <Input
            id="pinpadTotal"
            type="number"
            step="0.01"
            value={form.pinpadTotal}
            onChange={(e) => set('pinpadTotal', e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

function RouteComponent() {
  const queryClient = useQueryClient()
  const [site, setSite] = useState('')
  const [shiftNumberFilter, setShiftNumberFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | null>(null)

  const {
    data: shifts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['shifts', site],
    queryFn: () => listShifts(site),
    enabled: !!site,
  })

  // .filter() preserves the server's date/createdAt-desc order — no
  // client-side re-sort needed.
  const filteredShifts = shiftNumberFilter.trim()
    ? shifts.filter((s) =>
        s.shift_number
          .toLowerCase()
          .includes(shiftNumberFilter.trim().toLowerCase()),
      )
    : shifts

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['shifts', site] })
  }

  const createMutation = useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      invalidate()
      setCreateOpen(false)
      toast.success('Shift created')
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to create shift',
      ),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ShiftInput }) =>
      updateShift(id, data),
    onSuccess: () => {
      invalidate()
      setEditShift(null)
      toast.success('Shift updated')
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to update shift',
      ),
  })

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold">Shifts</h1>
          <p className="text-sm text-muted-foreground">
            Cash summary records — filter by site and shift number.
          </p>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <SitePicker value={site} onValueChange={setSite} className="w-48" />
          <Input
            placeholder="Filter by shift number…"
            value={shiftNumberFilter}
            onChange={(e) => setShiftNumberFilter(e.target.value)}
            className="w-48"
            disabled={!site}
          />
          {can('hub.shifts', 'create') && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!site}
            >
              <Plus className="h-4 w-4" />
              Add Shift
            </Button>
          )}
        </div>
      </div>

      {!site && (
        <p className="text-sm text-muted-foreground">
          Select a site to view shifts.
        </p>
      )}
      {site && isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {site && error && (
        <p className="text-sm text-destructive">Failed to load shifts.</p>
      )}

      {site && !isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Shift #</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Canadian Cash Collected</TableHead>
              <TableHead>Cash Back</TableHead>
              <TableHead>Loyalty</TableHead>
              <TableHead>Exempted Tax</TableHead>
              <TableHead>Cheques Cashed Out</TableHead>
              <TableHead>Pinpad Total</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShifts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-sm text-muted-foreground"
                >
                  {shifts.length === 0
                    ? 'No shifts found for this site.'
                    : 'No shifts match the filter.'}
                </TableCell>
              </TableRow>
            )}
            {filteredShifts.map((shift) => (
              <TableRow key={shift._id}>
                <TableCell className="text-sm">
                  {formatDate(shift.date)}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {shift.shift_number}
                </TableCell>
                <TableCell className="text-sm">{shift.site}</TableCell>
                {shift.isChickenDelight ? (
                  <TableCell
                    colSpan={5}
                    className="text-sm text-muted-foreground"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary">Chicken Delight</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Cash fields for Chicken Delight shifts aren't editable
                        here.
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="text-sm">
                      {formatNumber(shift.canadian_cash_collected)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatNumber(shift.cash_back)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatNumber(shift.loyalty)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatNumber(shift.exempted_tax)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatNumber(shift.chequesCashedOut)}
                    </TableCell>
                  </>
                )}
                {!shift.isChickenDelight && (
                  <TableCell className="text-sm">
                    {formatNumber(shift.pinpadTotal)}
                  </TableCell>
                )}
                <TableCell>
                  {can('hub.shifts', 'update') && !shift.isChickenDelight && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditShift(shift)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg">
            {createOpen && (
              <ShiftForm
                title="Add Shift"
                initial={emptyForm(site)}
                onSubmit={(data) => createMutation.mutate(data)}
                onClose={() => setCreateOpen(false)}
                isPending={createMutation.isPending}
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editShift}
        onOpenChange={(open) => !open && setEditShift(null)}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg">
            {editShift && (
              <ShiftForm
                title="Edit Shift"
                initial={formFromShift(editShift)}
                onSubmit={(data) =>
                  updateMutation.mutate({ id: editShift._id, data })
                }
                onClose={() => setEditShift(null)}
                isPending={updateMutation.isPending}
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
