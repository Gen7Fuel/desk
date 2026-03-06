export type TableEntry = {
  product: string
  qtyNet: string
  qtyGross: string
  productRate: string
  federalTaxRate: string
  provincialTaxRate: string
  pricePerUnit: string
  freightRate: string
  totalFreight: string
  productTotal: string
  federalTaxTotal: string
  provincialTaxTotal: string
}

export type ExtractedFields = {
  shippingLocation: string | null
  orderDate: string | null
  delivDate: string | null
  invoiceNumber: string | null
  billDate: string | null
  dueDraftDate: string | null
  billTo: string | null
  shipTo: string | null
  customer: string | null
  manifest: string | null
  driverCarrier: string | null
  terms: string | null
  remitTo: string | null
  totalOrdered: string | null
  totalDelivered: string | null
  productTotal: string | null
  freightTotal: string | null
  surcharges: string | null
  taxFeeTotal: string | null
  totalInvoiceToRemit: string | null
  productColumnValues: string[]
  qtyNetValues: string[]
  freightCellValues: string[]
  tableEntries: TableEntry[]
}
