import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const resources = [
  'Key Card',
  'Email',
  'Safe',
  'The Hub',
  'Desk',
  'CStoreOffice',
  'Fusion Pro',
  'Sage Intacct',
  'Payworks',
]

const resourceAccess: Record<string, { name: string; email: string }[]> = {
  'Key Card': [
    { name: 'Alice Johnson', email: 'alice.johnson@example.com' },
    { name: 'Bob Smith', email: 'bob.smith@example.com' },
    { name: 'David Brown', email: 'david.brown@example.com' },
    { name: 'Grace Wilson', email: 'grace.wilson@example.com' },
  ],
  Email: [
    { name: 'Alice Johnson', email: 'alice.johnson@example.com' },
    { name: 'Bob Smith', email: 'bob.smith@example.com' },
    { name: 'Carol Williams', email: 'carol.williams@example.com' },
    { name: 'David Brown', email: 'david.brown@example.com' },
    { name: 'Eve Davis', email: 'eve.davis@example.com' },
    { name: 'Frank Miller', email: 'frank.miller@example.com' },
    { name: 'Grace Wilson', email: 'grace.wilson@example.com' },
    { name: 'Henry Moore', email: 'henry.moore@example.com' },
  ],
  Safe: [
    { name: 'Alice Johnson', email: 'alice.johnson@example.com' },
    { name: 'David Brown', email: 'david.brown@example.com' },
  ],
  'The Hub': [
    { name: 'Alice Johnson', email: 'alice.johnson@example.com' },
    { name: 'Carol Williams', email: 'carol.williams@example.com' },
    { name: 'Frank Miller', email: 'frank.miller@example.com' },
  ],
  Desk: [
    { name: 'Alice Johnson', email: 'alice.johnson@example.com' },
    { name: 'Bob Smith', email: 'bob.smith@example.com' },
    { name: 'Carol Williams', email: 'carol.williams@example.com' },
    { name: 'Eve Davis', email: 'eve.davis@example.com' },
  ],
  CStoreOffice: [
    { name: 'David Brown', email: 'david.brown@example.com' },
    { name: 'Frank Miller', email: 'frank.miller@example.com' },
    { name: 'Henry Moore', email: 'henry.moore@example.com' },
  ],
  'Fusion Pro': [
    { name: 'Alice Johnson', email: 'alice.johnson@example.com' },
    { name: 'Eve Davis', email: 'eve.davis@example.com' },
    { name: 'Grace Wilson', email: 'grace.wilson@example.com' },
  ],
  'Sage Intacct': [
    { name: 'Alice Johnson', email: 'alice.johnson@example.com' },
    { name: 'Carol Williams', email: 'carol.williams@example.com' },
  ],
  Payworks: [
    { name: 'Alice Johnson', email: 'alice.johnson@example.com' },
    { name: 'David Brown', email: 'david.brown@example.com' },
    { name: 'Frank Miller', email: 'frank.miller@example.com' },
  ],
}

export const Route = createFileRoute('/_appbar/_sidebar/access/resources')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
})

function RouteComponent() {
  const { selected } = useSearch({ from: '/_appbar/_sidebar/access/resources' })
  const navigate = useNavigate({ from: '/access/resources' })
  const people = selected ? resourceAccess[selected] ?? [] : []

  return (
    <div className="flex h-full">
      <div className="flex w-56 flex-col gap-1 overflow-auto border-r p-4">
        <h2 className="mb-2 text-lg font-semibold">Resources</h2>
        {resources.map((resource) => (
          <button
            key={resource}
            onClick={() => navigate({ search: { selected: resource } })}
            className={cn(
              'rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              selected === resource && 'bg-accent/80 text-accent-foreground',
            )}
          >
            {resource}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {selected ? (
          <>
            <h3 className="mb-4 text-lg font-semibold">
              {selected} <span className="text-sm font-normal text-muted-foreground">({people.length})</span>
            </h3>
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
    </div>
  )
}
