export type BookworksPdfInspection = {
  hasText: boolean
  hasLitre: boolean
  matchesInvoice: boolean
}

export function inspectInvoiceText(
  text: string,
  invoiceNumber: string,
): BookworksPdfInspection {
  return {
    hasText: Boolean(text.trim()),
    hasLitre: /litre/i.test(text),
    matchesInvoice: text
      .toLowerCase()
      .replace(/\s+/g, '')
      .includes(invoiceNumber.toLowerCase().replace(/\s+/g, '')),
  }
}

export async function inspectBookworksPdf(
  file: File,
  invoiceNumber: string,
): Promise<BookworksPdfInspection> {
  if (!/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024)
    throw new Error('Choose a PDF no larger than 10 MB.')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const loading = pdfjs.getDocument({ data: await file.arrayBuffer() })
  try {
    const doc = await loading.promise
    if (doc.numPages > 50)
      throw new Error('Choose an invoice PDF with at most 50 pages.')
    const pages: Array<string> = []
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent()
      pages.push(
        content.items
          .map((item: { str?: string }) => ('str' in item ? item.str : ''))
          .join(' '),
      )
    }
    return inspectInvoiceText(pages.join('\n'), invoiceNumber)
  } catch (err) {
    if (err instanceof Error && /at most 50/.test(err.message)) throw err
    throw new Error(
      'Could not read this PDF. Check whether it is damaged or password protected.',
    )
  } finally {
    await loading.destroy()
  }
}
