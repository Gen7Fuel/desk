import { createFileRoute, redirect, useNavigate, useSearch } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
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
import { createResourceKind, getResourceKinds } from '@/lib/resource-kind-api'
import { getPersonnel } from '@/lib/personnel-api'

export const Route = createFileRoute('/_appbar/_sidebar/access/resources')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('access.resources', 'read')) {
      throw redirect({ to: '/' })
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
})

function RouteComponent() {
  const { selected } = useSearch({ from: '/_appbar/_sidebar/access/resources' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  function closeForm() {
    setShowForm(false)
    setFormName('')
  }

  const addResourceKindMutation = useMutation({
    mutationFn: () => createResourceKind({ name: formName.trim() }),
    onSuccess: (newKind: any) => {
      queryClient.invalidateQueries({ queryKey: ['resourceKinds'] })
      navigate({ to: '/access/resources', search: { selected: newKind.name } })
      closeForm()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || addResourceKindMutation.isPending) return
    addResourceKindMutation.mutate()
  }

  const {
    data: resourceKinds,
    isLoading: isLoadingResources,
    isError: isErrorResources,
    error: resourceError,
  } = useQuery({
    queryKey: ['resourceKinds'],
    queryFn: getResourceKinds,
  })

  const {
    data: personnel,
    isLoading: isLoadingPersonnel,
    isError: isErrorPersonnel,
    error: personnelError,
  } = useQuery({
    queryKey: ['personnel'],
    queryFn: getPersonnel,
  })

  const people =
    selected && Array.isArray(personnel)
      ? personnel
          .filter((person: any) =>
            Array.isArray(person.resources) &&
            person.resources.some((r: any) => r.type === selected),
          )
          .map((person: any) => ({ name: person.name, email: person.email }))
      : []

  return (
    <div className="flex h-full">
      <div className="flex w-56 flex-col gap-1 overflow-auto border-r p-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Resources</h2>
          <Button
            variant={showForm ? 'outline' : 'default'}
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              if (showForm) {
                closeForm()
              } else {
                setShowForm(true)
                setTimeout(() => nameInputRef.current?.focus(), 150)
              }
            }}
          >
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>
        {isLoadingResources ? (
			<p className="text-muted-foreground">Loading...</p>
		) : isErrorResources ? (
			<p className="text-destructive">{resourceError.message}</p>
		) : !resourceKinds || resourceKinds.length === 0 ? (
			<p className="text-muted-foreground">No resources found.</p>
		) : (
			resourceKinds.map((kind: any) => (
				<button
					key={kind._id || kind.id || kind.name}
					onClick={() => navigate({ to: '/access/resources', search: { selected: kind.name } })}
					className={cn(
						'rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
						selected === kind.name && 'bg-accent/80 text-accent-foreground',
					)}
				>
					{kind.name}
				</button>
			))
		)}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {selected ? (
          <>
            <h3 className="mb-4 text-lg font-semibold">
              {selected} <span className="text-sm font-normal text-muted-foreground">({people.length})</span>
            </h3>
            {isLoadingPersonnel ? (
				<p className="text-muted-foreground">Loading personnel...</p>
			) : isErrorPersonnel ? (
				<p className="text-destructive">{personnelError.message}</p>
			) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow key={person.email}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell>{person.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-muted-foreground">Select a resource to see who has access.</p>
        )}
      </div>

      {/* slide-in form panel */}
      <div
        className={cn(
          'shrink-0 overflow-hidden border-l bg-background transition-all duration-300 ease-in-out',
          showForm ? 'w-80' : 'w-0 border-l-0',
        )}
      >
        <form onSubmit={handleSubmit} className="flex h-full w-80 flex-col gap-3 p-4">
          <h3 className="text-sm font-semibold">New Resource</h3>
          <Input
            ref={nameInputRef}
            placeholder="Resource name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          {addResourceKindMutation.isError && (
            <p className="text-sm text-destructive">
              {addResourceKindMutation.error.message}
            </p>
          )}
          <Button type="submit" className="mt-1" disabled={addResourceKindMutation.isPending}>
            {addResourceKindMutation.isPending ? 'Adding...' : 'Add'}
          </Button>
        </form>
      </div>
    </div>
  )
}
