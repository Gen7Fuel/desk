import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PosReport, PosSettings } from '@/lib/pos-reports-api'
import {
  acceptPosReport,
  getPosReport,
  getPosScan,
  getPosSettings,
  listPosReports,
  savePosSite,
  scanPosFiles,
} from '@/lib/pos-reports-api'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/hub/pos-reports')({
  component: PosReportsPage,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.shifts', 'read'))
      throw redirect({ to: '/' })
  },
})
const money = (cents: number) =>
  (cents / 100).toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const statusLabel = {
  draft: 'Awaiting acceptance',
  accepted: 'Accepted',
  'needs-review': 'Revised — review required',
}
function completedTime(date: string, time: string, timezone: string) {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(time)
    ? new Date(`${date}T${time}`).toLocaleString('en-CA', {
        timeZone: timezone,
        hour12: false,
      })
    : `${date} ${time}`
}

function SiteSettings({
  settings,
  onSaved,
}: {
  settings: PosSettings
  onSaved: () => void
}) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [folder, setFolder] = useState('')
  const [locationId, setLocationId] = useState('')
  const [ids, setIds] = useState('')
  const save = useMutation({
    mutationFn: () =>
      savePosSite({
        id,
        name,
        folder,
        locationId,
        storeLocationIds: ids
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Site mapping saved')
      onSaved()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <details className="rounded-md border p-4">
      <summary className="cursor-pointer font-medium">
        Site configuration
      </summary>
      <div className="mt-4 space-y-4">
        {settings.sites.map((site) => (
          <div key={site.id} className="text-sm">
            <strong>{site.name}</strong> · {site.folder} ·{' '}
            {site.timezone || 'Timezone missing'}
            <div className="text-muted-foreground">
              {site.storeLocationIds.join(', ')} {site.issue}
            </div>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          Each FTP directory must be mapped to its XML StoreLocationID. Other
          sites use the selected location’s timezone.
        </p>
        {settings.locationIssue && (
          <p role="alert" className="text-sm text-destructive">
            {settings.locationIssue}
          </p>
        )}
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <Label className="grid gap-2">
            Site ID
            <Input
              required
              placeholder="oakville"
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
          </Label>
          <Label className="grid gap-2">
            Site name
            <Input
              required
              placeholder="Oakville"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Label>
          <Label className="grid gap-2">
            FTP directory
            <Input
              required
              placeholder="Oakville"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            />
          </Label>
          <Label className="grid gap-2">
            Location
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required={id !== 'burlington'}
            >
              <option value="">Select location</option>
              {settings.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.timezone || 'No timezone'})
                </option>
              ))}
            </select>
          </Label>
          <Label className="grid gap-2 sm:col-span-2">
            StoreLocationIDs, separated by commas
            <Input
              required
              value={ids}
              onChange={(e) => setIds(e.target.value)}
            />
          </Label>
          <Button disabled={save.isPending} type="submit">
            {save.isPending ? 'Saving…' : 'Save site mapping'}
          </Button>
        </form>
      </div>
    </details>
  )
}

function ReportDetails({
  report,
  onRefresh,
}: {
  report: PosReport
  onRefresh: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [reviewedReport, setReviewedReport] = useState<PosReport | null>(null)
  const [archiveErrors, setArchiveErrors] = useState<
    Array<{ file: string; message: string }>
  >([])
  const accept = useMutation({
    mutationFn: () => acceptPosReport(reviewedReport || report),
    onSuccess: (result) => {
      setConfirm(false)
      setArchiveErrors(result.archive.errors)
      if (result.archive.errors.length)
        toast.error(
          'Report saved; some files could not be archived. Retry after resolving the errors.',
        )
      else if (result.archive.waiting)
        toast.success(
          'Report accepted. Files spanning other days remain until those days are accepted.',
        )
      else toast.success('Report accepted and files archived')
      onRefresh()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      setConfirm(false)
      onRefresh()
    },
  })
  const rows: Array<[string, number]> = [
    ['Sales before tax', report.totals.gross],
    ['Sales with item tax records', report.totals.taxableSales],
    ['Sales without item tax records', report.totals.untaxedSales],
    ['Recorded discounts / promotions (signed)', report.totals.discounts],
    ['Sales tax', report.totals.tax],
    ['Fees', report.totals.fees],
    ['Rounding', report.totals.rounding],
    ['Total including tax', report.totals.total],
    ['Cash minus change', report.totals.cash],
    ['Other payments', report.totals.otherPayments],
    ['Safe drops (signed)', report.totals.safeDrops],
  ]
  return (
    <section className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {report.siteName} — {report.date}
          </h2>
          <p className="text-sm text-muted-foreground">
            {report.timezone} · {statusLabel[report.status]} · Accepted
            revisions: {report.revision}
          </p>
        </div>
        {can('hub.shifts', 'update') &&
          (report.status !== 'accepted' || report.pendingFiles > 0) && (
            <Button
              disabled={
                accept.isPending || report.issues.some((i) => i.blocking)
              }
              onClick={() => {
                setReviewedReport(report)
                setConfirm(true)
              }}
            >
              {report.status === 'accepted'
                ? 'Retry archive'
                : report.revision
                  ? 'Accept revised report'
                  : 'Accept report'}
            </Button>
          )}
      </div>
      {confirm && (
        <div role="alert" className="space-y-3 rounded border p-4">
          <p>
            {report.status === 'accepted'
              ? 'Retry archiving the files covered by accepted reports?'
              : `Accept ${report.siteName} for ${report.date}? This saves the reviewed totals and archives eligible source files.`}
          </p>
          <div className="flex gap-2">
            <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
              {accept.isPending ? 'Processing…' : 'Confirm'}
            </Button>
            <Button
              variant="outline"
              disabled={accept.isPending}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {report.acceptedAt && (
        <p className="text-sm">
          Last accepted by {report.acceptedBy} at{' '}
          {new Date(report.acceptedAt).toLocaleString('en-CA', {
            timeZone: report.timezone,
          })}{' '}
          ({report.timezone}).
        </p>
      )}
      {archiveErrors.length > 0 && (
        <div role="alert" className="text-sm text-destructive">
          {archiveErrors.map((e) => (
            <p key={e.file}>
              {e.file}: {e.message}
            </p>
          ))}
        </div>
      )}
      {report.issues.length > 0 && (
        <div className="rounded border border-amber-500 p-3 text-sm">
          <strong>Reconciliation notes</strong>
          {report.issues.map((issue, i) => (
            <p key={i}>
              Transaction {issue.transactionId}: {issue.message}
            </p>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Table>
          <TableBody>
            {rows.map(([label, amount]) => (
              <TableRow key={label}>
                <TableCell>{label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="space-y-4">
          <p>
            {report.totals.sales} paid transactions · {report.totals.voids}{' '}
            voided transactions · {report.totals.quantity} item units
          </p>
          <p className="text-sm text-muted-foreground">
            Transaction tax totals are used. Item tax records indicate recorded
            tax treatment; they do not establish a product’s tax exemption.
            Discounts retain the POS sign and are already reflected in sales.
          </p>
          <h3 className="font-medium">Payments, net of change</h3>
          {Object.entries(report.payments).map(([key, amount]) => (
            <div className="flex justify-between text-sm" key={key}>
              <span>{key}</span>
              <span>{money(amount)}</span>
            </div>
          ))}
        </div>
      </div>
      <details>
        <summary className="cursor-pointer font-medium">
          Transactions and items ({report.eventCount} events)
        </summary>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                'Completed (site time)',
                'Transaction',
                'Type',
                'Register / till',
                'Cashier',
                'Sales',
                'Tax',
                'Total',
              ].map((v) => (
                <TableHead key={v}>{v}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.events.map((event) => (
              <TableRow key={event.key}>
                <TableCell>
                  {completedTime(event.endDate, event.endTime, report.timezone)}
                </TableCell>
                <TableCell>
                  <details>
                    <summary className="cursor-pointer">{event.id}</summary>
                    {event.items.map((item, i) => (
                      <p className="py-1 text-xs" key={i}>
                        {item.code} · {item.description} · Qty {item.quantity} ·{' '}
                        {money(item.amount)}
                        {!item.active && ' (corrected / voided)'}
                      </p>
                    ))}
                    {event.operation && <p>{event.operation}</p>}
                    {event.closingCash !== null && (
                      <p>
                        Opening cash: {money(event.openingCash || 0)}; closing
                        cash: {money(event.closingCash)}
                      </p>
                    )}
                  </details>
                </TableCell>
                <TableCell>
                  {event.type.replace('Event', '')}
                  {event.excluded && ' (excluded)'}
                </TableCell>
                <TableCell>
                  {event.register} / {event.till}
                </TableCell>
                <TableCell>{event.cashier}</TableCell>
                <TableCell>{money(event.gross)}</TableCell>
                <TableCell>{money(event.tax)}</TableCell>
                <TableCell>{money(event.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
      <details>
        <summary className="cursor-pointer font-medium">
          Source files ({report.files.length}; {report.pendingFiles} awaiting
          archive)
        </summary>
        <ul className="mt-2 space-y-1 text-sm">
          {report.files.map((file) => (
            <li key={file.path + file.hash}>
              {file.path} — {file.archived ? 'Archived' : 'In FTP'}
              {file.days.length > 1 && ` · Covers ${file.days.join(', ')}`}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary className="cursor-pointer font-medium">
          Acceptance history
        </summary>
        {report.history.length ? (
          report.history.map((item) => (
            <p className="mt-2 text-sm" key={item.revision}>
              Revision {item.revision} · {item.acceptedBy} ·{' '}
              {new Date(item.acceptedAt).toLocaleString('en-CA', {
                timeZone: item.snapshot.timezone,
              })}{' '}
              · Total {money(item.snapshot.totals.total)} · Tax{' '}
              {money(item.snapshot.totals.tax)}
            </p>
          ))
        ) : (
          <p className="mt-2 text-sm">No accepted revisions yet.</p>
        )}
      </details>
    </section>
  )
}

function PosReportsPage() {
  const [site, setSite] = useState('burlington')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<{
    site: string
    date: string
  } | null>(null)
  const client = useQueryClient()
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['pos-reports'] })
  }
  const settings = useQuery({
    queryKey: ['pos-reports', 'sites'],
    queryFn: getPosSettings,
  })
  const reports = useQuery({
    queryKey: ['pos-reports', 'list', site, from, to],
    queryFn: () => listPosReports(site, from, to),
    refetchInterval: 30000,
  })
  const status = useQuery({
    queryKey: ['pos-reports', 'scan'],
    queryFn: getPosScan,
    refetchInterval: 30000,
  })
  const detail = useQuery({
    queryKey: ['pos-reports', 'detail', selected?.site, selected?.date],
    queryFn: () => getPosReport(selected!.site, selected!.date),
    enabled: !!selected,
    refetchInterval: 30000,
  })
  const scan = useMutation({
    mutationFn: scanPosFiles,
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.imported} files; ${result.waiting} uploads waiting`,
      )
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">POS Daily Reports</h1>
          <p className="text-sm text-muted-foreground">
            Midnight-to-midnight reports by transaction completion date in the
            site’s timezone.
          </p>
        </div>
        {can('hub.shifts', 'update') && (
          <Button onClick={() => scan.mutate()} disabled={scan.isPending}>
            {scan.isPending ? 'Reading files…' : 'Refresh files'}
          </Button>
        )}
      </div>
      {settings.data && can('hub.shifts', 'update') && (
        <SiteSettings settings={settings.data} onSaved={refresh} />
      )}
      <div className="flex flex-wrap gap-4">
        <Label className="grid gap-2">
          Site
          <select
            className="h-9 min-w-48 rounded-md border bg-background px-2 text-sm"
            value={site}
            onChange={(e) => {
              setSite(e.target.value)
              setSelected(null)
            }}
          >
            <option value="">All sites</option>
            {settings.data?.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Label>
        <Label className="grid gap-2">
          From
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Label>
        <Label className="grid gap-2">
          To
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Label>
      </div>
      {[settings.error, reports.error, detail.error, status.error]
        .filter(Boolean)
        .map((e, i) => (
          <p role="alert" className="text-destructive" key={i}>
            {e?.message}
          </p>
        ))}
      {status.data && (
        <p className="text-xs text-muted-foreground">
          {status.data.completedAt
            ? `Last file scan: ${new Date(status.data.completedAt).toLocaleString()}`
            : 'No completed scan yet.'}{' '}
          · {status.data.waiting} uploads waiting to finish
        </p>
      )}
      {!!status.data?.issues.length && (
        <div
          role="alert"
          className="rounded border border-amber-500 p-3 text-sm"
        >
          <strong>Files needing attention</strong>
          {status.data.issues.map((issue, i) => (
            <p key={i}>
              {issue.site} / {issue.file}: {issue.message}
            </p>
          ))}
        </div>
      )}
      {reports.isPending ? (
        <p>Loading reports…</p>
      ) : reports.isSuccess && reports.data.length === 0 ? (
        <p>
          No reports found. Files are imported automatically; use Refresh files
          to check now.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {[
                'Site',
                'Date',
                'Status',
                'Sales',
                'Payments',
                'Tax',
                'Discounts',
                '',
              ].map((v, i) => (
                <TableHead key={i}>{v}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.data?.map((r) => (
              <TableRow key={`${r.site}/${r.date}`}>
                <TableCell>{r.siteName}</TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>{statusLabel[r.status]}</TableCell>
                <TableCell>{money(r.totals.gross)}</TableCell>
                <TableCell>
                  {money(r.totals.cash + r.totals.otherPayments)}
                </TableCell>
                <TableCell>{money(r.totals.tax)}</TableCell>
                <TableCell>{money(r.totals.discounts)}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected({ site: r.site, date: r.date })}
                  >
                    View report
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {detail.isFetching && selected && !detail.data && (
        <p>Loading report details…</p>
      )}
      {detail.data && (
        <ReportDetails
          key={`${detail.data.site}/${detail.data.date}`}
          report={detail.data}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}
