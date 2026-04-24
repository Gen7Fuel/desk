import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { can } from '@/lib/permissions'
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
} from '@/lib/academy-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'

export const Route = createFileRoute('/_appbar/_sidebar/academy/employees')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('academy.employees', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['academy', 'employees'],
    queryFn: getEmployees,
  })

  const createMutation = useMutation({
    mutationFn: () => createEmployee(nameInput.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'employees'] })
      toast.success('Employee added')
      setAddOpen(false)
      setNameInput('')
    },
    onError: () => toast.error('Failed to add employee'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy', 'employees'] })
      toast.success('Employee deleted')
      setPendingDelete(null)
    },
    onError: () => toast.error('Failed to delete employee'),
  })

  function copyCode(id: string, code: string) {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        {can('academy.employees', 'create') && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Employee
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : employees.length === 0 ? (
        <p className="text-muted-foreground">No employees yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp._id}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{emp.code}</span>
                    <button
                      onClick={() => copyCode(emp._id, emp.code)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy code"
                    >
                      {copiedId === emp._id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(emp.createdAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  {can('academy.employees', 'delete') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingDelete(emp._id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setNameInput('') } }}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold">New Employee</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter the employee's name. A unique code will be generated automatically.
            </DialogDescription>
            <Input
              placeholder="Employee name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && nameInput.trim()) createMutation.mutate() }}
            />
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Cancel</Button>
              </DialogClose>
              <Button
                size="sm"
                disabled={!nameInput.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Adding…' : 'Add Employee'}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null) }}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold">Delete employee?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will remove the employee record. Existing completion records will still reference their code.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => { if (pendingDelete) deleteMutation.mutate(pendingDelete) }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
