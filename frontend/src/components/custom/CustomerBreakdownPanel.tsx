import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PurchaseOrderLike } from '@/lib/customer-activity'
import { buildCustomerRows } from '@/lib/customer-activity'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PurchaseOrder extends PurchaseOrderLike {
  date: string
  dateStr?: string
  poNumber: string
  fleetCardNumber: string
  driverName: string
}

interface Props {
  orders: Array<PurchaseOrder>
}

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

export default function CustomerBreakdownPanel({ orders }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const rows = useMemo(() => buildCustomerRows(orders), [orders])
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0)
  const chartData = rows.slice(0, 10)

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        No purchase orders to summarize.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border p-4">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Top customers by AR amount
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
              fill="var(--color-primary)"
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

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead className="text-right">Qty (L)</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Avg $/Entry</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isExpanded = expandedKey === row.customerName
              const avgAmount =
                row.entries > 0 ? row.totalAmount / row.entries : 0
              const sharePct =
                grandTotal > 0 ? (row.totalAmount / grandTotal) * 100 : 0
              return (
                <Fragment key={row.customerName}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedKey(isExpanded ? null : row.customerName)
                    }
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.customerName}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.entries}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.totalQty.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(avgAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {sharePct.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Fleet Card / PO #</TableHead>
                              <TableHead>Driver</TableHead>
                              <TableHead className="text-right">
                                Qty (L)
                              </TableHead>
                              <TableHead className="text-right">
                                Amount
                              </TableHead>
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
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
