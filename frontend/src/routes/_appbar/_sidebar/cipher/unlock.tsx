import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { unlockText } from '@/lib/cipher-api'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/permissions'

export const Route = createFileRoute('/_appbar/_sidebar/cipher/unlock')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('cipher.unlock', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const [id, setId] = useState('')
  const [key, setKey] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await unlockText(id, key)
      setResult(res.text)
    } catch (err: any) {
      setError(err.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Unlock (Decrypt) Information</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          className="border rounded px-2 py-1 font-mono"
          placeholder="Enter ID..."
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
        />
        <input
          className="border rounded px-2 py-1 font-mono"
          placeholder="Enter Key..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Decrypting...' : 'Unlock'}
        </Button>
      </form>
      {result && (
        <div className="mt-6 p-4 border rounded bg-muted">
          <div>
            <b>Decrypted Info:</b>
          </div>
          <div className="break-all whitespace-pre-wrap font-mono">
            {result}
          </div>
        </div>
      )}
      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  )
}
