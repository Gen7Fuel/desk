import { createFileRoute } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
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

const initialPersonnel = [
  { name: 'Alice Johnson', email: 'alice.johnson@example.com', phone: '(555) 123-4567' },
  { name: 'Bob Smith', email: 'bob.smith@example.com', phone: '(555) 234-5678' },
  { name: 'Carol Williams', email: 'carol.williams@example.com', phone: '(555) 345-6789' },
  { name: 'David Brown', email: 'david.brown@example.com', phone: '(555) 456-7890' },
  { name: 'Eve Davis', email: 'eve.davis@example.com', phone: '(555) 567-8901' },
  { name: 'Frank Miller', email: 'frank.miller@example.com', phone: '(555) 678-9012' },
  { name: 'Grace Wilson', email: 'grace.wilson@example.com', phone: '(555) 789-0123' },
  { name: 'Henry Moore', email: 'henry.moore@example.com', phone: '(555) 890-1234' },
]

export const Route = createFileRoute('/_appbar/personnel')({
  component: RouteComponent,
})

function RouteComponent() {
  const [people, setPeople] = useState(initialPersonnel)
  const [showForm, setShowForm] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

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
  }

  function handleRowClick(index: number) {
    const person = people[index]
    setEditingIndex(index)
    setName(person.name)
    setEmail(person.email)
    setPhone(person.phone)
    setShowForm(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !phone.trim()) return
    if (editingIndex !== null) {
      setPeople((prev) =>
        prev.map((p, i) =>
          i === editingIndex ? { name: name.trim(), email: email.trim(), phone: phone.trim() } : p,
        ),
      )
      closeForm()
    } else {
      setPeople((prev) => [...prev, { name: name.trim(), email: email.trim(), phone: phone.trim() }])
      setName('')
      setEmail('')
      setPhone('')
      nameInputRef.current?.focus()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto px-6 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-2xl font-semibold">Personnel</h2>
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
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person, index) => (
              <TableRow
                key={person.email}
                className={cn(
                  'cursor-pointer',
                  editingIndex === index && 'bg-accent/80',
                )}
                onClick={() => handleRowClick(index)}
              >
                <TableCell className="font-medium">{person.name}</TableCell>
                <TableCell>{person.email}</TableCell>
                <TableCell>{person.phone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div
        className={`overflow-hidden border-t transition-all duration-300 ease-in-out ${showForm ? 'max-h-24' : 'max-h-0 border-t-0'}`}
      >
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 bg-background p-4"
        >
        <Input
          ref={nameInputRef}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="(XXX) XXX-XXXX"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          className="flex-1"
        />
        <Button type="submit">{editingIndex !== null ? 'Update' : 'Add'}</Button>
        </form>
      </div>
    </div>
  )
}
