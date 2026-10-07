import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import type { SageVendor, VendorTag } from '@/lib/payable-vendor-tags'
import { fetchSageApVendors, saveVendorTag } from '@/lib/payable-vendor-tags'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  /** The payable vendor name being tagged; the dialog is open while it's set. */
  vendorName: string | null
  /** Intacct vendor ID the name is currently tagged with, if any. */
  currentId?: string
  onClose: () => void
  onTagged: (tag: VendorTag) => void
}

export default function VendorTagDialog({
  vendorName,
  currentId,
  onClose,
  onTagged,
}: Props) {
  const open = vendorName !== null
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const {
    data: vendors,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['sage-ap-vendors'],
    queryFn: fetchSageApVendors,
    enabled: open,
    staleTime: 10 * 60 * 1000,
  })

  const needle = search.trim().toLowerCase()
  const filtered = (vendors ?? []).filter(
    (v) =>
      !needle ||
      v.name.toLowerCase().includes(needle) ||
      v.id.toLowerCase().includes(needle),
  )

  function handleOpenChange(next: boolean) {
    if (next) return
    setSearch('')
    setError('')
    onClose()
  }

  async function choose(vendor: SageVendor) {
    if (!vendorName) return
    setSavingId(vendor.id)
    setError('')
    try {
      onTagged(await saveVendorTag(vendorName, vendor))
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the tag')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Tag &ldquo;{vendorName}&rdquo; with an Intacct vendor
          </DialogTitle>
        </DialogHeader>

        <Input
          autoFocus
          placeholder="Search by name or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {(loadError || error) && (
          <p className="text-sm text-destructive">
            {error ||
              (loadError instanceof Error
                ? loadError.message
                : 'Failed to load vendors')}
          </p>
        )}

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading Intacct
              vendors…
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No vendors match.
            </p>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={savingId !== null}
                onClick={() => void choose(v)}
                className={cn(
                  'flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent disabled:opacity-60',
                  v.id === currentId && 'bg-accent/60',
                )}
              >
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                  {v.id}
                </span>
                <span className="flex-1">{v.name}</span>
                {savingId === v.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  v.id === currentId && <Check className="h-4 w-4" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
