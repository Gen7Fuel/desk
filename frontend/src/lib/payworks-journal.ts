// Parsing + Intacct payload building for Payworks "Journal Entry" PDFs.

export interface PayworksJournal {
  customerNumber: string | null
  payPeriod: string
  periodEnding: string | null
  runDate: string
  payGroup: string | null
  wages: number
  wsib: number
  cpp: number
  ei: number
  serviceFees: number
  hst: number
  /** Credit to Payroll Clearing — total of all the debits above. */
  clearingTotal: number
}

// GL accounts for each debit line (Intacct "Payroll Journal" entries).
export const PAYROLL_GL_ACCOUNTS = {
  wages: '53300',
  wsib: '53650',
  cpp: '53550',
  ei: '53600',
  // Service fees and HST are both booked to Office Supplies.
  serviceFees: '54650',
  hst: '54650',
} as const

export const PAYROLL_JOURNAL_ID = 'PYRJ'

const AMOUNT = String.raw`([\d,]+\.\d{2})`

function money(text: string, pattern: string): number | null {
  const m = new RegExp(pattern + String.raw`\s*` + AMOUNT, 'i').exec(text)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

function field(text: string, pattern: RegExp): string | null {
  return pattern.exec(text)?.[1]?.trim() ?? null
}

/**
 * Parses the flattened text of a Payworks Journal Entry PDF (all pages, text
 * items joined by spaces). The PDF lists payables first (net pay, employee
 * and employer remittances), then the pay group's journal, which starts at
 * "Wages". Only that second section is read: employer CPP/EI, WSIB, wages,
 * service fees, HST and the Payroll Clearing credit.
 */
export function parsePayworksJournal(rawText: string): PayworksJournal {
  const text = rawText.replace(/\s+/g, ' ').trim()

  const runDate = field(text, /Run Date\s*(\d{4}-\d{2}-\d{2})/i)
  const payPeriod = field(text, /Pay Period\s*(\d+)/i)
  if (!runDate || !payPeriod) {
    throw new Error(
      'Not a Payworks journal entry: Run Date / Pay Period not found.',
    )
  }

  const wagesAt = text.search(/\bWages\b/)
  if (wagesAt < 0) throw new Error('Wages line not found in the journal entry.')
  const journal = text.slice(wagesAt)

  const values = {
    wages: money(journal, String.raw`Wages`),
    wsib: money(journal, String.raw`WSIB(?:\s+\d+)?`),
    cpp: money(journal, String.raw`CPP\s+Employer`),
    ei: money(journal, String.raw`EI\s+Employer`),
    serviceFees: money(journal, String.raw`Service Fees`),
    hst: money(journal, String.raw`HST`),
    clearingTotal: money(journal, String.raw`Payroll Clearing Account`),
  }
  const missing = Object.entries(values)
    .filter(([, v]) => v === null)
    .map(([k]) => k)
  if (missing.length) {
    throw new Error(`Could not find in the PDF: ${missing.join(', ')}`)
  }

  return {
    customerNumber: field(text, /Customer Number\s*(\S+)/i),
    payPeriod,
    periodEnding: field(text, /Period ending Date\s*(\d{4}-\d{2}-\d{2})/i),
    runDate,
    payGroup: field(text, /Pay Group\s*(.+?)\s*Journal Entry/i),
    ...(values as Record<keyof typeof values, number>),
  }
}

const cents = (n: number) => Math.round(n * 100)

/** Debit lines in display order; the same order is used for the Intacct payload. */
export function journalDebits(j: PayworksJournal) {
  return [
    {
      key: 'wages',
      label: 'Wages',
      glAccount: PAYROLL_GL_ACCOUNTS.wages,
      amount: j.wages,
    },
    {
      key: 'wsib',
      label: 'WSIB',
      glAccount: PAYROLL_GL_ACCOUNTS.wsib,
      amount: j.wsib,
    },
    {
      key: 'cpp',
      label: 'CPP',
      glAccount: PAYROLL_GL_ACCOUNTS.cpp,
      amount: j.cpp,
    },
    { key: 'ei', label: 'EI', glAccount: PAYROLL_GL_ACCOUNTS.ei, amount: j.ei },
    {
      key: 'serviceFees',
      label: 'Service Fees',
      glAccount: PAYROLL_GL_ACCOUNTS.serviceFees,
      amount: j.serviceFees,
    },
    {
      key: 'hst',
      label: 'HST',
      glAccount: PAYROLL_GL_ACCOUNTS.hst,
      amount: j.hst,
    },
  ] as const
}

export function totalDebits(j: PayworksJournal): number {
  return journalDebits(j).reduce((sum, d) => sum + cents(d.amount), 0) / 100
}

export function isBalanced(j: PayworksJournal): boolean {
  return cents(totalDebits(j)) === cents(j.clearingTotal)
}

export function buildJournalEntryPayload(args: {
  journal: PayworksJournal
  locationId: string
  creditAccountId: string
  description: string
}) {
  const { journal, locationId, creditAccountId, description } = args
  const dimensions = { location: { id: locationId } }

  return {
    glJournal: { id: PAYROLL_JOURNAL_ID },
    postingDate: journal.runDate,
    description,
    // Saved as a draft in Intacct rather than posted.
    state: 'draft',
    scheduledOperationKey: journal.payPeriod,
    lines: [
      {
        txnType: 'credit',
        txnAmount: journal.clearingTotal.toFixed(2),
        glAccount: { id: creditAccountId },
        dimensions,
        description,
      },
      ...journalDebits(journal).map((d) => ({
        txnType: 'debit',
        txnAmount: d.amount.toFixed(2),
        glAccount: { id: d.glAccount },
        dimensions,
        description,
      })),
    ],
  }
}

/** Extracts the text of every page of a PDF, items joined by spaces. */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() })
    .promise
  const pages: Array<string> = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent()
    pages.push(content.items.map((i: any) => i.str).join(' '))
  }
  return pages.join(' ')
}
