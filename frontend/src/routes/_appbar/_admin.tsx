import { Outlet, createFileRoute } from '@tanstack/react-router'
import type { SidebarLink } from '@/components/sidebar'
import { can } from '@/lib/permissions'
import { SidebarNavLinks } from '@/components/sidebar'

const adminModules: Array<SidebarLink & { permission: string }> = [
  { label: 'Personnel', path: '/personnel', permission: 'admin.personnel' },
  { label: 'Access', path: '/access/resources', permission: 'admin.access' },
  { label: 'Assets', path: '/assets/devices', permission: 'admin.assets' },
  {
    label: 'Credentials',
    path: '/credentials/categories',
    permission: 'admin.credentials',
  },
  {
    label: 'Subscriptions',
    path: '/subscriptions/categories',
    permission: 'admin.subscriptions',
  },
  {
    label: 'Site Assets',
    path: '/site-assets/list',
    permission: 'admin.site-assets',
  },
]

export const Route = createFileRoute('/_appbar/_admin')({
  component: RouteComponent,
})

function RouteComponent() {
  const links = adminModules.filter((m) => can(m.permission, 'read'))

  return (
    <div className="flex h-full">
      <SidebarNavLinks links={links} fuzzy />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
