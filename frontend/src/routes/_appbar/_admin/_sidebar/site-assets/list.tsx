import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, X } from 'lucide-react'
import type { Category, SiteAsset, SiteAssetInput } from '@/lib/site-assets-api'
import { cn } from '@/lib/utils'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CATEGORIES,
  DEVICE_TYPES,
  deleteSiteAsset,
  getLocations,
  getSiteAssets,
  updateSiteAsset,
} from '@/lib/site-assets-api'

export const Route = createFileRoute(
  '/_appbar/_admin/_sidebar/site-assets/list',
)({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('admin.site-assets', 'read')) {
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
  const queryClient = useQueryClient()
  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>('all')
  const [editingAsset, setEditingAsset] = useState<SiteAsset | null>(null)
  const [deletingAsset, setDeletingAsset] = useState<SiteAsset | null>(null)
  const [photoAsset, setPhotoAsset] = useState<SiteAsset | null>(null)

  // Edit form state
  const [editSite, setEditSite] = useState('')
  const [editCategory, setEditCategory] = useState<Category | ''>('')
  const [editDeviceType, setEditDeviceType] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editSerial, setEditSerial] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPhoto, setEditPhoto] = useState('')

  const editLabelRef = useRef<HTMLInputElement>(null)

  const { data: locations } = useQuery({
    queryKey: ['site-asset-locations'],
    queryFn: getLocations,
  })

  const { data: assets, isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => getSiteAssets(),
  })

  // Collect unique site names from loaded assets + locations for the filter bar
  const siteNames = Array.from(
    new Set([
      ...(locations?.map((l) => l.stationName) ?? []),
      ...(assets?.map((a) => a.site) ?? []),
    ]),
  ).sort()

  const siteCategoryFiltered = (assets ?? []).filter(
    (a) =>
      (selectedSite === 'all' || a.site === selectedSite) &&
      (selectedCategory === 'all' || a.category === selectedCategory),
  )

  const displayedAssets = siteCategoryFiltered.filter(
    (a) => selectedDeviceType === 'all' || a.deviceType === selectedDeviceType,
  )

  const deviceTypeOptions: Array<string> =
    selectedCategory === 'all'
      ? ['Tablet', ...Object.values(DEVICE_TYPES).flat()]
      : selectedCategory === 'Tablet'
        ? ['Tablet']
        : selectedCategory !== 'Other'
          ? DEVICE_TYPES[
              selectedCategory as Exclude<Category, 'Other' | 'Tablet'>
            ]
          : []

  useEffect(() => {
    if (editingAsset) {
      setTimeout(() => editLabelRef.current?.focus(), 150)
    }
  }, [editingAsset])

  function openEdit(asset: SiteAsset) {
    setEditingAsset(asset)
    setEditSite(asset.site)
    setEditCategory(asset.category)
    setEditDeviceType(asset.deviceType)
    setEditLabel(asset.label)
    setEditSerial(asset.serialNumber)
    setEditNotes(asset.notes)
    setEditPhoto(asset.photo)
    updateMutation.reset()
  }

  function closeEdit() {
    setEditingAsset(null)
    updateMutation.reset()
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingAsset) throw new Error('No asset selected')
      const payload: SiteAssetInput = {
        site: editSite,
        category: editCategory as Category,
        deviceType: editDeviceType,
        label: editLabel.trim(),
        serialNumber: editSerial.trim(),
        notes: editNotes.trim(),
        photo: editPhoto,
      }
      return updateSiteAsset(editingAsset._id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-assets'] })
      closeEdit()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSiteAsset(deletingAsset!._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-assets'] })
      setDeletingAsset(null)
    },
  })

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editSite || !editCategory || !editDeviceType || !editLabel.trim())
      return
    if (updateMutation.isPending) return
    updateMutation.mutate()
  }

  const editDeviceOptions =
    editCategory && editCategory !== 'Tablet' && editCategory !== 'Other'
      ? DEVICE_TYPES[editCategory]
      : []
  const showForm = !!editingAsset
  const canUpdate = can('admin.site-assets', 'update')
  const canDelete = can('admin.site-assets', 'delete')

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Filters */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Select
            value={selectedSite}
            onValueChange={(v) => {
              setSelectedSite(v)
              setSelectedDeviceType('all')
            }}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {siteNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedCategory}
            onValueChange={(v) => {
              setSelectedCategory(v)
              setSelectedDeviceType('all')
            }}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedDeviceType}
            onValueChange={setSelectedDeviceType}
            disabled={deviceTypeOptions.length === 0}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All device types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All device types</SelectItem>
              {deviceTypeOptions.map((dt) => (
                <SelectItem key={dt} value={dt}>
                  {dt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedSite !== 'all' ||
            selectedCategory !== 'all' ||
            selectedDeviceType !== 'all') && (
            <button
              onClick={() => {
                setSelectedSite('all')
                setSelectedCategory('all')
                setSelectedDeviceType('all')
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              Loading...
            </p>
          ) : displayedAssets.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              {selectedSite === 'all' &&
              selectedCategory === 'all' &&
              selectedDeviceType === 'all'
                ? 'No assets added yet.'
                : 'No assets match the selected filters.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Device Type</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedAssets.map((asset) => (
                  <TableRow key={asset._id}>
                    <TableCell>{asset.site}</TableCell>
                    <TableCell>{asset.category}</TableCell>
                    <TableCell>{asset.deviceType}</TableCell>
                    <TableCell className="font-medium">{asset.label}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {asset.serialNumber || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {asset.photo ? (
                        <button
                          type="button"
                          onClick={() => setPhotoAsset(asset)}
                          className="block"
                        >
                          <img
                            src={asset.photo}
                            alt={asset.label}
                            className="h-8 w-12 rounded object-cover transition-opacity hover:opacity-75"
                          />
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openEdit(asset)}
                          >
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingAsset(asset)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Slide-in edit panel */}
      <div
        className={cn(
          'shrink-0 overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
          showForm ? 'w-[360px]' : 'w-0 border-l-0',
        )}
      >
        {showForm && (
          <form
            onSubmit={handleEditSubmit}
            className="flex h-full w-[360px] flex-col"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Edit Asset</h3>
              <button
                type="button"
                onClick={closeEdit}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {/* Site */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Site</label>
                <Select value={editSite} onValueChange={setEditSite}>
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
                <label className="text-xs font-medium">Category</label>
                <Select
                  value={editCategory}
                  onValueChange={(v) => {
                    const cat = v as Category
                    setEditCategory(cat)
                    setEditDeviceType(cat === 'Tablet' ? 'Tablet' : '')
                  }}
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

              {/* Device Type */}
              {editCategory && editCategory !== 'Tablet' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Device Type</label>
                  {editCategory === 'Other' ? (
                    <Input
                      placeholder="e.g. UPS, Router, Camera..."
                      value={editDeviceType}
                      onChange={(e) => setEditDeviceType(e.target.value)}
                    />
                  ) : (
                    <Select
                      value={editDeviceType}
                      onValueChange={setEditDeviceType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {editDeviceOptions.map((dt) => (
                          <SelectItem key={dt} value={dt}>
                            {dt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Label */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Device</label>
                <Input
                  ref={editLabelRef}
                  placeholder="e.g. Paypoint 1"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
              </div>

              {/* Serial Number */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Serial Number</label>
                <Input
                  placeholder="e.g. SN-12345 (optional)"
                  value={editSerial}
                  onChange={(e) => setEditSerial(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Notes</label>
                <textarea
                  placeholder="Any additional notes... (optional)"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              {/* Photo */}
              <div className="space-y-1">
                <label className="text-xs font-medium">Photo</label>
                {editPhoto ? (
                  <div className="relative">
                    <img
                      src={editPhoto}
                      alt="Device"
                      className="h-32 w-full rounded border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setEditPhoto('')}
                      className="absolute right-1.5 top-1.5 rounded bg-background/80 p-0.5 text-destructive hover:bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-16 cursor-pointer flex-col items-center justify-center rounded border border-dashed text-muted-foreground hover:border-foreground/30 hover:text-foreground">
                    <ImageIcon className="mb-0.5 h-4 w-4" />
                    <span className="text-xs">Upload photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) setEditPhoto(await compressImage(file))
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="border-t px-4 py-3 space-y-2">
              {updateMutation.isError && (
                <p className="text-sm text-destructive">
                  {updateMutation.error.message}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  updateMutation.isPending ||
                  !editSite ||
                  !editCategory ||
                  !editDeviceType ||
                  !editLabel.trim()
                }
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Photo viewer dialog */}
      <Dialog
        open={!!photoAsset}
        onOpenChange={(open) => {
          if (!open) setPhotoAsset(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{photoAsset?.label}</DialogTitle>
            <DialogDescription>
              {photoAsset?.deviceType} — {photoAsset?.site}
            </DialogDescription>
          </DialogHeader>
          {photoAsset?.photo && (
            <img
              src={photoAsset.photo}
              alt={photoAsset.label}
              className="w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deletingAsset}
        onOpenChange={(open) => {
          if (!open) setDeletingAsset(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                {deletingAsset?.label}
              </span>{' '}
              ({deletingAsset?.deviceType} — {deletingAsset?.site})? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <p className="text-sm text-destructive">
              {deleteMutation.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingAsset(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
