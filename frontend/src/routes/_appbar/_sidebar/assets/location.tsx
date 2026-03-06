import { createFileRoute, redirect } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLocations, createLocation, updateLocation } from '@/lib/location-api'
import { getPersonnel } from '@/lib/personnel-api'

export interface OfficeLocation {
  _id?: string
  name: string
  lat: number
  lng: number
}

interface DeviceAtLocation {
  type: string
  make: string
  model: string
  identifier: string
  assignedTo: string
}

interface MapLocation {
  _id?: string
  name: string
  lat: number
  lng: number
  devices: DeviceAtLocation[]
}

interface LocationMapProps {
  locations: MapLocation[]
  onEditLocation: (loc: MapLocation) => void
}

const LazyMap = lazy(async () => {
  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  const { MapContainer, TileLayer, Marker, Popup } = await import('react-leaflet')

  // Fix default marker icons for bundlers
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  function LocationMap({ locations, onEditLocation }: LocationMapProps) {
    return (
      <MapContainer
        center={[30, -60]}
        zoom={3}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((office) => (
          <Marker key={office._id ?? office.name} position={[office.lat, office.lng]}>
            <Popup minWidth={280} maxWidth={400}>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">{office.name}</h3>
                  <button
                    onClick={() => onEditLocation(office)}
                    style={{ fontSize: '0.75rem', padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: '#f9fafb' }}
                  >
                    Edit
                  </button>
                </div>
                <p className="mb-1 text-sm text-muted-foreground">
                  {office.devices.length} device{office.devices.length !== 1 ? 's' : ''}
                </p>
                {office.devices.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1 text-left font-medium">Type</th>
                        <th className="py-1 text-left font-medium">Model</th>
                        <th className="py-1 text-left font-medium">ID</th>
                        <th className="py-1 text-left font-medium">Assigned To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {office.devices.map((d) => (
                        <tr key={d.identifier} className="border-b last:border-0">
                          <td className="py-1">{d.type}</td>
                          <td className="py-1">{d.model}</td>
                          <td className="py-1 font-mono">{d.identifier}</td>
                          <td className="py-1">{d.assignedTo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    )
  }

  return { default: LocationMap }
})

export const Route = createFileRoute('/_appbar/_sidebar/assets/location')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('assets.location', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const queryClient = useQueryClient()

  const { data: locations = [], isLoading: isLoadingLocs, isError: isErrorLocs, error: locsError } = useQuery<OfficeLocation[]>({
    queryKey: ['locations'],
    queryFn: getLocations,
  })

  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel'],
    queryFn: getPersonnel,
  })

  // Merge: for each location, gather devices from personnel whose device.location matches
  const mapLocations: MapLocation[] = locations.map((loc) => {
    const devices: DeviceAtLocation[] = personnel.flatMap((person: any) =>
      (person.devices ?? [])
        .filter((d: any) => d.location === loc.name)
        .map((d: any) => ({
          type: d.type,
          make: d.make,
          model: d.model,
          identifier: d.identifier,
          assignedTo: person.name,
        })),
    )
    return { ...loc, devices }
  })

  type FormMode = 'add' | 'edit' | null
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [editingLocation, setEditingLocation] = useState<MapLocation | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)

  async function lookupCoordinates() {
    const q = nameInput.trim()
    if (!q) return
    setIsGeocoding(true)
    setGeocodeError(null)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      )
      const data = await res.json()
      if (!data || data.length === 0) {
        setGeocodeError('Location not found. Try a more specific name.')
        return
      }
      setLatInput(parseFloat(data[0].lat).toFixed(6))
      setLngInput(parseFloat(data[0].lon).toFixed(6))
    } catch {
      setGeocodeError('Geocoding request failed.')
    } finally {
      setIsGeocoding(false)
    }
  }

  function closeForm() {
    setFormMode(null)
    setEditingLocation(null)
    setNameInput('')
    setLatInput('')
    setLngInput('')
    setGeocodeError(null)
  }

  function openAddForm() {
    if (formMode === 'add') { closeForm(); return }
    closeForm()
    setFormMode('add')
  }

  function openEditForm(loc: MapLocation) {
    setEditingLocation(loc)
    setNameInput(loc.name)
    setLatInput(String(loc.lat))
    setLngInput(String(loc.lng))
    setFormMode('edit')
  }

  const addMutation = useMutation({
    mutationFn: () =>
      createLocation({ name: nameInput.trim(), lat: parseFloat(latInput), lng: parseFloat(lngInput) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      closeForm()
    },
  })

  const editMutation = useMutation({
    mutationFn: () =>
      updateLocation(editingLocation!._id!, {
        name: nameInput.trim(),
        lat: parseFloat(latInput),
        lng: parseFloat(lngInput),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      closeForm()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    if (!nameInput.trim() || isNaN(lat) || isNaN(lng)) return
    if (formMode === 'add') addMutation.mutate()
    else if (formMode === 'edit') editMutation.mutate()
  }

  const isPending = addMutation.isPending || editMutation.isPending
  const mutationError =
    (addMutation.isError ? (addMutation.error as Error)?.message : null) ||
    (editMutation.isError ? (editMutation.error as Error)?.message : null)
  const showForm = formMode !== null

  return (
    <div className="flex h-full">
      {/* Map area */}
      <div className="relative flex-1">
        {isLoadingLocs ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">Loading map…</div>
        ) : isErrorLocs ? (
          <div className="flex h-full items-center justify-center text-destructive">
            {(locsError as Error)?.message ?? 'Failed to load locations.'}
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading map…
              </div>
            }
          >
            <LazyMap locations={mapLocations} onEditLocation={openEditForm} />
          </Suspense>
        )}

        {/* + button overlay (above Leaflet controls layer) */}
        <div className="absolute right-4 top-4 z-[1000]">
          <Button
            variant={formMode === 'add' ? 'outline' : 'default'}
            size="icon"
            className="h-8 w-8 shadow"
            onClick={openAddForm}
          >
            {formMode === 'add' ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Slide-in form panel */}
      <div
        className={cn(
          'shrink-0 overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
          showForm ? 'w-80' : 'w-0 border-l-0',
        )}
      >
        <form onSubmit={handleSubmit} className="flex h-full w-80 flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {formMode === 'edit' ? 'Edit Location' : 'New Location'}
            </h3>
            <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Name (e.g. Burlington, ON)"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); setGeocodeError(null) }}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={isGeocoding || !nameInput.trim()}
              onClick={lookupCoordinates}
            >
              {isGeocoding ? '…' : 'Look up'}
            </Button>
          </div>
          {geocodeError && <p className="text-sm text-destructive">{geocodeError}</p>}
          <Input
            placeholder="Latitude"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            type="number"
            step="any"
          />
          <Input
            placeholder="Longitude"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            type="number"
            step="any"
          />
          {mutationError && <p className="text-sm text-destructive">{mutationError}</p>}
          <Button type="submit" className="mt-1" disabled={isPending}>
            {isPending ? (formMode === 'edit' ? 'Updating…' : 'Adding…') : (formMode === 'edit' ? 'Update' : 'Add')}
          </Button>
        </form>
      </div>
    </div>
  )
}
