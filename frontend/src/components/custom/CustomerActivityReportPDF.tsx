import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'

interface PurchaseOrder {
  _id: string
  customerName: string
  quantity: number
  amount: number
}

interface Props {
  orders: Array<PurchaseOrder>
  site: string
  from: string
  to: string
}

interface CustomerRow {
  customerName: string
  entries: number
  totalQty: number
  totalAmount: number
}

function fmtDate(iso: string) {
  try {
    return format(parseISO(iso.split('T')[0]), 'MMM dd, yyyy')
  } catch {
    return iso
  }
}

function normalizeKey(name: string): string {
  return (name || 'Unknown').trim().replace(/\s+/g, ' ').toLowerCase()
}

function buildCustomerRows(
  orders: Array<PurchaseOrder>,
): Array<CustomerRow> {
  const map = new Map<
    string,
    { row: CustomerRow; nameCounts: Map<string, number> }
  >()

  for (const o of orders) {
    const key = normalizeKey(o.customerName)
    const displayCandidate = (o.customerName || 'Unknown')
      .trim()
      .replace(/\s+/g, ' ')

    let entry = map.get(key)
    if (!entry) {
      entry = {
        row: { customerName: displayCandidate, entries: 0, totalQty: 0, totalAmount: 0 },
        nameCounts: new Map(),
      }
      map.set(key, entry)
    }
    entry.row.entries += 1
    entry.row.totalQty += o.quantity || 0
    entry.row.totalAmount += o.amount || 0
    entry.nameCounts.set(
      displayCandidate,
      (entry.nameCounts.get(displayCandidate) || 0) + 1,
    )
  }

  return [...map.values()]
    .map(({ row, nameCounts }) => ({
      ...row,
      customerName: [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
}

const W = {
  customer: '32%',
  entries: '12%',
  qty: '18%',
  amount: '18%',
  avg: '12%',
  share: '8%',
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

      {/* ── Summary Table Page ── */}
      <Page style={S.contentPage} wrap>
        <PageHeader site={site} dateRange={dateRange} />

        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { width: W.customer }]}>
            Customer
          </Text>
          <Text
            style={[S.tableHeadCell, { width: W.entries, textAlign: 'right' }]}
          >
            Entries
          </Text>
          <Text
            style={[S.tableHeadCell, { width: W.qty, textAlign: 'right' }]}
          >
            Qty (L)
          </Text>
          <Text
            style={[S.tableHeadCell, { width: W.amount, textAlign: 'right' }]}
          >
            Amount
          </Text>
          <Text
            style={[S.tableHeadCell, { width: W.avg, textAlign: 'right' }]}
          >
            Avg $/Entry
          </Text>
          <Text
            style={[S.tableHeadCell, { width: W.share, textAlign: 'right' }]}
          >
            Share
          </Text>
        </View>

        {rows.map((row, i) => {
          const avgAmount = row.entries > 0 ? row.totalAmount / row.entries : 0
          const sharePct = grandTotal > 0 ? (row.totalAmount / grandTotal) * 100 : 0
          return (
            <View
              key={row.customerName}
              style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}
              wrap={false}
            >
              <Text style={[S.tableCell, { width: W.customer }]}>
                {row.customerName}
              </Text>
              <Text style={[S.tableCellRight, { width: W.entries }]}>
                {row.entries}
              </Text>
              <Text style={[S.tableCellRight, { width: W.qty }]}>
                {row.totalQty.toFixed(2)} L
              </Text>
              <Text style={[S.tableCellRight, { width: W.amount }]}>
                ${row.totalAmount.toFixed(2)}
              </Text>
              <Text style={[S.tableCellRight, { width: W.avg }]}>
                ${avgAmount.toFixed(2)}
              </Text>
              <Text style={[S.tableCellRight, { width: W.share }]}>
                {sharePct.toFixed(1)}%
              </Text>
            </View>
          )
        })}

        <View style={S.tableTotalRow} wrap={false}>
          <Text style={[S.tableTotalLabel, { width: '62%' }]}>
            Total ({totalEntries} entries)
          </Text>
          <Text style={[S.tableTotalValue, { width: W.amount }]}>
            ${grandTotal.toFixed(2)}
          </Text>
        </View>

        <PageFooter site={site} dateRange={dateRange} />
      </Page>
    </Document>
  )
}
