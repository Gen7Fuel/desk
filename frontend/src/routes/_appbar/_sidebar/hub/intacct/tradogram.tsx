import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type {
  DeliveryDetail,
  DeliverySummary,
  Draft,
  GLAccount,
  SiteAccount,
} from '@/lib/tradogram-api'
import { suggestedAccountCodes, tradogramRequest } from '@/lib/tradogram-api'
import { can } from '@/lib/permissions'
import { SitePicker } from '@/components/custom/SitePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TradogramGLAccountSelect } from '@/components/custom/TradogramGLAccountSelect'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/_appbar/_sidebar/hub/intacct/tradogram')(
  { component: Tradogram },
)

const blankSite: SiteAccount = {
  site: '',
  tradogramLocation: '',
  sageLocationId: '',
  loanAccountId: '',
  inventoryAccountId: '',
}
const amount = (value: number | null | undefined) =>
  value == null
    ? 'Unavailable'
    : value.toLocaleString('en-CA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Request failed. Please retry.'
const statusLabel = (status?: string) =>
  ({
    new: 'New',
    draft: 'Draft',
    ready: 'Ready for Intacct',
    'needs-review': 'Needs review',
  })[status || 'new'] || status

function Tradogram() {
  const writable = can('hub.intacct', 'update')
  const [tab, setTab] = useState<'deliveries' | 'prepared' | 'sites'>(
    'deliveries',
  )
  const [sites, setSites] = useState<Array<SiteAccount>>([])
  const [siteForm, setSiteForm] = useState<SiteAccount>(blankSite)
  const [rows, setRows] = useState<Array<DeliverySummary>>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState<DeliveryDetail | null>(null)
  const [form, setForm] = useState({
    site: '',
    vendorId: '',
    invoiceNumber: '',
    notes: '',
  })
  const [accountCodes, setAccountCodes] = useState<Record<string, string>>({})
  const [accounts, setAccounts] = useState<Array<GLAccount>>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState('')
  const [accountRefresh, setAccountRefresh] = useState(0)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setAccountsLoading(true)
    setAccountsError('')
    tradogramRequest<Array<GLAccount>>('/gl-accounts', {
      signal: controller.signal,
    })
      .then(setAccounts)
      .catch((e) => {
        if (!controller.signal.aborted) setAccountsError(message(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setAccountsLoading(false)
      })
    return () => controller.abort()
  }, [accountRefresh])

  useEffect(() => {
    const controller = new AbortController()
    tradogramRequest<Array<SiteAccount>>('/sites', {
      signal: controller.signal,
    })
      .then(setSites)
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (tab === 'sites') return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const request =
      tab === 'prepared'
        ? tradogramRequest<Array<DeliverySummary>>('/drafts', {
            signal: controller.signal,
          }).then((deliveries) => ({ deliveries, hasMore: false }))
        : tradogramRequest<{
            deliveries: Array<DeliverySummary>
            hasMore: boolean
          }>(`/deliveries?page=${page}`, { signal: controller.signal })
    request
      .then((result) => {
        setRows(result.deliveries)
        setHasMore(result.hasMore)
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(message(e))
          setRows([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [tab, page, refresh])

  async function review(code: string) {
    if (dirty && !window.confirm('Discard unsaved delivery changes?')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await tradogramRequest<DeliveryDetail>(`/deliveries/${code}`)
      const suggested = sites.find(
        (s) =>
          s.tradogramLocation && s.tradogramLocation === data.source.location,
      )
      setDetail(data)
      setForm({
        site: data.draft?.site || suggested?.site || '',
        vendorId: data.draft?.vendorId || '',
        invoiceNumber:
          data.draft?.invoiceNumber || data.source.invoiceNumber || '',
        notes: data.draft?.notes || '',
      })
      setAccounts(data.accounts)
      setAccountsError('')
      setAccountCodes(
        suggestedAccountCodes(
          data.source,
          data.draft,
          sites.find(
            (site) => site.site === (data.draft?.site || suggested?.site),
          ),
          data.accounts,
        ),
      )
      setDirty(false)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  async function save(targetStatus: 'draft' | 'ready') {
    if (!detail) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await tradogramRequest<{ draft: Draft }>(
        `/deliveries/${detail.source.deliveryCode}/draft`,
        {
          method: 'PUT',
          body: JSON.stringify({
            ...form,
            status: targetStatus,
            sourceHash: detail.source.sourceHash,
            revision: detail.draft?.revision ?? null,
            lines: detail.source.lines.map((l) => ({
              id: l.id,
              glAccountCode: accountCodes[l.id] || '',
            })),
          }),
        },
      )
      setDetail({ ...detail, draft: result.draft, stale: false })
      setDirty(false)
      setNotice(
        targetStatus === 'ready'
          ? 'Ready for Intacct saved. No bill has been posted.'
          : 'Draft saved.',
      )
      setRefresh((value) => value + 1)
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveSite() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await tradogramRequest<SiteAccount>('/sites', {
        method: 'PUT',
        body: JSON.stringify(siteForm),
      })
      setSites((prev) =>
        [...prev.filter((s) => s.site !== saved.site), saved].sort((a, b) =>
          a.site.localeCompare(b.site),
        ),
      )
      setSiteForm(saved)
      if (detail) setDetail({ ...detail, stale: true })
      setNotice(
        'Site accounts saved. Reopen affected deliveries to review their account mappings.',
      )
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  const config = sites.find((s) => s.site === form.site)
  const issues = detail
    ? [
        ...detail.source.issues,
        ...(!form.site
          ? ['Choose the receiving site.']
          : !config
            ? ['Save account settings for this site.']
            : []),
        ...(!config?.sageLocationId
          ? ['Configure the Intacct location/entity ID.']
          : []),
        ...(!form.vendorId ? ['Enter the Intacct vendor ID.'] : []),
        ...(accountsError || accountsLoading
          ? ['Wait for the Tradogram GL account list to load successfully.']
          : []),
        ...detail.source.lines.flatMap((line) => {
          const account = accounts.find((a) => a.code === accountCodes[line.id])
          return account
            ? []
            : [
                `Choose an active Loan or Inventory GL account for ${line.name}.`,
              ]
        }),
      ]
    : []
  const filtered = rows.filter(
    (row) =>
      (status === 'all' || row.status === status) &&
      `${row.supplier} ${row.poNumber} ${row.deliveryCode} ${row.site || ''} ${row.location || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tradogram</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prepare one Accounts Payable bill per received delivery, including
          partial deliveries.
        </p>
      </div>
      <ol className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
        <li>1. Create a PO and record receipt in Tradogram.</li>
        <li>2. Review received lines and choose Loan or Inventory.</li>
        <li>3. Save a draft or mark the delivery ready for Intacct.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        {(['deliveries', 'prepared', 'sites'] as const).map((value) => (
          <Button
            key={value}
            variant={tab === value ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => {
              setTab(value)
              setError('')
              setNotice('')
            }}
          >
            {value === 'deliveries'
              ? 'Deliveries'
              : value === 'prepared'
                ? 'Prepared bills'
                : 'Site accounts'}
          </Button>
        ))}
      </div>
      {!writable && (
        <p className="text-sm text-muted-foreground">
          Read-only access. Ask an administrator for Intacct update permission
          to prepare bills or configure accounts.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border bg-green-50 p-3 text-sm text-green-900"
        >
          {notice}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className={accountsError ? 'text-red-700' : 'text-muted-foreground'}
          role={accountsError ? 'alert' : 'status'}
        >
          {accountsError ||
            (accountsLoading
              ? 'Loading Tradogram GL accounts…'
              : `${accounts.length} active Loan / Inventory GL accounts from Tradogram.`)}
        </span>
        <Button
          variant="outline"
          disabled={busy || accountsLoading}
          onClick={() => setAccountRefresh((value) => value + 1)}
        >
          Refresh GL accounts
        </Button>
      </div>

      {tab === 'sites' ? (
        <section className="space-y-4 rounded-lg border p-5">
          <h2 className="font-semibold">Site account mappings</h2>
          <p className="text-sm text-muted-foreground">
            Choose a Hub site and save its Intacct IDs. Tradogram location name
            is an optional exact match used to suggest a receiving site; confirm
            it on each delivery. Select the site’s default Loan and Inventory
            accounts from Tradogram. Other account types, including Accounts
            Payable, are excluded.
          </p>
          <fieldset
            disabled={!writable || busy}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>Site</Label>
              <SitePicker
                value={siteForm.site}
                onValueChange={(site) =>
                  setSiteForm(
                    sites.find((s) => s.site === site) || {
                      ...blankSite,
                      site,
                    },
                  )
                }
              />
            </div>
            {(
              [
                ['tradogramLocation', 'Tradogram location / branch name'],
                ['sageLocationId', 'Intacct location/entity ID'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`site-${key}`}>{label}</Label>
                <Input
                  id={`site-${key}`}
                  value={siteForm[key]}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, [key]: e.target.value })
                  }
                />
              </div>
            ))}
            {(['loan', 'inventory'] as const).map((type) => {
              const key =
                type === 'loan' ? 'loanAccountId' : 'inventoryAccountId'
              const eligible = accounts.filter(
                (account) => account.type === type,
              )
              const matches = eligible.filter(
                (account) => account.number === siteForm[key],
              )
              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`site-${key}`}>
                    {type === 'loan'
                      ? 'Default Loan GL account'
                      : 'Default Inventory GL account'}
                  </Label>
                  <TradogramGLAccountSelect
                    id={`site-${key}`}
                    label={`${type} GL account for site`}
                    accounts={eligible}
                    value={
                      matches.length === 1
                        ? matches[0].code
                        : siteForm[key]
                          ? `unavailable:${siteForm[key]}`
                          : ''
                    }
                    disabled={
                      !writable || busy || accountsLoading || !!accountsError
                    }
                    onValueChange={(code) =>
                      setSiteForm({
                        ...siteForm,
                        [key]:
                          eligible.find((account) => account.code === code)
                            ?.number || '',
                      })
                    }
                  />
                  {siteForm[key] && matches.length !== 1 && (
                    <p className="text-xs text-amber-700">
                      Saved GL number {siteForm[key]} is unavailable or
                      ambiguous. Select an active account again.
                    </p>
                  )}
                </div>
              )
            })}
            <div className="self-end">
              <Button
                disabled={!siteForm.site || accountsLoading || !!accountsError}
                onClick={saveSite}
              >
                Save site accounts
              </Button>
            </div>
          </fieldset>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'Site',
                  'Location/entity',
                  'Loan account',
                  'Inventory account',
                  '',
                ].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.site}>
                  <TableCell>{site.site}</TableCell>
                  <TableCell>{site.sageLocationId || 'Not set'}</TableCell>
                  <TableCell>{site.loanAccountId || 'Not set'}</TableCell>
                  <TableCell>{site.inventoryAccountId || 'Not set'}</TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => setSiteForm(site)}>
                      View / edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Input
                className="max-w-sm"
                aria-label="Search deliveries"
                placeholder="Search supplier, PO, delivery or site"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Processing status"
                className="rounded-md border p-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {['all', 'new', 'draft', 'ready', 'needs-review'].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value === 'all' ? 'All statuses' : statusLabel(value)}
                    </option>
                  ),
                )}
              </select>
              <Button
                variant="outline"
                disabled={loading || busy}
                onClick={() => setRefresh((value) => value + 1)}
              >
                Refresh list
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tab === 'prepared'
                ? 'Most recent 200 saved bills. Open a delivery to check for source or account changes before proceeding.'
                : 'Live Tradogram deliveries for POs In Delivery, Fully Received, or Closed. Search and status filter apply to this page.'}
            </p>
            {loading ? (
              <p role="status">Loading deliveries…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      'Received',
                      'Supplier / PO',
                      'Location / site',
                      'PO status',
                      'Preparation',
                      '',
                    ].map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.deliveryCode}>
                      <TableCell>
                        {row.receivedDate || 'Not received'}
                      </TableCell>
                      <TableCell>
                        <div>{row.supplier}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.poNumber} · {row.deliveryCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.site || row.location || 'Not mapped'}
                      </TableCell>
                      <TableCell>{row.poStatus || '—'}</TableCell>
                      <TableCell>{statusLabel(row.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => review(row.deliveryCode)}
                        >
                          Review delivery
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        No deliveries match. Check the filters or record a
                        receipt in Tradogram.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            {tab === 'deliveries' && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={page === 1 || loading || busy}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">Page {page}</span>
                <Button
                  variant="outline"
                  disabled={!hasMore || loading || busy}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </section>

          {detail && (
            <section className="space-y-5 rounded-lg border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    {detail.source.supplier} · {detail.source.poNumber}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Delivery {detail.source.deliveryCode} · Received{' '}
                    {detail.source.receivedDate || 'Not recorded'} ·{' '}
                    {dirty
                      ? 'Unsaved changes'
                      : statusLabel(detail.draft?.status)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => review(detail.source.deliveryCode)}
                >
                  Reload delivery
                </Button>
              </div>
              {detail.stale && (
                <p
                  role="alert"
                  className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"
                >
                  The delivery, PO, or account mapping changed since the last
                  save. Review the current received lines and save again.
                </p>
              )}
              <fieldset
                disabled={!writable || busy || !!detail.draft?.intacctBillKey}
                className="grid gap-4 sm:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label>Receiving site</Label>
                  <SitePicker
                    value={form.site}
                    onValueChange={(site) => updateForm('site', site)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tradogram location:{' '}
                    {detail.source.location || 'Not provided'}
                  </p>
                </div>
                {(
                  [
                    ['vendorId', 'Intacct vendor ID'],
                    ['invoiceNumber', 'Supplier invoice reference'],
                    ['notes', 'Preparation notes'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`draft-${key}`}>{label}</Label>
                    <Input
                      id={`draft-${key}`}
                      value={form[key]}
                      onChange={(e) => updateForm(key, e.target.value)}
                    />
                  </div>
                ))}
              </fieldset>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      'Received item',
                      'Ordered',
                      'Received',
                      'PO unit price',
                      'Received subtotal',
                      'Debit account',
                      'GL account ID',
                    ].map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.source.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div>{line.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {line.description}
                        </div>
                        {line.poGLAccountNumber && (
                          <div className="text-xs text-muted-foreground">
                            PO account: {line.poGLAccountNumber} —{' '}
                            {line.poGLAccountName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {line.ordered} {line.unit}
                      </TableCell>
                      <TableCell>
                        {line.quantity} {line.unit}
                      </TableCell>
                      <TableCell>{amount(line.unitPrice)}</TableCell>
                      <TableCell>{amount(line.amount)}</TableCell>
                      <TableCell>
                        <TradogramGLAccountSelect
                          label={`Debit account for ${line.name}`}
                          accounts={accounts}
                          disabled={
                            !writable ||
                            busy ||
                            accountsLoading ||
                            !!accountsError ||
                            !!detail.draft?.intacctBillKey
                          }
                          value={accountCodes[line.id] || ''}
                          onValueChange={(code) => {
                            setAccountCodes((previous) => ({
                              ...previous,
                              [line.id]: code,
                            }))
                            setDirty(true)
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {accounts.find(
                          (account) => account.code === accountCodes[line.id],
                        )?.number || 'Not selected / unavailable'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="rounded-lg bg-muted/40 p-4 text-sm">
                <p>
                  Received subtotal:{' '}
                  <strong>
                    {detail.source.currency} {amount(detail.source.subtotal)}
                  </strong>
                </p>
                <p>
                  Debit: selected Loan / Inventory accounts · Credit: supplier
                  Accounts Payable
                </p>
                <p className="mt-2 text-muted-foreground">
                  This subtotal uses only this delivery’s received quantities at
                  PO prices. Taxes, discounts, fees and final invoice totals
                  must be confirmed when Intacct posting is added.
                </p>
              </div>
              {!!issues.length && (
                <div className="text-sm">
                  <p className="font-medium">Before marking ready:</p>
                  <ul className="list-disc pl-5">
                    {[...new Set(issues)].map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={!writable || busy || !!detail.draft?.intacctBillKey}
                  onClick={() => save('draft')}
                >
                  Save draft
                </Button>
                <Button
                  disabled={
                    !writable ||
                    busy ||
                    !!issues.length ||
                    !!detail.draft?.intacctBillKey
                  }
                  onClick={() => save('ready')}
                >
                  Mark ready for Intacct
                </Button>
                <Button
                  disabled
                  title="Intacct AP bill posting will be added after the bill fields and tax rules are confirmed."
                >
                  Create Intacct AP bill — coming next
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ready means prepared in Desk. No Intacct bill or payment has
                been created, and Tradogram records are unchanged.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
