import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Location {
  _id: string
  stationName: string
  site?: string
}

interface SitePickerProps {
  id?: string
  additionalSites?: Array<string>
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}

export function SitePicker({
  id,
  additionalSites = [],
  value,
  onValueChange,
  placeholder = 'Select a site',
  label = 'Sites',
  className = 'w-[180px]',
}: SitePickerProps) {
  const [locations, setLocations] = useState<Array<Location>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('https://app.gen7fuel.com/api/locations')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then((data: Array<Location>) =>
        setLocations(data.filter((l) => l.stationName)),
      )
      .catch((err) => {
        console.error('Error fetching locations:', err)
        setError('Failed to load locations')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger id={id} className={className}>
          <SelectValue placeholder="Loading locations..." />
        </SelectTrigger>
      </Select>
    )
  }

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger id={id} className={className}>
          <SelectValue placeholder={error} />
        </SelectTrigger>
      </Select>
    )
  }

  const siteNames = [
    ...new Set(
      [
        ...locations.map((location) => location.site || location.stationName),
        ...additionalSites,
      ].filter(Boolean),
    ),
  ]

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className={className}>
        {/* Radix doesn't resolve the displayed label for a value that was
            set programmatically (e.g. pre-filling an edit form) until the
            matching SelectItem has actually rendered once — pass the label
            explicitly instead of relying on its auto-lookup. */}
        <SelectValue placeholder={placeholder}>
          {value || undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {siteNames.length > 0 ? (
            siteNames.map((site) => (
              <SelectItem key={site} value={site}>
                {site}
              </SelectItem>
            ))
          ) : (
            <SelectItem disabled value="null">
              No sites available
            </SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
