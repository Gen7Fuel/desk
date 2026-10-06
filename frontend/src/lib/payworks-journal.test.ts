import { describe, expect, it } from 'vitest'
import {
  buildJournalEntryPayload,
  isBalanced,
  parsePayworksJournal,
} from './payworks-journal'

// Text items of the real Pay Period 40 PDF (Couchiching Gen7 LP), joined by spaces.
const SAMPLE = `v2.0   Gen7 Stations
  Customer Number   O14217   Payment Date   2026-10-02   Period ending Date   2026-09-27
  Pay Period   40   Run Date   2026-09-28   Pay Group   Couchiching Gen7 LP
  Journal Entry
  Account   Description   Debits   Credits
  10108   Net Pay   4,684.90
  ?   Service Fees   158.80
  ?   HST   20.64
  757514153RP0001 - Federal
  Tax   391.03
  757514153RP0001 - CPP
  Employee   213.17
  757514153RP0001 - CPP
  Employer   213.17
  757514153RP0001 - EI
  Employee   87.66
  757514153RP0001 - EI
  Employer   122.73
  Ontario - WSIB   66.14
  Payroll Clearing Account   5,958.24
  000008   Couchiching Gen7 LP
  Wages   5,376.76
  Ontario - WSIB 9879672   66.14
  757514153RP0001 - CPP
  Employer   213.17
  757514153RP0001 - EI
  Employer   122.73
  ?   Service Fees   158.80
  ?   HST   20.64
  Payroll Clearing Account   5,958.24`

describe('parsePayworksJournal', () => {
  const j = parsePayworksJournal(SAMPLE)

  it('reads the header fields', () => {
    expect(j).toMatchObject({
      customerNumber: 'O14217',
      payPeriod: '40',
      periodEnding: '2026-09-27',
      runDate: '2026-09-28',
      payGroup: 'Couchiching Gen7 LP',
    })
  })

  it('reads the employer-side journal amounts, not the payables section', () => {
    expect(j).toMatchObject({
      wages: 5376.76,
      wsib: 66.14,
      cpp: 213.17,
      ei: 122.73,
      serviceFees: 158.8,
      hst: 20.64,
      clearingTotal: 5958.24,
    })
  })

  it('balances', () => {
    expect(isBalanced(j)).toBe(true)
  })

  it('rejects text that is not a journal entry', () => {
    expect(() => parsePayworksJournal('hello')).toThrow(/Not a Payworks/)
  })

  it('names the missing fields', () => {
    const broken = SAMPLE.replace(/Wages\s+5,376\.76/, 'Wages')
    expect(() => parsePayworksJournal(broken)).toThrow(/wages/)
  })
})

describe('buildJournalEntryPayload', () => {
  const j = parsePayworksJournal(SAMPLE)
  const payload = buildJournalEntryPayload({
    journal: j,
    locationId: 'G160',
    creditAccountId: '10131',
    description: 'FT Frances Gen7 LP Weekly Payroll',
  })

  it('creates a draft PYRJ entry on the run date', () => {
    expect(payload).toMatchObject({
      glJournal: { id: 'PYRJ' },
      postingDate: '2026-09-28',
      state: 'draft',
      scheduledOperationKey: '40',
    })
  })

  it('credits the bank account and debits the expense accounts', () => {
    const rows = payload.lines.map((l) => [
      l.txnType,
      l.glAccount.id,
      l.txnAmount,
    ])
    expect(rows).toEqual([
      ['credit', '10131', '5958.24'],
      ['debit', '53300', '5376.76'],
      ['debit', '53650', '66.14'],
      ['debit', '53550', '213.17'],
      ['debit', '53600', '122.73'],
      ['debit', '54650', '158.80'],
      ['debit', '54650', '20.64'],
    ])
    expect(
      payload.lines.every((l) => l.dimensions.location.id === 'G160'),
    ).toBe(true)
  })
})
