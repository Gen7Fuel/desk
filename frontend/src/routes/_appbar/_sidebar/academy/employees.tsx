import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { AcademyCompletion, AcademyEmployee } from '@/lib/academy-api'
import { can } from '@/lib/permissions'
import {
  createEmployee,
  deleteEmployee,
  getCompletions,
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['academy', 'employees'],
    queryFn: getEmployees,
  })

  const { data: completions = [] } = useQuery({
    queryKey: ['academy', 'completions'],
    queryFn: () => getCompletions(),
  })

  const completionsByCode = completions.reduce<
    Record<string, Array<AcademyCompletion>>
  >((acc, c) => {
    ;(acc[c.employeeCode] ??= []).push(c)
    return acc
  }, {})

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
              <TableHead className="w-8" />
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Completions</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => {
              const empCompletions = completionsByCode[emp.code] ?? []
              const isOpen = expanded.has(emp._id)
              return (
                <EmployeeRows
                  key={emp._id}
                  employee={emp}
                  completions={empCompletions}
                  isOpen={isOpen}
                  onToggle={() => toggleExpanded(emp._id)}
                  copiedId={copiedId}
                  onCopyCode={copyCode}
                  onDelete={() => setPendingDelete(emp._id)}
                />
              )
            })}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false)
            setNameInput('')
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold">
              New Employee
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter the employee's name. A unique code will be generated
              automatically.
            </DialogDescription>
            <Input
              placeholder="Employee name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nameInput.trim())
                  createMutation.mutate()
              }}
            />
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
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

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold">
              Delete employee?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will remove the employee record. Existing completion records
              will still reference their code.
            </DialogDescription>
            <div className="flex justify-end gap-2">
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
                  if (pendingDelete) deleteMutation.mutate(pendingDelete)
                }}
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

// ── Sub-components ────────────────────────────────────────────────────────────

// One employee's main row plus, when expanded, a nested row listing every
// course they've completed (title + completion date).
function EmployeeRows({
  employee,
  completions,
  isOpen,
  onToggle,
  copiedId,
  onCopyCode,
  onDelete,
}: {
  employee: AcademyEmployee
  completions: Array<AcademyCompletion>
  isOpen: boolean
  onToggle: () => void
  copiedId: string | null
  onCopyCode: (id: string, code: string) => void
  onDelete: () => void
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
      >
        <TableCell>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{employee.name}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{employee.code}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCopyCode(employee._id, employee.code)
              }}
              className="text-muted-foreground hover:text-foreground"
              title="Copy code"
            >
              {copiedId === employee._id ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </TableCell>
        <TableCell className="text-sm">
          {completions.length} course{completions.length !== 1 ? 's' : ''}
        </TableCell>
        <TableCell className="text-sm">
          {format(new Date(employee.createdAt), 'MMM d, yyyy')}
        </TableCell>
        <TableCell>
          {can('academy.employees', 'delete') && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </TableCell>
      </TableRow>

      {isOpen && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={5} className="py-2">
            {completions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completions yet.
              </p>
            ) : (
              <div className="space-y-1">
                {completions
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.completedAt).getTime() -
                      new Date(a.completedAt).getTime(),
                  )
                  .map((c) => (
                    <div
                      key={c._id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span>{c.courseTitle}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(c.completedAt), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
