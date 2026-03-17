import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import type { CredentialCategory } from '@/lib/credential-category-api'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createCredentialCategory,
  deleteCredentialCategory,
  getCredentialCategories,
  updateCredentialCategory,
} from '@/lib/credential-category-api'

export const Route = createFileRoute(
  '/_appbar/_sidebar/credentials/categories',
)({
  component: RouteComponent,
  beforeLoad: () => {
    if (
      typeof window !== 'undefined' &&
      !can('credentials.categories', 'read')
    ) {
      throw redirect({ to: '/' })
    }
  },
})

type FormMode = 'add' | 'edit' | null

function RouteComponent() {
  const queryClient = useQueryClient()
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')

  const {
    data: categories,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['credentialCategories'],
    queryFn: getCredentialCategories,
  })

  function closeForm() {
    setFormMode(null)
    setEditingId(null)
    setFormName('')
    saveMutation.reset()
    deleteMutation.reset()
  }

  function openAdd() {
    setFormMode('add')
    setEditingId(null)
    setFormName('')
    saveMutation.reset()
    deleteMutation.reset()
  }

  function openEdit(cat: CredentialCategory) {
    setFormMode('edit')
    setEditingId(cat._id)
    setFormName(cat.name)
    saveMutation.reset()
    deleteMutation.reset()
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (formMode === 'edit' && editingId) {
        return updateCredentialCategory(editingId, { name: formName.trim() })
      }
      return createCredentialCategory({ name: formName.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentialCategories'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCredentialCategory(editingId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentialCategories'] })
      closeForm()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || saveMutation.isPending || deleteMutation.isPending)
      return
    saveMutation.mutate()
  }

  const showForm = formMode !== null
  const isPending = saveMutation.isPending || deleteMutation.isPending
  const mutationError =
    (saveMutation.isError ? saveMutation.error.message : null) ||
    (deleteMutation.isError ? deleteMutation.error.message : null)

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-xl font-semibold">Categories</h2>
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
          <p className="text-muted-foreground">Loading...</p>
        ) : isError ? (
          <p className="text-destructive">{error.message}</p>
        ) : !categories || categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">No categories found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold text-foreground">
                  Name
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow
                  key={cat._id}
                  className={cn(
                    'cursor-pointer hover:bg-accent/50',
                    formMode === 'edit' &&
                      editingId === cat._id &&
                      'bg-accent/80',
                  )}
                  onClick={() => openEdit(cat)}
                >
                  <TableCell className="text-sm text-muted-foreground">
                    {cat.name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Slide-in form */}
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
              {formMode === 'edit' ? 'Edit Category' : 'New Category'}
            </h3>
            <Input
              placeholder="Category name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
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
