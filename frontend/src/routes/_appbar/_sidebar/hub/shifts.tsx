import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Tag, Trash2 } from 'lucide-react'
import type { AttributeType, Shift, ShiftInput } from '@/lib/shifts-api'
import {
  getCustomAttributes,
  listShifts,
  removeShiftAttribute,
  setShiftAttribute,
  updateShift,
} from '@/lib/shifts-api'
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
// Attributes dialog
// ---------------------------------------------------------------------------

const ATTRIBUTE_TYPES: Array<AttributeType> = [
  'String',
  'Int32',
  'Double',
  'Boolean',
]

// "POS Total" -> "posTotal". Matches Hub's attribute-name rules (must start
// with a letter, letters/numbers only after that).
function toAttributeName(label: string): string {
  return label
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
}

const ATTRIBUTE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

// A round-tripped-through-JSON value can't tell us its original BSON type
// (Int32 and Double both just become "number"), so this is only used to
// pre-select a sensible type when re-editing an existing attribute.
function inferAttributeType(value: string | number | boolean): AttributeType {
  if (typeof value === 'boolean') return 'Boolean'
  if (typeof value === 'number')
    return Number.isInteger(value) ? 'Int32' : 'Double'
  return 'String'
}

function AttributesDialog({
  shift,
  onClose,
  onChanged,
}: {
  shift: Shift
  onClose: () => void
  onChanged: (updated: Shift) => void
}) {
  const [attributes, setAttributes] = useState(() => getCustomAttributes(shift))
  const [label, setLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newType, setNewType] = useState<AttributeType>('String')

  const derivedName = toAttributeName(label)
  const nameValid = ATTRIBUTE_NAME_RE.test(derivedName)

  const setMutation = useMutation({
    mutationFn: ({
      name,
      value,
      type,
    }: {
      name: string
      value: string
      type: AttributeType
    }) => setShiftAttribute(shift._id, name, value, type),
    onSuccess: (updated) => {
      setAttributes(getCustomAttributes(updated))
      onChanged(updated)
      toast.success('Attribute saved')
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to save attribute',
      ),
  })

  const removeMutation = useMutation({
    mutationFn: (name: string) => removeShiftAttribute(shift._id, name),
    onSuccess: (updated) => {
      setAttributes(getCustomAttributes(updated))
      onChanged(updated)
      toast.success('Attribute removed')
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to remove attribute',
      ),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!nameValid || newValue.trim() === '') return
    setMutation.mutate(
      { name: derivedName, value: newValue.trim(), type: newType },
      {
        onSuccess: () => {
          setLabel('')
          setNewValue('')
          setNewType('String')
        },
      },
    )
  }

  const entries = Object.entries(attributes)

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          Attributes — {shift.site} / {shift.shift_number}
        </DialogTitle>
      </DialogHeader>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom attributes yet.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map(([name, value]) => (
            <div
              key={name}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm">{name}</p>
                <p className="text-sm text-muted-foreground">
                  {String(value)} ({inferAttributeType(value)})
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(name)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2 border-t pt-4">
        <Label>Add Attribute</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Input
              placeholder="Label, e.g. POS Total"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            {label.trim() !== '' && (
              <p className="text-xs text-muted-foreground">
                {nameValid
                  ? `→ ${derivedName}`
                  : 'Must start with a letter and contain only letters/numbers.'}
              </p>
            )}
          </div>
          <Input
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={newType}
            onValueChange={(v) => setNewType(v as AttributeType)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTRIBUTE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            size="sm"
            disabled={
              !nameValid || newValue.trim() === '' || setMutation.isPending
            }
          >
            {setMutation.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </form>

      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

function RouteComponent() {
  const queryClient = useQueryClient()
  const [site, setSite] = useState('')
  const [shiftNumberFilter, setShiftNumberFilter] = useState('')
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [attributesShift, setAttributesShift] = useState<Shift | null>(null)

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
              <TableHead>Attributes</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShifts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={11}
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
                    colSpan={6}
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
                    <TableCell className="text-sm">
                      {formatNumber(shift.pinpadTotal)}
                    </TableCell>
                  </>
                )}
                <TableCell className="text-sm">
                  {(() => {
                    const count = Object.keys(getCustomAttributes(shift)).length
                    return count > 0 ? (
                      <Badge variant="outline">{count}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {can('hub.shifts', 'update') && !shift.isChickenDelight && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditShift(shift)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {can('hub.shifts', 'update') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttributesShift(shift)}
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

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

      {/* Attributes dialog */}
      <Dialog
        open={!!attributesShift}
        onOpenChange={(open) => !open && setAttributesShift(null)}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg">
            {attributesShift && (
              <AttributesDialog
                shift={attributesShift}
                onClose={() => setAttributesShift(null)}
                onChanged={(updated) => {
                  setAttributesShift(updated)
                  invalidate()
                }}
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
