import { describe, expect, it } from 'vitest'
import {
  buildJournalEntryPayload,
  isBalanced,
  journalTotals,
  parsePayworksJournal,
} from './payworks-journal'

// Text of the real Pay Period 41 PDF (Couchiching Gen7 LP), where Service Fees
// is negative (-195.20): a credit that reduces the expense, with no HST.
const PP41 =
  'v2.0 Gen7 Stations Customer Number O14217 Payment Date 2026-10-09 ' +
  'Period ending Date 2026-10-04 Pay Period 41 Run Date 2026-10-06 ' +
  'Pay Group Couchiching Gen7 LP Journal Entry Account Description Debits Credits ' +
  '10108 Net Pay 6,199.33 ? Service Fees -195.20 ' +
  '757514153RP0001 - Federal Tax 420.50 757514153RP0001 - CPP Employee 312.56 ' +
  '757514153RP0001 - CPP Employer 312.56 757514153RP0001 - EI Employee 114.88 ' +
  '757514153RP0001 - EI Employer 160.84 Ontario - WSIB 86.68 ' +
  'Payroll Clearing Account 7,412.15 000008 Couchiching Gen7 LP Wages 7,047.27 ' +
  'Ontario - WSIB 9879672 86.68 757514153RP0001 - CPP Employer 312.56 ' +
  '757514153RP0001 - EI Employer 160.84 ? Service Fees -195.20 ' +
  'Payroll Clearing Account 7,412.15'

describe('a negative service fee (credit)', () => {
  const j = parsePayworksJournal(PP41)

  it('is read with its sign, not dropped', () => {
    expect(j).toMatchObject({
      payPeriod: '41',
      runDate: '2026-10-06',
      wages: 7047.27,
      wsib: 86.68,
      cpp: 312.56,
      ei: 160.84,
      serviceFees: -195.2,
      hst: 0,
      clearingTotal: 7412.15,
    })
  })

  it('balances with the fee counted as a credit', () => {
    expect(journalTotals(j)).toEqual({ debit: 7607.35, credit: 7607.35 })
    expect(isBalanced(j)).toBe(true)
  })

  it('is sent to Intacct as a credit line on the same account', () => {
    const payload = buildJournalEntryPayload({
      journal: j,
      locationId: 'G160',
      creditAccountId: '10131',
      description: 'x',
    })
    expect(
      payload.lines.map((l) => [l.txnType, l.glAccount.id, l.txnAmount]),
    ).toEqual([
      ['credit', '10131', '7412.15'],
      ['debit', '53300', '7047.27'],
      ['debit', '53650', '86.68'],
      ['debit', '53550', '312.56'],
      ['debit', '53600', '160.84'],
      ['credit', '54650', '195.20'],
    ])
  })
})
