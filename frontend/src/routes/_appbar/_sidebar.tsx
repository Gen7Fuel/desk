import { createFileRoute, Link, Outlet, useLocation, useMatchRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const sidebarLinks: Record<string, { label: string; path: string }[]> = {
  personnel: [
    { label: 'List', path: '/personnel/list' },
  ],
  access: [
    { label: 'Resources', path: '/access/resources' },
    { label: 'Personnel', path: '/access/personnel' },
  ],
  assets: [
    { label: 'Devices', path: '/assets/devices' },
    { label: 'Personnel', path: '/assets/personnel' },
    { label: 'Location', path: '/assets/location' },
  ],
  credentials: [
    { label: 'List', path: '/credentials/list' },
  ],
  subscriptions: [
    { label: 'List', path: '/subscriptions/list' },
  ],
}

export const Route = createFileRoute('/_appbar/_sidebar')({
  component: RouteComponent,
})

function RouteComponent() {
  const location = useLocation()
  const section = location.pathname.split('/')[1] ?? ''
  const matchRoute = useMatchRoute()
  const links = sidebarLinks[section] ?? []

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
