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
import { apiFetch } from '@/lib/api'

interface Location {
  _id: string
  stationName: string
}

interface SitePickerProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}

export function SitePicker({
  value,
  onValueChange,
  placeholder = 'Select a site',
  label = 'Sites',
  className = 'w-[180px]',
}: SitePickerProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('https://app.gen7fuel.com/api/locations')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then((data: Location[]) => setLocations(data))
      .catch((err) => {
        console.error('Error fetching locations:', err)
        setError('Failed to load locations')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Loading locations..." />
        </SelectTrigger>
      </Select>
    )
  }

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder={error} />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {locations.length > 0 ? (
            locations.map((location) => (
              <SelectItem key={location._id} value={location.stationName}>
                {location.stationName}
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
