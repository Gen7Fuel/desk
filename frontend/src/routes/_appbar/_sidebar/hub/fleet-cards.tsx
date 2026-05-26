import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Workbook } from 'exceljs'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import type { FleetCard, FleetCardStatus } from '@/lib/fleet-card-api'
import {
  FLEET_CARD_STATUSES,
  createFleetCard,
  deleteFleetCard,
  formatCardNumber,
  getFleetCards,
  getHubLocations,
  updateFleetCard,
} from '@/lib/fleet-card-api'
import { getArCustomers } from '@/lib/ar-customer-api'
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
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
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
  validateSearch: (search: Record<string, unknown>) => ({
    account: typeof search.account === 'string' ? search.account : undefined,
    site: typeof search.site === 'string' ? search.site : undefined,
  }),
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
  stolen: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-yellow-100 text-yellow-800',
}

const EMPTY_FORM = {
  fleetCardNumber: '',
  customerName: '',
  site: '',
  driverName: '',
  numberPlate: '',
  vehicleMakeModel: '',
  status: 'active' as FleetCardStatus,
  notes: '',
}

type FormState = typeof EMPTY_FORM

type ParsedRow = Omit<FleetCard, '_id' | 'customerId' | 'customerEmail'>
type ImportPreview = { rows: Array<ParsedRow>; creates: number; updates: number }
type ImportResult = { created: number; updated: number; errors: Array<string> }

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
  const [acOpen, setAcOpen] = useState(false)

  const { data: arCustomers = [] } = useQuery({
    queryKey: ['ar-customers'],
    queryFn: getArCustomers,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['hub-locations'],
    queryFn: getHubLocations,
  })

  const suggestions = form.customerName.trim()
    ? arCustomers
        .filter((c) =>
          c.name.toLowerCase().includes(form.customerName.toLowerCase()),
        )
        .slice(0, 8)
    : []

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleCardNumberChange(raw: string) {
    set('fleetCardNumber', formatCardInput(raw))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      ...form,
      fleetCardNumber: form.fleetCardNumber.replace(/\s/g, ''),
    })
  }

  const digits = form.fleetCardNumber.replace(/\s/g, '')
  const cardValid = digits.length === 16

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="cardNumber">Card Number</Label>
          <Input
            id="cardNumber"
            placeholder="XXXX XXXX XXXX XXXX"
            value={form.fleetCardNumber}
            onChange={(e) => handleCardNumberChange(e.target.value)}
            className="font-mono tracking-widest"
            required
          />
          {form.fleetCardNumber && !cardValid && (
            <p className="text-xs text-destructive">
              Must be exactly 16 digits
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="accountName">Account Name</Label>
          <Popover
            open={acOpen && suggestions.length > 0}
            onOpenChange={setAcOpen}
          >
            <PopoverAnchor asChild>
              <Input
                id="accountName"
                value={form.customerName}
                onChange={(e) => {
                  set('customerName', e.target.value)
                  setAcOpen(true)
                }}
                onFocus={() => setAcOpen(true)}
                required
              />
            </PopoverAnchor>
            <PopoverContent
              align="start"
              sideOffset={4}
              className="p-0 w-[var(--radix-popover-anchor-width)]"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {suggestions.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    set('customerName', c.name)
                    setAcOpen(false)
                  }}
                >
                  {c.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="site">Site</Label>
          <Select
            value={form.site || '__none__'}
            onValueChange={(v) => set('site', v === '__none__' ? '' : v)}
          >
            <SelectTrigger id="site">
              <SelectValue placeholder="— None —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.stationName} value={l.stationName}>
                  {l.stationName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="driverName">Driver Name</Label>
          <Input
            id="driverName"
            value={form.driverName}
            onChange={(e) => set('driverName', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="numberPlate">Number Plate</Label>
          <Input
            id="numberPlate"
            value={form.numberPlate}
            onChange={(e) => set('numberPlate', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="makeModel">Make &amp; Model</Label>
          <Input
            id="makeModel"
            value={form.vehicleMakeModel}
            onChange={(e) => set('vehicleMakeModel', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select value={form.status} onValueChange={(v) => set('status', v)}>
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
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !cardValid || !form.customerName.trim()}
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function cellText(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object' && 'result' in val) {
    return String((val as { result?: unknown }).result ?? '').trim()
  }
  return String(val).trim()
}

async function parseFleetCardXlsx(file: File): Promise<Array<ParsedRow>> {
  const buffer = await file.arrayBuffer()
  const wb = new Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]

  const headers: Record<string, number> = {}
  ws.getRow(1).eachCell((cell, colNum) => {
    const h = cellText(cell.value).toLowerCase()
    headers[h] = colNum
  })

  const rows: Array<ParsedRow> = []
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return
    const get = (col: string) => {
      const idx = headers[col]
      return idx ? cellText(row.getCell(idx).value) : ''
    }
    const cardRaw = get('card').replace(/\D/g, '')
    const customerName = get('cx')
    if (cardRaw.length !== 16 || !customerName) return
    rows.push({
      fleetCardNumber: cardRaw,
      customerName,
      site: get('site'),
      driverName: get('driver'),
      numberPlate: get('plate'),
      vehicleMakeModel: get('make_model'),
      notes: get('notes'),
      status: 'active',
    })
  })
  return rows
}

async function runImport(
  rows: Array<ParsedRow>,
  cards: Array<FleetCard>,
): Promise<ImportResult> {
  const existing = new Map(cards.map((c) => [c.fleetCardNumber, c._id]))
  let created = 0
  let updated = 0
  const errors: Array<string> = []

  for (const row of rows) {
    const id = existing.get(row.fleetCardNumber)
    try {
      if (id) {
        await updateFleetCard(id, row)
        updated++
      } else {
        await createFleetCard(row)
        created++
      }
    } catch (err) {
      errors.push(
        `${formatCardNumber(row.fleetCardNumber)}: ${err instanceof Error ? err.message : 'Error'}`,
      )
    }
  }
  return { created, updated, errors }
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: '/hub/fleet-cards' })
  const { account: accountFilter, site: siteFilter } = Route.useSearch()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCard, setEditCard] = useState<FleetCard | null>(null)
  const [deleteCard, setDeleteCard] = useState<FleetCard | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importPending, setImportPending] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  function setAccountFilter(name: string | null) {
    navigate({
      search: (prev) => ({ ...prev, account: name ?? undefined }),
      replace: true,
    })
  }

  function setSiteFilter(name: string | null) {
    navigate({
      search: (prev) => ({ ...prev, site: name ?? undefined }),
      replace: true,
    })
  }

  const {
    data: cards = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['fleet-cards'],
    queryFn: getFleetCards,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['fleet-cards'] })

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (importInputRef.current) importInputRef.current.value = ''
    if (!file) return
    try {
      const rows = await parseFleetCardXlsx(file)
      const existing = new Map(cards.map((c) => [c.fleetCardNumber, c._id]))
      const creates = rows.filter((r) => !existing.has(r.fleetCardNumber)).length
      const updates = rows.length - creates
      setImportPreview({ rows, creates, updates })
    } catch {
      alert('Failed to parse Excel file. Make sure it is a valid .xlsx file.')
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return
    setImportPending(true)
    try {
      const result = await runImport(importPreview.rows, cards)
      setImportPreview(null)
      setImportResult(result)
      invalidate()
    } finally {
      setImportPending(false)
    }
  }

  const filteredCards = cards
    .filter((c) => !accountFilter || c.customerName === accountFilter)
    .filter((c) => !siteFilter || c.site === siteFilter)

  const createMutation = useMutation({
    mutationFn: createFleetCard,
    onSuccess: () => {
      invalidate()
      setCreateOpen(false)
    },
    onError: (err) =>
      alert(err instanceof Error ? err.message : 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<FleetCard, '_id' | 'customerId' | 'customerEmail'>>
    }) => updateFleetCard(id, data),
    onSuccess: () => {
      invalidate()
      setEditCard(null)
    },
    onError: (err) =>
      alert(err instanceof Error ? err.message : 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFleetCard(id),
    onSuccess: () => {
      invalidate()
      setDeleteCard(null)
    },
    onError: (err) =>
      alert(err instanceof Error ? err.message : 'Failed to delete'),
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Fleet Cards</h1>
          <p className="text-sm text-muted-foreground">
            {filteredCards.length}
            {accountFilter || siteFilter ? ` of ${cards.length}` : ''} card
            {cards.length !== 1 ? 's' : ''}
            {accountFilter && (
              <>
                {' '}
                —{' '}
                <span className="font-medium text-foreground">
                  {accountFilter}
                </span>
                <button
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setAccountFilter(null)}
                  aria-label="Clear account filter"
                >
                  ×
                </button>
              </>
            )}
            {siteFilter && (
              <>
                {' '}
                —{' '}
                <span className="font-medium text-foreground">
                  {siteFilter}
                </span>
                <button
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setSiteFilter(null)}
                  aria-label="Clear site filter"
                >
                  ×
                </button>
              </>
            )}
          </p>
        </div>
        {can('hub.fleetCards', 'create') && (
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Card
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">Failed to load fleet cards.</p>
      )}

      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Card Number</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Make &amp; Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCards.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-sm text-muted-foreground"
                >
                  {cards.length === 0
                    ? 'No fleet cards found.'
                    : 'No cards for this account.'}
                </TableCell>
              </TableRow>
            )}
            {filteredCards.map((card) => (
              <TableRow key={card._id}>
                <TableCell className="font-mono tracking-widest text-sm">
                  {formatCardNumber(card.fleetCardNumber)}
                </TableCell>
                <TableCell>
                  <button
                    className="hover:underline text-left"
                    onClick={() =>
                      setAccountFilter(
                        accountFilter === card.customerName
                          ? null
                          : card.customerName,
                      )
                    }
                  >
                    {card.customerName}
                  </button>
                </TableCell>
                <TableCell>
                  {card.site ? (
                    <button
                      className="hover:underline text-left"
                      onClick={() =>
                        setSiteFilter(
                          siteFilter === card.site ? null : card.site,
                        )
                      }
                    >
                      {card.site}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{card.driverName}</TableCell>
                <TableCell>{card.numberPlate}</TableCell>
                <TableCell>{card.vehicleMakeModel}</TableCell>
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

      {/* Import preview dialog */}
      <Dialog
        open={!!importPreview}
        onOpenChange={(open) => {
          if (!open && !importPending) setImportPreview(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg">
            <DialogHeader>
              <DialogTitle>Import Fleet Cards</DialogTitle>
              <DialogDescription>
                {importPreview && (
                  <>
                    {importPreview.rows.length} row
                    {importPreview.rows.length !== 1 ? 's' : ''} found —{' '}
                    <span className="text-green-700 font-medium">
                      {importPreview.creates} new
                    </span>
                    {importPreview.updates > 0 && (
                      <>
                        ,{' '}
                        <span className="text-amber-700 font-medium">
                          {importPreview.updates} update
                          {importPreview.updates !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {importPreview && importPreview.rows.length > 0 && (
              <div className="overflow-x-auto rounded border text-xs">
                <table className="w-full">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Card</th>
                      <th className="px-2 py-1.5 text-left font-medium">Customer</th>
                      <th className="px-2 py-1.5 text-left font-medium">Site</th>
                      <th className="px-2 py-1.5 text-left font-medium">Driver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5 font-mono tracking-widest">
                          {formatCardNumber(r.fleetCardNumber)}
                        </td>
                        <td className="px-2 py-1.5">{r.customerName}</td>
                        <td className="px-2 py-1.5">{r.site || '—'}</td>
                        <td className="px-2 py-1.5">{r.driverName || '—'}</td>
                      </tr>
                    ))}
                    {importPreview.rows.length > 5 && (
                      <tr className="border-t">
                        <td
                          colSpan={4}
                          className="px-2 py-1.5 text-center text-muted-foreground"
                        >
                          …and {importPreview.rows.length - 5} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={importPending}
                onClick={() => setImportPreview(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={importPending || !importPreview?.rows.length}
                onClick={handleConfirmImport}
              >
                {importPending
                  ? 'Importing…'
                  : `Import ${importPreview?.rows.length ?? 0} card${(importPreview?.rows.length ?? 0) !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Import result dialog */}
      <Dialog
        open={!!importResult}
        onOpenChange={(open) => {
          if (!open) setImportResult(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full rounded-lg border bg-background p-6 shadow-lg space-y-4">
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
              <DialogDescription>
                {importResult && (
                  <>
                    {importResult.created > 0 && (
                      <span className="block text-green-700">
                        {importResult.created} card
                        {importResult.created !== 1 ? 's' : ''} created
                      </span>
                    )}
                    {importResult.updated > 0 && (
                      <span className="block text-amber-700">
                        {importResult.updated} card
                        {importResult.updated !== 1 ? 's' : ''} updated
                      </span>
                    )}
                    {importResult.errors.length > 0 && (
                      <span className="block text-destructive">
                        {importResult.errors.length} error
                        {importResult.errors.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {importResult && importResult.errors.length > 0 && (
              <ul className="text-xs text-destructive space-y-1 max-h-40 overflow-y-auto rounded border p-2">
                {importResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button size="sm">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

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
        onOpenChange={(open) => {
          if (!open) setEditCard(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg">
            {editCard && (
              <CardForm
                title="Edit Fleet Card"
                initial={{
                  fleetCardNumber: formatCardNumber(editCard.fleetCardNumber),
                  customerName: editCard.customerName,
                  site: editCard.site,
                  driverName: editCard.driverName,
                  numberPlate: editCard.numberPlate,
                  vehicleMakeModel: editCard.vehicleMakeModel,
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
        onOpenChange={(open) => {
          if (!open) setDeleteCard(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogHeader>
              <DialogTitle>Delete Fleet Card?</DialogTitle>
              <DialogDescription>
                This will permanently delete the card{' '}
                <strong className="font-mono">
                  {deleteCard
                    ? formatCardNumber(deleteCard.fleetCardNumber)
                    : ''}
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
