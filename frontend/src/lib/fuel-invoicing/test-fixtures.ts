import type { ExtractedFields, TableEntry } from './types'

export function fuelEntry(overrides: Partial<TableEntry> = {}): TableEntry {
  return {
    product: '87',
    description: 'Regular Gas',
    qtyNet: '10,000.125',
    qtyGross: '11,000',
    productRate: '1.20',
    federalTaxRate: '',
    federalTaxName: 'Federal Gas Tax',
    provincialTaxRate: '',
    provincialTaxName: 'Provincial Gas Tax',
    pricePerUnit: '1.20',
    freightRate: '',
    totalFreight: '',
    productTotal: '12,000.15',
    federalTaxTotal: '100.00',
    provincialTaxTotal: '50.00',
    ...overrides,
  }
}

export function fuelInvoice(
  overrides: Partial<ExtractedFields> = {},
): ExtractedFields {
  return {
    shippingLocation: null,
    orderDate: null,
    delivDate: null,
    invoiceNumber: 'test-invoice',
    billDate: '10/19/2026',
    dueDraftDate: null,
    billTo: null,
    shipTo: 'Freddies Gen7 LP',
    customer: null,
    manifest: 'test-bol',
    driverCarrier: null,
    terms: 'Net 5 Days',
    remitTo: null,
    totalOrdered: null,
    totalDelivered: null,
    productTotal: '12,000.15',
    freightTotal: '100.00',
    surcharges: '10.00',
    taxFeeTotal: '150.00',
    totalInvoiceToRemit: '12,260.15',
    tableEntries: [fuelEntry()],
    ...overrides,
  }
}
