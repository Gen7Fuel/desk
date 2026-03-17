import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Copy, RefreshCcw } from 'lucide-react'
import { lockText } from '@/lib/cipher-api'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/permissions'

export const Route = createFileRoute('/_appbar/_sidebar/cipher/lock')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('cipher.lock', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ id: string; key: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<'key' | 'id' | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await lockText(text)
      setResult(res)
    } catch (err: any) {
      setError(err.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  // Center the page vertically and horizontally
  // Copy to clipboard helpers

  function handleCopy(value: string, type: 'key' | 'id') {
    navigator.clipboard.writeText(value)
    setCopied(type)
    setTimeout(() => setCopied(null), 1200)
  }

  function handleRefresh() {
    setResult(null)
    setText('')
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-xl p-6 rounded shadow bg-background">
        <h1 className="text-2xl font-bold mb-4 text-center">
          Lock (Encrypt) Information
        </h1>
        {!result ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              className="border rounded px-2 py-1 min-h-[100px]"
              placeholder="Enter text to encrypt..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? 'Encrypting...' : 'Lock'}
            </Button>
            {error && <div className="text-red-600 text-center">{error}</div>}
          </form>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-full p-4 border rounded bg-muted flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <b>Key:</b>
                <span className="break-all font-mono flex-1">{result.key}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => handleCopy(result.key, 'key')}
                  title="Copy key"
                  aria-label="Copy key"
                >
                  <Copy
                    className={
                      copied === 'key' ? 'size-4 text-green-600' : 'size-4'
                    }
                  />
                </Button>
                {copied === 'key' && (
                  <span className="text-green-600 text-xs ml-1">Copied!</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <b>ID:</b>
                <span className="break-all font-mono flex-1">{result.id}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => handleCopy(result.id, 'id')}
                  title="Copy id"
                  aria-label="Copy id"
                >
                  <Copy
                    className={
                      copied === 'id' ? 'size-4 text-green-600' : 'size-4'
                    }
                  />
                </Button>
                {copied === 'id' && (
                  <span className="text-green-600 text-xs ml-1">Copied!</span>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              title="Back to form"
              size="icon"
            >
              <RefreshCcw className="size-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
