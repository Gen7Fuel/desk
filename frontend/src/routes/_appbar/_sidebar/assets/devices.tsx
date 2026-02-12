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

const deviceTypes = [
  'Laptop',
  'Tablet',
  'Desktop',
  'Scanner',
  'Printer',
  'Camera',
  'Networking',
  'POS Terminal',
  'Fuel Equipment',
  'Safe',
]

interface DeviceEntry {
  assignedTo: string
  make: string
  model: string
  identifier: string
}

const devicesByType: Record<string, DeviceEntry[]> = {
  Laptop: [
    { assignedTo: 'Alice Johnson', make: 'Apple', model: 'MacBook Pro 14"', identifier: 'SN-AP-2024-7821' },
    { assignedTo: 'David Brown', make: 'Lenovo', model: 'ThinkPad X1 Carbon', identifier: 'SN-LN-2024-3310' },
    { assignedTo: 'Frank Miller', make: 'Dell', model: 'Latitude 5540', identifier: 'SN-DL-2024-5589' },
  ],
  Tablet: [
    { assignedTo: 'Eve Davis', make: 'Apple', model: 'iPad 10th Gen', identifier: 'SN-AP-2024-3344' },
    { assignedTo: 'Bob Smith', make: 'Apple', model: 'iPad Air M2', identifier: 'SN-AP-2024-6612' },
    { assignedTo: 'Grace Wilson', make: 'Samsung', model: 'Galaxy Tab S9', identifier: 'SN-SS-2024-1187' },
  ],
  Desktop: [
    { assignedTo: 'David Brown', make: 'Dell', model: 'OptiPlex 7010', identifier: 'SN-DL-2023-4451' },
    { assignedTo: 'Carol Williams', make: 'HP', model: 'ProDesk 400 G9', identifier: 'SN-HP-2023-7728' },
    { assignedTo: 'Henry Moore', make: 'Dell', model: 'OptiPlex 5000', identifier: 'SN-DL-2023-9902' },
  ],
  Scanner: [
    { assignedTo: 'Bob Smith', make: 'Zebra', model: 'TC21', identifier: 'BC-ZB-00482' },
    { assignedTo: 'Grace Wilson', make: 'Zebra', model: 'DS2208', identifier: 'BC-ZB-00615' },
    { assignedTo: 'Eve Davis', make: 'Honeywell', model: 'Voyager 1472g', identifier: 'BC-HW-00331' },
  ],
  Printer: [
    { assignedTo: 'Carol Williams', make: 'Brother', model: 'QL-820NWB', identifier: 'SN-BR-2024-1190' },
    { assignedTo: 'Alice Johnson', make: 'Epson', model: 'TM-T88VII', identifier: 'SN-EP-2024-0098' },
    { assignedTo: 'David Brown', make: 'HP', model: 'LaserJet Pro M404dn', identifier: 'SN-HP-2024-2245' },
  ],
  Camera: [
    { assignedTo: 'Frank Miller', make: 'Hikvision', model: 'DS-2CD2143G2-I', identifier: 'SN-HK-2023-5567' },
    { assignedTo: 'Frank Miller', make: 'Hikvision', model: 'DS-2CD2143G2-I', identifier: 'SN-HK-2023-5568' },
    { assignedTo: 'Frank Miller', make: 'Dahua', model: 'IPC-HDW3841T-ZAS', identifier: 'SN-DH-2023-9914' },
  ],
  Networking: [
    { assignedTo: 'Henry Moore', make: 'Cisco', model: 'CBS350-24T', identifier: 'SN-CS-2023-8812' },
    { assignedTo: 'Henry Moore', make: 'Ubiquiti', model: 'UniFi U6 Pro', identifier: 'SN-UB-2024-0073' },
    { assignedTo: 'Henry Moore', make: 'Ubiquiti', model: 'UniFi U6 Pro', identifier: 'SN-UB-2024-0074' },
  ],
  'POS Terminal': [
    { assignedTo: 'Alice Johnson', make: 'Verifone', model: 'MX 925', identifier: 'SN-VF-2024-0011' },
    { assignedTo: 'Bob Smith', make: 'Verifone', model: 'MX 925', identifier: 'SN-VF-2024-0012' },
    { assignedTo: 'Eve Davis', make: 'Ingenico', model: 'Lane 7000', identifier: 'SN-IG-2024-4490' },
  ],
  'Fuel Equipment': [
    { assignedTo: 'David Brown', make: 'Gilbarco', model: 'Passport', identifier: 'SN-GB-2022-4401' },
    { assignedTo: 'David Brown', make: 'Gilbarco', model: 'Encore 700', identifier: 'SN-GB-2022-4402' },
  ],
  Safe: [
    { assignedTo: 'Alice Johnson', make: 'Amsec', model: 'BF3416', identifier: 'SN-AM-2021-7723' },
    { assignedTo: 'David Brown', make: 'Amsec', model: 'BF1716', identifier: 'SN-AM-2022-8801' },
  ],
}

export const Route = createFileRoute('/_appbar/_sidebar/assets/devices')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
})

function RouteComponent() {
  const { selected } = useSearch({ from: '/_appbar/_sidebar/assets/devices' })
  const navigate = useNavigate({ from: '/assets/devices' })
  const entries = selected ? devicesByType[selected] ?? [] : []

  return (
    <div className="flex h-full">
      <div className="flex w-56 flex-col gap-1 overflow-auto border-r p-4">
        <h2 className="mb-2 text-lg font-semibold">Device Types</h2>
        {deviceTypes.map((type) => (
          <button
            key={type}
            onClick={() => navigate({ search: { selected: type } })}
            className={cn(
              'rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              selected === type && 'bg-accent/80 text-accent-foreground',
            )}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {selected ? (
          <>
            <h3 className="mb-4 text-lg font-semibold">
              {selected} <span className="text-sm font-normal text-muted-foreground">({entries.length})</span>
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Identifier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.identifier}>
                    <TableCell className="font-medium">{entry.assignedTo}</TableCell>
                    <TableCell>{entry.make}</TableCell>
                    <TableCell>{entry.model}</TableCell>
                    <TableCell>{entry.identifier}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-muted-foreground">Select a device type to see assigned units.</p>
        )}
      </div>
    </div>
  )
}
