import { Outlet, createFileRoute } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SidebarNavLinks } from '@/components/sidebar'
import type { SidebarLink } from '@/components/sidebar'

const adminModules: Array<SidebarLink & { permission: string }> = [
  { label: 'Personnel', path: '/personnel', permission: 'personnel' },
  { label: 'Access', path: '/access/resources', permission: 'access' },
  { label: 'Assets', path: '/assets/devices', permission: 'assets' },
  { label: 'Credentials', path: '/credentials/categories', permission: 'credentials' },
  { label: 'Subscriptions', path: '/subscriptions/categories', permission: 'subscriptions' },
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
