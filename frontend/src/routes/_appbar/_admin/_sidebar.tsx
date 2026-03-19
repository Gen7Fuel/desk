import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SidebarNavLinks } from '@/components/sidebar'

const sidebarLinks: Record<
  string,
  Array<{ label: string; path: string; permission: string }>
> = {
  personnel: [{ label: 'List', path: '/personnel', permission: 'personnel' }],
  access: [
    {
      label: 'Resources',
      path: '/access/resources',
      permission: 'access.resources',
    },
    {
      label: 'Personnel',
      path: '/access/personnel',
      permission: 'access.personnel',
    },
  ],
  assets: [
    { label: 'Devices', path: '/assets/devices', permission: 'assets.devices' },
    {
      label: 'Personnel',
      path: '/assets/personnel',
      permission: 'assets.personnel',
    },
    {
      label: 'Location',
      path: '/assets/location',
      permission: 'assets.location',
    },
  ],
  credentials: [
    {
      label: 'Categories',
      path: '/credentials/categories',
      permission: 'credentials.categories',
    },
    {
      label: 'Credentials',
      path: '/credentials/list',
      permission: 'credentials.list',
    },
  ],
  subscriptions: [
    {
      label: 'Categories',
      path: '/subscriptions/categories',
      permission: 'subscriptions.categories',
    },
    {
      label: 'Subscriptions',
      path: '/subscriptions/list',
      permission: 'subscriptions.list',
    },
  ],
}

export const Route = createFileRoute('/_appbar/_admin/_sidebar')({
  component: RouteComponent,
})

function RouteComponent() {
  const location = useLocation()
  const section = location.pathname.split('/')[1] ?? ''
  const links = (sidebarLinks[section] ?? []).filter((l) =>
    can(l.permission, 'read'),
  )

  return (
    <div className="flex h-full">
      <SidebarNavLinks links={links} />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
