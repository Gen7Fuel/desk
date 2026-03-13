import { createFileRoute, redirect } from '@tanstack/react-router'
import { useFuelInvoicing } from '../../lib/fuel-invoicing/use-fuel-invoicing'
import { can } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'

export const Route = createFileRoute('/_appbar/fuel-invoicing')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('fuelInvoicing', 'read')) {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => {
    const res = await apiFetch('/api/sage/connect', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { message?: string }).message || 'Failed to connect to Sage Intacct.')
    }
    const data: { access_token: string } = await res.json()
    return data
  },
  pendingComponent: () => (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ color: '#aaa', fontWeight: 500, fontSize: 16 }}>Connecting to Sage Intacct…</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      <p style={{ color: 'red', fontWeight: 600, fontSize: 16 }}>Failed to connect to Sage Intacct</p>
      <p style={{ color: '#aaa', fontSize: 14 }}>{error.message}</p>
    </div>
  ),
})

const HEADER_LABELS: { key: keyof import('../../lib/fuel-invoicing/types').ExtractedFields; label: string }[] = [
  { key: 'invoiceNumber',      label: 'Invoice #' },
  { key: 'billDate',           label: 'Bill Date' },
  { key: 'orderDate',          label: 'Order Date' },
  { key: 'delivDate',          label: 'Delivery Date' },
  { key: 'dueDraftDate',       label: 'Due / Draft Date' },
  { key: 'customer',           label: 'Customer' },
  { key: 'billTo',             label: 'Bill To' },
  { key: 'shipTo',             label: 'Ship To' },
  { key: 'shippingLocation',   label: 'Shipping Location' },
  { key: 'manifest',           label: 'Manifest' },
  { key: 'driverCarrier',      label: 'Driver / Carrier' },
  { key: 'terms',              label: 'Terms' },
  { key: 'remitTo',            label: 'Remit To' },
]

const SUMMARY_LABELS: { key: keyof import('../../lib/fuel-invoicing/types').ExtractedFields; label: string }[] = [
  { key: 'totalOrdered',       label: 'Total Ordered' },
  { key: 'totalDelivered',     label: 'Total Delivered' },
  { key: 'productTotal',       label: 'Product Total' },
  { key: 'freightTotal',       label: 'Freight Total' },
  { key: 'surcharges',         label: 'Surcharges' },
  { key: 'taxFeeTotal',        label: 'Tax / Fee Total' },
  { key: 'totalInvoiceToRemit',label: 'Total Invoice to Remit' },
]

const TABLE_COLS: { key: keyof import('../../lib/fuel-invoicing/types').TableEntry; label: string }[] = [
  { key: 'product',             label: 'Product' },
  { key: 'qtyNet',              label: 'Qty Net' },
  { key: 'qtyGross',            label: 'Qty Gross' },
  { key: 'productRate',         label: 'Product Rate' },
  { key: 'pricePerUnit',        label: 'Price / Unit' },
  { key: 'freightRate',         label: 'Freight Rate' },
  { key: 'totalFreight',        label: 'Total Freight' },
  { key: 'federalTaxRate',      label: 'Fed. Tax Rate' },
  { key: 'provincialTaxRate',   label: 'Prov. Tax Rate' },
  { key: 'productTotal',        label: 'Product Total' },
  { key: 'federalTaxTotal',     label: 'Fed. Tax Total' },
  { key: 'provincialTaxTotal',  label: 'Prov. Tax Total' },
]

function RouteComponent() {
  const { access_token: sageToken } = Route.useLoaderData()
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
      <h2 style={{ marginBottom: 8 }}>Upload and Submit NSP Invoice</h2>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: dragActive ? '2px solid #4f8cff' : '2px dashed #444',
          background: dragActive ? '#232a36' : '#232323',
          borderRadius: 12,
          width: 400,
          height: 180,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '32px 0',
          transition: 'background 0.2s, border 0.2s',
        }}
      >
        <input
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          id="pdf-upload-input"
          onChange={handleInputChange}
        />
        <label htmlFor="pdf-upload-input" style={{ cursor: 'pointer', color: '#ccc', fontWeight: 500, fontSize: 18 }}>
          {dragActive ? 'Drop PDF here...' : file ? file.name : 'Drag & drop PDF here or click to upload'}
        </label>
      </div>

      {file && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSubmitToAzure}
            disabled={submitting || !base64}
            style={{ cursor: 'pointer', padding: '8px 24px', fontWeight: 600 }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}
      {submitMsg && <span style={{ fontSize: 14, marginTop: 8 }}>{submitMsg}</span>}
      {error && <span style={{ fontSize: 14, marginTop: 8, color: 'red' }}>{error}</span>}

      {fields && (
        <div style={{ width: '100%', maxWidth: 960, marginTop: 40 }}>

          {/* Header fields */}
          <section style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 12, color: '#ccc', borderBottom: '1px solid #333', paddingBottom: 6 }}>Invoice Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px 24px' }}>
              {HEADER_LABELS.map(({ key, label }) => {
                const val = fields[key]
                if (!val || (Array.isArray(val) && val.length === 0)) return null
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                    <span style={{ fontSize: 14, color: '#e8e8e8', whiteSpace: 'pre-wrap' }}>{String(val)}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Line items table */}
          {fields.tableEntries.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 12, color: '#ccc', borderBottom: '1px solid #333', paddingBottom: 6 }}>Line Items</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {TABLE_COLS.map(({ key, label }) => (
                        <th key={key} style={{ padding: '8px 12px', textAlign: 'left', color: '#888', borderBottom: '1px solid #333', whiteSpace: 'nowrap' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.tableEntries.map((entry, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#1e1e1e' : '#252525' }}>
                        {TABLE_COLS.map(({ key }) => (
                          <td key={key} style={{ padding: '7px 12px', color: '#ddd', borderBottom: '1px solid #2a2a2a', whiteSpace: 'nowrap' }}>
                            {entry[key] ?? '—'}
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
            <h3 style={{ marginBottom: 12, color: '#ccc', borderBottom: '1px solid #333', paddingBottom: 6 }}>Totals</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px 24px' }}>
              {SUMMARY_LABELS.map(({ key, label }) => {
                const val = fields[key]
                if (!val) return null
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                    <span style={{ fontSize: 15, color: '#e8e8e8', fontWeight: 600 }}>{String(val)}</span>
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
