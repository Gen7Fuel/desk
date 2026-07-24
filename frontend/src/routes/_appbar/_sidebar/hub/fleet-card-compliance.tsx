import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { can, getTokenPayload } from '@/lib/permissions'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export const Route = createFileRoute(
  '/_appbar/_sidebar/hub/fleet-card-compliance',
)({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.fleetCardCompliance', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

interface FleetCardComplianceRow {
  customerName: string
  totalVisits: number
  withCard: number
  withoutCard: number
  lastVisitDateStr: string
  stationNames: Array<string>
}

const HUB = 'https://app.gen7fuel.com'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function getExternalToken(): string {
  const payload = getTokenPayload() as { externalToken?: string } | null
  return payload?.externalToken ?? ''
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '—'
  return `${((numerator / denominator) * 100).toFixed(0)}%`
}

interface ChartDatum {
  customerName: string
  withoutCard: number
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartDatum }>
}) {
  if (!active || !payload?.length) return null
  const { customerName, withoutCard } = payload[0].payload
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-popover-foreground">
        {withoutCard} visit{withoutCard === 1 ? '' : 's'} without card
      </p>
      <p className="text-muted-foreground">{customerName}</p>
    </div>
  )
}

function RouteComponent() {
  const [from, setFrom] = useState(daysAgoIso(90))
  const [to, setTo] = useState(todayIso())
  const [site, setSite] = useState('') // unset = All Sites
  const [rows, setRows] = useState<Array<FleetCardComplianceRow>>([])
  const [loading, setLoading] = useState(false)

  const fetchReport = async () => {
    if (!from || !to) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate: from, endDate: to })
      if (site) {
        // Send both param names — matches the defensive pattern already used
        // by cash-management.tsx for this same endpoint family, in case of
        // any alias-support lag between deployed backend/frontend.
        params.set('site', site)
        params.set('stationName', site)
      }
      const res = await fetch(
        `${HUB}/api/purchase-orders/fleet-card-report?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${getExternalToken()}`,
            'X-Required-Permission': 'po',
          },
        },
      )
      const data: unknown = await res.json()
      setRows(Array.isArray(data) ? (data as Array<FleetCardComplianceRow>) : [])
    } catch (err) {
      console.error('Failed to fetch fleet card report:', err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchReport()
  }, [from, to, site])

  const totals = useMemo(() => {
    const totalVisits = rows.reduce((s, r) => s + r.totalVisits, 0)
    const withCard = rows.reduce((s, r) => s + r.withCard, 0)
    const withoutCard = rows.reduce((s, r) => s + r.withoutCard, 0)
    return { totalVisits, withCard, withoutCard }
  }, [rows])

  // Already sorted by withoutCard desc, totalVisits desc from the backend.
  const chartData: Array<ChartDatum> = rows
    .filter((r) => r.withoutCard > 0)
    .slice(0, 10)
    .map((r) => ({ customerName: r.customerName, withoutCard: r.withoutCard }))

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <h2 className="text-2xl font-semibold">Fleet Card Compliance</h2>
        <p className="text-sm text-muted-foreground">
          Which customers&apos; drivers show up with their fleet card vs.
          without it.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            From
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !from && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {from ? format(parseISO(from), 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={from ? parseISO(from) : undefined}
                onSelect={(date) =>
                  setFrom(date ? format(date, 'yyyy-MM-dd') : '')
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            To
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !to && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {to ? format(parseISO(to), 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={to ? parseISO(to) : undefined}
                onSelect={(date) => setTo(date ? format(date, 'yyyy-MM-dd') : '')}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <SitePicker value={site} onValueChange={setSite} placeholder="All Sites" />
        {site && (
          <Button variant="ghost" size="sm" onClick={() => setSite('')}>
            Clear site
          </Button>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-2 rounded-md bg-muted/50 px-4 py-3 text-sm font-medium">
        <span>Total Tracked Visits: {totals.totalVisits}</span>
        <span>With Card: {totals.withCard}</span>
        <span>Without Card: {totals.withoutCard}</span>
        <span>% With Card: {pct(totals.withCard, totals.totalVisits)}</span>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No fleet-card-tracked purchase orders in this range.
        </div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="rounded-md border p-4">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Top customers without their fleet card
              </h3>
              <ResponsiveContainer
                width="100%"
                height={Math.max(160, chartData.length * 40 + 20)}
              >
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
                  barCategoryGap="30%"
                >
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="customerName"
                    width={140}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: 'var(--color-muted)' }}
                  />
                  <Bar
                    dataKey="withoutCard"
                    fill="var(--color-destructive)"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                  >
                    <LabelList
                      dataKey="withoutCard"
                      position="right"
                      fill="var(--color-foreground)"
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total Visits</TableHead>
                  <TableHead className="text-right">With Card</TableHead>
                  <TableHead className="text-right">Without Card</TableHead>
                  <TableHead className="text-right">% With Card</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Site(s)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.customerName}>
                    <TableCell className="font-medium">
                      {row.customerName}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.totalVisits}
                    </TableCell>
                    <TableCell className="text-right">{row.withCard}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right',
                        row.withoutCard > 0 && 'font-semibold text-destructive',
                      )}
                    >
                      {row.withoutCard}
                    </TableCell>
                    <TableCell className="text-right">
                      {pct(row.withCard, row.totalVisits)}
                    </TableCell>
                    <TableCell>{row.lastVisitDateStr}</TableCell>
                    <TableCell>{row.stationNames.join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
