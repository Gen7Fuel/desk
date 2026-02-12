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

const personnel = [
  'Alice Johnson',
  'Bob Smith',
  'Carol Williams',
  'David Brown',
  'Eve Davis',
  'Frank Miller',
  'Grace Wilson',
  'Henry Moore',
]

const personnelAccess: Record<string, { resource: string; identifier: string }[]> = {
  'Alice Johnson': [
    { resource: 'Key Card', identifier: 'KC-2024-0451' },
    { resource: 'Email', identifier: 'alice.johnson@example.com' },
    { resource: 'Safe', identifier: 'Safe #3 — Combo 42-18-7' },
    { resource: 'The Hub', identifier: 'alice.johnson' },
    { resource: 'Desk', identifier: 'alice.johnson@desk' },
    { resource: 'Fusion Pro', identifier: 'ajohnson@fusionpro' },
    { resource: 'Sage Intacct', identifier: 'alice.j@intacct' },
    { resource: 'Payworks', identifier: 'EMP-1001' },
  ],
  'Bob Smith': [
    { resource: 'Key Card', identifier: 'KC-2024-0452' },
    { resource: 'Email', identifier: 'bob.smith@example.com' },
    { resource: 'Desk', identifier: 'bob.smith@desk' },
  ],
  'Carol Williams': [
    { resource: 'Email', identifier: 'carol.williams@example.com' },
    { resource: 'The Hub', identifier: 'carol.williams' },
    { resource: 'Desk', identifier: 'carol.williams@desk' },
    { resource: 'Sage Intacct', identifier: 'carol.w@intacct' },
  ],
  'David Brown': [
    { resource: 'Key Card', identifier: 'KC-2024-0453' },
    { resource: 'Email', identifier: 'david.brown@example.com' },
    { resource: 'Safe', identifier: 'Safe #1 — Combo 31-25-9' },
    { resource: 'CStoreOffice', identifier: 'dbrown@cstore' },
    { resource: 'Payworks', identifier: 'EMP-1004' },
  ],
  'Eve Davis': [
    { resource: 'Email', identifier: 'eve.davis@example.com' },
    { resource: 'Desk', identifier: 'eve.davis@desk' },
    { resource: 'Fusion Pro', identifier: 'edavis@fusionpro' },
  ],
  'Frank Miller': [
    { resource: 'Email', identifier: 'frank.miller@example.com' },
    { resource: 'The Hub', identifier: 'frank.miller' },
    { resource: 'CStoreOffice', identifier: 'fmiller@cstore' },
    { resource: 'Payworks', identifier: 'EMP-1006' },
  ],
  'Grace Wilson': [
    { resource: 'Key Card', identifier: 'KC-2024-0457' },
    { resource: 'Email', identifier: 'grace.wilson@example.com' },
    { resource: 'Fusion Pro', identifier: 'gwilson@fusionpro' },
  ],
  'Henry Moore': [
    { resource: 'Email', identifier: 'henry.moore@example.com' },
    { resource: 'CStoreOffice', identifier: 'hmoore@cstore' },
  ],
}

export const Route = createFileRoute('/_appbar/_sidebar/access/personnel')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
})

function RouteComponent() {
  const { selected } = useSearch({ from: '/_appbar/_sidebar/access/personnel' })
  const navigate = useNavigate({ from: '/access/personnel' })
  const accessList = selected ? personnelAccess[selected] ?? [] : []

  return (
    <div className="flex h-full">
      <div className="flex w-56 flex-col gap-1 overflow-auto border-r p-4">
        <h2 className="mb-2 text-lg font-semibold">Personnel</h2>
        {personnel.map((person) => (
          <button
            key={person}
            onClick={() => navigate({ search: { selected: person } })}
            className={cn(
              'rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              selected === person && 'bg-accent/80 text-accent-foreground',
            )}
          >
            {person}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {selected ? (
          <>
            <h3 className="mb-4 text-lg font-semibold">
              {selected} <span className="text-sm font-normal text-muted-foreground">({accessList.length})</span>
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Identifier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessList.map((entry) => (
                  <TableRow key={entry.resource}>
                    <TableCell className="font-medium">{entry.resource}</TableCell>
                    <TableCell>{entry.identifier}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-muted-foreground">Select a person to see their access.</p>
        )}
      </div>
    </div>
  )
}
