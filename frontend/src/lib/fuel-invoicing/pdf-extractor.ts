import type { ExtractedFields, TableEntry } from './types'

const RECTS = {
  shippingLocation: { x0: 25, y0: 740, x1: 25 + 86, y1: 740 + 16 },
  orderDate: { x0: 26, y0: 710, x1: 26 + 85, y1: 710 + 17 },
  delivDate: { x0: 25, y0: 678, x1: 25 + 86, y1: 678 + 19 },
  invoiceNumber: { x0: 513, y0: 740, x1: 513 + 74, y1: 740 + 17 },
  billDate: { x0: 514, y0: 710, x1: 514 + 73, y1: 710 + 17 },
  dueDraftDate: { x0: 513, y0: 670, x1: 513 + 74, y1: 670 + 28 },
  billTo: { x0: 84, y0: 596, x1: 84 + 187, y1: 596 + 54 },
  shipTo: { x0: 361, y0: 595, x1: 361 + 187, y1: 595 + 57 },
  customer: { x0: 29, y0: 513, x1: 29 + 80, y1: 513 + 63 },
  manifest: { x0: 206, y0: 513, x1: 206 + 100, y1: 513 + 63 },
  driverCarrier: { x0: 421, y0: 512, x1: 421 + 83, y1: 512 + 64 },
  terms: { x0: 503, y0: 512, x1: 503 + 84, y1: 512 + 64 },
  remitTo: { x0: 30, y0: 41, x1: 30 + 173, y1: 41 + 71 },
  totalOrdered: { x0: 329, y0: 109, x1: 329 + 59, y1: 109 + 15 },
  totalDelivered: { x0: 330, y0: 95, x1: 330 + 59, y1: 95 + 15 },
  productTotal: { x0: 510, y0: 108, x1: 510 + 77, y1: 108 + 17 },
  freightTotal: { x0: 510, y0: 83, x1: 510 + 75, y1: 83 + 13 },
  surcharges: { x0: 510, y0: 70, x1: 510 + 75, y1: 70 + 13 },
  taxFeeTotal: { x0: 510, y0: 42, x1: 510 + 76, y1: 42 + 15 },
  totalInvoiceToRemit: { x0: 487, y0: 27, x1: 487 + 99, y1: 27 + 15 },
}

type PdfItem = { text: string; x: number; y: number }

function extractFromRect(
  items: Array<PdfItem>,
  rect: { x0: number; y0: number; x1: number; y1: number },
): string | null {
  const inRect = items.filter(
    (item) =>
      item.x >= rect.x0 &&
      item.x <= rect.x1 &&
      item.y >= rect.y0 &&
      item.y <= rect.y1,
  )
  return inRect.length ? inRect.map((i) => i.text).join(' ') : null
}

function filterRegion(
  items: Array<PdfItem>,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): Array<string> {
  return items
    .filter(
      (item) =>
        item.x >= xMin &&
        item.x <= xMax &&
        item.y >= yMin &&
        item.y <= yMax &&
        item.text.length > 0,
    )
    .map((item) => item.text)
}

