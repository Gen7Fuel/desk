import { getTokenPayload } from './permissions'

const HUB = 'https://app.gen7fuel.com'

function getExternalToken(): string {
  const payload = getTokenPayload() as { externalToken?: string } | null
  return payload?.externalToken ?? ''
}

/** Earliest month the Hub will report on — `paid` was first persisted 2026-07-03. */
export const AR_PAID_MIN_MONTH = '2026-07'

// ─── Wire types (mirror backend/utils/arPaidReport.js) ────────────────────────

export interface ArPaidRow {
  dateYmd: string
  dateLabel: string
  customer: string
  shiftNumber: string
  amount: number
  amountLabel: string
}

export interface ArPaidSite {
  site: string
  displayName: string
  hasShifts: boolean
  coverageLabel: string
  summaryText: string
  shiftCount: number
  shiftNumbers: Array<string>
  shiftDateYmds: Array<string>
  payingCustomerCount: number
  paymentCount: number
  totalPaid: number
  totalPaidLabel: string
  paymentCountLabel: string
  hasNegativeAmounts: boolean
  hasUnnamedCustomers: boolean
  rows: Array<ArPaidRow>
}

export interface ArPaidReport {
  month: string
  monthLabel: string
  periodLabel: string
  generatedAt: string
  grandTotalPaid: number
  grandTotalPaidLabel: string
  grandPaymentCount: number
  sites: Array<ArPaidSite>
}

// ─── Data ─────────────────────────────────────────────────────────────────────

export async function fetchArPaidReport(month: string): Promise<ArPaidReport> {
  const res = await fetch(
    `${HUB}/api/cash-summary/ar-paid-report?month=${encodeURIComponent(month)}`,
    { headers: { Authorization: `Bearer ${getExternalToken()}` } },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error ?? `Hub returned ${res.status}`)
  }
  return (await res.json()) as ArPaidReport
}

/**
 * Months the picker offers: AR_PAID_MIN_MONTH through the current month, newest
 * first. Labels come from the same month names the backend uses.
 */
