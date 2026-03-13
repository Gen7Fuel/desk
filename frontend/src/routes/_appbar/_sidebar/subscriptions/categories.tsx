import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
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
import { createCategory, deleteCategory, getCategories } from '@/lib/category-api'

export const Route = createFileRoute('/_appbar/_sidebar/subscriptions/categories')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('subscriptions.categories', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')

  const { data: categories, isLoading, isError, error } = useQuery({
    queryKey: ['subscriptionCategories'],
    queryFn: getCategories,
  })

  function closeForm() {
    setShowForm(false)
    setFormName('')
    addMutation.reset()
  }

  const addMutation = useMutation({
    mutationFn: () => createCategory({ name: formName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionCategories'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionCategories'] })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || addMutation.isPending) return
    addMutation.mutate()
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 overflow-auto p-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-xl font-semibold">Categories</h2>
          <Button
            variant={showForm ? 'outline' : 'default'}
            size="icon"
            className="h-6 w-6"
            onClick={() => (showForm ? closeForm() : setShowForm(true))}
          >
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : isError ? (
          <p className="text-destructive">{(error).message}</p>
        ) : !categories || categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">No categories found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold text-foreground">Name</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat._id}>
                  <TableCell className="text-sm text-muted-foreground">{cat.name}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(cat._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {deleteMutation.isError && (
          <p className="mt-2 text-sm text-destructive">
            {(deleteMutation.error).message}
          </p>
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
          <form onSubmit={handleSubmit} className="flex h-full w-80 flex-col gap-3 p-4">
            <h3 className="text-sm font-semibold">New Category</h3>
            <Input
              placeholder="Category name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
            />
            {addMutation.isError && (
              <p className="text-sm text-destructive">
                {(addMutation.error).message}
              </p>
            )}
            <Button type="submit" className="mt-1" disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
