import { createFileRoute, Link, Outlet, redirect, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { CreditCard, Fuel, KeyRound, LayoutGrid, Lock, LogOut, MonitorSmartphone, Settings, User, Binary, Package } from 'lucide-react'
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

  const isPersonnelActive = !!matchRoute({ to: '/personnel', fuzzy: true })
  const isAccessActive = !!matchRoute({ to: '/access', fuzzy: true })
  const isAssetsActive = !!matchRoute({ to: '/assets', fuzzy: true })
  const isCredentialsActive = !!matchRoute({ to: '/credentials', fuzzy: true })
  const isSubscriptionsActive = !!matchRoute({ to: '/subscriptions', fuzzy: true })
  const isFuelActive = !!matchRoute({ to: '/fuel-invoicing', fuzzy: true })
  const isCipherActive = !!matchRoute({ to: '/cipher', fuzzy: true })
  const isInventoryActive = !!matchRoute({ to: '/inventory', fuzzy: true })
  const isSettingsActive = !!matchRoute({ to: '/settings', fuzzy: true })

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
          {can('personnel', 'read') && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/personnel"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isPersonnelActive && 'bg-accent/80 text-accent-foreground',
                )}
              >
                <User className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Personnel</TooltipContent>
          </Tooltip>
          )}
          {(can('access.personnel', 'read') || can('access.resources', 'read')) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/access"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isAccessActive && 'bg-accent/80 text-accent-foreground',
                )}
              >
                <Lock className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Access</TooltipContent>
          </Tooltip>
          )}
          {(can('assets.devices', 'read') || can('assets.personnel', 'read') || can('assets.location', 'read')) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/assets"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isAssetsActive && 'bg-accent/80 text-accent-foreground',
                )}
              >
                <MonitorSmartphone className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Assets</TooltipContent>
          </Tooltip>
          )}
          {(can('credentials.list', 'read') || can('credentials.categories', 'read')) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/credentials"
                search={{ selected: '' }}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isCredentialsActive && 'bg-accent/80 text-accent-foreground',
                )}
              >
                <KeyRound className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Credentials</TooltipContent>
          </Tooltip>
          )}
          {(can('subscriptions.list', 'read') || can('subscriptions.categories', 'read')) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/subscriptions"
                search={{ selected: '' }}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isSubscriptionsActive && 'bg-accent/80 text-accent-foreground',
                )}
              >
                <CreditCard className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Subscriptions</TooltipContent>
          </Tooltip>
          )}
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
            <TooltipContent side="right">Fuel Invoicing</TooltipContent>
          </Tooltip>
          )}
          {(can('cipher.lock', 'read') || can('cipher.unlock', 'read')) && (
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
          {can('inventory.coremarkInitialOrder', 'read') && (
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
          <div className="mt-auto flex flex-col items-center gap-2">
            {(can('settings.users', 'read') || can('settings.roles', 'read')) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                    to="/settings/users"
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                      isSettingsActive && 'bg-accent/80 text-accent-foreground'
                    )} search={{ selected: 'users' }}>
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
