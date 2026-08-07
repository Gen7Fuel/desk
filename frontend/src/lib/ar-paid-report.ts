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

// Palette and metrics transcribed from the original hand-made report
// (AR_Payments_Report_June2026.docx). Sizes are half-points, spacing is twips.
const NAVY = '1F3864'
const SLATE = '9AA5B1'
const BODY_GREY = '444444'
const SITE_GREY = '222222'
const MUTED_GREY = '777777'
const RULE_GREY = 'D9D9D9'
const WHITE = 'FFFFFF'
const BLACK = '000000'

/** US Letter in twips. The original is Letter; docx would otherwise default to A4. */
const PAGE_WIDTH = 12240
const PAGE_HEIGHT = 15840
const MARGIN = 1440

const COLUMN_WIDTHS = [1800, 2600, 2200, 1800] // dxa, 8400 total
const CELL_MARGINS = { top: 100, left: 120, bottom: 100, right: 120 }

/**
 * Builds the Word document.
 *
 * Structurally mirrors the hand-made original: Letter page, navy/grey palette,
 * two-line cover title, hairline rules, navy table header, unshaded total row.
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
  } = await import('docx')

  const ALIGNMENTS = [
    AlignmentType.LEFT,
    AlignmentType.LEFT,
    AlignmentType.CENTER,
    AlignmentType.RIGHT,
  ]

  /** One run of text in its own paragraph. */
  const line = (
    content: string,
    opts: {
      bold?: boolean
      size?: number
      color?: string
      characterSpacing?: number
      after?: number
      before?: number
      alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]
    } = {},
  ) =>
    new Paragraph({
      alignment: opts.alignment,
      // Omit entirely when unset, so docx does not emit a bare <w:spacing/>.
      spacing:
        opts.after === undefined && opts.before === undefined
          ? undefined
          : { after: opts.after, before: opts.before },
      children: [
        new TextRun({
          text: content,
          bold: opts.bold,
          size: opts.size,
          color: opts.color,
          characterSpacing: opts.characterSpacing,
        }),
      ],
    })

  /** An otherwise empty paragraph carrying a horizontal rule. */
  const rule = (
    edge: 'top' | 'bottom',
    opts: {
      color: string
      size: number
      space: number
      after?: number
      before?: number
    },
  ) =>
    new Paragraph({
      border: {
        [edge]: {
          style: BorderStyle.SINGLE,
          color: opts.color,
          size: opts.size,
          space: opts.space,
        },
      },
      spacing: { after: opts.after, before: opts.before },
      children: [new TextRun({ text: '' })],
    })

  const cell = (
    content: string,
    column: number,
    opts: { bold?: boolean; color?: string; fill?: string } = {},
  ) =>
    new TableCell({
      width: { size: COLUMN_WIDTHS[column], type: WidthType.DXA },
      shading: opts.fill
        ? { type: ShadingType.CLEAR, fill: opts.fill }
        : undefined,
      margins: CELL_MARGINS,
      children: [
        new Paragraph({
          alignment: ALIGNMENTS[column],
          children: [
            new TextRun({
              text: content,
              bold: opts.bold ?? false,
              color: opts.color ?? BLACK,
              size: 20,
            }),
          ],
        }),
      ],
    })

  const detailTable = (site: ArPaidSite) => {
    const edge = { style: BorderStyle.SINGLE, size: 4, color: 'auto' }
    return new Table({
      width: { size: 8400, type: WidthType.DXA },
      columnWidths: COLUMN_WIDTHS,
      borders: {
        top: edge,
        bottom: edge,
        left: edge,
        right: edge,
        insideHorizontal: edge,
        insideVertical: edge,
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['Date', 'A/R Customer', 'Shift #', 'Amount Paid'].map(
            (heading, i) =>
              cell(heading, i, { bold: true, color: WHITE, fill: NAVY }),
          ),
        }),
        ...site.rows.map(
          (r) =>
            new TableRow({
              children: [
                cell(r.dateLabel, 0),
                cell(r.customer, 1),
                cell(r.shiftNumber, 2),
                cell(r.amountLabel, 3),
              ],
            }),
        ),
        // The original leaves the total row unshaded and unbolded.
        new TableRow({
          children: [
            cell('', 0),
            cell('Total', 1),
            cell(site.paymentCountLabel, 2),
            cell(site.totalPaidLabel, 3),
          ],
        }),
      ],
    })
  }

  // ── Cover page ──
  const lastSite = report.sites.length - 1
  const cover = [
    new Paragraph({ spacing: { before: 1800 } }),
    rule('bottom', { color: NAVY, size: 24, space: 1, after: 500 }),
    line('GEN7', {
      bold: true,
      color: SLATE,
      characterSpacing: 30,
      size: 24,
      after: 200,
      alignment: AlignmentType.LEFT,
    }),
    // The original splits the title across two lines.
    line('A/R Payments', { bold: true, color: NAVY, size: 72, after: 0 }),
    line('Received Report', { bold: true, color: NAVY, size: 72, after: 300 }),
    line(`Consolidated Summary — ${report.monthLabel}`, {
      color: BODY_GREY,
      size: 26,
      after: 900,
    }),
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          color: RULE_GREY,
          size: 6,
          space: 4,
        },
      },
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: 'SITES COVERED',
          bold: true,
          color: NAVY,
          characterSpacing: 20,
          size: 20,
        }),
      ],
    }),
    ...report.sites.flatMap((s, i) => [
      line(s.displayName, {
        color: SITE_GREY,
        size: 24,
        after: 40,
        before: i === 0 ? 120 : undefined,
      }),
      line(s.coverageLabel, {
        color: MUTED_GREY,
        size: 19,
        after: i === lastSite ? 900 : 200,
      }),
    ]),
    rule('top', {
      color: RULE_GREY,
      size: 6,
      space: 4,
      after: 100,
      before: 600,
    }),
    line('Prepared for: Gen7', { color: MUTED_GREY, size: 19, after: 40 }),
    line(`Report period: ${report.periodLabel}`, {
      color: MUTED_GREY,
      size: 19,
    }),
  ]

  // ── One section per site ──
  const siteBlocks = report.sites.flatMap((site) => [
    new Paragraph({ children: [new PageBreak()] }),
    line('A/R Payments Received Report', {
      bold: true,
      color: NAVY,
      size: 44,
      after: 120,
    }),
    line(site.displayName, { color: BODY_GREY, size: 22, after: 60 }),
    line(`Reporting Period: ${report.monthLabel}`, {
      color: BODY_GREY,
      size: 22,
      after: 400,
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
      children: [new TextRun({ text: 'Summary' })],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [new TextRun({ text: site.summaryText })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
      children: [new TextRun({ text: 'A/R Payments Detail' })],
    }),
    ...(site.rows.length > 0
      ? [detailTable(site)]
      : [
          line(
            'No A/R payments were recorded for this site during this period.',
            { color: MUTED_GREY, size: 19 },
          ),
        ]),
    // Data-quality notes; the original never needed these.
    ...(site.hasUnnamedCustomers
      ? [
          line(
            '* One or more payments were recorded against a blank customer name on ' +
              'the shift report and appear as (Unnamed).',
            { color: MUTED_GREY, size: 18, before: 160 },
          ),
        ]
      : []),
    ...(site.hasNegativeAmounts
      ? [
          line(
            '* This period includes one or more negative A/R payment amounts ' +
              '(reversals or corrections).',
            { color: MUTED_GREY, size: 18, before: 160 },
          ),
        ]
      : []),
  ])

  const doc = new Document({
    creator: 'Gen7 Desk',
    title: `A/R Payments Received Report — ${report.monthLabel}`,
    description: `A/R payments received across the Wavers sites for ${report.monthLabel}`,
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children: [...cover, ...siteBlocks],
      },
    ],
  })

  return Packer.toBlob(doc)
}
