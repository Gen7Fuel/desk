import { Outlet, createFileRoute } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SidebarNavLinks } from '@/components/sidebar'

const fuelLinks = [
  {
    label: 'Fuel Invoicing',
    path: '/fuel-invoicing',
    permission: 'fuel.fuelInvoicing',
  },
  { label: 'Kardpoll', path: '/kardpoll', permission: 'fuel.kardpoll' },
  { label: 'Fuel Rec', path: '/fuel-rec', permission: 'fuel.fuelRec' },
]

export const Route = createFileRoute('/_appbar/_fuel')({
  component: RouteComponent,
})

function RouteComponent() {
  const links = fuelLinks.filter((l) => can(l.permission, 'read'))

  return (
    <div className="flex h-full">
      <SidebarNavLinks links={links} />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
