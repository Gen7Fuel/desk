import { useState } from 'react'
import { createLog } from '../log-api'
import { extractFieldsFromRects } from './pdf-extractor'
import { buildFilename } from './filename'
import { createAttachment, createBill, createInvoice } from './sage-api'
import type { ExtractedFields } from './types'

export function useFuelInvoicing(sageToken: string) {
  const [fields, setFields] = useState<ExtractedFields | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [base64, setBase64] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  const handleFileUpload = async (uploadedFile: File) => {
    setFields(null)
    setBase64(null)
    setFile(uploadedFile)
    setError(null)
    setSubmitMsg(null)
    try {
      const buffer = await uploadedFile.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i])
      setBase64(btoa(binary))
      const values = await extractFieldsFromRects(uploadedFile)
      console.log('freightTotal:', values.freightTotal)
      console.log('surcharges:', values.surcharges)
      setFields(values)
    } catch (err) {
      setError('Failed to parse PDF.')
      console.error('PDF parse error:', err)
    }
  }

  const handleSubmitToAzure = async () => {
    if (!file || !base64) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const filename = buildFilename(fields)
      const extension = file.name.includes('.')
        ? file.name.split('.').pop()!
        : 'pdf'

      if (!fields) throw new Error('No invoice data extracted from the PDF.')

      // ── Step 1: create attachment in Sage Intacct ──────────────────────────
      const attachmentKey = await createAttachment(
        base64,
        filename,
        extension,
        sageToken,
      )

      // ── Step 2: create accounts-payable bill ───────────────────────────────
      const billKey = await createBill(fields, attachmentKey, sageToken)
      void billKey

      // ── Step 3: create accounts-receivable invoice ───────────────────────
      const invoiceKey = await createInvoice(fields, attachmentKey, sageToken)
      void invoiceKey

      void createLog({
        app: 'fuel.fuelInvoicing',
        action: 'create',
        entityId: fields.invoiceNumber ?? file.name,
        entitySnapshot: {
          invoiceNumber: fields.invoiceNumber,
          billDate: fields.billDate,
          customer: fields.customer,
          totalInvoiceToRemit: fields.totalInvoiceToRemit,
        },
      })
      setSubmitMsg('Submitted successfully.')
      setFile(null)
      setBase64(null)
      setFields(null)
      const input = document.getElementById(
        'pdf-upload-input',
      ) as HTMLInputElement
      input.value = ''
    } catch (err) {
      setSubmitMsg(
        err instanceof Error
          ? err.message
          : 'Submission failed. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFileUpload(f)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer.files[0] as File | undefined
    if (f && f.type === 'application/pdf') {
      handleFileUpload(f)
    } else {
      setError('Please upload a PDF file')
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  return {
    fields,
    error,
    dragActive,
    base64,
    file,
    submitting,
    submitMsg,
    handleSubmitToAzure,
    handleInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  }
}
