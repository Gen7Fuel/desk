import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/fuel-invoicing')({
  component: RouteComponent,
})

import { useState } from 'react'

type TableEntry = {
  product: string;
  qtyNet: string;
  qtyGross: string;
  productRate: string;
  federalTaxRate: string;
  provincialTaxRate: string;
  pricePerUnit: string;
  freightRate: string;
  totalFreight: string;
  productTotal: string;
  federalTaxTotal: string;
  provincialTaxTotal: string;
};


  


async function extractFieldsFromRects(file: File): Promise<{
  shippingLocation: string | null,
  orderDate: string | null,
  delivDate: string | null,
  invoiceNumber: string | null,
  billDate: string | null,
  dueDraftDate: string | null,
  billTo: string | null,
  shipTo: string | null,
  customer: string | null,
  manifest: string | null,
  driverCarrier: string | null,
  terms: string | null,
  remitTo: string | null,
  totalOrdered: string | null,
  totalDelivered: string | null,
  productTotal: string | null,
  freightTotal: string | null,
  surcharges: string | null,
  taxFeeTotal: string | null,
  totalInvoiceToRemit: string | null,
  productColumnValues: string[],
  qtyNetValues: string[],
  freightCellValues: string[],
  tableEntries: TableEntry[],
}> {
  const rects = {
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
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const page = await pdf.getPage(1)
  const textContent = await page.getTextContent()
  const items = textContent.items.map((item: any) => ({
    text: item.str.trim(),
    x: item.transform[4],
    y: item.transform[5],
  }))

  // Extract product total and tax totals from x: 550-590, y: 127-496
  const totalTaxRaw = items
    .filter((item: {
      text: any; x: number; y: number 
}) =>
      item.x >= 550 && item.x <= 590 && item.y >= 127 && item.y <= 496 && item.text.length > 0
    )
    .map((item: { text: string }) => item.text);

  // Extract product rate and tax values from x: 360-430, y: 127-496
  const rateTaxRaw = items
    .filter((item: {
      text: any; x: number; y: number 
}) =>
      item.x >= 360 && item.x <= 430 && item.y >= 127 && item.y <= 496 && item.text.length > 0
    )
    .map((item: { text: string }) => item.text);
  function extract(rect: { x0: number, y0: number, x1: number, y1: number }) {
    const inRect = items.filter((item: { x: number; y: number }) =>
      item.x >= rect.x0 && item.x <= rect.x1 &&
      item.y >= rect.y0 && item.y <= rect.y1
    )
    return inRect.length ? inRect.map((i: { text: any }) => i.text).join(' ') : null
  }
  // Extract Product column values from the table region
  // Table region: x in [22,52], y in [127,496] (PDF y increases downward)
  const productColumnValues = items
    .filter((item: {
      text: any; x: number; y: number 
}) =>
      item.x >= 22 && item.x <= 52 && item.y >= 127 && item.y <= 496 && item.text.length > 0
    )
    .map((item: { text: string }) => item.text);

  // Extract Qty Net values from the table region
  // Table region: x in [230,270], y in [127,496]
  const qtyNetValues = items
    .filter((item: {
      text: any; x: number; y: number 
}) =>
      item.x >= 230 && item.x <= 270 && item.y >= 127 && item.y <= 496 && item.text.length > 0
    )
    .map((item: { text: string }) => item.text);

  // Extract Qty Gross values (first value for each entry) from x: 290-360, y: 127-496
  const qtyGrossRaw = items
    .filter((item: {
      text: any; x: number; y: number 
}) =>
      item.x >= 290 && item.x <= 360 && item.y >= 127 && item.y <= 496 && item.text.length > 0
    )
    .map((item: { text: string }) => item.text);

  // Take only the first value for each entry (every two values)
  const qtyGrossValues = [];
  for (let i = 0; i < qtyGrossRaw.length; i += 2) {
    qtyGrossValues.push(qtyGrossRaw[i] || '');
  }

  // Extract Freight values (x: 480-530, y: 127-496)
  const freightValues = items
    .filter((item: {
      text: any; x: number; y: number 
}) =>
      item.x >= 480 && item.x <= 530 && item.y >= 127 && item.y <= 496 && item.text.length > 0
    )
    .map((item: { text: string }) => item.text);

  // Group every two values as [freight rate, total freight] for each entry
  const freightCellValues = [];
  for (let i = 0; i < freightValues.length; i += 2) {
    const rate = freightValues[i] || '';
    const total = freightValues[i + 1] || '';
    freightCellValues.push([rate, total].filter(Boolean).join('\n'));
  }

  // Construct table entries as JSON objects
  // Build table entries with rate/tax/price logic
  const maxLen = Math.max(
    productColumnValues.length,
    qtyNetValues.length,
    qtyGrossValues.length,
    Math.floor(freightValues.length / 2)
  );
  const tableEntries: TableEntry[] = [];
  let rateTaxIdx = 0;
  let totalTaxIdx = 0;
  for (let i = 0; i < maxLen; i++) {
    const product = productColumnValues[i] || '';
    let productRate = '', federalTaxRate = '', provincialTaxRate = '', pricePerUnit = '';
    let productTotal = '', federalTaxTotal = '', provincialTaxTotal = '';
    if (product === 'ULSDD') {
      // Only 3 values for rate/tax/price: productRate, federalTaxRate, pricePerUnit
      productRate = rateTaxRaw[rateTaxIdx] || '';
      federalTaxRate = rateTaxRaw[rateTaxIdx + 1] || '';
      pricePerUnit = rateTaxRaw[rateTaxIdx + 2] || '';
      rateTaxIdx += 3;
      // Only 2 values for totals: productTotal, federalTaxTotal
      productTotal = totalTaxRaw[totalTaxIdx] || '';
      federalTaxTotal = totalTaxRaw[totalTaxIdx + 1] || '';
      provincialTaxTotal = '';
      totalTaxIdx += 2;
    } else {
      // 4 values for rate/tax/price: productRate, federalTaxRate, provincialTaxRate, pricePerUnit
      productRate = rateTaxRaw[rateTaxIdx] || '';
      federalTaxRate = rateTaxRaw[rateTaxIdx + 1] || '';
      provincialTaxRate = rateTaxRaw[rateTaxIdx + 2] || '';
      pricePerUnit = rateTaxRaw[rateTaxIdx + 3] || '';
      rateTaxIdx += 4;
      // 3 values for totals: productTotal, federalTaxTotal, provincialTaxTotal
      productTotal = totalTaxRaw[totalTaxIdx] || '';
      federalTaxTotal = totalTaxRaw[totalTaxIdx + 1] || '';
      provincialTaxTotal = totalTaxRaw[totalTaxIdx + 2] || '';
      totalTaxIdx += 3;
    }
    tableEntries.push({
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
    });
  }

  return {
    shippingLocation: extract(rects.shippingLocation),
    orderDate: extract(rects.orderDate),
    delivDate: extract(rects.delivDate),
    invoiceNumber: extract(rects.invoiceNumber),
    billDate: extract(rects.billDate),
    dueDraftDate: extract(rects.dueDraftDate),
    billTo: extract(rects.billTo),
    shipTo: extract(rects.shipTo),
    customer: (() => {
      const raw = extract(rects.customer);
      if (!raw) return null;
      const match = raw.match(/\w+/);
      return match ? match[0] : null;
    })(),
    manifest: extract(rects.manifest),
    driverCarrier: extract(rects.driverCarrier),
    terms: extract(rects.terms),
    remitTo: extract(rects.remitTo),
    totalOrdered: extract(rects.totalOrdered),
    totalDelivered: extract(rects.totalDelivered),
    productTotal: extract(rects.productTotal),
    freightTotal: extract(rects.freightTotal),
    surcharges: extract(rects.surcharges),
    taxFeeTotal: extract(rects.taxFeeTotal),
    totalInvoiceToRemit: extract(rects.totalInvoiceToRemit),
    productColumnValues,
    qtyNetValues,
    freightCellValues,
    tableEntries,
  }
}

function RouteComponent() {
  const [fields, setFields] = useState<{
    shippingLocation: string | null,
    orderDate: string | null,
    delivDate: string | null,
    invoiceNumber: string | null,
    billDate: string | null,
    dueDraftDate: string | null,
    billTo: string | null,
    shipTo: string | null,
    customer: string | null,
    manifest: string | null,
    driverCarrier: string | null,
    terms: string | null,
    remitTo: string | null,
    totalOrdered: string | null,
    totalDelivered: string | null,
    productTotal: string | null,
    freightTotal: string | null,
    surcharges: string | null,
    taxFeeTotal: string | null,
    totalInvoiceToRemit: string | null,
    productColumnValues: string[],
    qtyNetValues: string[],
    freightCellValues: string[],
    tableEntries: TableEntry[],
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file: File) => {
    setLoading(true)
    setError(null)
    setFields(null)
    try {
      const values = await extractFieldsFromRects(file)
      setFields(values)
    } catch (err) {
      setError('Failed to parse PDF')
      console.error('PDF parse error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file);
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      handleFileUpload(file);
    } else {
      setError('Please upload a PDF file');
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h2>Extract Invoice Data from PDF</h2>
      {!fields && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: dragActive ? '2px solid #4f8cff' : '2px dashed #444',
            background: dragActive ? '#232a36' : '#232323',
            borderRadius: 12,
            width: 400,
            height: 180,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '32px 0',
            transition: 'background 0.2s, border 0.2s',
          }}
        >
          <input
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            id="pdf-upload-input"
            onChange={handleInputChange}
          />
          <label htmlFor="pdf-upload-input" style={{ cursor: 'pointer', color: '#ccc', fontWeight: 500, fontSize: 18 }}>
            {dragActive ? 'Drop PDF here...' : 'Drag & drop PDF here or click to upload'}
          </label>
        </div>
      )}
      {loading && <p>Extracting data…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {fields && (
        <div style={{ marginTop: 24, maxWidth: 800 }}>
          <h3>Extracted Data</h3>
          <ul>
            <li><strong>Shipping Location:</strong> {fields.shippingLocation}</li>
            <li><strong>Order Date:</strong> {fields.orderDate}</li>
            <li><strong>Deliv Date:</strong> {fields.delivDate}</li>
            <li><strong>Invoice Number:</strong> {fields.invoiceNumber}</li>
            <li><strong>Bill Date:</strong> {fields.billDate}</li>
            <li><strong>Due/Draft Date:</strong> {fields.dueDraftDate}</li>
            <li><strong>Bill To:</strong> {fields.billTo}</li>
            <li><strong>Ship To:</strong> {fields.shipTo}</li>
            <li><strong>Customer:</strong> {fields.customer}</li>
            <li><strong>Manifest:</strong> {fields.manifest}</li>
            <li><strong>Driver/Carrier:</strong> {fields.driverCarrier}</li>
            <li><strong>Terms:</strong> {fields.terms}</li>
            <li><strong>Remit To:</strong> {fields.remitTo}</li>
            <li><strong>Total Ordered:</strong> {fields.totalOrdered}</li>
            <li><strong>Total Delivered:</strong> {fields.totalDelivered}</li>
            <li><strong>Product Total:</strong> {fields.productTotal}</li>
            <li><strong>Freight Total:</strong> {fields.freightTotal}</li>
            <li><strong>Surcharges:</strong> {fields.surcharges}</li>
            <li><strong>Tax/Fee Total:</strong> {fields.taxFeeTotal}</li>
            <li><strong>Total Invoice to Remit:</strong> {fields.totalInvoiceToRemit}</li>
          </ul>
          <h4>Extracted Table Data (JSON)</h4>
          <pre style={{ padding: 16, borderRadius: 4, marginTop: 16 }}>
            {JSON.stringify(fields.tableEntries, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
