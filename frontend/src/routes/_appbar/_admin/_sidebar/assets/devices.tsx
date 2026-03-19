import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
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
import { createDeviceKind, getDeviceKinds } from '@/lib/device-kind-api'
import { getPersonnel } from '@/lib/personnel-api'
import { apiFetch } from '@/lib/api'

export const Route = createFileRoute('/_appbar/_admin/_sidebar/assets/devices')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('assets.devices', 'read')) {
      throw redirect({ to: '/' })
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
})

function RouteComponent() {
  const { selected } = useSearch({ from: '/_appbar/_admin/_sidebar/assets/devices' })
  const navigate = useNavigate({ from: '/assets/devices' })
  const queryClient = useQueryClient()

  const {
    data: deviceKinds,
    isLoading: isLoadingKinds,
    isError: isErrorKinds,
    error: kindsError,
  } = useQuery({ queryKey: ['deviceKinds'], queryFn: getDeviceKinds })

  const { data: personnel } = useQuery({
    queryKey: ['personnel'],
    queryFn: getPersonnel,
  })

  // Flatten all devices of the selected type across all personnel
  const entries: Array<{
    personId: string
    deviceIdx: number
    assignedTo: string
    make: string
    model: string
    identifier: string
    location: string
  }> =
    selected && Array.isArray(personnel)
      ? personnel.flatMap((person: any) => {
          const id = person._id || person.id
          return (person.devices ?? [])
            .map((d: any, idx: number) => ({
              ...d,
              personId: id,
              deviceIdx: idx,
              assignedTo: person.name,
            }))
            .filter((d: any) => d.type === selected)
        })
      : []

  // Slide-in form state — shared for "add device kind" and "edit device entry"
  type FormMode = 'addKind' | 'editDevice' | null
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [editingDeviceIdx, setEditingDeviceIdx] = useState<number | null>(null)
  const [kindName, setKindName] = useState('')
  const [formMake, setFormMake] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formIdentifier, setFormIdentifier] = useState('')

  function closeForm() {
    setFormMode(null)
    setEditingPersonId(null)
    setEditingDeviceIdx(null)
    setKindName('')
    setFormMake('')
    setFormModel('')
    setFormIdentifier('')
  }

  function openEditDevice(entry: (typeof entries)[number]) {
    setEditingPersonId(entry.personId)
    setEditingDeviceIdx(entry.deviceIdx)
    setFormMake(entry.make)
    setFormModel(entry.model)
    setFormIdentifier(entry.identifier)
    setFormMode('editDevice')
  }

  // Add new device kind
  const addKindMutation = useMutation({
    mutationFn: () => createDeviceKind({ name: kindName.trim() }),
    onSuccess: (newKind: any) => {
      queryClient.invalidateQueries({ queryKey: ['deviceKinds'] })
      navigate({ search: { selected: newKind.name } })
      closeForm()
    },
  })

  // Edit an existing device entry on a person
  const editDeviceMutation = useMutation({
    mutationFn: async () => {
      const person = personnel?.find(
        (p: any) => (p._id || p.id) === editingPersonId,
      )
      if (!person) throw new Error('Person not found')
      const updatedDevices = (person.devices ?? []).map((d: any, i: number) =>
        i === editingDeviceIdx
          ? {
              type: selected,
              make: formMake.trim(),
              model: formModel.trim(),
              identifier: formIdentifier.trim(),
            }
          : d,
      )
      const res = await apiFetch(`/api/personnel/${editingPersonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices: updatedDevices }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update device')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] })
      closeForm()
    },
  })

  function handleKindSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!kindName.trim() || addKindMutation.isPending) return
    addKindMutation.mutate()
  }

  function handleDeviceSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formMake.trim() || !formModel.trim() || !formIdentifier.trim()) return
    if (editDeviceMutation.isPending) return
    editDeviceMutation.mutate()
  }

  const showForm = formMode !== null
  const isPending = addKindMutation.isPending || editDeviceMutation.isPending
  const mutationError =
    (addKindMutation.isError ? addKindMutation.error.message : null) ||
    (editDeviceMutation.isError ? editDeviceMutation.error.message : null)

  return (
    <div className="flex h-full">
      {/* Left: device kinds list */}
      <div className="flex w-56 flex-col gap-1 overflow-auto border-r p-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Device Types</h2>
          <Button
            variant={formMode === 'addKind' ? 'outline' : 'default'}
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              if (formMode === 'addKind') {
                closeForm()
              } else {
                closeForm()
                setFormMode('addKind')
              }
            }}
          >
            {formMode === 'addKind' ? (
              <X className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
        </div>
        {isLoadingKinds ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : isErrorKinds ? (
          <p className="text-destructive">{kindsError.message}</p>
        ) : !deviceKinds || deviceKinds.length === 0 ? (
          <p className="text-muted-foreground">No device types found.</p>
        ) : (
          deviceKinds.map((kind: any) => (
            <button
              key={kind._id || kind.id}
              onClick={() => {
                closeForm()
                navigate({ search: { selected: kind.name } })
              }}
              className={cn(
                'rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                selected === kind.name && 'bg-accent/80 text-accent-foreground',
              )}
            >
              {kind.name}
            </button>
          ))
        )}
      </div>

      {/* Middle: devices of selected type */}
      <div className="flex-1 overflow-auto p-4">
        {selected ? (
          <>
            <h3 className="mb-4 text-lg font-semibold">
              {selected}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                ({entries.length})
              </span>
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No devices of this type.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry, idx) => (
                    <TableRow
                      key={`${entry.personId}-${entry.deviceIdx}-${idx}`}
                      className={cn(
                        'cursor-pointer hover:bg-accent/50',
                        formMode === 'editDevice' &&
                          editingPersonId === entry.personId &&
                          editingDeviceIdx === entry.deviceIdx &&
                          'bg-accent/80',
                      )}
                      onClick={() => openEditDevice(entry)}
                    >
                      <TableCell className="font-medium">
                        {entry.assignedTo}
                      </TableCell>
                      <TableCell>{entry.make}</TableCell>
                      <TableCell>{entry.model}</TableCell>
                      <TableCell>{entry.identifier}</TableCell>
                      <TableCell>{entry.location || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-muted-foreground">
            Select a device type to see assigned units.
          </p>
        )}
      </div>

      {/* Slide-in form panel */}
      <div
        className={cn(
          'shrink-0 overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
          showForm ? 'w-80' : 'w-0 border-l-0',
        )}
      >
        {formMode === 'addKind' ? (
          <form
            onSubmit={handleKindSubmit}
            className="flex h-full w-80 flex-col gap-3 p-4"
          >
            <h3 className="text-sm font-semibold">New Device Type</h3>
            <Input
              placeholder="Type name"
              value={kindName}
              onChange={(e) => setKindName(e.target.value)}
            />
            {mutationError && (
              <p className="text-sm text-destructive">{mutationError}</p>
            )}
            <Button type="submit" className="mt-1" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add'}
            </Button>
          </form>
        ) : formMode === 'editDevice' ? (
          <form
            onSubmit={handleDeviceSubmit}
            className="flex h-full w-80 flex-col gap-3 p-4"
          >
            <h3 className="text-sm font-semibold">Edit Device</h3>
            <Input
              placeholder="Make"
              value={formMake}
              onChange={(e) => setFormMake(e.target.value)}
            />
            <Input
              placeholder="Model"
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
            />
            <Input
              placeholder="Identifier"
              value={formIdentifier}
              onChange={(e) => setFormIdentifier(e.target.value)}
            />
            {mutationError && (
              <p className="text-sm text-destructive">{mutationError}</p>
            )}
            <Button type="submit" className="mt-1" disabled={isPending}>
              {isPending ? 'Updating...' : 'Update'}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
