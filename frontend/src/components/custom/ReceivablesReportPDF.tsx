import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'

const HUB = 'https://app.gen7fuel.com'

interface PurchaseOrder {
  _id: string
  date: string
  fleetCardNumber: string
  customerName: string
  driverName: string
  quantity: number
  amount: number
  description: string
  vehicleMakeModel: string
  signature: string
  receipt: string
  poNumber: string
}

interface Props {
  orders: Array<PurchaseOrder>
  site: string
  from: string
  to: string
}

function fmtDate(iso: string) {
  try {
    return format(parseISO(iso.split('T')[0]), 'MMM dd, yyyy')
  } catch {
    return iso
  }
}

function fmtFleet(n: string) {
  return (n || '').replace(/(.{4})/g, '$1 ').trim()
}

function poDisplay(order: PurchaseOrder) {
  if (order.fleetCardNumber) return fmtFleet(order.fleetCardNumber)
  return order.poNumber || '—'
}

function poLabel(order: PurchaseOrder) {
  if (order.fleetCardNumber) return `Fleet Card: ${fmtFleet(order.fleetCardNumber)}`
  if (order.poNumber) return `PO # ${order.poNumber}`
  return 'No Reference'
}

const W = {
  date: '13%',
  customer: '18%',
  po: '10%',
  driver: '11%',
  vehicle: '14%',
  product: '9%',
  qty: '13%',
  amount: '12%',
}

const S = StyleSheet.create({
  contentPage: {
    paddingTop: 52,
    paddingBottom: 44,
    paddingHorizontal: 36,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  pageHeader: {
    position: 'absolute',
    top: 16,
    left: 36,
    right: 36,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageHeaderLeft: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
  },
  pageHeaderCenter: {
    fontSize: 8,
    color: '#64748b',
  },
  pageHeaderRight: {
    fontSize: 8,
    color: '#64748b',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 16,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageFooterText: {
    fontSize: 7.5,
    color: '#94a3b8',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 2,
  },
  tableHeadCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    minHeight: 20,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 8.5,
    color: '#1e293b',
    paddingHorizontal: 4,
  },
  tableCellRight: {
    fontSize: 8.5,
    color: '#1e293b',
    paddingHorizontal: 4,
    textAlign: 'right',
  },
  tableTotalRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 2,
    backgroundColor: '#0f172a',
    borderRadius: 2,
    marginTop: 2,
    alignItems: 'center',
  },
  tableTotalLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    paddingHorizontal: 4,
    textAlign: 'right',
  },
  tableTotalValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    paddingHorizontal: 4,
    textAlign: 'right',
  },
  docIdentifier: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 16,
  },
  docDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    marginBottom: 20,
  },
  docPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 4,
    minHeight: 300,
    marginTop: 8,
  },
  docPlaceholderText: {
    fontSize: 11,
    color: '#94a3b8',
  },
})

function PageHeader({
  site,
  dateRange,
}: {
  site: string
  dateRange: string
}) {
  return (
    <View style={S.pageHeader} fixed>
      <Text style={S.pageHeaderLeft}>Gen7 Fuel</Text>
      <Text style={S.pageHeaderCenter}>
        Receivables Report — {site} — {dateRange}
      </Text>
      <Text
        style={S.pageHeaderRight}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  )
}

function PageFooter({
  site,
  dateRange,
}: {
  site: string
  dateRange: string
}) {
  return (
    <View style={S.pageFooter} fixed>
      <Text style={S.pageFooterText}>Confidential</Text>
      <Text style={S.pageFooterText}>
        {site} • {dateRange}
      </Text>
      <Text
        style={S.pageFooterText}
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  )
}

