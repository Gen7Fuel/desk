import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'

interface ARDiscrepancyDay {
  date: string
  arIncurredTotal: number
  transactionsTotal: number
  match: boolean
  direction: 'hub' | 'bulloch' | 'ok'
}

interface Props {
  days: Array<ARDiscrepancyDay>
  site: string
  from: string
  to: string
}

function fmtDate(iso: string) {
  try {
    return format(parseISO(iso), 'MMM dd, yyyy')
  } catch {
    return iso
  }
}

function statusLabel(direction: 'hub' | 'bulloch' | 'ok'): string {
  if (direction === 'ok') return 'OK'
  if (direction === 'hub') return 'Missing entries on Hub'
  return 'Missing entries on Bulloch'
}

const W = {
  date: '18%',
  arIncurred: '20%',
  transactions: '20%',
  difference: '18%',
  status: '24%',
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
  tableRowMismatch: {
    backgroundColor: '#fee2e2',
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
})

function PageHeader({ site, dateRange }: { site: string; dateRange: string }) {
  return (
    <View style={S.pageHeader} fixed>
      <Text style={S.pageHeaderLeft}>Gen7 Fuel</Text>
      <Text style={S.pageHeaderCenter}>
        AR Discrepancy Report — {site} — {dateRange}
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

export default function ARDiscrepancyReportPDF({ days, site, from, to }: Props) {
  const dateRange = `${fmtDate(from)} – ${fmtDate(to)}`
  const generated = format(new Date(), 'MMM dd, yyyy')
  const mismatched = days.filter((d) => !d.match).length
  const ok = days.length - mismatched

  const stats: Array<[string, string]> = [
    ['TOTAL DAYS', days.length.toString()],
    ['DISCREPANCIES', mismatched.toString()],
    ['DAYS OK', ok.toString()],
    ['GENERATED', generated],
  ]

  return (
    <Document
      title={`AR Discrepancy Report — ${site} — ${dateRange}`}
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
            AR DISCREPANCY REPORT
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
                  color:
                    label === 'DISCREPANCIES' && mismatched > 0
                      ? '#f87171'
                      : '#ffffff',
                }}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>
      </Page>

      {/* ── Summary Table ── */}
      <Page style={S.contentPage} wrap>
        <PageHeader site={site} dateRange={dateRange} />

        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { width: W.date }]}>Date</Text>
          <Text
            style={[S.tableHeadCell, { width: W.arIncurred, textAlign: 'right' }]}
          >
            AR Incurred (Hub)
          </Text>
          <Text
            style={[
              S.tableHeadCell,
              { width: W.transactions, textAlign: 'right' },
            ]}
          >
            Transactions (Bulloch)
          </Text>
          <Text
            style={[
              S.tableHeadCell,
              { width: W.difference, textAlign: 'right' },
            ]}
          >
            Difference
          </Text>
          <Text style={[S.tableHeadCell, { width: W.status }]}>Status</Text>
        </View>

        {days.map((day, i) => {
          const diff = day.transactionsTotal - day.arIncurredTotal
          const rowStyle = !day.match
            ? S.tableRowMismatch
            : i % 2 === 1
              ? S.tableRowAlt
              : {}
          return (
            <View key={day.date} style={[S.tableRow, rowStyle]} wrap={false}>
              <Text style={[S.tableCell, { width: W.date }]}>
                {fmtDate(day.date)}
              </Text>
              <Text style={[S.tableCellRight, { width: W.arIncurred }]}>
                ${day.arIncurredTotal.toFixed(2)}
              </Text>
              <Text style={[S.tableCellRight, { width: W.transactions }]}>
                ${day.transactionsTotal.toFixed(2)}
              </Text>
              <Text
                style={[
                  S.tableCellRight,
                  {
                    width: W.difference,
                    color: !day.match ? '#dc2626' : '#1e293b',
                    fontFamily: !day.match ? 'Helvetica-Bold' : 'Helvetica',
                  },
                ]}
              >
                {diff >= 0 ? '+' : ''}
                {diff.toFixed(2)}
              </Text>
              <Text
                style={[
                  S.tableCell,
                  {
                    width: W.status,
                    color: !day.match ? '#dc2626' : '#16a34a',
                    fontFamily: !day.match ? 'Helvetica-Bold' : 'Helvetica',
                  },
                ]}
              >
                {statusLabel(day.direction)}
              </Text>
            </View>
          )
        })}

        <PageFooter site={site} dateRange={dateRange} />
      </Page>
    </Document>
  )
}
