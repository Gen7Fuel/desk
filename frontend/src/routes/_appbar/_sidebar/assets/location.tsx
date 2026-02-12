import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

interface LocationDevice {
  type: string
  make: string
  model: string
  identifier: string
}

interface OfficeLocation {
  name: string
  lat: number
  lng: number
  devices: LocationDevice[]
}

const offices: OfficeLocation[] = [
  {
    name: 'St. Lucia',
    lat: 13.9094,
    lng: -60.9789,
    devices: [
      { type: 'Laptop', make: 'Apple', model: 'MacBook Pro 14"', identifier: 'SN-AP-2024-7821' },
      { type: 'POS Terminal', make: 'Verifone', model: 'MX 925', identifier: 'SN-VF-2024-0011' },
      { type: 'POS Terminal', make: 'Verifone', model: 'MX 925', identifier: 'SN-VF-2024-0012' },
      { type: 'Scanner', make: 'Zebra', model: 'TC21', identifier: 'BC-ZB-00482' },
      { type: 'Printer', make: 'Epson', model: 'TM-T88VII', identifier: 'SN-EP-2024-0098' },
      { type: 'Camera', make: 'Hikvision', model: 'DS-2CD2143G2-I', identifier: 'SN-HK-2023-5567' },
      { type: 'Camera', make: 'Hikvision', model: 'DS-2CD2143G2-I', identifier: 'SN-HK-2023-5568' },
      { type: 'Safe', make: 'Amsec', model: 'BF3416', identifier: 'SN-AM-2021-7723' },
      { type: 'Fuel Equipment', make: 'Gilbarco', model: 'Passport', identifier: 'SN-GB-2022-4401' },
      { type: 'Fuel Equipment', make: 'Gilbarco', model: 'Encore 700', identifier: 'SN-GB-2022-4402' },
    ],
  },
  {
    name: 'Burlington, ON',
    lat: 43.3255,
    lng: -79.799,
    devices: [
      { type: 'Laptop', make: 'Lenovo', model: 'ThinkPad X1 Carbon', identifier: 'SN-LN-2024-3310' },
      { type: 'Desktop', make: 'Dell', model: 'OptiPlex 7010', identifier: 'SN-DL-2023-4451' },
      { type: 'Desktop', make: 'HP', model: 'ProDesk 400 G9', identifier: 'SN-HP-2023-7728' },
      { type: 'Printer', make: 'Brother', model: 'QL-820NWB', identifier: 'SN-BR-2024-1190' },
      { type: 'Printer', make: 'HP', model: 'LaserJet Pro M404dn', identifier: 'SN-HP-2024-2245' },
      { type: 'Tablet', make: 'Apple', model: 'iPad 10th Gen', identifier: 'SN-AP-2024-3344' },
      { type: 'Safe', make: 'Amsec', model: 'BF1716', identifier: 'SN-AM-2022-8801' },
      { type: 'Camera', make: 'Dahua', model: 'IPC-HDW3841T-ZAS', identifier: 'SN-DH-2023-9914' },
    ],
  },
  {
    name: 'Kelowna, BC',
    lat: 49.8881,
    lng: -119.4956,
    devices: [
      { type: 'Laptop', make: 'Dell', model: 'Latitude 5540', identifier: 'SN-DL-2024-5589' },
      { type: 'Desktop', make: 'Dell', model: 'OptiPlex 5000', identifier: 'SN-DL-2023-9902' },
      { type: 'Tablet', make: 'Apple', model: 'iPad Air M2', identifier: 'SN-AP-2024-6612' },
      { type: 'Tablet', make: 'Samsung', model: 'Galaxy Tab S9', identifier: 'SN-SS-2024-1187' },
      { type: 'Scanner', make: 'Zebra', model: 'DS2208', identifier: 'BC-ZB-00615' },
      { type: 'Scanner', make: 'Honeywell', model: 'Voyager 1472g', identifier: 'BC-HW-00331' },
      { type: 'POS Terminal', make: 'Ingenico', model: 'Lane 7000', identifier: 'SN-IG-2024-4490' },
      { type: 'Networking', make: 'Cisco', model: 'CBS350-24T', identifier: 'SN-CS-2023-8812' },
      { type: 'Networking', make: 'Ubiquiti', model: 'UniFi U6 Pro', identifier: 'SN-UB-2024-0073' },
      { type: 'Networking', make: 'Ubiquiti', model: 'UniFi U6 Pro', identifier: 'SN-UB-2024-0074' },
    ],
  },
]

const LazyMap = lazy(async () => {
  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  const { MapContainer, TileLayer, Marker, Popup } = await import('react-leaflet')

  // Fix default marker icons for bundlers
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  function LocationMap() {
    return (
      <MapContainer
        center={[30, -60]}
        zoom={3}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {offices.map((office) => (
          <Marker key={office.name} position={[office.lat, office.lng]}>
            <Popup minWidth={280} maxWidth={400}>
              <div>
                <h3 className="mb-2 text-base font-semibold">{office.name}</h3>
                <p className="mb-1 text-sm text-muted-foreground">
                  {office.devices.length} devices
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="py-1 text-left font-medium">Type</th>
                      <th className="py-1 text-left font-medium">Model</th>
                      <th className="py-1 text-left font-medium">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {office.devices.map((d) => (
                      <tr key={d.identifier} className="border-b last:border-0">
                        <td className="py-1">{d.type}</td>
                        <td className="py-1">{d.model}</td>
                        <td className="py-1 font-mono">{d.identifier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    )
  }

  return { default: LocationMap }
})

export const Route = createFileRoute('/_appbar/_sidebar/assets/location')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full flex-col">
      <div className="h-full w-full">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading map…
            </div>
          }
        >
          <LazyMap />
        </Suspense>
      </div>
    </div>
  )
}
