import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SidebarNavLinks } from '@/components/sidebar'

const sidebarLinks: Record<
  string,
  Array<{ label: string; path: string; permission: string }>
> = {
  personnel: [
    { label: 'List', path: '/personnel', permission: 'admin.personnel' },
  ],
  access: [
    {
      label: 'Resources',
      path: '/access/resources',
      permission: 'admin.access.resources',
    },
    {
      label: 'Personnel',
      path: '/access/personnel',
      permission: 'admin.access.personnel',
    },
  ],
  assets: [
    {
      label: 'Devices',
      path: '/assets/devices',
      permission: 'admin.assets.devices',
    },
    {
      label: 'Personnel',
      path: '/assets/personnel',
      permission: 'admin.assets.personnel',
    },
    {
      label: 'Location',
      path: '/assets/location',
      permission: 'admin.assets.location',
    },
  ],
  credentials: [
    {
      label: 'Categories',
      path: '/credentials/categories',
      permission: 'admin.credentials.categories',
    },
    {
      label: 'Credentials',
      path: '/credentials/list',
      permission: 'admin.credentials.list',
    },
  ],
  subscriptions: [
    {
      label: 'Categories',
      path: '/subscriptions/categories',
      permission: 'admin.subscriptions.categories',
    },
    {
      label: 'Subscriptions',
      path: '/subscriptions/list',
      permission: 'admin.subscriptions.list',
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