export default function ReceivablesReportPDF({
  orders,
  site,
  from,
  to,
}: Props) {
  const total = orders.reduce((s, o) => s + (o.amount || 0), 0)
  const totalQty = orders.reduce((s, o) => s + (o.quantity || 0), 0)
  const dateRange = `${fmtDate(from)} – ${fmtDate(to)}`
  const generated = format(new Date(), 'MMM dd, yyyy')

  const stats: Array<[string, string]> = [
    ['ENTRIES', orders.length.toString()],
    ['TOTAL QUANTITY', `${totalQty.toFixed(2)} L`],
    ['TOTAL AMOUNT', `$${total.toFixed(2)}`],
    ['GENERATED', generated],
  ]

  return (
    <Document
      title={`Receivables Report — ${site} — ${dateRange}`}
      author="Gen7 Fuel"
    >
      {/* ── Title Page ── */}
      <Page style={{ fontFamily: 'Helvetica' }}>
        <View
          style={{
            flex: 1,
            backgroundColor: '#1e3a5f',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <Image src="/logo.png" style={{ height: 72, marginBottom: 48 }} />
          <Text
            style={{
              fontSize: 28,
              fontFamily: 'Helvetica-Bold',
              color: '#ffffff',
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            RECEIVABLES REPORT
          </Text>
          <View
            style={{
              width: 48,
              height: 2,
              backgroundColor: '#3b82f6',
              marginBottom: 28,
            }}
          />
          <Text
            style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}
          >
            {site}
          </Text>
          <Text style={{ fontSize: 11, color: '#64748b' }}>{dateRange}</Text>
        </View>

        <View
          style={{
            backgroundColor: '#0f172a',
            paddingHorizontal: 60,
            paddingVertical: 28,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          {stats.map(([label, value]) => (
            <View key={label}>
              <Text
                style={{
                  fontSize: 7,
                  color: '#475569',
                  marginBottom: 5,
                  letterSpacing: 1,
                }}
              >
                {label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Helvetica-Bold',
                  color: '#ffffff',
                }}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>
      </Page>

      {/* ── Summary Table Page ── */}
      <Page style={S.contentPage} wrap>
        <PageHeader site={site} dateRange={dateRange} />

        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { width: W.date }]}>Date</Text>
          <Text style={[S.tableHeadCell, { width: W.customer }]}>Customer</Text>
          <Text style={[S.tableHeadCell, { width: W.po }]}>PO #</Text>
          <Text style={[S.tableHeadCell, { width: W.driver }]}>Driver</Text>
          <Text style={[S.tableHeadCell, { width: W.vehicle }]}>Vehicle</Text>
          <Text style={[S.tableHeadCell, { width: W.product }]}>Product</Text>
          <Text
            style={[S.tableHeadCell, { width: W.qty, textAlign: 'right' }]}
          >
            Quantity
          </Text>
          <Text
            style={[S.tableHeadCell, { width: W.amount, textAlign: 'right' }]}
          >
            Amount
          </Text>
        </View>

        {orders.map((o, i) => (
          <View
            key={o._id}
            style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
            wrap={false}
          >
            <Text style={[S.tableCell, { width: W.date }]}>
              {fmtDate(o.date)}
            </Text>
            <Text style={[S.tableCell, { width: W.customer }]}>
              {o.customerName || '—'}
            </Text>
            <Text style={[S.tableCell, { width: W.po }]}>
              {poDisplay(o)}
            </Text>
            <Text style={[S.tableCell, { width: W.driver }]}>
              {o.driverName || '—'}
            </Text>
            <Text style={[S.tableCell, { width: W.vehicle }]}>
              {o.vehicleMakeModel || '—'}
            </Text>
            <Text style={[S.tableCell, { width: W.product }]}>
              {o.description || '—'}
            </Text>
            <Text style={[S.tableCellRight, { width: W.qty }]}>
              {(o.quantity || 0).toFixed(3)} L
            </Text>
            <Text style={[S.tableCellRight, { width: W.amount }]}>
              ${(o.amount || 0).toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={S.tableTotalRow} wrap={false}>
          <Text style={[S.tableTotalLabel, { width: '88%' }]}>Total</Text>
          <Text style={[S.tableTotalValue, { width: W.amount }]}>
            ${total.toFixed(2)}
          </Text>
        </View>

        <PageFooter site={site} dateRange={dateRange} />
      </Page>

      {/* ── Supporting Document Pages (one per order) ── */}
      {orders.map((o) => (
        <Page key={`doc-${o._id}`} style={S.contentPage}>
          <PageHeader site={site} dateRange={dateRange} />

          <View style={{ marginBottom: 4 }}>
            <Text style={S.docIdentifier}>{poLabel(o)}</Text>
            <Text style={S.docMeta}>
              {o.customerName || '—'} • {fmtDate(o.date)} •{' '}
              ${(o.amount || 0).toFixed(2)}
            </Text>
          </View>
          <View style={S.docDivider} />

          {o.receipt ? (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Image
                src={`${HUB}/cdn/download/${o.receipt}`}
                style={{ width: '100%', objectFit: 'contain', maxHeight: 560 }}
              />
            </View>
          ) : (
            <View style={S.docPlaceholder}>
              <Text style={S.docPlaceholderText}>No supporting document</Text>
            </View>
          )}

          <PageFooter site={site} dateRange={dateRange} />
        </Page>
      ))}
    </Document>
  )
}
