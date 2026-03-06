import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useFuelInvoicing } from '../../lib/fuel-invoicing/use-fuel-invoicing'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_appbar/fuel-invoicing')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('fuelInvoicing', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const {
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
  } = useFuelInvoicing()

  const [sageConnected, setSageConnected] = useState(() =>
    typeof window !== 'undefined' && !!localStorage.getItem('sage_access_token'),
  )

  function handleAuthorize() {
    // Navigate to the backend authorize endpoint which will redirect to Sage
    const token = localStorage.getItem('token')
    window.location.href = `/api/sage/authorize?token=${encodeURIComponent(token ?? '')}`
  }

  function handleDisconnect() {
    localStorage.removeItem('sage_access_token')
    setSageConnected(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h2>Upload and Submit NSP Invoice</h2>

      {/* Sage connection status */}
      <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        {sageConnected ? (
          <>
            <span style={{ fontSize: 14, color: '#4ade80', fontWeight: 500 }}>Connected to Sage Intacct</span>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={handleAuthorize}>
            Authorize Sage Intacct
          </Button>
        )}
      </div>

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
          {dragActive ? 'Drop PDF here...' : file ? file.name : 'Drag & drop PDF here or click to upload'}
        </label>
      </div>
      {file && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSubmitToAzure}
            disabled={submitting || !base64}
            style={{ cursor: 'pointer', padding: '8px 24px', fontWeight: 600 }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}
      {submitMsg && <span style={{ fontSize: 14, marginTop: 8 }}>{submitMsg}</span>}
      {error && <span style={{ fontSize: 14, marginTop: 8, color: 'red' }}>{error}</span>}
    </div>
  )
}
