import { createFileRoute, redirect } from '@tanstack/react-router'
import { Plus, Trash, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import * as personnelApi from '@/lib/personnel-api'
import { can } from '@/lib/permissions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'

interface Personnel {
  _id?: string
  id?: string
  name: string
  email: string
  phone: string
}

export const Route = createFileRoute('/_appbar/_admin/_sidebar/personnel/')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('personnel', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const [people, setPeople] = useState<Array<Personnel>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [showPhones, setShowPhones] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Load personnel from backend
  useEffect(() => {
    personnelApi
      .getPersonnel()
      .then(setPeople)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Listen for Shift key to show/hide phone numbers
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Shift') setShowPhones(true)
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift') setShowPhones(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  })

  function maskPhone(ph: string) {
    return ph.replace(/\d/g, '*')
  }

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits.length ? `(${digits}` : ''
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  function closeForm() {
    setShowForm(false)
    setEditingIndex(null)
    setName('')
    setEmail('')
    setPhone('')
    setShowDeleteDialog(false)
  }

  function handleRowClick(index: number) {
    const person = people[index]
    setEditingIndex(index)
    setName(person.name)
    setEmail(person.email)
    setPhone(person.phone)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !phone.trim()) return
    setError(null)
    try {
      if (editingIndex !== null) {
        const id = people[editingIndex]._id || people[editingIndex].id
        if (!id) {
          setError('Unable to update: missing personnel ID')
          return
        }
        const updated = await personnelApi.updatePersonnel(id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        })
        setPeople((prev) =>
          prev.map((p, i) => (i === editingIndex ? updated : p)),
        )
        closeForm()
      } else {
        const created = await personnelApi.createPersonnel({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        })
        setPeople((prev) => [...prev, created])
        setName('')
        setEmail('')
        setPhone('')
        nameInputRef.current?.focus()
      }
    } catch (err: any) {
      setError(err.message || 'Error saving personnel')
    }
  }

  return (
    <div className="flex h-full">
      {/* Main table area */}
      <div className="flex flex-1 flex-col overflow-auto px-6 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-2xl font-semibold">Personnel</h2>
          {(showForm || can('personnel', 'create')) && (
            <Button
              variant={showForm ? 'outline' : 'default'}
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (showForm) {
                  closeForm()
                } else {
                  setEditingIndex(null)
                  setName('')
                  setEmail('')
                  setPhone('')
                  setShowForm(true)
                }
              }}
            >
              {showForm ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3}>Loading...</TableCell>
              </TableRow>
            ) : people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>No personnel found.</TableCell>
              </TableRow>
            ) : (
              people.map((person, index) => (
                <TableRow
                  key={person._id || person.id || person.email}
                  className={cn(
                    'cursor-pointer hover:bg-accent/50',
                    editingIndex === index && showForm && 'bg-accent/80',
                  )}
                  onClick={() => handleRowClick(index)}
                >
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell>{person.email}</TableCell>
                  <TableCell>
                    {showPhones ? person.phone : maskPhone(person.phone)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Slide-in form panel */}
      <div
        className={cn(
          'shrink-0 overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
          showForm ? 'w-80' : 'w-0 border-l-0',
        )}
      >
        <form
          onSubmit={handleSubmit}
          className="flex h-full w-80 flex-col gap-3 p-4"
        >
          <h3 className="text-sm font-semibold">
            {editingIndex !== null ? 'Edit Personnel' : 'New Personnel'}
          </h3>
          <Input
            ref={nameInputRef}
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="(XXX) XXX-XXXX"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
          />
          <div className="flex gap-2">
            {(editingIndex !== null
              ? can('personnel', 'update')
              : can('personnel', 'create')) && (
              <Button type="submit" className="flex-1">
                {editingIndex !== null ? 'Update' : 'Add'}
              </Button>
            )}
            {editingIndex !== null && can('personnel', 'delete') && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                title="Delete personnel"
              >
                <Trash className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && editingIndex !== null && (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-50 bg-black/40" />
            <DialogContent className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg text-foreground">
              <DialogTitle className="mb-2 text-xl font-bold">
                Delete Personnel
              </DialogTitle>
              <DialogDescription className="mb-4">
                Are you sure you want to delete <b>{name}</b> (<b>{email}</b>)?
              </DialogDescription>
              <div className="flex justify-end gap-4">
                <Button
                  variant="destructive"
                  onClick={async () => {
                    setError(null)
                    try {
                      const id =
                        people[editingIndex]._id || people[editingIndex].id
                      if (!id) {
                        setError('Unable to delete: missing personnel ID')
                        return
                      }
                      await personnelApi.deletePersonnel(id)
                      setPeople((prev) =>
                        prev.filter((_, i) => i !== editingIndex),
                      )
                      closeForm()
                    } catch (err: any) {
                      setError(err.message || 'Error deleting personnel')
                      setShowDeleteDialog(false)
                    }
                  }}
                >
                  Yes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(false)}
                >
                  No
                </Button>
              </div>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  )
}