export function availableMonths(
  now: Date = new Date(),
): Array<{ value: string; label: string }> {
  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const [minYear, minMonth] = AR_PAID_MIN_MONTH.split('-').map(Number)
  const out: Array<{ value: string; label: string }> = []
  let y = now.getFullYear()
  let m = now.getMonth() + 1
  while (y > minYear || (y === minYear && m >= minMonth)) {
    out.push({
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: `${MONTHS[m - 1]} ${y}`,
    })
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return out
}

export function arPaidReportFilename(report: ArPaidReport): string {
  return `AR_Payments_Report_${report.monthLabel.replace(/\s+/g, '')}.docx`
}

// ─── .docx ────────────────────────────────────────────────────────────────────

/**
 * Builds the Word document.
 *
 * `docx` is imported lazily: routeTree.gen.ts static-imports every route module,
 * so a top-level import would put the library (and its jszip dependency) in the
 * main bundle for every Desk user, including those without the permission.
 */
export async function buildArPaidReportDocx(
  report: ArPaidReport,
): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    PageBreak,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    VerticalAlign,
  } = await import('docx')

  const COLUMN_WIDTHS = [22, 43, 13, 22]
  const HEADER_FILL = 'E2F0D9'
  const TOTAL_FILL = 'F2F2F2'

  const cell = (
    text: string,
    opts: { bold?: boolean; right?: boolean; fill?: string; width: number },
  ) =>
    new TableCell({
      width: { size: opts.width, type: WidthType.PERCENTAGE },
      shading: opts.fill
        ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill }
        : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text, bold: opts.bold, size: 20 })],
        }),
      ],
    })

  const detailTable = (site: ArPaidSite) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['Date', 'A/R Customer', 'Shift #', 'Amount Paid'].map(
            (h, i) =>
              cell(h, {
                bold: true,
                right: i === 3,
                fill: HEADER_FILL,
                width: COLUMN_WIDTHS[i],
              }),
          ),
        }),
        ...site.rows.map(
          (r) =>
            new TableRow({
              children: [
                cell(r.dateLabel, { width: COLUMN_WIDTHS[0] }),
                cell(r.customer, { width: COLUMN_WIDTHS[1] }),
                cell(r.shiftNumber, { width: COLUMN_WIDTHS[2] }),
                cell(r.amountLabel, { right: true, width: COLUMN_WIDTHS[3] }),
              ],
            }),
        ),
        new TableRow({
          children: [
            cell('', { fill: TOTAL_FILL, width: COLUMN_WIDTHS[0] }),
            cell('Total', {
              bold: true,
              fill: TOTAL_FILL,
              width: COLUMN_WIDTHS[1],
            }),
            cell(site.paymentCountLabel, {
              bold: true,
              fill: TOTAL_FILL,
              width: COLUMN_WIDTHS[2],
            }),
            cell(site.totalPaidLabel, {
              bold: true,
              right: true,
              fill: TOTAL_FILL,
              width: COLUMN_WIDTHS[3],
            }),
          ],
        }),
      ],
    })

  const text = (
    content: string,
    opts: {
      bold?: boolean
      size?: number
      spacing?: number
      color?: string
      alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]
    } = {},
  ) =>
    new Paragraph({
      alignment: opts.alignment,
      spacing: { after: opts.spacing ?? 120 },
      children: [
        new TextRun({
          text: content,
          bold: opts.bold,
          size: opts.size ?? 22,
          color: opts.color,
        }),
      ],
    })

  // ── Cover page ──
  const cover = [
    text('GEN7', { bold: true, size: 28, spacing: 400 }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'A/R Payments Received Report',
          bold: true,
          size: 48,
        }),
      ],
    }),
    text(`Consolidated Summary — ${report.monthLabel}`, {
      size: 26,
      spacing: 600,
    }),
    text('SITES COVERED', { bold: true, size: 20, spacing: 200 }),
    ...report.sites.flatMap((s) => [
      text(s.displayName, { bold: true, spacing: 40 }),
      text(s.coverageLabel, { size: 20, color: '595959', spacing: 240 }),
    ]),
    text('Prepared for: Gen7', { spacing: 40 }),
    text(`Report period: ${report.periodLabel}`, { spacing: 0 }),
  ]

  // ── One section per site ──
  const siteBlocks = report.sites.flatMap((site) => [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'A/R Payments Received Report',
          bold: true,
          size: 32,
        }),
      ],
    }),
    text(site.displayName, { bold: true, size: 26, spacing: 40 }),
    text(`Reporting Period: ${report.monthLabel}`, {
      size: 20,
      color: '595959',
      spacing: 300,
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 80 },
      children: [new TextRun({ text: 'Summary', bold: true, size: 24 })],
    }),
    new Paragraph({
      spacing: { after: 300, line: 300 },
      border: {
        left: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: 'D0D0D0',
          space: 12,
        },
      },
      children: [new TextRun({ text: site.summaryText, size: 22 })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'A/R Payments Detail', bold: true, size: 24 }),
      ],
    }),
    ...(site.rows.length > 0
      ? [detailTable(site)]
      : [
          text(
            'No A/R payments were recorded for this site during this period.',
            {
              color: '595959',
            },
          ),
        ]),
    ...(site.hasUnnamedCustomers
      ? [
          text(
            '* One or more payments were recorded against a blank customer name on the shift ' +
              'report and appear as (Unnamed).',
            { size: 18, color: '9C6500', spacing: 40 },
          ),
        ]
      : []),
    ...(site.hasNegativeAmounts
      ? [
          text(
            '* This period includes one or more negative A/R payment amounts (reversals or ' +
              'corrections).',
            { size: 18, color: '9C6500', spacing: 40 },
          ),
        ]
      : []),
  ])

  const doc = new Document({
    creator: 'Gen7 Desk',
    title: `A/R Payments Received Report — ${report.monthLabel}`,
    description: `A/R payments received across the Wavers sites for ${report.monthLabel}`,
    sections: [{ children: [...cover, ...siteBlocks] }],
  })

  return Packer.toBlob(doc)
}
