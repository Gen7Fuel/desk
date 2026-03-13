import { createFileRoute, redirect } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import JSZip from 'jszip'
import { Download, FileSpreadsheet, FolderDown, Loader2, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/permissions'
import { apiFetch } from '@/lib/api'

export const Route = createFileRoute('/_appbar/_sidebar/inventory/coremark-initial-order')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('inventory.coremarkInitialOrder', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

interface OrderResult {
  name: string
  filename: string
  itemCount: number
  content: string
}

interface ProcessResponse {
  results: Array<OrderResult>
  errors: Array<{ sheet: string; error: string }>
}

async function processExcel(file: File): Promise<ProcessResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/api/inventory/coremark/process', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
  }
  return res.json()
}

function RouteComponent() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: processExcel,
    onSuccess: () => setFile(null),
  })

  const ACCEPTED = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]

  function validateAndSet(f: File) {
    if (!ACCEPTED.includes(f.type) && !f.name.match(/\.(xlsx|xls)$/i)) {
      setFileError('Only Excel files (.xlsx, .xls) are accepted.')
      return
    }
    setFileError(null)
    mutation.reset()
    setFile(f)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) validateAndSet(f)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0] as File | undefined
    if (f) validateAndSet(f)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function clearAll() {
    setFile(null)
    setFileError(null)
    mutation.reset()
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function downloadOrder(result: OrderResult) {
    const blob = new Blob([result.content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadAll(results: Array<OrderResult>) {
    const zip = new JSZip()
    for (const r of results) {
      zip.file(r.filename, r.content)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'coremark-orders.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div>
        <h2 className="text-2xl font-semibold">CoreMark Initial Order</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the CoreMark initial order spreadsheet to generate order files.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
          file && 'border-solid border-primary/40 bg-primary/5',
        )}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={handleInputChange}
        />

        {file ? (
          <>
            <FileSpreadsheet className="h-12 w-12 text-primary" />
            <div className="text-center">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
          </>
        ) : (
          <>
            <UploadCloud className={cn('h-12 w-12 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground')} />
            <div className="text-center">
              <p className="font-medium">Drop your Excel file here</p>
              <p className="text-sm text-muted-foreground">or click to browse — .xlsx and .xls accepted</p>
            </div>
          </>
        )}
      </div>

      {fileError && <p className="text-sm text-destructive">{fileError}</p>}

      {mutation.isError && (
        <p className="text-sm text-destructive">{(mutation.error).message}</p>
      )}

      {/* Actions */}
      {file && (
        <div className="flex gap-2">
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(file)}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              'Import'
            )}
          </Button>
          <Button variant="outline" onClick={clearAll} disabled={mutation.isPending}>
            <X className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      )}

      {/* Results */}
      {mutation.isSuccess && mutation.data.results.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium">
              Generated {mutation.data.results.length} order file{mutation.data.results.length !== 1 ? 's' : ''}:
            </p>
            <Button size="sm" variant="outline" onClick={() => downloadAll(mutation.data.results)}>
              <FolderDown className="mr-2 h-4 w-4" />
              Download All
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {mutation.data.results.map((r) => (
              <button
                key={r.filename}
                onClick={() => downloadOrder(r)}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <div>
                  <p className="text-sm font-medium">{r.filename}</p>
                  <p className="text-xs text-muted-foreground">{r.itemCount} item{r.itemCount !== 1 ? 's' : ''}</p>
                </div>
                <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
          {mutation.data.errors.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              {mutation.data.errors.map((e) => (
                <p key={e.sheet} className="text-xs text-destructive">
                  Sheet "{e.sheet}": {e.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
