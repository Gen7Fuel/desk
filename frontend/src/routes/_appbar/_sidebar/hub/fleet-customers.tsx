import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus, ShieldOff } from 'lucide-react'
import type { FleetCustomer } from '@/lib/fleet-customer-api'
import {
  createFleetCustomer,
  getFleetCustomers,
  revokeFleetCustomerAccess,
  setFleetCustomerCredentials,
  updateFleetCustomer,
} from '@/lib/fleet-customer-api'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/hub/fleet-customers')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.fleetCustomers', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

// ---------------------------------------------------------------------------
// Create / Edit dialog
// ---------------------------------------------------------------------------

type CustomerForm = { name: string; email: string }

function CustomerFormDialog({
  title,
  initial,
  isPending,
  onSubmit,
  onClose,
}: {
  title: string
  initial: CustomerForm
  isPending: boolean
  onSubmit: (data: CustomerForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<CustomerForm>(initial)

  function set(field: keyof CustomerForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !form.name.trim() || !form.email.trim()}
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Credentials dialog
// ---------------------------------------------------------------------------

type CredentialsForm = {
  username: string
  password: string
  confirmPassword: string
}

function CredentialsDialog({
  customer,
  onClose,
}: {
  customer: FleetCustomer
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CredentialsForm>({
    username: customer.username ?? '',
    password: '',
    confirmPassword: '',
  })
  const [mismatch, setMismatch] = useState(false)

  function set(field: keyof CredentialsForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'password' || field === 'confirmPassword') setMismatch(false)
  }

  const credentialsMutation = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      setFleetCustomerCredentials(customer._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-customers'] })
      onClose()
    },
    onError: (err) =>
      alert(err instanceof Error ? err.message : 'Failed to set credentials'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setMismatch(true)
      return
    }
    credentialsMutation.mutate({
      username: form.username,
      password: form.password,
    })
  }

  const isReset = !!customer.username

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {isReset ? 'Reset Credentials' : 'Set Portal Access'}
        </DialogTitle>
        <DialogDescription>
          {isReset
            ? `Update the portal login credentials for ${customer.name}.`
            : `Grant ${customer.name} access to the customer portal.`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            required
          />
          {mismatch && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={
            credentialsMutation.isPending ||
            !form.username.trim() ||
            !form.password ||
            !form.confirmPassword
          }
        >
          {credentialsMutation.isPending ? 'Saving…' : 'Save'}
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
  const [createOpen, setCreateOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<FleetCustomer | null>(null)
  const [credentialsCustomer, setCredentialsCustomer] =
    useState<FleetCustomer | null>(null)
  const [revokeCustomer, setRevokeCustomer] = useState<FleetCustomer | null>(
    null,
  )

  const {
    data: customers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['fleet-customers'],
    queryFn: getFleetCustomers,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['fleet-customers'] })

  const createMutation = useMutation({
    mutationFn: createFleetCustomer,
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
      data: { name: string; email: string }
    }) => updateFleetCustomer(id, data),
    onSuccess: () => {
      invalidate()
      setEditCustomer(null)
    },
    onError: (err) =>
      alert(err instanceof Error ? err.message : 'Failed to update'),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeFleetCustomerAccess(id),
    onSuccess: () => {
      invalidate()
      setRevokeCustomer(null)
    },
    onError: (err) =>
      alert(err instanceof Error ? err.message : 'Failed to revoke access'),
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Fleet Customers</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {can('hub.fleetCustomers', 'create') && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load fleet customers.
        </p>
      )}

      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Portal Access</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-sm text-muted-foreground"
                >
                  No fleet customers found.
                </TableCell>
              </TableRow>
            )}
            {customers.map((customer) => (
              <TableRow key={customer._id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>
                  {customer.username ? (
                    <Badge
                      className="bg-green-100 text-green-800"
                      variant="outline"
                    >
                      {customer.username}
                    </Badge>
                  ) : (
                    <Badge
                      className="bg-gray-100 text-gray-600"
                      variant="outline"
                    >
                      No access
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {can('hub.fleetCustomers', 'update') && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditCustomer(customer)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCredentialsCustomer(customer)}
                          title={
                            customer.username
                              ? 'Reset Credentials'
                              : 'Set Portal Access'
                          }
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {customer.username && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeCustomer(customer)}
                            title="Revoke Access"
                          >
                            <ShieldOff className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </>
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
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-lg border bg-background p-6 shadow-lg">
            <CustomerFormDialog
              title="Add Fleet Customer"
              initial={{ name: '', email: '' }}
              isPending={createMutation.isPending}
              onSubmit={(data) => createMutation.mutate(data)}
              onClose={() => setCreateOpen(false)}
            />
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editCustomer}
        onOpenChange={(open) => {
          if (!open) setEditCustomer(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-lg border bg-background p-6 shadow-lg">
            {editCustomer && (
              <CustomerFormDialog
                title="Edit Fleet Customer"
                initial={{ name: editCustomer.name, email: editCustomer.email }}
                isPending={updateMutation.isPending}
                onSubmit={(data) =>
                  updateMutation.mutate({ id: editCustomer._id, data })
                }
                onClose={() => setEditCustomer(null)}
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Credentials dialog */}
      <Dialog
        open={!!credentialsCustomer}
        onOpenChange={(open) => {
          if (!open) setCredentialsCustomer(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-md w-full rounded-lg border bg-background p-6 shadow-lg">
            {credentialsCustomer && (
              <CredentialsDialog
                customer={credentialsCustomer}
                onClose={() => setCredentialsCustomer(null)}
              />
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Revoke confirm dialog */}
      <Dialog
        open={!!revokeCustomer}
        onOpenChange={(open) => {
          if (!open) setRevokeCustomer(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogHeader>
              <DialogTitle>Revoke Portal Access?</DialogTitle>
              <DialogDescription>
                This will remove portal access for{' '}
                <strong>{revokeCustomer?.name}</strong>. They will no longer be
                able to log in.
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
                disabled={revokeMutation.isPending}
                onClick={() => {
                  if (revokeCustomer) revokeMutation.mutate(revokeCustomer._id)
                }}
              >
                {revokeMutation.isPending ? 'Revoking…' : 'Revoke'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
