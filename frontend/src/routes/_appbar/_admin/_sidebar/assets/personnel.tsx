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
import { getDeviceKinds } from '@/lib/device-kind-api'
import { getLocations } from '@/lib/location-api'

export const Route = createFileRoute(
  '/_appbar/_admin/_sidebar/assets/personnel',
)({
  component: RouteComponent,
  beforeLoad: () => {
    if (
      typeof window !== 'undefined' &&
      !can('admin.assets.personnel', 'read')
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
    from: '/_appbar/_admin/_sidebar/assets/personnel',
  })
  const navigate = useNavigate()
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

  const { data: deviceKinds } = useQuery({
    queryKey: ['deviceKinds'],
    queryFn: getDeviceKinds,
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
  })

  const selectedPerson =
    personnel?.find(
      (person: any) => person._id === selected || person.id === selected,
    ) ?? null

  const devices = selectedPerson?.devices ?? []

  // slide-in form state
  const [showForm, setShowForm] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formType, setFormType] = useState('')
  const [formMake, setFormMake] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formIdentifier, setFormIdentifier] = useState('')
  const [formLocation, setFormLocation] = useState('')

  function closeForm() {
    setShowForm(false)
    setEditingIndex(null)
    setFormType('')
    setFormMake('')
    setFormModel('')
    setFormIdentifier('')
    setFormLocation('')
  }

  function openNewForm() {
    setEditingIndex(null)
    setFormType('')
    setFormMake('')
    setFormModel('')
    setFormIdentifier('')
    setFormLocation('')
    setShowForm(true)
  }

  function openEditForm(idx: number) {
    const entry = devices[idx]
    setEditingIndex(idx)
    setFormType(entry.type)
    setFormMake(entry.make)
    setFormModel(entry.model)
    setFormIdentifier(entry.identifier)
    setFormLocation(entry.location ?? '')
    setShowForm(true)
  }

  const saveDeviceMutation = useMutation({
    mutationFn: async () => {
      const id = selectedPerson?._id || selectedPerson?.id
      const newEntry = {
        type: formType.trim(),
        make: formMake.trim(),
        model: formModel.trim(),
        identifier: formIdentifier.trim(),
        location: formLocation,
      }
      const updatedDevices =
        editingIndex !== null
          ? devices.map((d: any, i: number) =>
              i === editingIndex ? newEntry : d,
            )
          : [...devices, newEntry]
      const res = await apiFetch(`/api/personnel/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices: updatedDevices }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save device')
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
    if (
      !formType.trim() ||
      !formMake.trim() ||
      !formModel.trim() ||
      !formIdentifier.trim()
    )
      return
    if (saveDeviceMutation.isPending) return
    saveDeviceMutation.mutate()
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
            return (
              <button
                key={id}
                onClick={() => {
                  closeForm()
                  navigate({
                    to: '/assets/personnel',
                    search: { selected: id },
                  })
                }}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  selected === id && 'bg-accent/80 text-accent-foreground',
                )}
              >
                {person.name || id}
              </button>
            )
          })
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-auto p-4">
        {selected ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-lg font-semibold">
                {selectedPerson?.name || selected}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  ({devices.length})
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
                  <TableHead>Type</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No devices assigned.
                    </TableCell>
                  </TableRow>
                ) : (
                  devices.map((entry: any, idx: number) => (
                    <TableRow
                      key={`${entry.identifier}-${idx}`}
                      className={cn(
                        'cursor-pointer hover:bg-accent/50',
                        editingIndex === idx && showForm && 'bg-accent/80',
                      )}
                      onClick={() => openEditForm(idx)}
                    >
                      <TableCell className="font-medium">
                        {entry.type}
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
            Select a person to see their assigned devices.
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
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="flex h-full w-80 flex-col gap-3 p-4"
          >
            <h3 className="text-sm font-semibold">
              {editingIndex !== null ? 'Edit Device' : 'New Device'}
            </h3>
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {deviceKinds?.map((kind: any) => (
                  <SelectItem key={kind._id || kind.id} value={kind.name}>
                    {kind.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select value={formLocation} onValueChange={setFormLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((loc: any) => (
                  <SelectItem key={loc._id || loc.id} value={loc.name}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {saveDeviceMutation.isError && (
              <p className="text-sm text-destructive">
                {saveDeviceMutation.error.message}
              </p>
            )}
            <Button
              type="submit"
              className="mt-1"
              disabled={saveDeviceMutation.isPending}
            >
              {saveDeviceMutation.isPending
                ? editingIndex !== null
                  ? 'Updating...'
                  : 'Adding...'
                : editingIndex !== null
                  ? 'Update'
                  : 'Add'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
