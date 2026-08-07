import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ArPaidReport, ArPaidSite } from '@/lib/ar-paid-report'
import { can } from '@/lib/permissions'
import {
  arPaidReportFilename,
  availableMonths,
  buildArPaidReportDocx,
  fetchArPaidReport,
} from '@/lib/ar-paid-report'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/hub/ar-paid-report')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.arPaidReport', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function SiteSection({ site }: { site: ArPaidSite }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{site.displayName}</h3>
          <p className="text-xs text-muted-foreground">{site.coverageLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {site.hasNegativeAmounts && (
            <Badge variant="destructive">Includes negative amounts</Badge>
          )}
          {site.hasUnnamedCustomers && (
            <Badge variant="secondary">Unnamed customer</Badge>
          )}
          <span className="text-sm font-medium">
            {site.paymentCountLabel} · {site.totalPaidLabel}
          </span>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {site.summaryText}
      </p>

      {site.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No A/R payments were recorded for this site during this period.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>A/R Customer</TableHead>
                <TableHead>Shift #</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {site.rows.map((r, i) => (
                <TableRow
                  key={`${r.dateYmd}-${r.shiftNumber}-${r.customer}-${i}`}
                >
                  <TableCell>{r.dateLabel}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell>{r.shiftNumber}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.amountLabel}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell />
                <TableCell>Total</TableCell>
                <TableCell>{site.paymentCountLabel}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {site.totalPaidLabel}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function RouteComponent() {
  const months = useMemo(() => availableMonths(), [])
  const [month, setMonth] = useState(months[0]?.value ?? '')
  const [report, setReport] = useState<ArPaidReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!month) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchArPaidReport(month)
      .then((data) => {
        if (!cancelled) setReport(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setReport(null)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [month])

  const handleDownload = async () => {
    if (!report) return
    setDownloading(true)
    try {
      const blob = await buildArPaidReportDocx(report)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = arPaidReportFilename(report)
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(`Downloaded ${arPaidReportFilename(report)}`)
    } catch (err) {
      toast.error(
        `Failed to build the document: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <h2 className="text-2xl font-semibold">A/R Paid Report</h2>
        <p className="text-sm text-muted-foreground">
          A/R payments received across both Wavers sites in a month, from the
          shift reports. Reports are available from July 2026 onward.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Month
          </span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleDownload}
          disabled={!report || loading || downloading}
        >
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download .docx
        </Button>
      </div>

      {report && !loading && (
        <div className="flex flex-wrap justify-between gap-2 rounded-md bg-muted/50 px-4 py-3 text-sm font-medium">
          <span>Period: {report.periodLabel}</span>
          <span>Payments: {report.grandPaymentCount}</span>
          <span>Total Received: {report.grandTotalPaidLabel}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading...
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-destructive">
          {error}
        </div>
      ) : (
        report?.sites.map((site) => <SiteSection key={site.site} site={site} />)
      )}
    </div>
  )
}
