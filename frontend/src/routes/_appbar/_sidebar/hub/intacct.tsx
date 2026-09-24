import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { can, getExternalToken } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import { SitePicker } from '@/components/custom/SitePicker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/hub/intacct')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.intacct', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

const HUB = 'https://app.gen7fuel.com'

interface SageCustomer {
  id: string
  name: string
}

interface EntityInfo {
  sageToken: string
  locationId: string
}

async function resolveEntity(site: string): Promise<EntityInfo> {
  const tokenRes = await apiFetch('/api/sage/connect', { method: 'POST' })
  if (!tokenRes.ok) throw new Error('Failed to get Sage token')
  const { access_token: sageToken } = (await tokenRes.json()) as {
    access_token: string
  }

  const locRes = await fetch(`${HUB}/api/locations`, {
    headers: { Authorization: `Bearer ${getExternalToken()}` },
  })
  if (!locRes.ok) throw new Error('Failed to fetch Hub locations')
  const locations = (await locRes.json()) as Array<{
    stationName: string
    site?: string
    sageEntityKey?: string
  }>
  const loc = locations.find((l) => (l.site ?? l.stationName) === site)
  if (!loc?.sageEntityKey)
    throw new Error(`No Sage entity key configured for "${site}"`)

  const entityRes = await apiFetch(`/api/sage/entity/${loc.sageEntityKey}`, {
    headers: { 'X-Sage-Token': sageToken },
  })
  if (!entityRes.ok) throw new Error('Failed to fetch Sage entity')
  const entityData = (await entityRes.json()) as {
    'ia::result': { id: string }
  }
  const locationId = entityData['ia::result'].id
  if (!locationId) throw new Error('Could not resolve Sage location ID')

  return { sageToken, locationId }
}

