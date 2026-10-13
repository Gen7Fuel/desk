import { describe, expect, it } from 'vitest'
import {
  NO_BANK_STATEMENT_SITES,
  buildReceiptLines,
  tillOverShortFor,
} from './sage-other-receipt-lines'
import type { ReceiptFigures } from './sage-other-receipt-lines'

const base: ReceiptFigures = {
  site: 'Rankin',
  dateLabel: '06/10/2026',
  gblSales: 1000,
  cashSales: 200,
  kardpollSales: 300,
  ontarioIntegratedTax: 0,
  gst: 50,
  rst: 70,
  storeSales: 400,
  safeDeposit: 200,
  nightDeposit: 0,
  gcRedemption: 20,
  loyalty: 10,
  nonGpmcArTotal: 0,
  gpmcArRows: [],
  kardpollValue: -5,
  gblValue: 12,
  tillOverShort: -3.5,
}

const rows = (f: ReceiptFigures) =>
  buildReceiptLines(f).map((l) => [l.glAccount, l.amount, l.description])

describe('buildReceiptLines', () => {
  it('posts GST to 20300 and RST to 20390, with no single tax total line', () => {
    const r = rows(base)
    expect(r).toContainEqual(['20300', 50, 'GST'])
    expect(r).toContainEqual(['20390', 70, 'RST'])
    expect(r.filter((l) => /tax/i.test(String(l[2])))).toEqual([])
  })

  it('keeps the bank-statement Paid/Short lines for a site with a bank statement', () => {
    const r = rows(base)
    expect(r).toContainEqual(['55050', -5, 'Kardpoll Short'])
    expect(r).toContainEqual(['55050', 12, 'GBL Paid'])
    expect(r.filter((l) => String(l[2]).startsWith('Till'))).toEqual([])
  })

  it.each([...NO_BANK_STATEMENT_SITES])(
    '%s gets Till Over/Short on 55050 instead of the Paid/Short lines',
    (site) => {
      const r = rows({ ...base, site })
      expect(r).toContainEqual(['55050', -3.5, 'Till Short'])
      expect(r.filter((l) => /Paid|Short$/.test(String(l[2])) && l[2] !== 'Till Short')).toEqual([])
      // The 40010 sales lines are untouched.
      expect(r).toContainEqual(['40010', 1000, 'GBL Sales'])
      expect(r).toContainEqual(['40010', 300, 'Kardpoll Sales'])
    },
  )

  it('labels a positive Till Over/Short as over', () => {
    expect(rows({ ...base, site: 'Oliver', tillOverShort: 4.25 })).toContainEqual([
      '55050',
      4.25,
      'Till Over',
    ])
  })

  it('leaves out zero-value lines, including a zero till over/short and zero tax', () => {
    const r = rows({ ...base, site: 'Oliver', tillOverShort: 0, gst: 0, rst: 0 })
    expect(r.find((l) => l[0] === '55050')).toBeUndefined()
    expect(r.find((l) => l[0] === '20300' || l[0] === '20390')).toBeUndefined()
  })

  it('posts the safe, gift card, loyalty and AR lines as before', () => {
    const r = rows({
      ...base,
      nonGpmcArTotal: 90,
      gpmcArRows: [{ name: 'GPMC Fleet', amount: 40 }],
      nightDeposit: 15,
    })
    expect(r).toContainEqual(['10011', -200, 'Safe Deposit 06/10/2026'])
    expect(r).toContainEqual(['10011', 15, 'Night Deposit'])
    expect(r).toContainEqual(['52250', -20, 'Gift Card Redemption'])
    expect(r).toContainEqual(['52175', -10, 'Loyalty'])
    expect(r).toContainEqual(['10440', -90, 'Total AR POs'])
    expect(r).toContainEqual(['55100', -40, 'GPMC Fleet'])
  })
})

describe('tillOverShortFor', () => {
  const inputs = {
    canadianCashCollected: 1000,
    reportedCanadianCash: 990,
    handheldDebit: 4,
    unsettledPrepays: -2,
  }

  it("uses Hub's adjusted figure when it has one, including 0", () => {
    expect(tillOverShortFor({ ...inputs, adjustedOverShort: -7.5 })).toBe(-7.5)
    expect(tillOverShortFor({ ...inputs, adjustedOverShort: 0 })).toBe(0)
  })

  it('otherwise computes it from the cash figures', () => {
    expect(tillOverShortFor({ ...inputs, adjustedOverShort: null })).toBe(12)
    expect(tillOverShortFor({ ...inputs })).toBe(12)
  })
})
