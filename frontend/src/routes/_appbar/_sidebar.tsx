import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SidebarNavLinks } from '@/components/sidebar'

const sidebarLinks: Record<
  string,
  Array<{ label: string; path: string; permission: string }>
> = {
  cipher: [
    { label: 'Lock', path: '/cipher/lock', permission: 'cipher.lock' },
    { label: 'Unlock', path: '/cipher/unlock', permission: 'cipher.unlock' },
  ],
  inventory: [
    {
      label: 'CoreMark Initial Order',
      path: '/inventory/coremark-initial-order',
      permission: 'inventory.coremarkInitialOrder',
    },
  ],
  settings: [
    { label: 'Users', path: '/settings/users', permission: 'settings.users' },
    { label: 'Roles', path: '/settings/roles', permission: 'settings.roles' },
  ],
  hub: [
    { label: 'CDN Panel',    path: '/hub/cdn',         permission: 'hub.cdn' },
    { label: 'Payables',     path: '/hub/payables',    permission: 'hub.payables' },
    { label: 'Receivables',  path: '/hub/receivables', permission: 'hub.receivables' },
  ],
}

export const Route = createFileRoute('/_appbar/_sidebar')({
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
