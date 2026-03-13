import { Link, Outlet, createFileRoute, useLocation, useMatchRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { can } from '@/lib/permissions'

const sidebarLinks: Record<string, Array<{ label: string; path: string; permission: string }>> = {
  personnel: [
    { label: 'List', path: '/personnel/list', permission: 'personnel' },
  ],
  access: [
    { label: 'Resources', path: '/access/resources', permission: 'access.resources' },
    { label: 'Personnel', path: '/access/personnel', permission: 'access.personnel' },
  ],
  assets: [
    { label: 'Devices', path: '/assets/devices', permission: 'assets.devices' },
    { label: 'Personnel', path: '/assets/personnel', permission: 'assets.personnel' },
    { label: 'Location', path: '/assets/location', permission: 'assets.location' },
  ],
  credentials: [
    { label: 'Categories', path: '/credentials/categories', permission: 'credentials.categories' },
    { label: 'Credentials', path: '/credentials/list', permission: 'credentials.list' },
  ],
  subscriptions: [
    { label: 'Categories', path: '/subscriptions/categories', permission: 'subscriptions.categories' },
    { label: 'Subscriptions', path: '/subscriptions/list', permission: 'subscriptions.list' },
  ],
  cipher: [
    { label: 'Lock', path: '/cipher/lock', permission: 'cipher.lock' },
    { label: 'Unlock', path: '/cipher/unlock', permission: 'cipher.unlock' },
  ],
  inventory: [
    { label: 'CoreMark Initial Order', path: '/inventory/coremark-initial-order', permission: 'inventory.coremarkInitialOrder' },
  ],
  settings: [
    { label: 'Users', path: '/settings/users', permission: 'settings.users' },
    { label: 'Roles', path: '/settings/roles', permission: 'settings.roles' },
  ],
  hub: [
    { label: 'CDN Panel', path: '/hub/cdn', permission: 'hub.cdn' },
  ],
}

export const Route = createFileRoute('/_appbar/_sidebar')({
  component: RouteComponent,
})

function RouteComponent() {
  const location = useLocation()
  const section = location.pathname.split('/')[1] ?? ''
  const matchRoute = useMatchRoute()
  const links = (sidebarLinks[section] ?? []).filter((l) => can(l.permission, 'read'))

  return (
    <div className="flex h-full">
      <aside className="flex w-48 flex-col gap-1 border-r bg-background p-4">
        {links.map((link) => {
          const isActive = !!matchRoute({ to: link.path })
          return (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                'rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-accent/80 text-accent-foreground',
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </aside>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
