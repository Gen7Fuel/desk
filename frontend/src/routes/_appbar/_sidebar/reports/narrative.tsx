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
import { cn } from '@/lib/utils'

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

interface NarrativeEntry {
  Station_SK: string
  Station: string
  ReportDate: string
  NarrativeText: string | null
  Suggestion: string | null
  CreatedAt: string
  UpdatedAt: string
}

function formatDate(dateStr: string) {
  return String(dateStr).slice(0, 10)
}

function RouteComponent() {
  const [locations, setLocations] = useState<Array<HubLocation>>([])
  const [selectedLocation, setSelectedLocation] = useState<HubLocation | null>(
    null,
  )
  const [entries, setEntries] = useState<Array<NarrativeEntry>>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<NarrativeEntry | null>(
    null,
  )
  const [narrativeText, setNarrativeText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('https://app.gen7fuel.com/api/locations')
      .then((res) => res.json())
      .then((data: Array<HubLocation>) => setLocations(data))
      .catch(() => setError('Failed to load stations.'))
  }, [])

  useEffect(() => {
    if (!selectedLocation) return
    setLoadingEntries(true)
    setEntries([])
    setSelectedEntry(null)
    setNarrativeText('')
    setSaved(false)
    apiFetch(`/api/narrative/${selectedLocation.csoCode}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(
            (body && (body.error || body.message)) ||
              `Request failed with status ${res.status}`,
          )
        }
        return body
      })
      .then((data: unknown) => setEntries(Array.isArray(data) ? data : []))
      .catch((err) => {
        setError(err.message || 'Failed to load entries.')
        setEntries([])
      })
      .finally(() => setLoadingEntries(false))
  }, [selectedLocation])

  const handleLocationChange = (stationName: string) => {
    const loc = locations.find((l) => l.stationName === stationName) ?? null
    setSelectedLocation(loc)
    setError(null)
  }

  const handleSelectEntry = (entry: NarrativeEntry) => {
    setSelectedEntry(entry)
    setNarrativeText(entry.NarrativeText || '')
    setSaved(false)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocation || !selectedEntry || !narrativeText.trim()) return

    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await apiFetch('/api/narrative', {
        method: 'POST',
        body: JSON.stringify({
          csoCode: selectedLocation.csoCode,
          legalName: selectedLocation.legalName,
          reportDate: formatDate(selectedEntry.ReportDate),
          narrativeText,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save.')
      }
      setSaved(true)
      setEntries((prev) =>
        prev.map((entry) =>
          entry.ReportDate === selectedEntry.ReportDate
            ? { ...entry, NarrativeText: narrativeText }
            : entry,
        ),
      )
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit =
    !!selectedEntry && narrativeText.trim().length > 0 && !saving

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-72 flex flex-col border-r">
        <div className="p-4 border-b">
          <h1 className="text-base font-semibold mb-3">Station Narrative</h1>
          <Select onValueChange={handleLocationChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a station" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Stations</SelectLabel>
                {locations.map((loc) => (
                  <SelectItem key={loc._id} value={loc.stationName}>
                    {loc.stationName}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto">
          {loadingEntries && (
            <p className="p-4 text-sm text-muted-foreground">
              Loading entries…
            </p>
          )}
          {!loadingEntries && selectedLocation && entries.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No entries found.
            </p>
          )}
          {!loadingEntries && !selectedLocation && (
            <p className="p-4 text-sm text-muted-foreground">
              Select a station to view entries.
            </p>
          )}
          {entries.map((entry) => (
            <button
              key={entry.ReportDate}
              onClick={() => handleSelectEntry(entry)}
              className={cn(
                'w-full text-left px-4 py-3 border-b hover:bg-accent transition-colors',
                selectedEntry?.ReportDate === entry.ReportDate && 'bg-accent',
              )}
            >
              <div className="text-sm font-medium">
                {formatDate(entry.ReportDate)}
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {entry.NarrativeText
                  ? entry.NarrativeText.slice(0, 60) +
                    (entry.NarrativeText.length > 60 ? '…' : '')
                  : 'No narrative yet'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedEntry && (
          <p className="text-sm text-muted-foreground">
            Select an entry to view and edit.
          </p>
        )}
        {selectedEntry && (
          <form
            onSubmit={handleSubmit}
            className="max-w-2xl flex flex-col gap-5"
          >
            <div className="flex flex-col gap-0.5">
              <h2 className="text-lg font-semibold">
                {selectedLocation?.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Report Date: {formatDate(selectedEntry.ReportDate)}
              </p>
            </div>

            {can('reports.narrative', 'create') && selectedEntry.Suggestion && (
              <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Suggestion
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedEntry.Suggestion}
                </p>
              </div>
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
                placeholder="Enter the station narrative summary…"
                rows={10}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={!canSubmit}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {saved && (
                <span className="text-sm text-green-600 font-medium">
                  Saved successfully.
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
