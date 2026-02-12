import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Credential {
  name: string
  category: string
  url?: string
  username: string
  password: string
  notes?: string
}

const initialCredentials: Credential[] = [
  {
    name: 'Bulloch Bridge Server',
    category: 'Server',
    username: 'mohammad',
    password: '',
    notes: 'Connect with ssh keys to 24.50.55.130 / 192.168.1.102',
  },
  {
    name: "James' Email",
    category: 'Email',
    username: 'james@gen7fuel.com',
    password: 'Gpmc2025$$',
  },
  {
    name: "Mohammad's Email",
    category: 'Email',
    username: 'mohammad@gen7fuel.com',
    password: 'G7fl19681963',
    notes: 'Mark will reset the password for security reason. Ask him for the password, save',
  },
  {
    name: 'App Server',
    category: 'Server',
    username: 'gen7fuel',
    password: 'G7fl19681963',
    notes: 'Use the command: ssh gen7fuel@31.5.55.130 for connecting to the VPS',
  },
  {
    name: 'GitHub',
    category: 'Development',
    username: 'Gen7Fuel / mohammad@gen7fuel.cc',
    password: 'G7fl19681963',
    notes: 'GitHub hosts the code for The Hub. Login from www.github.com',
  },
  {
    name: 'MongoDB (Hub Database)',
    category: 'Database',
    username: 'gen7fuel',
    password: 'Wcf8dJEQQ$1',
    notes: 'Internal 192.168.1.25:48751 External 24.50.55.130:39137',
  },
  {
    name: 'Google account for Silver Grizzly',
    category: 'Google Account',
    username: 'orderssg@gen7fuel.com',
    password: 'G3n7st@tions2023!',
    notes: 'This is used to login to handheld devices on site after a factory reset.',
  },
  {
    name: 'Oliver Email',
    category: 'Email',
    username: 'office.oliver@gen7fuel.com',
    password: 'Gpmc032025',
    notes: 'May only work for Google account',
  },
  {
    name: 'Osoyoos Email',
    category: 'Email',
    username: 'office.osoyoos@gen7fuel.com',
    password: 'Gpmc032025',
    notes: 'May only work for Google account',
  },
  {
    name: 'Handheld Device Gmail Account',
    category: 'Google Account',
    username: 'gen7station@gmail.com',
    password: 'gen7stationB2$',
    notes: "We are using this credential in all the sites' handheld devices",
  },
  {
    name: 'Hostinger Online Portal',
    category: 'Hosting',
    username: 'orders@gen7fuel.com',
    password: 'Gen72025',
  },
  {
    name: 'Hostinger Server',
    category: 'Hosting',
    username: 'root',
    password: 'G7fl19681963@',
    notes: '31.97.98.111',
  },
  {
    name: 'Gmail Account for n8n Automation',
    category: 'Google Account',
    username: 'gen7.automation@gmail.com',
    password: 'G7fl19681963',
    notes: 'This is the email we use to receive scheduled reports from Kardpoll. Recovery email is mohammad@gen7fuel.com',
  },
]

export const Route = createFileRoute('/_appbar/credentials')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || '',
  }),
})

function RouteComponent() {
  const { selected } = useSearch({ from: '/_appbar/credentials' })
  const navigate = useNavigate({ from: '/credentials' })
  const [creds, setCreds] = useState(initialCredentials)
  const [altPressed, setAltPressed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const categories = [...new Set(creds.map((c) => c.category))]

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Alt') setAltPressed(true)
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Alt') setAltPressed(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    if (showForm) {
      // Small delay to let the slide animation start before focusing
      const t = setTimeout(() => nameInputRef.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [showForm])

  function closeForm() {
    setShowForm(false)
    setFormName('')
    setFormCategory('')
    setFormUrl('')
    setFormUsername('')
    setFormPassword('')
    setFormNotes('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || !formCategory.trim() || !formUsername.trim() || !formPassword.trim()) return
    const newCred: Credential = {
      name: formName.trim(),
      category: formCategory.trim(),
      url: formUrl.trim() || undefined,
      username: formUsername.trim(),
      password: formPassword.trim(),
      notes: formNotes.trim() || undefined,
    }
    setCreds((prev) => [...prev, newCred])
    navigate({ search: { selected: newCred.name } })
    closeForm()
  }

  const selectedCredential = creds.find((c) => c.name === selected)

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 overflow-auto border-r">
        <div className="flex items-center gap-2 px-4 pt-4 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credentials</span>
          <Button
            variant={showForm ? 'outline' : 'default'}
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              if (showForm) {
                closeForm()
              } else {
                setShowForm(true)
              }
            }}
          >
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>
        {categories.map((category) => (
          <div key={category}>
            <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {category}
            </div>
            {creds
              .filter((c) => c.category === category)
              .map((cred) => (
                <button
                  key={cred.name}
                  onClick={() =>
                    navigate({ search: { selected: cred.name } })
                  }
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                    selected === cred.name &&
                      'bg-accent/80 text-accent-foreground',
                  )}
                >
                  {cred.name}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {selectedCredential ? (
          <div className="px-6 pt-4">
            <h2 className="mb-4 text-lg font-semibold">
              {selectedCredential.name}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Category</TableCell>
                  <TableCell>{selectedCredential.category}</TableCell>
                </TableRow>
                {selectedCredential.url && (
                  <TableRow>
                    <TableCell className="font-medium">URL</TableCell>
                    <TableCell>
                      <a
                        href={selectedCredential.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline underline-offset-2 hover:text-blue-400"
                      >
                        {selectedCredential.url}
                      </a>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="font-medium">Username</TableCell>
                  <TableCell className="font-mono text-sm">
                    {selectedCredential.username}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Password</TableCell>
                  <TableCell className="font-mono text-sm">
                    {altPressed ? (
                      selectedCredential.password
                    ) : (
                      <span className="text-muted-foreground">
                        {'•'.repeat(selectedCredential.password.length)}
                        <span className="ml-3 font-sans text-xs text-muted-foreground/60">
                          Hold Alt to reveal
                        </span>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                {selectedCredential.notes && (
                  <TableRow>
                    <TableCell className="font-medium">Notes</TableCell>
                    <TableCell className="text-muted-foreground">
                      {selectedCredential.notes}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a credential to view details
          </div>
        )}
      </div>

      {/* Slide-in form panel */}
      <div
        className={cn(
          'shrink-0 overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
          showForm ? 'w-80' : 'w-0 border-l-0',
        )}
      >
        <form onSubmit={handleSubmit} className="flex h-full w-80 flex-col gap-3 p-4">
          <h3 className="text-sm font-semibold">New Credential</h3>
          <Input
            ref={nameInputRef}
            placeholder="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Input
            placeholder="Category (e.g. Infrastructure)"
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value)}
          />
          <Input
            placeholder="URL (optional)"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
          />
          <Input
            placeholder="Username"
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
          />
          <Input
            placeholder="Notes (optional)"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
          <Button type="submit" className="mt-1">
            Add
          </Button>
        </form>
      </div>
    </div>
  )
}
