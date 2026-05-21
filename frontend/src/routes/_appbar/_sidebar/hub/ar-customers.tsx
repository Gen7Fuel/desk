import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Trash2, Upload } from 'lucide-react'
import type { ArCustomer, ArCustomerUpdate } from '@/lib/ar-customer-api'
import {
  deleteArCustomer,
  getArCustomers,
  syncArCustomers,
  updateArCustomer,
} from '@/lib/ar-customer-api'
import { getFleetCards } from '@/lib/fleet-card-api'
import { can } from '@/lib/permissions'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/_appbar/_sidebar/hub/ar-customers')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.arCustomers', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function orDash(value: string | null | undefined): string {
  return value?.trim() || '—'
}

// ---------------------------------------------------------------------------
// Sync zone
// ---------------------------------------------------------------------------

interface SyncResult {
  created: number
  updated: number
  deleted: number
}

function SyncZone({ onSynced }: { onSynced: () => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const syncMutation = useMutation({
    mutationFn: syncArCustomers,
    onSuccess: (result) => {
      setSyncResult(result)
      setSyncError(null)
      onSynced()
    },
    onError: (err) => {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
      setSyncResult(null)
    },
  })

  function handleFile(file: File | undefined) {
    if (!file) return
    setSyncResult(null)
    setSyncError(null)
    syncMutation.mutate(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0])
    // reset so same file can be re-selected
    e.target.value = ''
  }

  const isPending = syncMutation.isPending

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={isPending}
        onClick={() => !isPending && fileRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isPending)
            fileRef.current?.click()
        }}
        onDragOver={(e) => { e.preventDefault(); if (!isPending) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-4 text-sm transition-colors',
          isPending
            ? 'cursor-not-allowed opacity-60 border-muted'
            : dragOver
              ? 'cursor-copy border-primary bg-primary/5 text-primary'
              : 'cursor-pointer border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-foreground',
        ].join(' ')}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Syncing…</span>
          </>
        ) : dragOver ? (
          <>
            <Upload className="h-4 w-4" />
            <span className="text-xs">Drop file to sync</span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span className="text-center text-xs">Upload CSO export of house accounts</span>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xls,.htm,.html"
        className="hidden"
        onChange={handleInputChange}
      />

      {syncResult && (
        <p className="mt-2 text-sm text-green-700">
          Sync complete — {syncResult.created} created, {syncResult.updated} updated, {syncResult.deleted} deleted
        </p>
      )}
      {syncError && (
        <p className="mt-2 text-sm text-destructive">{syncError}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit dialog
// ---------------------------------------------------------------------------

type EditForm = {
  creditLimit: string
  phone: string
  email: string
  notes: string
}

function EditDialog({
  customer,
  onClose,
}: {
  customer: ArCustomer
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EditForm>({
    creditLimit: customer.creditLimit !== null ? String(customer.creditLimit) : '',
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
  })

  function set(field: keyof EditForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateMutation = useMutation({
    mutationFn: (data: ArCustomerUpdate) =>
      updateArCustomer(customer._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-customers'] })
      onClose()
    },
    onError: (err) =>
      alert(err instanceof Error ? err.message : 'Failed to update'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const creditRaw = form.creditLimit.trim()
    const creditLimit =
      creditRaw === '' ? null : Number(creditRaw)
    if (creditRaw !== '' && isNaN(creditLimit as number)) return
    updateMutation.mutate({
      creditLimit,
      phone: form.phone,
      email: form.email,
      notes: form.notes,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Edit Customer</DialogTitle>
        <DialogDescription>
          Customer ID and name are read-only — set by file sync.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Customer ID</Label>
          <p className="text-sm font-medium">{customer.customerId}</p>
        </div>
        <div className="space-y-1.5">
          <Label>Name</Label>
          <p className="text-sm font-medium">{customer.name}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="creditLimit">Credit Limit</Label>
          <Input
            id="creditLimit"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1000"
            value={form.creditLimit}
            onChange={(e) => set('creditLimit', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
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
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save'}
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
  const navigate = useNavigate()
  const [editCustomer, setEditCustomer] = useState<ArCustomer | null>(null)
  const [deleteCustomer, setDeleteCustomer] = useState<ArCustomer | null>(null)
  const [nameFilter, setNameFilter] = useState('')

  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ['ar-customers'],
    queryFn: getArCustomers,
  })

  const { data: fleetCards = [] } = useQuery({
    queryKey: ['fleet-cards'],
    queryFn: getFleetCards,
  })

  const filteredCustomers = nameFilter.trim()
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(nameFilter.toLowerCase()),
      )
    : customers

  const cardCountByCustomerName = fleetCards.reduce<Record<string, number>>(
    (acc, card) => {
      if (card.customerName) acc[card.customerName] = (acc[card.customerName] ?? 0) + 1
      return acc
    },
    {},
  )

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-customers'] })
      setDeleteCustomer(null)
    },
    onError: (err) =>
      alert(err instanceof Error ? err.message : 'Failed to delete'),
  })

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex flex-1 items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">AR Customers</h1>
            <p className="text-sm text-muted-foreground">
              {filteredCustomers.length}{nameFilter.trim() ? ` of ${customers.length}` : ''} customer{customers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-1 justify-center">
            <Input
              placeholder="Filter by name…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </div>
        <div className="w-1/4 shrink-0">
          <SyncZone
            onSynced={() =>
              queryClient.invalidateQueries({ queryKey: ['ar-customers'] })
            }
          />
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">Failed to load AR customers.</p>
      )}

      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Cards</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-sm text-muted-foreground"
                >
                  {customers.length === 0
                    ? 'No AR customers found. Upload a file to sync.'
                    : 'No customers match the filter.'}
                </TableCell>
              </TableRow>
            )}
            {filteredCustomers.map((customer) => (
              <TableRow key={customer._id}>
                <TableCell className="font-mono text-sm">
                  {customer.customerId}
                </TableCell>
                <TableCell>
                  <button
                    className="hover:underline text-left"
                    onClick={() =>
                      navigate({
                        to: '/hub/fleet-cards',
                        search: { account: customer.name },
                      })
                    }
                  >
                    {customer.name}
                  </button>
                </TableCell>
                <TableCell>{formatCurrency(customer.creditLimit)}</TableCell>
                <TableCell className="text-sm">
                  {orDash(customer.phone)}
                </TableCell>
                <TableCell className="text-sm">
                  {orDash(customer.email)}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {orDash(customer.notes)}
                </TableCell>
                <TableCell className="text-sm">
                  {cardCountByCustomerName[customer.name] ?? 0}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {can('hub.arCustomers', 'update') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditCustomer(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {can('hub.arCustomers', 'delete') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteCustomer(customer)}
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

      {/* Edit dialog */}
      <Dialog
        open={!!editCustomer}
        onOpenChange={(open) => { if (!open) setEditCustomer(null) }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-lg w-full rounded-lg border bg-background p-6 shadow-lg">
            {editCustomer && (
              <EditDialog
                customer={editCustomer}
                onClose={() => setEditCustomer(null)}
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deleteCustomer}
        onOpenChange={(open) => { if (!open) setDeleteCustomer(null) }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogHeader>
              <DialogTitle>Delete AR Customer?</DialogTitle>
              <DialogDescription>
                This will permanently delete{' '}
                <strong>{deleteCustomer?.name}</strong> (
                <span className="font-mono">{deleteCustomer?.customerId}</span>
                ). This action cannot be undone.
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
                  if (deleteCustomer) deleteMutation.mutate(deleteCustomer._id)
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
