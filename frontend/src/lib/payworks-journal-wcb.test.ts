import { describe, expect, it } from 'vitest'
import {
  buildJournalEntryPayload,
  isBalanced,
  journalTotals,
  parsePayworksJournal,
} from './payworks-journal'

// Journal section of the real Silver Grizzly PDF: British Columbia's workers'
// comp line is "WCB" (not "WSIB"), plus a negative service fee and no HST.
const SILVER_GRIZZLY =
  'Customer Number O14217 Payment Date 2026-10-09 Period ending Date 2026-10-04 ' +
  'Pay Period 41 Run Date 2026-10-06 Pay Group Silver Grizzy Gen7 LP Journal Entry ' +
  'Account Description Debits Credits 000009 Silver Grizzy Gen7 LP ' +
  'Wages 8,758.96 British Columbia - WCB 201675124 56.06 ' +
  '791614027RP0001 - CPP Employer 471.76 ' +
  '791614027RP0001 - EI Employer 199.88 ' +
  '? Service Fees -1,147.85 Payroll Clearing Account 8,338.81'

describe('WCB (British Columbia) in place of WSIB', () => {
  const j = parsePayworksJournal(SILVER_GRIZZLY)

  it('reads the WCB amount into the same field as WSIB', () => {
    expect(j).toMatchObject({
      wages: 8758.96,
      wsib: 56.06,
      cpp: 471.76,
      cpp2: 0,
      ei: 199.88,
      serviceFees: -1147.85,
      clearingTotal: 8338.81,
    })
  })

  it('balances', () => {
    expect(journalTotals(j)).toEqual({ debit: 9486.66, credit: 9486.66 })
    expect(isBalanced(j)).toBe(true)
  })

  it('posts WCB to the WSIB account', () => {
    const payload = buildJournalEntryPayload({
      journal: j,
      locationId: 'G170',
      creditAccountId: '10135',
      description: 'x',
    })
    expect(
      payload.lines.map((l) => [l.txnType, l.glAccount.id, l.txnAmount]),
    ).toEqual([
      ['credit', '10135', '8338.81'],
      ['debit', '53300', '8758.96'],
      ['debit', '53650', '56.06'],
      ['debit', '53550', '471.76'],
      ['debit', '53600', '199.88'],
      ['credit', '54650', '1147.85'],
    ])
  })
})
