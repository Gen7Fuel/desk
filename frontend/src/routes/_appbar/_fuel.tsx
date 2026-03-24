import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SidebarNavLinks } from '@/components/sidebar'

const fuelLinks = [
  { label: 'Fuel Invoicing', path: '/fuel-invoicing' },
  { label: 'Kardpoll', path: '/kardpoll' },
  { label: 'Fuel Rec', path: '/fuel-rec' },
]

export const Route = createFileRoute('/_appbar/_fuel')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full">
      <SidebarNavLinks links={fuelLinks} />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
