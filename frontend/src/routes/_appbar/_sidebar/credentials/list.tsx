import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import type { Credential } from '@/lib/credential-api'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getCredentialCategories } from '@/lib/credential-category-api'
import {
  createCredential,
  deleteCredential,
  getCredentials,
  updateCredential,
} from '@/lib/credential-api'

export const Route = createFileRoute('/_appbar/_sidebar/credentials/list')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('credentials.list', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

type FormMode = 'add' | 'edit' | null

function RouteComponent() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revealPassword, setRevealPassword] = useState(false)

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: getCredentials,
  })

  const { data: categories } = useQuery({
    queryKey: ['credentialCategories'],
    queryFn: getCredentialCategories,
  })

  const [formMode, setFormMode] = useState<FormMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Ctrl+Alt to reveal password
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.altKey) setRevealPassword(true)
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (!e.ctrlKey || !e.altKey) setRevealPassword(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Autofocus name input when form opens
  useEffect(() => {
    if (formMode) {
      const t = setTimeout(() => nameInputRef.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [formMode])

  function closeForm() {
    setFormMode(null)
    setEditingId(null)
    setFormName('')
    setFormCategory('')
    setFormUrl('')
    setFormUsername('')
    setFormPassword('')
    setFormNotes('')
    saveMutation.reset()
    deleteMutation.reset()
  }

  function openAdd() {
    setFormMode('add')
    setEditingId(null)
    setFormName('')
    setFormCategory('')
    setFormUrl('')
    setFormUsername('')
    setFormPassword('')
    setFormNotes('')
    saveMutation.reset()
    deleteMutation.reset()
  }

  function openEdit(cred: Credential) {
    setFormMode('edit')
    setEditingId(cred._id)
    setSelectedId(cred._id)
    setFormName(cred.name)
    setFormCategory(cred.category)
    setFormUrl(cred.url ?? '')
    setFormUsername(cred.username)
    setFormPassword(cred.password)
    setFormNotes(cred.notes ?? '')
    saveMutation.reset()
    deleteMutation.reset()
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: formName.trim(),
        category: formCategory,
        url: formUrl.trim() || undefined,
        username: formUsername.trim(),
        password: formPassword.trim(),
        notes: formNotes.trim() || undefined,
      }
      if (formMode === 'edit' && editingId) {
        return updateCredential(editingId, payload)
      }
      return createCredential(payload as Parameters<typeof createCredential>[0])
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      setSelectedId(data._id)
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCredential(editingId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      setSelectedId(null)
      closeForm()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (
      !formName.trim() ||
      !formCategory ||
      !formUsername.trim() ||
      !formPassword.trim()
    )
      return
    if (saveMutation.isPending || deleteMutation.isPending) return
    saveMutation.mutate()
  }

  const showForm = formMode !== null
  const isPending = saveMutation.isPending || deleteMutation.isPending
  const mutationError =
    (saveMutation.isError ? saveMutation.error.message : null) ||
    (deleteMutation.isError ? deleteMutation.error.message : null)

  const selectedCredential = credentials?.find((c) => c._id === selectedId)

  // Group credentials by category
  const grouped = (credentials ?? []).reduce<Record<string, Array<Credential>>>(
    (acc, cred) => {
      ;(acc[cred.category] ??= []).push(cred)
      return acc
    },
    {},
  )

  return (
    <div className="flex h-full">
      {/* Inner sidebar — categorized list */}
      <div className="w-64 shrink-0 overflow-auto border-r">
        <div className="flex items-center gap-2 px-4 pt-4 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Credentials
          </span>
          <Button
            variant={formMode === 'add' ? 'outline' : 'default'}
            size="icon"
            className="h-6 w-6"
            onClick={() => (formMode === 'add' ? closeForm() : openAdd())}
          >
            {formMode === 'add' ? (
              <X className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
        </div>

        {isLoading ? (
          <p className="px-4 py-2 text-muted-foreground text-sm">Loading...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="px-4 py-2 text-muted-foreground text-sm">
            No credentials yet.
          </p>
        ) : (
          Object.entries(grouped).map(([category, creds]) => (
            <div key={category}>
              <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {category}
              </div>
              {creds.map((cred) => (
                <button
                  key={cred._id}
                  onClick={() => {
                    setSelectedId(cred._id)
                    if (formMode === 'edit') openEdit(cred)
                    else if (formMode === 'add') closeForm()
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                    selectedId === cred._id &&
                      'bg-accent/80 text-accent-foreground',
                  )}
                >
                  {cred.name}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Detail view */}
      <div className="flex-1 min-w-0 overflow-auto">
        {selectedCredential ? (
          <div className="px-6 pt-4">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {selectedCredential.name}
              </h2>
              <Button
                variant="outline"
                size="xs"
                onClick={() => openEdit(selectedCredential)}
                disabled={
                  formMode === 'edit' && editingId === selectedCredential._id
                }
              >
                Edit
              </Button>
            </div>
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
                    {revealPassword ? (
                      selectedCredential.password
                    ) : (
                      <span className="text-muted-foreground">
                        {'•'.repeat(selectedCredential.password.length)}
                        <span className="ml-3 font-sans text-xs text-muted-foreground/60">
                          Hold Ctrl + Alt to reveal
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
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="flex h-full w-80 flex-col gap-3 p-4"
          >
            <h3 className="text-sm font-semibold">
              {formMode === 'edit' ? 'Edit Credential' : 'New Credential'}
            </h3>

            <Input
              ref={nameInputRef}
              placeholder="Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />

            <Select value={formCategory} onValueChange={setFormCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat._id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            {mutationError && (
              <p className="text-sm text-destructive">{mutationError}</p>
            )}

            <Button type="submit" className="mt-1" disabled={isPending}>
              {saveMutation.isPending
                ? formMode === 'edit'
                  ? 'Updating...'
                  : 'Adding...'
                : formMode === 'edit'
                  ? 'Update'
                  : 'Add'}
            </Button>

            {formMode === 'edit' && (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
