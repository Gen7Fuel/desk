import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useMatchRoute,
  useNavigate,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Binary,
  BriefcaseBusiness,
  ClipboardList,
  Fuel,
  Headset,
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
import { SupportPanel, useSupportChats } from '@/components/support-panel'

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
  const { chatList, pendingCount, updateChatStatus } = useSupportChats()
  const [supportOpen, setSupportOpen] = useState(false)

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
    'site-assets',
  ]
  const section = location.pathname.split('/')[1] ?? ''
  const isAdminActive = adminSections.includes(section)
  const isFuelActive =
    !!matchRoute({ to: '/fuel-invoicing', fuzzy: true }) ||
    !!matchRoute({ to: '/kardpoll', fuzzy: true }) ||
    !!matchRoute({ to: '/fuel-rec', fuzzy: true })
  const isCipherActive = !!matchRoute({ to: '/cipher', fuzzy: true })
  const isInventoryActive = !!matchRoute({ to: '/inventory', fuzzy: true })
  const isSettingsActive = !!matchRoute({ to: '/settings', fuzzy: true })
  const isHubActive = location.pathname.startsWith('/hub')
  const isIssuesActive = location.pathname.startsWith('/issues')

  const adminTo =
    [
      { path: '/personnel', perm: 'admin.personnel' },
      { path: '/access/resources', perm: 'admin.access' },
      { path: '/assets/devices', perm: 'admin.assets' },
      { path: '/credentials/categories', perm: 'admin.credentials' },
      { path: '/subscriptions/categories', perm: 'admin.subscriptions' },
    ].find((r) => can(r.perm, 'read'))?.path ?? '/personnel'

  const fuelTo =
    [
      { path: '/fuel-invoicing', perm: 'fuel.fuelInvoicing' },
      { path: '/fuel-rec', perm: 'fuel.fuelRec' },
      { path: '/kardpoll', perm: 'fuel.fuelInvoicing' },
    ].find((r) => can(r.perm, 'read'))?.path ?? '/fuel-invoicing'

  const cipherTo =
    [
      { path: '/cipher/lock', perm: 'cipher.lock' },
      { path: '/cipher/unlock', perm: 'cipher.unlock' },
    ].find((r) => can(r.perm, 'read'))?.path ?? '/cipher/lock'

  const inventoryTo =
    [
      {
        path: '/inventory/coremark-initial-order',
        perm: 'inventory.coremarkInitialOrder',
      },
    ].find((r) => can(r.perm, 'read'))?.path ??
    '/inventory/coremark-initial-order'

  const hubTo =
    [
      { path: '/hub/cdn', perm: 'hub.cdn' },
      { path: '/hub/payables', perm: 'hub.payables' },
      { path: '/hub/receivables', perm: 'hub.receivables' },
    ].find((r) => can(r.perm, 'read'))?.path ?? '/hub/cdn'

  const settingsTo =
    [
      { path: '/settings/users', perm: 'settings.users' },
      { path: '/settings/roles', perm: 'settings.roles' },
    ].find((r) => can(r.perm, 'read'))?.path ?? '/settings/users'

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
          {can('admin', 'read') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={adminTo}
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
          )}
          {can('fuel', 'read') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={fuelTo}
                  search={
                    fuelTo === '/fuel-invoicing' ? { selected: '' } : undefined
                  }
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
                  to={cipherTo}
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
                  to={inventoryTo}
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
          {can('issues', 'read') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/issues"
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isIssuesActive && 'bg-accent/80 text-accent-foreground',
                  )}
                >
                  <ClipboardList className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Issues</TooltipContent>
            </Tooltip>
          )}
          {can('hub', 'read') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={hubTo}
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
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSupportOpen(true)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Headset className="h-5 w-5" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Support</TooltipContent>
            </Tooltip>
            {can('settings', 'read') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={settingsTo}
                    search={
                      settingsTo === '/settings/users'
                        ? { selected: 'users' }
                        : undefined
                    }
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                      isSettingsActive && 'bg-accent/80 text-accent-foreground',
                    )}
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
      <SupportPanel
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        chatList={chatList}
        updateChatStatus={updateChatStatus}
      />
    </div>
  )
}