// ---------------------------------------------------------------------------
// AR Purchase Orders (last week) panel
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Computes yesterday first, then takes the Monday on/before it — so opening
// the page on a Monday falls back to the prior week's Mon-Sun range instead
// of producing an inverted/empty one.
function computeLastWeekRange(): { startDate: string; endDate: string } {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const diffToMonday = (yesterday.getDay() + 6) % 7
  const monday = new Date(yesterday)
  monday.setDate(yesterday.getDate() - diffToMonday)
  return { startDate: toDateStr(monday), endDate: toDateStr(yesterday) }
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatAmount(amount: number): string {
  return `$${(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface HubLocation {
  stationName: string
  site?: string
}

interface PurchaseOrderRow {
  _id: string
  date: string
  dateStr?: string
  stationName: string
  customerName: string
  poNumber: string
  quantity: number
  amount: number
}

function poRowDate(row: Pick<PurchaseOrderRow, 'date' | 'dateStr'>): string {
  return row.dateStr || new Date(row.date).toLocaleDateString('en-CA')
}

async function fetchHubLocations(): Promise<Array<HubLocation>> {
  const res = await fetch(`${HUB}/api/locations`, {
    headers: { Authorization: `Bearer ${getExternalToken()}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Hub locations')
  return (await res.json()) as Array<HubLocation>
}

async function fetchArPurchaseOrders(
  startDate: string,
  endDate: string,
  site: string,
): Promise<Array<PurchaseOrderRow>> {
  const params = new URLSearchParams({ startDate, endDate })
  if (site !== 'all') {
    params.set('site', site)
    params.set('stationName', site)
  }
  const res = await fetch(`${HUB}/api/purchase-orders?${params}`, {
    headers: {
      Authorization: `Bearer ${getExternalToken()}`,
      'X-Required-Permission': 'po',
    },
  })
  if (!res.ok) throw new Error('Failed to fetch purchase orders')
  const data: unknown = await res.json()
  return Array.isArray(data) ? (data as Array<PurchaseOrderRow>) : []
}

function ArPurchaseOrdersPanel() {
  const [range] = useState(computeLastWeekRange)
  const [poSite, setPoSite] = useState('all')

  const { data: locations = [] } = useQuery({
    queryKey: ['hub-locations'],
    queryFn: fetchHubLocations,
  })

  const {
    data: orders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ar-purchase-orders', range.startDate, range.endDate, poSite],
    queryFn: () =>
      fetchArPurchaseOrders(range.startDate, range.endDate, poSite),
  })

  const total = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0)

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">AR Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">
            {formatDateLabel(range.startDate)} –{' '}
            {formatDateLabel(range.endDate)}
          </p>
        </div>
        <div className="w-56 space-y-1.5">
          <Label>Site</Label>
          <Select value={poSite} onValueChange={setPoSite}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {locations.map((loc) => {
                const name = loc.site ?? loc.stationName
                return (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load purchase orders.
        </p>
      )}

      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>PO #</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  No AR purchase orders found.
                </TableCell>
              </TableRow>
            )}
            {orders.map((order) => (
              <TableRow key={order._id}>
                <TableCell className="text-sm">{poRowDate(order)}</TableCell>
                <TableCell className="text-sm">
                  {order.stationName}
                </TableCell>
                <TableCell className="text-sm">
                  {order.customerName}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {order.poNumber}
                </TableCell>
                <TableCell className="text-sm">{order.quantity}</TableCell>
                <TableCell className="text-sm">
                  {formatAmount(order.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {orders.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>Total</TableCell>
                <TableCell>{formatAmount(total)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      )}
    </div>
  )
}

async function searchCustomers(
  entity: EntityInfo,
  q: string,
): Promise<Array<SageCustomer>> {
  const res = await apiFetch(
    `/api/sage/customers?q=${encodeURIComponent(q)}`,
    {
      headers: {
        'X-Sage-Token': entity.sageToken,
        'X-Sage-Entity': entity.locationId,
      },
    },
  )
  if (!res.ok) throw new Error('Failed to search Sage customers')
  const data = (await res.json()) as {
    'ia::result'?: Array<SageCustomer>
  }
  return data['ia::result'] ?? []
}

function RouteComponent() {
  const [site, setSite] = useState<string | undefined>(undefined)
  const [entity, setEntity] = useState<EntityInfo | null>(null)
  const [entityLoading, setEntityLoading] = useState(false)
  const [entityError, setEntityError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [open, setOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] =
    useState<SageCustomer | null>(null)

  // Resolve the Sage token + entity location whenever the selected site changes.
  useEffect(() => {
    setEntity(null)
    setEntityError('')
    setSelectedCustomer(null)
    setSearchInput('')
    setDebouncedSearch('')
    if (!site) return

    let cancelled = false
    setEntityLoading(true)
    resolveEntity(site)
      .then((result) => {
        if (!cancelled) setEntity(result)
      })
      .catch((err) => {
        if (!cancelled)
          setEntityError(
            err instanceof Error ? err.message : 'Failed to resolve entity',
          )
      })
      .finally(() => {
        if (!cancelled) setEntityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [site])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  const {
    data: customers = [],
    isLoading: customersLoading,
    error: customersError,
  } = useQuery({
    queryKey: ['sage-customers', entity?.locationId, debouncedSearch],
    queryFn: () => searchCustomers(entity!, debouncedSearch),
    enabled: !!entity && open,
  })

  function handleSelect(customer: SageCustomer) {
    setSelectedCustomer(customer)
    setSearchInput(customer.name)
    setOpen(false)
  }

  const inputDisabled = !site || entityLoading || !!entityError

  return (
    <div className="p-6">
      <h1 className="mb-6 text-lg font-semibold">Intacct</h1>

      <ArPurchaseOrdersPanel />

      <div className="mb-4 flex items-end gap-4">
        <div className="space-y-1.5">
          <Label>Site</Label>
          <SitePicker value={site} onValueChange={setSite} />
        </div>

        <div className="w-72 space-y-1.5">
          <Label>AR Customer</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
              <div>
                <Input
                  placeholder={
                    !site
                      ? 'Select a site first'
                      : entityLoading
                        ? 'Resolving Sage entity…'
                        : 'Click or type to search…'
                  }
                  value={searchInput}
                  disabled={inputDisabled}
                  onFocus={() => setOpen(true)}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    setSelectedCustomer(null)
                    setOpen(true)
                  }}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              className="w-72 p-1"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {customersLoading && (
                <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              )}
              {customersError && (
                <p className="px-2 py-2 text-sm text-destructive">
                  Failed to load customers.
                </p>
              )}
              {!customersLoading &&
                !customersError &&
                customers.length === 0 && (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    No customers found.
                  </p>
                )}
              {!customersLoading &&
                !customersError &&
                customers.length > 0 && (
                  <div className="max-h-72 overflow-y-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => handleSelect(customer)}
                      >
                        <span className="font-medium">{customer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {customer.id}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {entityError && (
        <p className="mb-4 text-sm text-destructive">{entityError}</p>
      )}

      <div className="text-sm">
        {selectedCustomer ? (
          <p>
            Selected:{' '}
            <span className="font-medium">{selectedCustomer.name}</span>{' '}
            <span className="font-mono text-muted-foreground">
              ({selectedCustomer.id})
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">No customer selected.</p>
        )}
      </div>
    </div>
  )
}
