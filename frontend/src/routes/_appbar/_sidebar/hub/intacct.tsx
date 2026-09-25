import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { can, getExternalToken } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
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

async function getSageToken(): Promise<string> {
  const tokenRes = await apiFetch('/api/sage/connect', { method: 'POST' })
  if (!tokenRes.ok) throw new Error('Failed to get Sage token')
  const { access_token: sageToken } = (await tokenRes.json()) as {
    access_token: string
  }
  return sageToken
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

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateLabel(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// e.g. "Sep 14th-20th, 2026 charges on account", or when the range crosses a
// month/year boundary: "Aug 31st, 2026-Sep 2nd, 2026 charges on account".
function buildChargesLabel(startDate: string, endDate: string): string {
  const start = parseDateStr(startDate)
  const end = parseDateStr(endDate)
  const sameMonthYear =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()

  const range = sameMonthYear
    ? `${format(start, 'MMM do')}-${format(end, 'do')}, ${format(end, 'yyyy')}`
    : `${format(start, 'MMM do, yyyy')}-${format(end, 'MMM do, yyyy')}`

  return `${range} charges on account`
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
  sageToken: string,
  q: string,
): Promise<Array<SageCustomer>> {
  const res = await apiFetch(
    `/api/sage/customers?q=${encodeURIComponent(q)}`,
    { headers: { 'X-Sage-Token': sageToken } },
  )
  if (!res.ok) throw new Error('Failed to search Sage customers')
  const data = (await res.json()) as {
    'ia::result'?: Array<SageCustomer>
  }
  return data['ia::result'] ?? []
}

// ---------------------------------------------------------------------------
// AR Invoice creation
// ---------------------------------------------------------------------------

const INVOICE_GL_ACCOUNT = '40010'
const INVOICE_LOCATION_ID = 'A210'
const INVOICE_TERM_ID = 'Due on Receipt'
const INVOICE_CUSTOMER_MESSAGE_ID = 'Payment'
const INVOICE_TAX_DETAIL_ID = 'Exempt Services Sale'

interface InvoiceLine {
  txnAmount: string
  glAccount: { id: string }
  memo: string
  dimensions: { location: { id: string } }
  taxEntries: Array<{ taxDetail: { id: string } }>
}

function buildInvoiceLines(orders: Array<PurchaseOrderRow>): Array<InvoiceLine> {
  return orders.map((order) => ({
    txnAmount: (Number(order.amount) || 0).toFixed(2),
    glAccount: { id: INVOICE_GL_ACCOUNT },
    memo: order.poNumber,
    dimensions: { location: { id: INVOICE_LOCATION_ID } },
    taxEntries: [{ taxDetail: { id: INVOICE_TAX_DETAIL_ID } }],
  }))
}

async function createInvoice(
  sageToken: string,
  customer: SageCustomer,
  range: { startDate: string; endDate: string },
  referenceNumber: string,
  description: string,
  orders: Array<PurchaseOrderRow>,
): Promise<{ id: string; key: string }> {
  const payload = {
    invoiceDate: range.endDate,
    dueDate: range.endDate,
    customer: { id: customer.id },
    customerMessage: { id: INVOICE_CUSTOMER_MESSAGE_ID },
    referenceNumber,
    description,
    term: { id: INVOICE_TERM_ID },
    currency: { txnCurrency: 'CAD' },
    state: 'draft',
    lines: buildInvoiceLines(orders),
  }

  const res = await apiFetch('/api/sage/invoice', {
    method: 'POST',
    headers: { 'X-Sage-Token': sageToken },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const detail =
      (body?.['ia::error'] as { message?: string } | undefined)?.message ??
      (body?.message as string | undefined) ??
      JSON.stringify(body)
    throw new Error(`Sage ${res.status}: ${detail}`)
  }

  const result = body?.['ia::result'] as
    | { id: string; key: string }
    | undefined
  if (!result?.id) throw new Error('Sage did not return an invoice id.')
  return result
}

function CustomerInvoicePanel({
  range,
  referenceNumber,
  description,
  sageToken,
  customer,
}: {
  range: { startDate: string; endDate: string }
  referenceNumber: string
  description: string
  sageToken: string
  customer: SageCustomer
}) {
  const {
    data: orders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ar-purchase-orders', range.startDate, range.endDate, 'all'],
    queryFn: () => fetchArPurchaseOrders(range.startDate, range.endDate, 'all'),
  })

  const matchedOrders = orders.filter(
    (order) =>
      order.customerName.trim().toLowerCase() ===
      customer.name.trim().toLowerCase(),
  )
  const total = matchedOrders.reduce(
    (sum, order) => sum + (Number(order.amount) || 0),
    0,
  )

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [created, setCreated] = useState<{ id: string; key: string } | null>(
    null,
  )

  async function handleCreateInvoice() {
    setCreating(true)
    setCreateError('')
    try {
      const result = await createInvoice(
        sageToken,
        customer,
        range,
        referenceNumber,
        description,
        matchedOrders,
      )
      setCreated(result)
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create invoice',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mb-8 space-y-3">
      <h2 className="text-base font-semibold">
        Invoice Preview — {customer.name}
      </h2>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load purchase orders.
        </p>
      )}

      {!isLoading && !error && (
        <>
          {matchedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No AR purchase order transactions found for {customer.name} in
              this date range.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Tax Detail</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchedOrders.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell className="font-mono text-sm">
                      {order.poNumber}
                    </TableCell>
                    <TableCell className="text-sm">
                      {INVOICE_GL_ACCOUNT}
                    </TableCell>
                    <TableCell className="text-sm">
                      {INVOICE_TAX_DETAIL_ID}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatAmount(order.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell>{formatAmount(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}

          <Button
            size="sm"
            disabled={matchedOrders.length === 0 || creating || !!created}
            onClick={() => void handleCreateInvoice()}
          >
            {creating ? 'Creating…' : 'Create Invoice (Draft)'}
          </Button>

          {createError && (
            <p className="text-sm text-destructive">{createError}</p>
          )}
          {created && (
            <p className="text-sm text-emerald-600">
              Draft invoice created — id {created.id}, key {created.key}.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function RouteComponent() {
  const [range] = useState(computeLastWeekRange)
  const [referenceNumber] = useState(() =>
    buildChargesLabel(range.startDate, range.endDate),
  )
  const [description] = useState(() =>
    buildChargesLabel(range.startDate, range.endDate),
  )

  const [sageToken, setSageToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [tokenError, setTokenError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [open, setOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] =
    useState<SageCustomer | null>(null)

  // Fetch the Sage token once on mount — the customer search isn't
  // entity-scoped, so no site selection is needed to enable it.
  useEffect(() => {
    let cancelled = false
    getSageToken()
      .then((token) => {
        if (!cancelled) setSageToken(token)
      })
      .catch((err) => {
        if (!cancelled)
          setTokenError(
            err instanceof Error ? err.message : 'Failed to get Sage token',
          )
      })
      .finally(() => {
        if (!cancelled) setTokenLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    queryKey: ['sage-customers', debouncedSearch],
    queryFn: () => searchCustomers(sageToken!, debouncedSearch),
    enabled: !!sageToken && open,
  })

  function handleSelect(customer: SageCustomer) {
    setSelectedCustomer(customer)
    setSearchInput(customer.name)
    setOpen(false)
  }

  const inputDisabled = tokenLoading || !!tokenError

  return (
    <div className="p-6">
      <h1 className="mb-6 text-lg font-semibold">Intacct</h1>

      <ArPurchaseOrdersPanel />

      <div className="mb-8 space-y-1 text-sm">
        <p>
          <span className="font-medium">Reference Number:</span>{' '}
          {referenceNumber}
        </p>
        <p>
          <span className="font-medium">Description:</span> {description}
        </p>
      </div>

      <div className="mb-4 w-72 space-y-1.5">
        <Label>AR Customer</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div>
              <Input
                placeholder={
                  tokenLoading
                    ? 'Connecting to Sage…'
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

      {tokenError && (
        <p className="mb-4 text-sm text-destructive">{tokenError}</p>
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

      {selectedCustomer && sageToken && (
        <CustomerInvoicePanel
          key={selectedCustomer.id}
          range={range}
          referenceNumber={referenceNumber}
          description={description}
          sageToken={sageToken}
          customer={selectedCustomer}
        />
      )}
    </div>
  )
}
