import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { CreditCard, Fuel, KeyRound, LayoutGrid, Lock, MonitorSmartphone, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const Route = createFileRoute('/_appbar')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute()
  const isPersonnelActive = !!matchRoute({ to: '/personnel', fuzzy: true })
  const isAccessActive = !!matchRoute({ to: '/access', fuzzy: true })
  const isAssetsActive = !!matchRoute({ to: '/assets', fuzzy: true })
  const isCredentialsActive = !!matchRoute({ to: '/credentials', fuzzy: true })
  const isSubscriptionsActive = !!matchRoute({ to: '/subscriptions', fuzzy: true })
  const isFuelActive = !!matchRoute({ to: '/fuel-invoicing', fuzzy: true })

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
                  isPersonnelActive && 'bg-accent/80 text-accent-foreground',
                )}
              >
                <User className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Personnel</TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/credentials"
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/subscriptions"
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/fuel-invoicing"
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
        </TooltipProvider>
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
