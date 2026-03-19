import { Link, useLocation, useMatchRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SidebarLink {
  label: string
  path: string
}

export function Sidebar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <aside className={cn('flex flex-col border-r bg-background', className)}>
      {children}
    </aside>
  )
}

export function SidebarHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <span className="text-sm font-semibold">{title}</span>
      {action}
    </div>
  )
}

export function SidebarItem({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent',
        active && 'bg-accent/80 text-accent-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function SidebarNavLinks({
  links,
  fuzzy,
}: {
  links: Array<SidebarLink>
  fuzzy?: boolean
}) {
  const matchRoute = useMatchRoute()
  const location = useLocation()

  return (
    <Sidebar className="w-48 gap-1 p-4">
      {links.map((link) => {
        const isActive = fuzzy
          ? location.pathname.startsWith('/' + link.path.split('/')[1])
          : !!matchRoute({ to: link.path })
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
    </Sidebar>
  )
}
