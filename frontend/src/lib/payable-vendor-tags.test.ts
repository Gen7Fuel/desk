import { describe, expect, it } from 'vitest'
import { vendorNameKey } from './payable-vendor-tags'

describe('vendorNameKey', () => {
  it('ignores case, outer whitespace and repeated spaces', () => {
    expect(vendorNameKey('  Global   Payments ')).toBe('global payments')
    expect(vendorNameKey('GLOBAL PAYMENTS')).toBe(
      vendorNameKey('global payments'),
    )
  })

  it('keeps different names apart', () => {
    expect(vendorNameKey('Global Payment')).not.toBe(
      vendorNameKey('Global Payments'),
    )
  })
})
