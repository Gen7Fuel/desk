import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useMatchRoute,
  useNavigate,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  Binary,
  BriefcaseBusiness,
  Fuel,
  LayoutGrid,
  LogOut,
  Package,
  Settings,
  Tablet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTokenPayload } from '@/lib/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const Route = createFileRoute('/_appbar')({
  beforeLoad: () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('token')
    if (!token) throw redirect({ to: '/login' })
    // If the token exists but has no permissions field it was issued before the
    // permission system was added — force a fresh login.
    const payload = getTokenPayload()
    if (!payload?.permissions) {
      localStorage.removeItem('token')
      throw redirect({ to: '/login' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const { can } = usePermissions()

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate({ to: '/login' })
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate({ to: '/login' })
    }
  }, [])

  if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
    return null
  }

  const location = useLocation()
  const adminSections = [
    'personnel',
    'access',
    'assets',
    'credentials',
    'subscriptions',
  ]
  const section = location.pathname.split('/')[1] ?? ''
  const isAdminActive = adminSections.includes(section)
  const isFuelActive =
    !!matchRoute({ to: '/fuel-invoicing', fuzzy: true }) ||
    !!matchRoute({ to: '/kardpoll', fuzzy: true })
  const isCipherActive = !!matchRoute({ to: '/cipher', fuzzy: true })
  const isInventoryActive = !!matchRoute({ to: '/inventory', fuzzy: true })
  const isSettingsActive = !!matchRoute({ to: '/settings', fuzzy: true })
  const isHubActive = location.pathname.startsWith('/hub')

  return (
    <div className="flex h-screen">
      <nav className="flex w-16 flex-col items-center gap-2 border-r bg-background py-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <LayoutGrid className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Home</TooltipContent>
          </Tooltip>
          <hr className="w-8 border-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/personnel"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isAdminActive && 'bg-accent/80 text-accent-foreground',
                )}
              >
                <BriefcaseBusiness className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Admin</TooltipContent>
          </Tooltip>
          {can('fuelInvoicing', 'read') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/fuel-invoicing"
                  search={{ selected: '' }}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isFuelActive && 'bg-accent/80 text-accent-foreground',
                  )}
                >
                  <Fuel className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Fuel</TooltipContent>
            </Tooltip>
          )}
          {can('cipher', 'read') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/cipher"
                  search={{ selected: '' }}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isCipherActive && 'bg-accent/80 text-accent-foreground',
                  )}
                >
                  <Binary className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Cipher</TooltipContent>
            </Tooltip>
          )}
          {can('inventory', 'read') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/inventory"
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isInventoryActive && 'bg-accent/80 text-accent-foreground',
                  )}
                >
                  <Package className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Inventory</TooltipContent>
            </Tooltip>
          )}
          {can('hub', 'read') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/hub/cdn"
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isHubActive && 'bg-accent/80 text-accent-foreground',
                  )}
                >
                  <Tablet className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">The Hub</TooltipContent>
            </Tooltip>
          )}
          <div className="mt-auto flex flex-col items-center gap-2">
            {can('settings', 'read') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/settings/users"
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                      isSettingsActive && 'bg-accent/80 text-accent-foreground',
                    )}
                    search={{ selected: 'users' }}
                  >
                    <Settings className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          </div>
          {/* <Tooltip>
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <div className='h-5 w-5 font-bold text-sm'>AR</div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Purchase Orders</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/payouts"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <div className='h-5 w-5 font-bold text-sm'>AP</div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Payables and Payouts</TooltipContent>
          </Tooltip> */}
        </TooltipProvider>
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
