import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Headset, Send, Ticket, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  disconnectHubSupportSocket,
  getHubSupportSocket,
} from '@/lib/hubSocket'
import { getExternalToken } from '@/lib/permissions'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  sender: string
  senderName: string
  senderType?: 'agent' | 'customer'
  text: string
  createdAt: string
}

interface PendingChat {
  chatId: string
  customer: { name: string; email: string }
  site: string
  initialMessage: string
  createdAt: string
}

interface ChatSession extends PendingChat {
  status: 'pending' | 'accepted' | 'expired' | 'closed'
  acceptedBy?: { id: string; name: string }
  messages: Array<ChatMessage>
  ticketId?: string
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSupportChats() {
  const [chats, setChats] = useState<Map<string, ChatSession>>(new Map())
  const [connected, setConnected] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const token = getExternalToken()
    if (!token) return

    // Fetch existing pending/active chats via REST
    fetch('https://app.gen7fuel.com/api/support/chat', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((body: { data: Array<any> }) => {
        setChats((prev) => {
          const next = new Map(prev)
          for (const c of body.data) {
            const chatId = String(c._id)
            if (!next.has(chatId)) {
              const acceptedById = String(c.acceptedBy?.id || '')
              next.set(chatId, {
                chatId,
                customer: c.customer || { name: '', email: '' },
                site: c.site || '',
                initialMessage: c.initialMessage || '',
                createdAt: c.createdAt,
                status: c.status,
                acceptedBy: c.acceptedBy,
                messages: (c.messages || []).map((m: any) => ({
                  ...m,
                  sender: String(m.sender || ''),
                  senderType: (acceptedById && String(m.sender) === acceptedById)
                    ? 'agent'
                    : 'customer',
                })),
              })
            }
          }
          return next
        })
      })
      .catch((err) => console.error('[SupportChats] Failed to fetch chats:', err))

    const socket = getHubSupportSocket()

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    // New pending chat from a customer
    socket.on('support-chat:pending', (data: PendingChat) => {
      setChats((prev) => {
        const next = new Map(prev)
        next.set(data.chatId, {
          ...data,
          status: 'pending',
          messages: [],
        })
        return next
      })
    })

    // Chat was accepted (by this agent or another)
    socket.on(
      'support-chat:accepted',
      (data: { chatId: string; acceptedBy: { id: string; name: string } }) => {
        setChats((prev) => {
          const next = new Map(prev)
          const existing = next.get(data.chatId)
          if (existing) {
            next.set(data.chatId, {
              ...existing,
              status: 'accepted',
              acceptedBy: data.acceptedBy,
            })
          }
          return next
        })
      },
    )

    // New message in an active chat
    socket.on(
      'support-chat:new-message',
      (data: { chatId: string; message: ChatMessage }) => {
        setChats((prev) => {
          const next = new Map(prev)
          const existing = next.get(data.chatId)
          if (existing) {
            next.set(data.chatId, {
              ...existing,
              messages: [...existing.messages, data.message],
            })
          }
          return next
        })
      },
    )

    // Chat expired (ticket created)
    socket.on(
      'support-chat:expired',
      (data: { chatId: string; ticketId: string }) => {
        setChats((prev) => {
          const next = new Map(prev)
          const existing = next.get(data.chatId)
          if (existing) {
            next.set(data.chatId, {
              ...existing,
              status: 'expired',
              ticketId: data.ticketId,
            })
          }
          return next
        })
      },
    )

    // Chat closed
    socket.on('support-chat:closed', (data: { chatId: string }) => {
      setChats((prev) => {
        const next = new Map(prev)
        const existing = next.get(data.chatId)
        if (existing) {
          next.set(data.chatId, { ...existing, status: 'closed' })
        }
        return next
      })
    })

    return () => {
      disconnectHubSupportSocket()
      initialized.current = false
    }
  }, [])

