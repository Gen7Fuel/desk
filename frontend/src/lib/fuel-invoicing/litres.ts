import type { ExtractedFields, TableEntry } from './types'

/** Qty Delivered is stored as qtyNet by the PDF extractor. Never round it. */
export function deliveredLitres(entry: TableEntry): number {
  const raw = entry.qtyNet.trim()
  const valid = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)
  const value = Number(raw.replace(/,/g, ''))
  if (!valid || !Number.isFinite(value)) {
    throw new Error(
      `Invalid Qty Delivered for ${entry.description || entry.product}: "${entry.qtyNet}". Check the PDF before submitting with Litres.`,
    )
  }
  return value
}

export function validateDeliveredLitres(fields: ExtractedFields): void {
  if (!fields.tableEntries.length) {
    throw new Error(
      'No fuel products found. Check the PDF before submitting with Litres.',
    )
  }
  fields.tableEntries.forEach(deliveredLitres)
}
