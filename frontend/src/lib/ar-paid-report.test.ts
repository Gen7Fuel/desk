import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  arPaidReportFilename,
  availableMonths,
  buildArPaidReportDocx,
} from './ar-paid-report'
import type { ArPaidReport } from './ar-paid-report'

const report: ArPaidReport = {
  month: '2026-07',
  monthLabel: 'July 2026',
  periodLabel: 'July 1 – July 31, 2026',
  generatedAt: '2026-08-07T18:00:00.000Z',
  grandTotalPaid: 11691.95,
  grandTotalPaidLabel: '$11,691.95',
  grandPaymentCount: 3,
  sites: [
    {
      site: 'Wavers West',
      displayName: 'Wavers of Brokenhead',
      hasShifts: true,
      coverageLabel: 'A/R payments recorded July 16–17, 2026',
      summaryText:
        'This report covers all shift reports available for Wavers of Brokenhead dated July 16 and July 17, 2026 (shift numbers 10012, 20014, 40009, 10013, 20016, and 40012). Across these shifts, two accounts receivable (A/R) customers made a payment toward their outstanding balance. All other A/R customer entries during this period reflect charges incurred with no payment recorded.',
      shiftCount: 6,
      shiftNumbers: ['10012', '20014', '40009', '10013', '20016', '40012'],
      shiftDateYmds: ['2026-07-16', '2026-07-17'],
      payingCustomerCount: 2,
      paymentCount: 2,
      totalPaid: 3875.01,
      totalPaidLabel: '$3,875.01',
      paymentCountLabel: '2 payments',
      hasNegativeAmounts: false,
      hasUnnamedCustomers: false,
      rows: [
        {
          dateYmd: '2026-07-16',
          dateLabel: 'July 16, 2026',
          customer: 'SASco',
          shiftNumber: '20014',
          amount: 2925.03,
          amountLabel: '$2,925.03',
        },
        {
          dateYmd: '2026-07-17',
          dateLabel: 'July 17, 2026',
          customer: 'Hollow Water First Nation',
          shiftNumber: '20016',
          amount: 949.98,
          amountLabel: '$949.98',
        },
      ],
    },
    {
      site: 'Wavers East',
      displayName: 'Brokenhead Community Store',
      hasShifts: false,
      coverageLabel: 'No A/R payments recorded',
      summaryText:
        'No shift reports are available for Brokenhead Community Store for July 2026. No accounts receivable (A/R) payments are recorded for this period.',
      shiftCount: 0,
      shiftNumbers: [],
      shiftDateYmds: [],
      payingCustomerCount: 0,
      paymentCount: 0,
      totalPaid: 0,
      totalPaidLabel: '$0.00',
      paymentCountLabel: '0 payments',
      hasNegativeAmounts: false,
      hasUnnamedCustomers: false,
      rows: [],
    },
  ],
}

describe('buildArPaidReportDocx', () => {
  it('produces a valid Word document containing the report content', async () => {
    const blob = await buildArPaidReportDocx(report)
    expect(blob.size).toBeGreaterThan(1000)

    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toContain('word/document.xml')

    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('A/R Payments Received Report')
    expect(xml).toContain('Consolidated Summary')
    expect(xml).toContain('Wavers of Brokenhead')
    expect(xml).toContain('Brokenhead Community Store')
    expect(xml).toContain('SASco')
    expect(xml).toContain('Hollow Water First Nation')
    expect(xml).toContain('$2,925.03')
    expect(xml).toContain('$3,875.01')
    expect(xml).toContain('2 payments')
    // Empty site renders the fallback line rather than an empty table.
    expect(xml).toContain('No A/R payments were recorded for this site')
  })

  it('names the file after the month', () => {
    expect(arPaidReportFilename(report)).toBe(
      'AR_Payments_Report_July2026.docx',
    )
  })

  it('offers months newest-first back to the July 2026 floor', () => {
    const months = availableMonths(new Date('2026-09-15T12:00:00Z'))
    expect(months.map((m) => m.value)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
    ])
    expect(months[0].label).toBe('September 2026')
  })
})
