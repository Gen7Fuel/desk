import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

export const Route = createFileRoute('/(sage)/callback')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      setStatus('error')
      setErrorMsg('No authorization code received from Sage.')
      return
    }

    apiFetch('/api/sage/token', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { message?: string }).message || 'Token exchange failed.')
        }
        return res.json()
      })
      .then((data: { access_token: string }) => {
        localStorage.setItem('sage_access_token', data.access_token)
        navigate({ to: '/fuel-invoicing' })
      })
      .catch((err: Error) => {
        setStatus('error')
        setErrorMsg(err.message)
      })
  }, [navigate])

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <p style={{ color: 'red', fontWeight: 600 }}>Authorization failed</p>
        <p style={{ color: '#aaa', fontSize: 14 }}>{errorMsg}</p>
        <button
          style={{ cursor: 'pointer', padding: '8px 20px', fontWeight: 600 }}
          onClick={() => navigate({ to: '/fuel-invoicing' })}
        >
          Back to Fuel Invoicing
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ color: '#aaa', fontWeight: 500 }}>Connecting to Sage Intacct…</p>
    </div>
  )
}
