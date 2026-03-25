import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getPersonnel } from '@/lib/personnel-api'
import { getResourceKinds } from '@/lib/resource-kind-api'

export const Route = createFileRoute(
  '/_appbar/_admin/_sidebar/access/personnel',
)({
  component: RouteComponent,
  beforeLoad: () => {
    if (
      typeof window !== 'undefined' &&
      !can('admin.access.personnel', 'read')
    ) {
      throw redirect({ to: '/' })
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
})

function RouteComponent() {
  const { selected } = useSearch({
    from: '/_appbar/_admin/_sidebar/access/personnel',
  })
  const navigate = useNavigate({ from: '/access/personnel' })
  const queryClient = useQueryClient()

  const {
    data: personnel,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['personnel'],
    queryFn: getPersonnel,
  })

  const { data: resourceKinds } = useQuery({
    queryKey: ['resourceKinds'],
    queryFn: getResourceKinds,
  })

  const selectedPerson =
    personnel?.find(
      (person: any) =>
        person._id === selected ||
        person.id === selected ||
        person.name === selected,
    ) ?? null

  const accessList = selectedPerson?.resources ?? []

  // slide-in form state
  const [showForm, setShowForm] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formType, setFormType] = useState('')
  const [formIdentifier, setFormIdentifier] = useState('')
  const identifierRef = useRef<HTMLInputElement>(null)

  function closeForm() {
    setShowForm(false)
    setEditingIndex(null)
    setFormType('')
    setFormIdentifier('')
  }

  function openNewForm() {
    setEditingIndex(null)
    setFormType('')
    setFormIdentifier('')
    setShowForm(true)
    setTimeout(() => identifierRef.current?.focus(), 150)
  }

  function openEditForm(idx: number) {
    const entry = accessList[idx]
    setEditingIndex(idx)
    setFormType(entry.type)
    setFormIdentifier(entry.identifier)
    setShowForm(true)
    setTimeout(() => identifierRef.current?.focus(), 150)
  }

  const saveResourceMutation = useMutation({
    mutationFn: async () => {
      const id = selectedPerson?._id || selectedPerson?.id
      let updatedResources: Array<any>
      if (editingIndex !== null) {
        updatedResources = accessList.map((r: any, i: number) =>
          i === editingIndex
            ? { type: formType, identifier: formIdentifier.trim() }
            : r,
        )
      } else {
        updatedResources = [
          ...accessList,
          { type: formType, identifier: formIdentifier.trim() },
        ]
      }
      const res = await apiFetch(`/api/personnel/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: updatedResources }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save resource')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] })
      closeForm()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formType || !formIdentifier.trim()) return
    if (saveResourceMutation.isPending) return
    saveResourceMutation.mutate()
  }

  return (
    <div className="flex h-full">
      <div className="flex w-56 flex-col gap-1 overflow-auto border-r p-4">
        <h2 className="mb-2 text-lg font-semibold">Personnel</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : isError ? (
          <p className="text-destructive">{error.message}</p>
        ) : !personnel || personnel.length === 0 ? (
          <p className="text-muted-foreground">No personnel found.</p>
        ) : (
          personnel.map((person: any) => {
            const id = person._id || person.id
            const label = person.name || id
            return (
              <button
                key={id}
                onClick={() => {
                  closeForm()
                  navigate({ search: { selected: id } })
                }}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  selected === id && 'bg-accent/80 text-accent-foreground',
                )}
              >
                {label}
              </button>
            )
          })
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {selected ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                {selectedPerson?.name || selected}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  ({accessList.length})
                </span>
              </h3>
              <Button
                variant={showForm ? 'outline' : 'default'}
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  if (showForm) {
                    closeForm()
                  } else {
                    openNewForm()
                  }
                }}
              >
                {showForm ? (
                  <X className="h-3 w-3" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Identifier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No resources assigned.
                    </TableCell>
                  </TableRow>
                ) : (
                  accessList.map((entry: any, idx: number) => (
                    <TableRow
                      key={`${entry.type}-${idx}`}
                      className={cn(
                        'cursor-pointer hover:bg-accent/50',
                        editingIndex === idx && showForm && 'bg-accent/80',
                      )}
                      onClick={() => openEditForm(idx)}
                    >
                      <TableCell className="font-medium">
                        {entry.type}
                      </TableCell>
                      <TableCell>{entry.identifier}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-muted-foreground">
            Select a person to see their access.
          </p>
        )}
      </div>

      {/* slide-in form panel */}
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
            {editingIndex !== null ? 'Edit Resource' : 'New Resource'}
          </h3>
          <Select value={formType} onValueChange={setFormType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {resourceKinds?.map((kind: any) => (
                <SelectItem key={kind._id || kind.id} value={kind.name}>
                  {kind.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            ref={identifierRef}
            placeholder="Identifier"
            value={formIdentifier}
            onChange={(e) => setFormIdentifier(e.target.value)}
          />
          {saveResourceMutation.isError && (
            <p className="text-sm text-destructive">
              {saveResourceMutation.error.message}
            </p>
          )}
          <Button
            type="submit"
            className="mt-1"
            disabled={saveResourceMutation.isPending}
          >
            {saveResourceMutation.isPending
              ? editingIndex !== null
                ? 'Updating...'
                : 'Adding...'
              : editingIndex !== null
                ? 'Update'
                : 'Add'}
          </Button>
        </form>
      </div>
    </div>
  )
}
