import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Headset, RefreshCw, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { disconnectHubSupportSocket, getHubSupportSocket } from '@/lib/hubSocket'
import { getExternalToken } from '@/lib/permissions'

const HUB = 'https://app.gen7fuel.com'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TicketUser {
  _id: string
  name: string
  email: string
  isSupport?: boolean
}

interface TicketMessage {
  _id: string
  sender: TicketUser
  text: string
  createdAt: string
}

interface Ticket {
  _id: string
  text: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'resolved' | 'closed'
  site: string
  createdAt: string
  userId: TicketUser
  messages: Array<TicketMessage>
}

type StatusFilter = 'open' | 'resolved' | 'closed' | 'all'

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSupportTickets() {
  const [tickets, setTickets] = useState<Array<Ticket>>([])
  const [loading, setLoading] = useState(false)
  const initialized = useRef(false)

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const token = getExternalToken()
      const res = await fetch(`${HUB}/api/support/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const body = await res.json()
        setTickets(body.data?.tickets ?? [])
      }
    } catch (err) {
      console.error('[SupportTickets] Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    fetchTickets()

    const socket = getHubSupportSocket()

    socket.on('connect', fetchTickets)

    socket.on('ticket:new', (ticket: Ticket) => {
      setTickets((prev) => [ticket, ...prev])
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('New support ticket', {
          body: `${ticket.userId.name || ticket.userId.email || 'Customer'} (${ticket.site}): ${ticket.text}`,
          icon: '/favicon.ico',
          tag: `ticket-${ticket._id}`,
        })
        n.onclick = () => { window.focus(); n.close() }
      }
    })

    return () => {
      disconnectHubSupportSocket()
      initialized.current = false
    }
  }, [])

  const addMessage = (ticketId: string, msg: TicketMessage) => {
    setTickets((prev) =>
      prev.map((t) =>
        t._id === ticketId ? { ...t, messages: [...t.messages, msg] } : t,
      ),
    )
  }

  const updateTicket = (ticketId: string, updates: Partial<Ticket>) => {
    setTickets((prev) =>
      prev.map((t) => (t._id === ticketId ? { ...t, ...updates } : t)),
    )
  }

  const openCount = tickets.filter((t) => t.status === 'open').length

  return { tickets, openCount, loading, refresh: fetchTickets, addMessage, updateTicket }
}

// ── Panel Component ────────────────────────────────────────────────────────────

interface SupportPanelProps {
  open: boolean
  onClose: () => void
  tickets: Array<Ticket>
  loading: boolean
  onRefresh: () => void
  onAddMessage: (ticketId: string, msg: TicketMessage) => void
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>) => void
}

const PRIORITY_STYLE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
}

function Badge({ label, style }: { label: string; style: string }) {
  return (
    <span className={cn('inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded', style)}>
      {label}
    </span>
  )
}

export function SupportPanel({
  open,
  onClose,
  tickets,
  loading,
  onRefresh,
  onAddMessage,
  onUpdateTicket,
}: SupportPanelProps) {
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [messageText, setMessageText] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeTicket = activeTicketId
    ? tickets.find((t) => t._id === activeTicketId) ?? null
    : null

  useEffect(() => {
    if (!open) setActiveTicketId(null)
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeTicket?.messages.length])

  // Join ticket socket room and listen for new messages
  useEffect(() => {
    if (!activeTicketId) return
    const socket = getHubSupportSocket()
    socket.emit('join-room', activeTicketId)

    const onNewMessage = (msg: TicketMessage) => {
      onAddMessage(activeTicketId, msg)
    }
    socket.on('new-message', onNewMessage)

    return () => {
      socket.off('new-message', onNewMessage)
    }
  }, [activeTicketId])

  const sendMessage = () => {
    if (!messageText.trim() || !activeTicketId) return
    const socket = getHubSupportSocket()
    socket.emit('send-message', {
      conversationId: activeTicketId,
      text: messageText.trim(),
    })
    setMessageText('')
  }

  const updateStatus = async (ticketId: string, status: Ticket['status']) => {
    setUpdatingStatus(true)
    try {
      const token = getExternalToken()
      const res = await fetch(`${HUB}/api/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })
      if (res.ok) onUpdateTicket(ticketId, { status })
    } catch (err) {
      console.error('[SupportPanel] Update status error:', err)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    if (diffMs < 60_000) return 'Just now'
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
    if (diffMs < 86_400_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const filteredTickets =
    statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter)

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}

      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-[400px] max-w-[calc(100vw-64px)] bg-background border-l shadow-xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {activeTicket ? (
          /* ── Ticket detail ── */
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setActiveTicketId(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {activeTicket.userId.name || activeTicket.userId.email || 'Unknown'}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  {activeTicket.site}
                  <span className="text-muted-foreground/40">·</span>
                  <Badge
                    label={activeTicket.priority}
                    style={PRIORITY_STYLE[activeTicket.priority] ?? ''}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge label={activeTicket.status} style={STATUS_STYLE[activeTicket.status] ?? ''} />
                {activeTicket.status === 'open' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={updatingStatus}
                    onClick={() => updateStatus(activeTicket._id, 'resolved')}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {activeTicket.messages.map((msg, idx) => {
                const isSupport = !!msg.sender.isSupport
                return (
                  <div
                    key={msg._id || idx}
                    className={`flex ${isSupport ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                        isSupport ? 'bg-primary text-primary-foreground' : 'bg-muted',
                      )}
                    >
                      {!isSupport && (
                        <div className="text-[10px] font-semibold mb-0.5 opacity-70">
                          {msg.sender.name || 'Customer'}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <div
                        className={cn(
                          'text-[10px] mt-1',
                          isSupport ? 'opacity-70' : 'text-muted-foreground',
                        )}
                      >
                        {fmtDate(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {activeTicket.status === 'open' ? (
              <form
                className="flex gap-2 border-t px-4 py-3"
                onSubmit={(e) => { e.preventDefault(); sendMessage() }}
              >
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a reply…"
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button type="submit" size="icon" disabled={!messageText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <div className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
                This ticket is {activeTicket.status}.
              </div>
            )}
          </div>
        ) : (
          /* ── Ticket list ── */
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Headset className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Support Tickets</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-1 px-4 py-2 border-b">
              {(['open', 'resolved', 'closed', 'all'] as Array<StatusFilter>).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors',
                    statusFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Headset className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No {statusFilter === 'all' ? '' : statusFilter} tickets.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTickets.map((ticket) => (
                    <div
                      key={ticket._id}
                      className="px-4 py-3 hover:bg-muted/40 transition cursor-pointer"
                      onClick={() => setActiveTicketId(ticket._id)}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-muted-foreground truncate">
                          {ticket.userId.name || ticket.userId.email || 'Unknown'} · {ticket.site}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {fmtDate(ticket.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug line-clamp-2 mb-1.5">
                        {ticket.text}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Badge label={ticket.status} style={STATUS_STYLE[ticket.status] ?? ''} />
                        <Badge label={ticket.priority} style={PRIORITY_STYLE[ticket.priority] ?? ''} />
                        {ticket.messages.length > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {ticket.messages.length} messages
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
