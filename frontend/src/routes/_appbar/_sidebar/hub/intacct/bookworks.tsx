import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { BookworksInvoice, BookworksSearch } from '@/lib/bookworks-api'
import { BookworksDraft } from '@/components/custom/BookworksDraft'
import { can } from '@/lib/permissions'
import { searchBookworksInvoices } from '@/lib/bookworks-api'
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

export const Route = createFileRoute('/_appbar/_sidebar/hub/intacct/bookworks')(
  { component: Bookworks },
)

const money = (value: number | null) =>
  value == null
    ? 'Unavailable'
    : value.toLocaleString('en-CA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
// Bookworks returns accounting dates as timezone-less timestamps. Keep the
// calendar date instead of shifting it to the user's browser timezone.
const date = (value: string | null) => value?.slice(0, 10) || 'Unavailable'
const status = (posted: boolean | null) =>
  posted === true ? 'Posted' : posted === false ? 'Not posted' : 'Unknown'

export function Bookworks() {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [results, setResults] = useState<BookworksSearch | null>(null)
  const [selected, setSelected] = useState<BookworksInvoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function search(number: string, offset = 0) {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setLoading(true)
    setError('')
    setSelected(null)
    setResults(null)
    try {
      const data = await searchBookworksInvoices(number, offset, current.signal)
      if (!current.signal.aborted) setResults(data)
    } catch (err) {
      if (!current.signal.aborted)
        setError(err instanceof Error ? err.message : 'Invoice lookup failed.')
    } finally {
      if (!current.signal.aborted) setLoading(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const number = invoiceNumber.trim()
    if (!number) {
      setError('Enter an invoice number.')
      return
    }
    void search(number)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Bookworks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find an Accounts Payable invoice by its exact invoice number, then
          select a result to view its details.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="w-full space-y-2 sm:w-80">
          <Label htmlFor="bookworks-invoice-number">Invoice #</Label>
          <Input
            id="bookworks-invoice-number"
            placeholder="e.g. IN08676002"
            value={invoiceNumber}
            maxLength={100}
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading || !invoiceNumber.trim()}>
          {loading ? 'Searching…' : 'Search invoices'}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {loading && (
          <p role="status" className="text-sm text-muted-foreground">
            Searching Bookworks…
          </p>
        )}
        {!results && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Enter an invoice number to get started.
          </p>
        )}
        {results && (
          <section aria-label="Invoice results" className="space-y-3">
            <h2 className="text-lg font-medium">
              Results for {results.invoiceNumber}
            </h2>
            {results.warnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-700">
                {warning}
              </p>
            ))}
            {!results.invoices.length ? (
              <p>
                No invoices found on this page for “{results.invoiceNumber}”.
                Check the invoice number or return to the previous page.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Invoice date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        data-state={
                          selected?.id === invoice.id ? 'selected' : undefined
                        }
                      >
                        <TableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          {invoice.vendorName ||
                            invoice.vendorCode ||
                            'Unavailable'}
                        </TableCell>
                        <TableCell>{date(invoice.invoiceDate)}</TableCell>
                        <TableCell>{status(invoice.posted)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(invoice.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`View invoice ${invoice.invoiceNumber} from ${invoice.vendorCode || 'unknown vendor'} (record ${invoice.id})`}
                            aria-pressed={selected?.id === invoice.id}
                            onClick={() => setSelected(invoice)}
                          >
                            View details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {(results.hasMore || results.offset > 0) && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || results.offset === 0}
                  onClick={() =>
                    void search(
                      results.invoiceNumber,
                      Math.max(0, results.offset - results.pageSize),
                    )
                  }
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {Math.floor(results.offset / results.pageSize) + 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || !results.hasMore}
                  onClick={() =>
                    void search(
                      results.invoiceNumber,
                      results.offset + results.pageSize,
                    )
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
      {selected && can('hub.intacct', 'update') && (
        <BookworksDraft key={selected.id} invoice={selected} />
      )}
      {selected && (
        <section
          aria-label="Invoice details"
          className="space-y-4 rounded-lg border p-5"
        >
          <h2 className="text-lg font-semibold">
            Invoice {selected.invoiceNumber}
          </h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                'Vendor',
                selected.vendorName || selected.vendorCode || 'Unavailable',
              ],
              ['Vendor code', selected.vendorCode || 'Unavailable'],
              ['Bookworks record ID', String(selected.id)],
              ['Invoice date', date(selected.invoiceDate)],
              ['Due date', date(selected.dueDate)],
              ['Discount date', date(selected.discountDate)],
              ['Posting status', status(selected.posted)],
              ['Total amount', money(selected.totalAmount)],
              ['Description', selected.description || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <h3 className="font-medium">GL distributions</h3>
          {selected.distributions.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GL account</TableHead>
                    <TableHead>Cost center</TableHead>
                    <TableHead>Debit / Credit</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.distributions.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>{line.glAccountCode || '—'}</TableCell>
                      <TableCell>{line.costCenterCode || '—'}</TableCell>
                      <TableCell>{line.debitOrCredit || '—'}</TableCell>
                      <TableCell>{line.description || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No GL distributions returned for this invoice.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
