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

// Table body: below the column headers (y < ~499), above the "Total Product
// Ordered" summary line (y > ~124).
const TABLE_Y_MIN = 127
const TABLE_Y_MAX = 496

// x-bands for each column, measured from the BookWorks invoice template.
// A per-line item is matched to a row by y-proximity (ROW_Y_TOL), not by
// position in a flattened list — the old approach assumed a fixed number of
// values per row based on the product code, which broke whenever a row's
// actual tax-line count didn't match that guess.
const PRODUCT_CODE_X: [number, number] = [20, 55]
const DESCRIPTION_X: [number, number] = [170, 260]
const QTY_ORDERED_X: [number, number] = [285, 325]
const QTY_DELIVERED_X: [number, number] = [340, 380]
const PRICE_AMT_X: [number, number] = [412, 435]
const FREIGHT_RATE_X: [number, number] = [500, 515]
const FREIGHT_TOTAL_X: [number, number] = [455, 495]
const TOTAL_X: [number, number] = [540, 575] // product total AND tax totals
const TAX_LABEL_X: [number, number] = [100, 300]
const TAX_RATE_X: [number, number] = [375, 405]

const ROW_Y_TOL = 3
const BLOCK_PAD = 3

function buildTableEntries(items: Array<PdfItem>): Array<TableEntry> {
  const bodyItems = items.filter(
    (item) =>
      item.y >= TABLE_Y_MIN && item.y <= TABLE_Y_MAX && item.text.length > 0,
  )

  const inBand = (item: PdfItem, [xMin, xMax]: [number, number]) =>
    item.x >= xMin && item.x <= xMax

  const productRows = bodyItems
    .filter((item) => inBand(item, PRODUCT_CODE_X))
    .sort((a, b) => b.y - a.y)

  return productRows.map((row, i) => {
    const blockTop = row.y + BLOCK_PAD
    const blockBottom =
      i + 1 < productRows.length
        ? productRows[i + 1].y + BLOCK_PAD
        : TABLE_Y_MIN - BLOCK_PAD
    const block = bodyItems.filter(
      (item) => item.y <= blockTop && item.y > blockBottom,
    )

    const atRow = (band: [number, number]) =>
      block.find(
        (item) => inBand(item, band) && Math.abs(item.y - row.y) <= ROW_Y_TOL,
      )?.text ?? ''

    const priceAmt = atRow(PRICE_AMT_X)

    // Description can wrap onto a second line (e.g. "Premium Unleaded Gas" /
    // "91 Octane") — join every fragment in the column, top to bottom.
    const description = block
      .filter((item) => inBand(item, DESCRIPTION_X))
      .sort((a, b) => b.y - a.y)
      .map((item) => item.text)
      .join(' ')

    let federalTaxRate = '',
      federalTaxTotal = '',
      federalTaxName = '',
      provincialTaxRate = '',
      provincialTaxTotal = '',
      provincialTaxName = ''

    const taxLabels = block.filter(
      (item) =>
        inBand(item, TAX_LABEL_X) && item.text.toLowerCase().includes('tax'),
    )
    for (const label of taxLabels) {
      const rate =
        block.find(
          (item) =>
            inBand(item, TAX_RATE_X) &&
            Math.abs(item.y - label.y) <= ROW_Y_TOL,
        )?.text ?? ''
      const total =
        block.find(
          (item) =>
            inBand(item, TOTAL_X) && Math.abs(item.y - label.y) <= ROW_Y_TOL,
        )?.text ?? ''
      // The label includes a jurisdiction/fuel suffix the invoice doesn't
      // need (e.g. "Provincial Gas Tax ON" -> "Provincial Gas Tax"), so keep
      // only the part up to and including the word "Tax".
      const name = (label.text.match(/^(.*?\bTax\b)/i)?.[1] ?? label.text).trim()
      const lower = label.text.toLowerCase()
      if (lower.includes('federal')) {
        federalTaxRate = rate
        federalTaxTotal = total
        federalTaxName = name
      } else if (lower.includes('provincial')) {
        provincialTaxRate = rate
        provincialTaxTotal = total
        provincialTaxName = name
      }
    }

    const freightTotal =
      block.find((item) => inBand(item, FREIGHT_TOTAL_X))?.text ?? ''

    return {
      product: row.text,
      description,
      qtyNet: atRow(QTY_DELIVERED_X),
      qtyGross: atRow(QTY_ORDERED_X),
      productRate: priceAmt,
      federalTaxRate,
      federalTaxName,
      provincialTaxRate,
      provincialTaxName,
      pricePerUnit: priceAmt,
      freightRate: atRow(FREIGHT_RATE_X),
      totalFreight: freightTotal,
      productTotal: atRow(TOTAL_X),
      federalTaxTotal,
      provincialTaxTotal,
    }
  })
}

export async function extractFieldsFromRects(
  file: File,
): Promise<ExtractedFields> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

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

  // Match each label to its value by y-coordinate proximity
  const totalsArea = items.filter(
    (item) => item.y >= 70 && item.y <= 120 && item.text.length > 0,
  )
  const findValueAtY = (labelY: number) =>
    totalsArea
      .filter((item) => item.x >= 520 && item.x <= 585)
      .sort((a, b) => Math.abs(a.y - labelY) - Math.abs(b.y - labelY))[0]
      ?.text ?? null

  const freightLabelItem = totalsArea.find(
    (item) =>
      item.x >= 440 &&
      item.x <= 520 &&
      item.text.toLowerCase().includes('freight'),
  )
  const surchargesLabelItem = totalsArea.find(
    (item) =>
      item.x >= 440 &&
      item.x <= 520 &&
      item.text.toLowerCase().includes('surcharge'),
  )

  const freightTotal = freightLabelItem
    ? findValueAtY(freightLabelItem.y)
    : null
  const surcharges = surchargesLabelItem
    ? findValueAtY(surchargesLabelItem.y)
    : null

  const tableEntries = buildTableEntries(items)

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
    freightTotal,
    surcharges,
    taxFeeTotal: extract(RECTS.taxFeeTotal),
    totalInvoiceToRemit: extract(RECTS.totalInvoiceToRemit),
    tableEntries,
  }
}
