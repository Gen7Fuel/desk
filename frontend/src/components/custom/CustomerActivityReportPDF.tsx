import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import type { PurchaseOrderLike } from '@/lib/customer-activity'
import { buildCustomerRows } from '@/lib/customer-activity'

interface PurchaseOrder extends PurchaseOrderLike {
  date: string
  dateStr?: string
  poNumber: string
  fleetCardNumber: string
  driverName: string
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

function orderDate(o: Pick<PurchaseOrder, 'date' | 'dateStr'>) {
  return fmtDate(o.dateStr || o.date)
}

function fmtFleet(n: string) {
  return (n || '').replace(/(.{4})/g, '$1 ').trim()
}

function poDisplay(o: Pick<PurchaseOrder, 'fleetCardNumber' | 'poNumber'>) {
  if (o.fleetCardNumber) return fmtFleet(o.fleetCardNumber)
  return o.poNumber || '—'
}

const WD = {
  date: '16%',
  po: '20%',
  driver: '24%',
  qty: '18%',
  amount: '22%',
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
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 14,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartLabel: {
    width: '26%',
    fontSize: 8,
    color: '#1e293b',
    paddingRight: 6,
  },
  chartTrack: {
    width: '54%',
    height: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
  },
  chartFill: {
    height: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  chartValue: {
    width: '20%',
    textAlign: 'right',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    paddingLeft: 6,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 2,
    marginBottom: 2,
  },
  customerHeaderName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  customerHeaderCount: {
    fontSize: 8,
    color: '#cbd5e1',
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
    marginBottom: 14,
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
})

function PageHeader({ site, dateRange }: { site: string; dateRange: string }) {
  return (
    <View style={S.pageHeader} fixed>
      <Text style={S.pageHeaderLeft}>Gen7 Fuel</Text>
      <Text style={S.pageHeaderCenter}>
        Customer Activity Report — {site} — {dateRange}
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

function PageFooter({ site, dateRange }: { site: string; dateRange: string }) {
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

export default function CustomerActivityReportPDF({
  orders,
  site,
  from,
  to,
}: Props) {
  // buildCustomerRows sorts by totalAmount descending — highest-selling
  // customer (by $ volume) first, lowest last.
  const rows = buildCustomerRows(orders)
  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0)
  const totalEntries = rows.reduce((s, r) => s + r.entries, 0)
  const dateRange = `${fmtDate(from)} – ${fmtDate(to)}`
  const generated = format(new Date(), 'MMM dd, yyyy')

  const stats: Array<[string, string]> = [
    ['CUSTOMERS', rows.length.toString()],
    ['TOTAL ENTRIES', totalEntries.toString()],
    ['TOTAL AMOUNT', `$${grandTotal.toFixed(2)}`],
    ['GENERATED', generated],
  ]

  const chartRows = rows.slice(0, 10)
  const maxAmount = Math.max(...chartRows.map((r) => r.totalAmount), 1)

  return (
    <Document
      title={`Customer Activity Report — ${site} — ${dateRange}`}
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
              fontSize: 26,
              fontFamily: 'Helvetica-Bold',
              color: '#ffffff',
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            CUSTOMER ACTIVITY REPORT
          </Text>
          <View
            style={{
              width: 48,
              height: 2,
              backgroundColor: '#3b82f6',
              marginBottom: 28,
            }}
          />
          <Text style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
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

      {/* ── Chart Page ── */}
      <Page style={S.contentPage}>
        <PageHeader site={site} dateRange={dateRange} />

        <Text style={S.sectionTitle}>
          Top {chartRows.length} Customer{chartRows.length === 1 ? '' : 's'}{' '}
          by AR Amount
        </Text>

        {chartRows.map((row) => (
          <View key={row.customerName} style={S.chartRow} wrap={false}>
            <Text style={S.chartLabel}>{row.customerName}</Text>
            <View style={S.chartTrack}>
              <View
                style={[
                  S.chartFill,
                  { width: `${(row.totalAmount / maxAmount) * 100}%` },
                ]}
              />
            </View>
            <Text style={S.chartValue}>${row.totalAmount.toFixed(2)}</Text>
          </View>
        ))}

        <PageFooter site={site} dateRange={dateRange} />
      </Page>

      {/* ── Grouped Transaction Listing ── */}
      <Page style={S.contentPage} wrap>
        <PageHeader site={site} dateRange={dateRange} />

        {rows.map((row) => (
          <View key={row.customerName}>
            <View style={S.customerHeader} wrap={false}>
              <Text style={S.customerHeaderName}>{row.customerName}</Text>
              <Text style={S.customerHeaderCount}>
                {row.entries} transaction{row.entries === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={S.tableHead} wrap={false}>
              <Text style={[S.tableHeadCell, { width: WD.date }]}>Date</Text>
              <Text style={[S.tableHeadCell, { width: WD.po }]}>
                Fleet Card / PO #
              </Text>
              <Text style={[S.tableHeadCell, { width: WD.driver }]}>
                Driver
              </Text>
              <Text
                style={[S.tableHeadCell, { width: WD.qty, textAlign: 'right' }]}
              >
                Qty (L)
              </Text>
              <Text
                style={[
                  S.tableHeadCell,
                  { width: WD.amount, textAlign: 'right' },
                ]}
              >
                Amount
              </Text>
            </View>

            {row.orders.map((o, i) => (
              <View
                key={o._id}
                style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[S.tableCell, { width: WD.date }]}>
                  {orderDate(o)}
                </Text>
                <Text style={[S.tableCell, { width: WD.po }]}>
                  {poDisplay(o)}
                </Text>
                <Text style={[S.tableCell, { width: WD.driver }]}>
                  {o.driverName || '—'}
                </Text>
                <Text style={[S.tableCellRight, { width: WD.qty }]}>
                  {(o.quantity || 0).toFixed(2)} L
                </Text>
                <Text style={[S.tableCellRight, { width: WD.amount }]}>
                  ${(o.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={S.tableTotalRow} wrap={false}>
              <Text style={[S.tableTotalLabel, { width: '78%' }]}>Total</Text>
              <Text style={[S.tableTotalValue, { width: WD.amount }]}>
                ${row.totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        ))}

        <PageFooter site={site} dateRange={dateRange} />
      </Page>
    </Document>
  )
}
