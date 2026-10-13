// Lines of the Intacct Other Receipt that Cash Management creates for one day.
// Pure so the per-site rules can be tested; the page turns these into the
// Intacct payload.

/** Sites with no bank statement: no GBL/Kardpoll Paid/Short, Till Over/Short instead. */
export const NO_BANK_STATEMENT_SITES: ReadonlyArray<string> = [
  'Charlies',
  'Osoyoos',
  'Oliver',
  'Wavers East',
  'Wavers West',
  'Sioux Valley',
]

export const GST_GL_ACCOUNT = '20300'
export const RST_GL_ACCOUNT = '20390'
export const TILL_OVER_SHORT_GL_ACCOUNT = '55050'

export interface ReceiptLine {
  glAccount: string
  /** Signed, exactly as it should post. */
  amount: number
  description: string
}

export interface ReceiptFigures {
  site: string
  /** DD/MM/YYYY, for the safe deposit line. */
  dateLabel: string
  /** Total sales less item sales, cash, missed CPL, GST and RST. */
  gblSales: number
  cashSales: number
  kardpollSales: number
  ontarioIntegratedTax: number
  gst: number
  rst: number
  storeSales: number
  safeDeposit: number
  nightDeposit: number
  gcRedemption: number
  loyalty: number
  /** AR purchase orders that aren't GPMC, one total line. */
  nonGpmcArTotal: number
  gpmcArRows: ReadonlyArray<{ name: string; amount: number }>
  kardpollValue: number
  gblValue: number
  /** Signed: negative is short. */
  tillOverShort: number
}

/** Hub's Till Over/Short: its adjusted figure when it has one, else computed. */
export function tillOverShortFor({
  adjustedOverShort,
  canadianCashCollected,
  reportedCanadianCash,
  handheldDebit,
  unsettledPrepays,
}: {
  adjustedOverShort?: number | null
  canadianCashCollected: number
  reportedCanadianCash: number
  handheldDebit: number
  unsettledPrepays: number
}): number {
  return adjustedOverShort != null
    ? adjustedOverShort
    : canadianCashCollected -
        reportedCanadianCash +
        handheldDebit +
        unsettledPrepays
}

const cents = (n: number) => Math.round(n * 100)

/** Lines in the order they appear on the entry; zero-value lines are left out. */
export function buildReceiptLines(f: ReceiptFigures): Array<ReceiptLine> {
  const noBank = NO_BANK_STATEMENT_SITES.includes(f.site)
  const lines: Array<ReceiptLine> = [
    { glAccount: '40010', amount: f.gblSales, description: 'GBL Sales' },
    { glAccount: '40010', amount: f.cashSales, description: 'Cash Sales' },
    { glAccount: '40010', amount: f.kardpollSales, description: 'Kardpoll Sales' },
    {
      glAccount: '40010',
      amount: f.ontarioIntegratedTax,
      description: 'Ontario Integrated Tax',
    },
    { glAccount: GST_GL_ACCOUNT, amount: f.gst, description: 'GST' },
    { glAccount: RST_GL_ACCOUNT, amount: f.rst, description: 'RST' },
    { glAccount: '40200', amount: f.storeSales, description: 'Store Sales' },
    {
      glAccount: '10011',
      amount: -f.safeDeposit,
      description: `Safe Deposit ${f.dateLabel}`,
    },
    { glAccount: '10011', amount: f.nightDeposit, description: 'Night Deposit' },
    {
      glAccount: '52250',
      amount: -f.gcRedemption,
      description: 'Gift Card Redemption',
    },
    { glAccount: '52175', amount: -f.loyalty, description: 'Loyalty' },
    { glAccount: '10440', amount: -f.nonGpmcArTotal, description: 'Total AR POs' },
    ...f.gpmcArRows.map((r) => ({
      glAccount: '55100',
      amount: -r.amount,
      description: r.name,
    })),
  ]

  if (noBank) {
    lines.push({
      glAccount: TILL_OVER_SHORT_GL_ACCOUNT,
      amount: f.tillOverShort,
      description: f.tillOverShort >= 0 ? 'Till Over' : 'Till Short',
    })
  } else {
    lines.push(
      {
        glAccount: '55050',
        amount: f.kardpollValue,
        description: f.kardpollValue >= 0 ? 'Kardpoll Paid' : 'Kardpoll Short',
      },
      {
        glAccount: '55050',
        amount: f.gblValue,
        description: f.gblValue >= 0 ? 'GBL Paid' : 'GBL Short',
      },
    )
  }

  return lines.filter((l) => cents(l.amount) !== 0)
}
