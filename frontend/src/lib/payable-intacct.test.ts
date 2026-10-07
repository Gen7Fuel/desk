import { describe, expect, it } from 'vitest'
import {
  CASH_VENDOR_ID,
  buildPayableBillNumber,
  buildPayableBillPayload,
  formatBillDate,
} from './payable-intacct'

describe('formatBillDate', () => {
  it('matches the hand-made entries, including "Sept"', () => {
    expect(formatBillDate('2026-09-29')).toBe('Sept 29/2026')
    expect(formatBillDate('2026-10-02')).toBe('Oct 02/2026')
    expect(formatBillDate('2026-01-05')).toBe('Jan 05/2026')
  })

  it('rejects a malformed date', () => {
    expect(() => formatBillDate('29/09/2026')).toThrow(/Invalid date/)
  })
})

describe('buildPayableBillNumber', () => {
  it('is "<vendor> <date>"', () => {
    expect(buildPayableBillNumber('  Wholesale Club ', '2026-09-29')).toBe(
      'Wholesale Club Sept 29/2026',
    )
  })

  it('appends the amount for the duplicate retry', () => {
    expect(buildPayableBillNumber('Wholesale Club', '2026-09-29', 145.3)).toBe(
      'Wholesale Club Sept 29/2026 - 145.30',
    )
  })
})

describe('buildPayableBillPayload', () => {
  const input = {
    billNumber: 'Wholesale Club Sept 29/2026',
    vendorName: 'Wholesale Club',
    date: '2026-09-29',
    amount: 145.3,
    notes: 'Deli Supplies',
    supplierId: CASH_VENDOR_ID,
    entityId: 'G150',
  }
  const bill = buildPayableBillPayload(input)

  it('is a draft bill for the supplier, dated on the payable date', () => {
    expect(bill).toMatchObject({
      billNumber: 'Wholesale Club Sept 29/2026',
      vendor: { id: 'V00236' },
      state: 'draft',
      createdDate: '2026-09-29',
      postingDate: '2026-09-29',
      dueDate: '2026-09-29',
      taxSolution: { key: '3' },
    })
  })

  it('has only the negative Store Safe line', () => {
    expect(bill.lines).toHaveLength(1)
    expect(bill.lines[0]).toMatchObject({
      glAccount: { id: '10011' },
      txnAmount: '-145.30',
      memo: 'Deli Supplies',
      dimensions: { location: { id: 'G150' }, vendor: { id: 'V00236' } },
    })
  })

  it('uses the vendor name as the memo when there are no notes', () => {
    expect(
      buildPayableBillPayload({ ...input, notes: '  ' }).lines[0].memo,
    ).toBe('Wholesale Club')
  })

  it('links the attachment only when there is one', () => {
    expect(bill).not.toHaveProperty('attachment')
    expect(
      buildPayableBillPayload({ ...input, attachmentKey: '17' }),
    ).toMatchObject({ attachment: { key: '17' } })
  })
})
