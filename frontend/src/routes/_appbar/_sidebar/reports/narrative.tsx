import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { can } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_appbar/_sidebar/reports/narrative')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('reports.narrative', 'read')) {
      throw redirect({ to: '/' })
    }
  },
  component: RouteComponent,
})

interface HubLocation {
  _id: string
  stationName: string
  csoCode: string
  legalName: string
}

function RouteComponent() {
  const [locations, setLocations] = useState<Array<HubLocation>>([])
  const [selectedLocation, setSelectedLocation] = useState<HubLocation | null>(
    null,
  )
  const [date, setDate] = useState('')
  const [narrativeText, setNarrativeText] = useState('')
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('https://app.gen7fuel.com/api/locations')
      .then((res) => res.json())
      .then((data: Array<HubLocation>) => setLocations(data))
      .catch(() => setError('Failed to load stations.'))
  }, [])

  useEffect(() => {
    if (!selectedLocation || !date) return

    setFetching(true)
    setSaved(false)
    apiFetch(`/api/narrative/${selectedLocation.csoCode}/${date}`)
      .then((res) => res.json())
      .then((data) => {
        setNarrativeText(data?.NarrativeText || '')
      })
      .catch(() => {
        setNarrativeText('')
      })
      .finally(() => setFetching(false))
  }, [selectedLocation, date])

  const handleLocationChange = (stationName: string) => {
    const loc = locations.find((l) => l.stationName === stationName) ?? null
    setSelectedLocation(loc)
    setSaved(false)
    setNarrativeText('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocation || !date || !narrativeText.trim()) return

    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await apiFetch('/api/narrative', {
        method: 'POST',
        body: JSON.stringify({
          csoCode: selectedLocation.csoCode,
          legalName: selectedLocation.legalName,
          reportDate: date,
          narrativeText,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save.')
      }
      setSaved(true)
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit =
    !!selectedLocation && !!date && narrativeText.trim().length > 0 && !saving

  return (
    <div className="max-w-2xl p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Station Narrative Summary</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <Label>Station</Label>
            <Select onValueChange={handleLocationChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select a station" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Stations</SelectLabel>
                  {locations.length > 0 ? (
                    locations.map((loc) => (
                      <SelectItem key={loc._id} value={loc.stationName}>
                        {loc.stationName}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="none">
                      No stations available
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="date">Report Date</Label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setSaved(false)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        {fetching && (
          <p className="text-sm text-muted-foreground">
            Loading existing record...
          </p>
        )}

        <div className="flex flex-col gap-1">
          <Label htmlFor="narrative">Narrative</Label>
          <Textarea
            id="narrative"
            value={narrativeText}
            onChange={(e) => {
              setNarrativeText(e.target.value)
              setSaved(false)
            }}
            placeholder="Enter the station narrative summary..."
            rows={8}
            disabled={fetching}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={!canSubmit}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">
              Saved successfully.
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