  // Sorted newest first
  const chatList = Array.from(chats.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const pendingCount = chatList.filter((c) => c.status === 'pending').length

  const updateChatStatus = (
    chatId: string,
    updates: Partial<ChatSession>,
  ) => {
    setChats((prev) => {
      const next = new Map(prev)
      const existing = next.get(chatId)
      if (existing) {
        next.set(chatId, { ...existing, ...updates })
      }
      return next
    })
  }

  return { chats, chatList, pendingCount, connected, updateChatStatus }
}

// ── Panel Component ────────────────────────────────────────────────────────────

interface SupportPanelProps {
  open: boolean
  onClose: () => void
  chatList: Array<ChatSession>
  updateChatStatus: (chatId: string, updates: Partial<ChatSession>) => void
}

export function SupportPanel({ open, onClose, chatList, updateChatStatus }: SupportPanelProps) {
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const active = activeChat
    ? chatList.find((c) => c.chatId === activeChat)
    : null

  // Reset active chat when panel closes
  useEffect(() => {
    if (!open) setActiveChat(null)
  }, [open])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages.length])

  const [accepting, setAccepting] = useState(false)

  const acceptChat = async (chatId: string) => {
    setAccepting(true)
    try {
      const token = getExternalToken()
      const res = await fetch(
        `https://app.gen7fuel.com/api/support/chat/${chatId}/accept`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[SupportPanel] Accept failed:', body.message)
        setAccepting(false)
        return
      }
      const body = await res.json()
      // Update local state immediately so UI reflects the accepted status
      updateChatStatus(chatId, {
        status: 'accepted',
        acceptedBy: body.data?.acceptedBy,
      })
      // Join the chat room via socket for real-time messaging
      const socket = getHubSupportSocket()
      socket.emit('support-chat:join', { chatId })
      setActiveChat(chatId)
    } catch (err) {
      console.error('[SupportPanel] Accept error:', err)
    } finally {
      setAccepting(false)
    }
  }

  const sendMessage = () => {
    if (!messageText.trim() || !activeChat) return
    const socket = getHubSupportSocket()
    socket.emit('support-chat:message', {
      chatId: activeChat,
      text: messageText.trim(),
    })
    setMessageText('')
  }

  const closeChat = (chatId: string) => {
    const socket = getHubSupportSocket()
    socket.emit('support-chat:close', { chatId })
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    if (diffMs < 60_000) return 'Just now'
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="text-[10px] font-semibold uppercase text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
            Pending
          </span>
        )
      case 'accepted':
        return (
          <span className="text-[10px] font-semibold uppercase text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
            Active
          </span>
        )
      case 'expired':
        return (
          <span className="text-[10px] font-semibold uppercase text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
            Ticket
          </span>
        )
      case 'closed':
        return (
          <span className="text-[10px] font-semibold uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            Closed
          </span>
        )
      default:
        return null
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-[380px] max-w-[calc(100vw-64px)] bg-background border-l shadow-xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* ── Active chat view ── */}
        {active && active.status === 'accepted' ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setActiveChat(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {active.customer.name || active.customer.email}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {active.site}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive text-xs"
                onClick={() => closeChat(active.chatId)}
              >
                End
              </Button>
            </div>

            {/* Initial message */}
            <div className="mx-4 mt-3 mb-1 p-2 rounded bg-muted/40 text-xs text-muted-foreground italic border">
              Initial message: "{active.initialMessage}"
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {active.messages.map((msg, idx) => {
                const isAgent = msg.senderType === 'agent'
                return (
                  <div
                    key={idx}
                    className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                        isAgent
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted',
                      )}
                    >
                      {!isAgent && (
                        <div className="text-[10px] font-semibold mb-0.5 opacity-70">
                          {msg.senderName || 'Customer'}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <div
                        className={cn(
                          'text-[10px] mt-1',
                          isAgent ? 'opacity-70' : 'text-muted-foreground',
                        )}
                      >
                        {fmtTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              className="flex gap-2 border-t px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage()
              }}
            >
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" size="icon" disabled={!messageText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        ) : active && active.status === 'expired' ? (
          /* ── Expired / ticket view ── */
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setActiveChat(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {active.customer.name || active.customer.email}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {active.site}
                </div>
              </div>
              {statusLabel('expired')}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <Ticket className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Ticket Created</h3>
              <p className="text-xs text-muted-foreground">
                No agent accepted in time. A support ticket was automatically
                created and the customer has been notified.
              </p>
              <div className="rounded-md bg-muted/40 border p-4 w-full text-left">
                <p className="text-xs text-muted-foreground mb-1 font-medium">
                  Initial message
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {active.initialMessage}
                </p>
              </div>
              {active.ticketId && (
                <p className="text-xs text-muted-foreground">
                  Ticket ID:{' '}
                  <span className="font-mono font-semibold">
                    {active.ticketId}
                  </span>
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ── Chat list view ── */
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Headset className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Support Chats</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chatList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Headset className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No support requests yet.
                    <br />
                    They'll show up here in real time.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {chatList.map((chat) => (
                    <div
                      key={chat.chatId}
                      className="px-4 py-3 hover:bg-muted/40 transition cursor-pointer"
                      onClick={() => {
                        if (
                          chat.status === 'accepted' ||
                          chat.status === 'expired'
                        ) {
                          setActiveChat(chat.chatId)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">
                          {chat.customer.name || chat.customer.email}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {statusLabel(chat.status)}
                          <span className="text-[10px] text-muted-foreground">
                            {fmtTime(chat.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-2">
                        {chat.site} — {chat.initialMessage}
                      </p>
                      {chat.status === 'pending' && (
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs"
                          disabled={accepting}
                          onClick={(e) => {
                            e.stopPropagation()
                            acceptChat(chat.chatId)
                          }}
                        >
                          {accepting ? 'Accepting…' : 'Accept'}
                        </Button>
                      )}
                      {chat.status === 'accepted' && (
                        <div className="text-[10px] text-green-700">
                          Chatting with {chat.acceptedBy?.name || 'agent'}
                        </div>
                      )}
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
