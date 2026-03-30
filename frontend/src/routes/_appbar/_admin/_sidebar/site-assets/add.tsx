import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle, ImageIcon, X } from 'lucide-react'
import type { Category } from '@/lib/site-assets-api'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CATEGORIES,
  DEVICE_TYPES,
  createSiteAsset,
  getLocations,
} from '@/lib/site-assets-api'

export const Route = createFileRoute(
  '/_appbar/_admin/_sidebar/site-assets/add',
)({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('admin.site-assets', 'create')) {
      throw redirect({ to: '/' })
    }
  },
})

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas
          .getContext('2d')!
          .drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

function RouteComponent() {
  const labelRef = useRef<HTMLInputElement>(null)

  const [site, setSite] = useState('')
  const [category, setCategory] = useState<Category | ''>('')
  const [deviceType, setDeviceType] = useState('')
  const [label, setLabel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [photo, setPhoto] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: locations, isError: locationsError } = useQuery({
    queryKey: ['site-asset-locations'],
    queryFn: getLocations,
  })

  // Auto-set deviceType for Tablet (only one option)
  useEffect(() => {
    if (category === 'Tablet') {
      setDeviceType('Tablet')
    } else {
      setDeviceType('')
    }
  }, [category])

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(false), 4000)
      return () => clearTimeout(t)
    }
  }, [success])

  function reset() {
    setSite('')
    setCategory('')
    setDeviceType('')
    setLabel('')
    setSerialNumber('')
    setPhoto('')
    mutation.reset()
    setTimeout(() => labelRef.current?.focus(), 50)
  }

  const mutation = useMutation({
    mutationFn: () =>
      createSiteAsset({
        site,
        category: category as Category,
        deviceType,
        label: label.trim(),
        serialNumber: serialNumber.trim(),
        photo,
      }),
    onSuccess: () => {
      setSuccess(true)
      reset()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!site || !category || !deviceType || !label.trim()) return
    if (mutation.isPending) return
    mutation.mutate()
  }

  const deviceOptions =
    category && category !== 'Tablet' && category !== 'Other'
      ? DEVICE_TYPES[category]
      : []

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">Add Asset</h1>

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Asset added successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Site */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Site</label>
          {locationsError && (
            <p className="text-xs text-destructive">
              Failed to load sites. Check your permissions.
            </p>
          )}
          <Select value={site} onValueChange={setSite}>
            <SelectTrigger>
              <SelectValue placeholder="Select site..." />
            </SelectTrigger>
            <SelectContent>
              {locations?.map((loc) => (
                <SelectItem key={loc._id} value={loc.stationName}>
                  {loc.stationName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Category</label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as Category)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Device Type — hidden for Tablet (auto-set), free text for Other, dropdown otherwise */}
        {category && category !== 'Tablet' && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Device Type</label>
            {category === 'Other' ? (
              <Input
                placeholder="e.g. UPS, Router, Camera..."
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
              />
            ) : (
              <Select value={deviceType} onValueChange={setDeviceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select device type..." />
                </SelectTrigger>
                <SelectContent>
                  {deviceOptions.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {dt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Device */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Device</label>
          <Input
            ref={labelRef}
            placeholder="e.g. Monitor, Scanner, etc."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Serial Number */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Serial Number{' '}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            placeholder="e.g. SN-12345"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
        </div>

        {/* Photo */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Photo{' '}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          {photo ? (
            <div className="relative">
              <img
                src={photo}
                alt="Device"
                className="h-40 w-full rounded border object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto('')}
                className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 text-destructive hover:bg-background"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded border border-dashed text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
              <ImageIcon className="mb-1 h-5 w-5" />
              <span className="text-xs">Click to upload photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) setPhoto(await compressImage(file))
                }}
              />
            </label>
          )}
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">{mutation.error.message}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={
            mutation.isPending ||
            !site ||
            !category ||
            !deviceType ||
            !label.trim()
          }
        >
          {mutation.isPending ? 'Adding...' : 'Add Asset'}
        </Button>
      </form>
    </div>
  )
}