function buildTableEntries(
  productColumnValues: Array<string>,
  qtyNetValues: Array<string>,
  qtyGrossValues: Array<string>,
  freightValues: Array<string>,
  rateTaxRaw: Array<string>,
  totalTaxRaw: Array<string>,
): Array<TableEntry> {
  const maxLen = Math.max(
    productColumnValues.length,
    qtyNetValues.length,
    qtyGrossValues.length,
    Math.floor(freightValues.length / 2),
  )
  const entries: Array<TableEntry> = []
  let rateTaxIdx = 0
  let totalTaxIdx = 0

  for (let i = 0; i < maxLen; i++) {
    const product = productColumnValues[i] || ''
    let productRate = '',
      federalTaxRate = '',
      provincialTaxRate = '',
      pricePerUnit = ''
    let productTotal = '',
      federalTaxTotal = '',
      provincialTaxTotal = ''

    if (product === 'ULSDD') {
      productRate = rateTaxRaw[rateTaxIdx] || ''
      federalTaxRate = rateTaxRaw[rateTaxIdx + 1] || ''
      pricePerUnit = rateTaxRaw[rateTaxIdx + 2] || ''
      rateTaxIdx += 3
      productTotal = totalTaxRaw[totalTaxIdx] || ''
      federalTaxTotal = totalTaxRaw[totalTaxIdx + 1] || ''
      totalTaxIdx += 2
    } else {
      productRate = rateTaxRaw[rateTaxIdx] || ''
      federalTaxRate = rateTaxRaw[rateTaxIdx + 1] || ''
      provincialTaxRate = rateTaxRaw[rateTaxIdx + 2] || ''
      pricePerUnit = rateTaxRaw[rateTaxIdx + 3] || ''
      rateTaxIdx += 4
      productTotal = totalTaxRaw[totalTaxIdx] || ''
      federalTaxTotal = totalTaxRaw[totalTaxIdx + 1] || ''
      provincialTaxTotal = totalTaxRaw[totalTaxIdx + 2] || ''
      totalTaxIdx += 3
    }

    entries.push({
      product,
      qtyNet: qtyNetValues[i] || '',
      qtyGross: qtyGrossValues[i] || '',
      productRate,
      federalTaxRate,
      provincialTaxRate,
      pricePerUnit,
      freightRate: freightValues[i * 2] || '',
      totalFreight: freightValues[i * 2 + 1] || '',
      productTotal,
      federalTaxTotal,
      provincialTaxTotal,
    })
  }

  return entries
}

export async function extractFieldsFromRects(
  file: File,
): Promise<ExtractedFields> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const page = await pdf.getPage(1)
  const textContent = await page.getTextContent()

  const items: Array<PdfItem> = textContent.items.map((item: any) => ({
    text: item.str.trim(),
    x: item.transform[4],
    y: item.transform[5],
  }))

  const extract = (rect: (typeof RECTS)[keyof typeof RECTS]) =>
    extractFromRect(items, rect)

  const totalTaxRaw = filterRegion(items, 550, 590, 127, 496)
  const rateTaxRaw = filterRegion(items, 360, 430, 127, 496)
  const productColumnValues = filterRegion(items, 22, 52, 127, 496)
  const qtyNetValues = filterRegion(items, 230, 270, 127, 496)
  const qtyGrossRaw = filterRegion(items, 290, 360, 127, 496)
  const freightValues = filterRegion(items, 480, 530, 127, 496)

  const qtyGrossValues = qtyGrossRaw.filter((_, i) => i % 2 === 0)

  const freightCellValues: Array<string> = []
  for (let i = 0; i < freightValues.length; i += 2) {
    freightCellValues.push(
      [freightValues[i] || '', freightValues[i + 1] || '']
        .filter(Boolean)
        .join('\n'),
    )
  }

  const tableEntries = buildTableEntries(
    productColumnValues,
    qtyNetValues,
    qtyGrossValues,
    freightValues,
    rateTaxRaw,
    totalTaxRaw,
  )

  return {
    shippingLocation: extract(RECTS.shippingLocation),
    orderDate: extract(RECTS.orderDate),
    delivDate: extract(RECTS.delivDate),
    invoiceNumber: extract(RECTS.invoiceNumber),
    billDate: extract(RECTS.billDate),
    dueDraftDate: extract(RECTS.dueDraftDate),
    billTo: extract(RECTS.billTo),
    shipTo: extract(RECTS.shipTo),
    customer: (() => {
      const raw = extract(RECTS.customer)
      if (!raw) return null
      const match = raw.match(/\w+/)
      return match ? match[0] : null
    })(),
    manifest: extract(RECTS.manifest),
    driverCarrier: extract(RECTS.driverCarrier),
    terms: extract(RECTS.terms),
    remitTo: extract(RECTS.remitTo),
    totalOrdered: extract(RECTS.totalOrdered),
    totalDelivered: extract(RECTS.totalDelivered),
    productTotal: extract(RECTS.productTotal),
    freightTotal: extract(RECTS.freightTotal),
    surcharges: extract(RECTS.surcharges),
    taxFeeTotal: extract(RECTS.taxFeeTotal),
    totalInvoiceToRemit: extract(RECTS.totalInvoiceToRemit),
    productColumnValues,
    qtyNetValues,
    freightCellValues,
    tableEntries,
  }
}
