import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CustomerRow, PurchaseOrderLike } from '@/lib/customer-activity'
import { buildCustomerRows } from '@/lib/customer-activity'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface PurchaseOrder extends PurchaseOrderLike {
  date: string
  dateStr?: string
  poNumber: string
  fleetCardNumber: string
  driverName: string
  productCode: string
}

interface Props {
  orders: Array<PurchaseOrder>
}

// Non-fuel transactions rung in through the Chicken Delight terminal are
// tagged with this productCode so they can be reported in their own section
// instead of being mixed into the fuel AR ranking/listing.
const CD_PRODUCT_CODE = 'CD'

function poDateStr(order: Pick<PurchaseOrder, 'date' | 'dateStr'>): string {
  return order.dateStr || new Date(order.date).toLocaleDateString('en-CA')
}

function formatFleetCardNumber(number: string): string {
  return (number || '').replace(/(.{4})/g, '$1 ').trim()
}

function formatCurrency(value: number): string {
  return `$${(value || 0).toFixed(2)}`
}

function formatCompactCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}`
}

interface ChartDatum {
  customerName: string
  totalAmount: number
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartDatum }>
}) {
  if (!active || !payload?.length) return null
  const { customerName, totalAmount } = payload[0].payload
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-popover-foreground">
        {formatCurrency(totalAmount)}
      </p>
      <p className="text-muted-foreground">{customerName}</p>
    </div>
  )
}

function CustomerGroupSection({
  title,
  rows,
  barColor,
  headerClassName,
}: {
  title: string
  rows: Array<CustomerRow<PurchaseOrder>>
  barColor: string
  headerClassName?: string
}) {
  const chartData = rows.slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border p-4">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          {title}
        </h3>
        <ResponsiveContainer
          width="100%"
          height={Math.max(160, chartData.length * 40 + 20)}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
            barCategoryGap="30%"
          >
            <XAxis
              type="number"
              tickFormatter={formatCompactCurrency}
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
              dataKey="totalAmount"
              fill={barColor}
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            >
              <LabelList
                dataKey="totalAmount"
                position="right"
                formatter={(value: number) => formatCurrency(value)}
                fill="var(--color-foreground)"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-6">
        {rows.map((row) => (
          <div
            key={row.customerName}
            className="overflow-hidden rounded-md border"
          >
            <div
              className={cn(
                'flex items-center justify-between px-4 py-2',
                headerClassName ?? 'bg-muted/50',
              )}
            >
              <h4 className="font-semibold">{row.customerName}</h4>
              <span className="text-sm text-muted-foreground">
                {row.entries} transaction{row.entries === 1 ? '' : 's'}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Fleet Card / PO #</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Qty (L)</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.orders.map((o) => (
                  <TableRow key={o._id}>
                    <TableCell>{poDateStr(o)}</TableCell>
                    <TableCell>
                      {formatFleetCardNumber(o.fleetCardNumber) ||
                        o.poNumber ||
                        '-'}
                    </TableCell>
                    <TableCell>{o.driverName || '-'}</TableCell>
                    <TableCell className="text-right">
                      {(o.quantity || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(o.amount || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">
                    {row.totalQty.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(row.totalAmount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CustomerBreakdownPanel({ orders }: Props) {
  const fuelOrders = useMemo(
    () => orders.filter((o) => o.productCode !== CD_PRODUCT_CODE),
    [orders],
  )
  const cdOrders = useMemo(
    () => orders.filter((o) => o.productCode === CD_PRODUCT_CODE),
    [orders],
  )

  // buildCustomerRows sorts by totalAmount descending — highest-selling
  // customer (by $ volume) first, lowest last.
  const fuelRows = useMemo(() => buildCustomerRows(fuelOrders), [fuelOrders])
  const cdRows = useMemo(() => buildCustomerRows(cdOrders), [cdOrders])
  const cdTotal = cdRows.reduce((s, r) => s + r.totalAmount, 0)

  if (fuelRows.length === 0 && cdRows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        No purchase orders to summarize.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {fuelRows.length > 0 && (
        <CustomerGroupSection
          title="Top customers by AR amount"
          rows={fuelRows}
          barColor="var(--color-primary)"
        />
      )}

      {cdRows.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">Chicken Delight</h2>
            <span className="text-sm text-muted-foreground">
              {cdRows.length} customer{cdRows.length === 1 ? '' : 's'} ·{' '}
              {formatCurrency(cdTotal)} total
            </span>
          </div>
          <CustomerGroupSection
            title="Top customers by amount"
            rows={cdRows}
            barColor="#14b8a6"
            headerClassName="bg-teal-500/10 dark:bg-teal-400/10"
          />
        </div>
      )}
    </div>
  )
}
