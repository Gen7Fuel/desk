import { describe, expect, it } from 'vitest'
import { suggestedAccountCodes } from './tradogram-api'
import type {
  DeliverySource,
  Draft,
  GLAccount,
  SiteAccount,
} from './tradogram-api'

const accounts: Array<GLAccount> = [
  { code: 'loan', name: 'Loan Site', number: '16250', type: 'loan' },
  {
    code: 'inventory',
    name: 'Build Inventory',
    number: '10760',
    type: 'inventory',
  },
]
const site: SiteAccount = {
  site: 'Walpole',
  tradogramLocation: '',
  sageLocationId: 'T010',
  loanAccountId: '16250',
  inventoryAccountId: '10760',
}
const source: DeliverySource = {
  supplierAccountNumber: 'V001',
  deliveryCode: 'abcdefghijkl',
  poNumber: 'PO1',
  supplier: 'Supplier',
  receivedDate: '2026-10-22',
  sourceHash: 'hash',
  currency: 'CAD',
  subtotal: 10,
  issues: [],
  poTax: '0',
  poDiscount: '0',
  poFees: '0',
  lines: [
    {
      id: 'line',
      name: 'Pump',
      description: '',
      quantity: 1,
      ordered: 2,
      unit: '',
      unitPrice: 10,
      amount: 10,
      department: '',
      poGLAccountName: 'Loan Site',
      poGLAccountNumber: '16250',
    },
  ],
}
const draft: Draft = {
  revision: 1,
  site: 'Walpole',
  vendorId: 'V1',
  invoiceNumber: '',
  notes: '',
  status: 'draft',
  intacctBillKey: '',
  lines: [],
}

describe('Tradogram GL suggestions', () => {
  it('suggests a unique eligible PO account for a new delivery', () => {
    expect(suggestedAccountCodes(source, null, site, accounts)).toEqual({
      line: 'loan',
    })
    expect(
      suggestedAccountCodes(
        {
          ...source,
          lines: [{ ...source.lines[0], poGLAccountNumber: '20010' }],
        },
        null,
        site,
        accounts,
      ),
    ).toEqual({ line: '' })
  })
  it('preserves a saved account even if the PO or catalogue changed', () => {
    expect(
      suggestedAccountCodes(
        source,
        {
          ...draft,
          lines: [
            { id: 'line', accountType: 'inventory', glAccountCode: 'removed' },
          ],
        },
        site,
        accounts,
      ),
    ).toEqual({ line: 'removed' })
  })
  it('migrates older category-only drafts through site defaults', () => {
    expect(
      suggestedAccountCodes(
        source,
        { ...draft, lines: [{ id: 'line', accountType: 'inventory' }] },
        site,
        accounts,
      ),
    ).toEqual({ line: 'inventory' })
    expect(
      suggestedAccountCodes(
        source,
        { ...draft, lines: [{ id: 'line', accountType: 'inventory' }] },
        undefined,
        accounts,
      ),
    ).toEqual({ line: '' })
  })
  it('keeps an intentionally cleared saved selection empty', () => {
    expect(
      suggestedAccountCodes(
        source,
        {
          ...draft,
          lines: [{ id: 'line', accountType: '', glAccountCode: '' }],
        },
        site,
        accounts,
      ),
    ).toEqual({ line: '' })
  })
  it('requires an explicit choice when an account number is ambiguous', () => {
    expect(
      suggestedAccountCodes(source, null, site, [
        ...accounts,
        { ...accounts[0], code: 'duplicate' },
      ]),
    ).toEqual({ line: '' })
  })
})
