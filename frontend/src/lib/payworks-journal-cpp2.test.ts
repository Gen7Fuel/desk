import { describe, expect, it } from 'vitest'
import {
  buildJournalEntryPayload,
  isBalanced,
  journalTotals,
  parsePayworksJournal,
} from './payworks-journal'

// Journal section of the real Jocko Point PDF: two employer CPP lines (CPP and
// CPP2), a negative service fee and no HST.
const JOCKO =
  'Customer Number O14217 Payment Date 2026-10-09 Period ending Date 2026-10-04 ' +
  'Pay Period 41 Run Date 2026-10-06 Pay Group Jocko Point Gen7 LP Journal Entry ' +
  'Account Description Debits Credits 000003 Jocko Point Gen7 LP ' +
  'Wages 7,331.57 ? Ontario - WSIB 1403447 66.52 ' +
  '? 792305229RP0001 - CPP Employer 289.77 ' +
  '? 792305229RP0001 - CPP2 Employer 76.92 ' +
  '? 792305229RP0001 - EI Employer 123.43 ' +
  '? Service Fees -581.75 Payroll Clearing Account 7,306.46'

describe('a second employer CPP line (CPP2)', () => {
  const j = parsePayworksJournal(JOCKO)

  it('captures CPP and CPP2 separately', () => {
    expect(j).toMatchObject({
      cpp: 289.77,
      cpp2: 76.92,
      ei: 123.43,
      serviceFees: -581.75,
      hst: 0,
    })
  })

  it('now balances', () => {
    expect(journalTotals(j)).toEqual({ debit: 7888.21, credit: 7888.21 })
    expect(isBalanced(j)).toBe(true)
  })

  it('sends CPP2 as its own debit on the CPP account', () => {
    const payload = buildJournalEntryPayload({
      journal: j,
      locationId: 'G140',
      creditAccountId: '10097',
      description: 'x',
    })
    expect(
      payload.lines.map((l) => [l.txnType, l.glAccount.id, l.txnAmount]),
    ).toEqual([
      ['credit', '10097', '7306.46'],
      ['debit', '53300', '7331.57'],
      ['debit', '53650', '66.52'],
      ['debit', '53550', '289.77'],
      ['debit', '53550', '76.92'],
      ['debit', '53600', '123.43'],
      ['credit', '54650', '581.75'],
    ])
  })

  it('treats a PDF with no CPP2 as before', () => {
    const noCpp2 = JOCKO.replace(
      '? 792305229RP0001 - CPP2 Employer 76.92 ',
      '',
    ).replace('7,306.46', '7,229.54')
    const k = parsePayworksJournal(noCpp2)
    expect(k.cpp2).toBe(0)
    expect(isBalanced(k)).toBe(true)
  })
})
