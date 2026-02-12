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

const personnelDevices: Record<string, { type: string; make: string; model: string; identifier: string }[]> = {
  'Alice Johnson': [
    { type: 'Laptop', make: 'Apple', model: 'MacBook Pro 14"', identifier: 'SN-AP-2024-7821' },
    { type: 'POS Terminal', make: 'Verifone', model: 'MX 925', identifier: 'SN-VF-2024-0011' },
    { type: 'Printer', make: 'Epson', model: 'TM-T88VII', identifier: 'SN-EP-2024-0098' },
    { type: 'Safe', make: 'Amsec', model: 'BF3416', identifier: 'SN-AM-2021-7723' },
  ],
  'Bob Smith': [
    { type: 'Scanner', make: 'Zebra', model: 'TC21', identifier: 'BC-ZB-00482' },
    { type: 'Tablet', make: 'Apple', model: 'iPad Air M2', identifier: 'SN-AP-2024-6612' },
    { type: 'POS Terminal', make: 'Verifone', model: 'MX 925', identifier: 'SN-VF-2024-0012' },
  ],
  'Carol Williams': [
    { type: 'Desktop', make: 'HP', model: 'ProDesk 400 G9', identifier: 'SN-HP-2023-7728' },
    { type: 'Printer', make: 'Brother', model: 'QL-820NWB', identifier: 'SN-BR-2024-1190' },
  ],
  'David Brown': [
    { type: 'Laptop', make: 'Lenovo', model: 'ThinkPad X1 Carbon', identifier: 'SN-LN-2024-3310' },
    { type: 'Desktop', make: 'Dell', model: 'OptiPlex 7010', identifier: 'SN-DL-2023-4451' },
    { type: 'Printer', make: 'HP', model: 'LaserJet Pro M404dn', identifier: 'SN-HP-2024-2245' },
    { type: 'Fuel Equipment', make: 'Gilbarco', model: 'Passport', identifier: 'SN-GB-2022-4401' },
    { type: 'Fuel Equipment', make: 'Gilbarco', model: 'Encore 700', identifier: 'SN-GB-2022-4402' },
    { type: 'Safe', make: 'Amsec', model: 'BF1716', identifier: 'SN-AM-2022-8801' },
  ],
  'Eve Davis': [
    { type: 'Tablet', make: 'Apple', model: 'iPad 10th Gen', identifier: 'SN-AP-2024-3344' },
    { type: 'Scanner', make: 'Honeywell', model: 'Voyager 1472g', identifier: 'BC-HW-00331' },
    { type: 'POS Terminal', make: 'Ingenico', model: 'Lane 7000', identifier: 'SN-IG-2024-4490' },
  ],
  'Frank Miller': [
    { type: 'Laptop', make: 'Dell', model: 'Latitude 5540', identifier: 'SN-DL-2024-5589' },
    { type: 'Camera', make: 'Hikvision', model: 'DS-2CD2143G2-I', identifier: 'SN-HK-2023-5567' },
    { type: 'Camera', make: 'Hikvision', model: 'DS-2CD2143G2-I', identifier: 'SN-HK-2023-5568' },
    { type: 'Camera', make: 'Dahua', model: 'IPC-HDW3841T-ZAS', identifier: 'SN-DH-2023-9914' },
  ],
  'Grace Wilson': [
    { type: 'Tablet', make: 'Samsung', model: 'Galaxy Tab S9', identifier: 'SN-SS-2024-1187' },
    { type: 'Scanner', make: 'Zebra', model: 'DS2208', identifier: 'BC-ZB-00615' },
  ],
  'Henry Moore': [
    { type: 'Desktop', make: 'Dell', model: 'OptiPlex 5000', identifier: 'SN-DL-2023-9902' },
    { type: 'Networking', make: 'Cisco', model: 'CBS350-24T', identifier: 'SN-CS-2023-8812' },
    { type: 'Networking', make: 'Ubiquiti', model: 'UniFi U6 Pro', identifier: 'SN-UB-2024-0073' },
    { type: 'Networking', make: 'Ubiquiti', model: 'UniFi U6 Pro', identifier: 'SN-UB-2024-0074' },
  ],
}

const personnel = Object.keys(personnelDevices)

export const Route = createFileRoute('/_appbar/_sidebar/assets/personnel')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    selected: (search.selected as string) || undefined,
  }),
})

function RouteComponent() {
  const { selected } = useSearch({ from: '/_appbar/_sidebar/assets/personnel' })
  const navigate = useNavigate({ from: '/assets/personnel' })
  const devices = selected ? personnelDevices[selected] ?? [] : []

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
              {selected} <span className="text-sm font-normal text-muted-foreground">({devices.length})</span>
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Make</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Identifier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((entry) => (
                  <TableRow key={entry.identifier}>
                    <TableCell className="font-medium">{entry.type}</TableCell>
                    <TableCell>{entry.make}</TableCell>
                    <TableCell>{entry.model}</TableCell>
                    <TableCell>{entry.identifier}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <p className="text-muted-foreground">Select a person to see their assigned devices.</p>
        )}
      </div>
    </div>
  )
}
