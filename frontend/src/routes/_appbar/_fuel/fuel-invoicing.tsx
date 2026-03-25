import { createFileRoute, redirect } from '@tanstack/react-router'
import { useRef } from 'react'
import { FileText, Loader2, UploadCloud } from 'lucide-react'
import { useFuelInvoicing } from '../../../lib/fuel-invoicing/use-fuel-invoicing'
import type {
  ExtractedFields,
  TableEntry,
} from '../../../lib/fuel-invoicing/types'
import { can } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_appbar/_fuel/fuel-invoicing')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('fuel.fuelInvoicing', 'read')) {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => {
    const res = await apiFetch('/api/sage/connect', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        (body as { message?: string }).message ||
          'Failed to connect to Sage Intacct.',
      )
    }
    const data: { access_token: string } = await res.json()
    return data
  },
  pendingComponent: () => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <p style={{ color: '#aaa', fontWeight: 500, fontSize: 16 }}>
        Connecting to Sage Intacct…
      </p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <p style={{ color: 'red', fontWeight: 600, fontSize: 16 }}>
        Failed to connect to Sage Intacct
      </p>
      <p style={{ color: '#aaa', fontSize: 14 }}>{error.message}</p>
    </div>
  ),
})

const HEADER_LABELS: Array<{ key: keyof ExtractedFields; label: string }> = [
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'billDate', label: 'Bill Date' },
  { key: 'orderDate', label: 'Order Date' },
  { key: 'delivDate', label: 'Delivery Date' },
  { key: 'dueDraftDate', label: 'Due / Draft Date' },
  { key: 'customer', label: 'Customer' },
  { key: 'billTo', label: 'Bill To' },
  { key: 'shipTo', label: 'Ship To' },
  { key: 'shippingLocation', label: 'Shipping Location' },
  { key: 'manifest', label: 'Manifest' },
  { key: 'driverCarrier', label: 'Driver / Carrier' },
  { key: 'terms', label: 'Terms' },
  { key: 'remitTo', label: 'Remit To' },
]

const SUMMARY_LABELS: Array<{ key: keyof ExtractedFields; label: string }> = [
  { key: 'totalOrdered', label: 'Total Ordered' },
  { key: 'totalDelivered', label: 'Total Delivered' },
  { key: 'productTotal', label: 'Product Total' },
  { key: 'freightTotal', label: 'Freight Total' },
  { key: 'surcharges', label: 'Surcharges' },
  { key: 'taxFeeTotal', label: 'Tax / Fee Total' },
  { key: 'totalInvoiceToRemit', label: 'Total Invoice to Remit' },
]

const TABLE_COLS: Array<{ key: keyof TableEntry; label: string }> = [
  { key: 'product', label: 'Product' },
  { key: 'qtyNet', label: 'Qty Net' },
  { key: 'qtyGross', label: 'Qty Gross' },
  { key: 'productRate', label: 'Product Rate' },
  { key: 'pricePerUnit', label: 'Price / Unit' },
  { key: 'freightRate', label: 'Freight Rate' },
  { key: 'totalFreight', label: 'Total Freight' },
  { key: 'federalTaxRate', label: 'Fed. Tax Rate' },
  { key: 'provincialTaxRate', label: 'Prov. Tax Rate' },
  { key: 'productTotal', label: 'Product Total' },
  { key: 'federalTaxTotal', label: 'Fed. Tax Total' },
  { key: 'provincialTaxTotal', label: 'Prov. Tax Total' },
]

function RouteComponent() {
  const { access_token: sageToken } = Route.useLoaderData()
  const canCreate = can('fuel.fuelInvoicing', 'create')
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    fields,
    error,
    dragActive,
    base64,
    file,
    submitting,
    submitMsg,
    handleSubmitToAzure,
    handleInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  } = useFuelInvoicing(sageToken)

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Upload and Submit NSP Invoice
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a fuel invoice PDF to extract fields and submit to Sage
          Intacct.
        </p>
      </div>

      {/* Drop zone */}
      {canCreate ? (
        <div
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
            file && 'border-solid border-primary/40 bg-primary/5',
          )}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleInputChange}
          />
          {file ? (
            <>
              <FileText className="h-12 w-12 text-primary" />
              <div className="text-center">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(file.size)}
                </p>
              </div>
            </>
          ) : (
            <>
              <UploadCloud
                className={cn(
                  'h-12 w-12 transition-colors',
                  dragActive ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <div className="text-center">
                <p className="font-medium">Drop your PDF here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse — PDF files accepted
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Actions */}
      {canCreate && file && (
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSubmitToAzure}
            disabled={submitting || !base64}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit'
            )}
          </Button>
          {submitMsg && (
            <span className="text-sm text-muted-foreground">{submitMsg}</span>
          )}
        </div>
      )}

      {fields && (
        <div style={{ width: '100%', maxWidth: 960 }}>
          {/* Header fields */}
          <section style={{ marginBottom: 32 }}>
            <h3
              style={{
                marginBottom: 12,
                color: '#ccc',
                borderBottom: '1px solid #333',
                paddingBottom: 6,
              }}
            >
              Invoice Details
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '10px 24px',
              }}
            >
              {HEADER_LABELS.map(({ key, label }) => {
                const val = fields[key]
                if (!val || (Array.isArray(val) && val.length === 0))
                  return null
                return (
                  <div
                    key={key}
                    style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#888',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: '#e8e8e8',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {String(val)}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Line items table */}
          {fields.tableEntries.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h3
                style={{
                  marginBottom: 12,
                  color: '#ccc',
                  borderBottom: '1px solid #333',
                  paddingBottom: 6,
                }}
              >
                Line Items
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr>
                      {TABLE_COLS.map(({ key, label }) => (
                        <th
                          key={key}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            color: '#888',
                            borderBottom: '1px solid #333',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.tableEntries.map((entry, i) => (
                      <tr
                        key={i}
                        style={{
                          background: i % 2 === 0 ? '#1e1e1e' : '#252525',
                        }}
                      >
                        {TABLE_COLS.map(({ key }) => (
                          <td
                            key={key}
                            style={{
                              padding: '7px 12px',
                              color: '#ddd',
                              borderBottom: '1px solid #2a2a2a',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry[key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Summary totals */}
          <section>
            <h3
              style={{
                marginBottom: 12,
                color: '#ccc',
                borderBottom: '1px solid #333',
                paddingBottom: 6,
              }}
            >
              Totals
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '10px 24px',
              }}
            >
              {SUMMARY_LABELS.map(({ key, label }) => {
                const val = fields[key]
                if (!val) return null
                return (
                  <div
                    key={key}
                    style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#888',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 15,
                        color: '#e8e8e8',
                        fontWeight: 600,
                      }}
                    >
                      {String(val)}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
