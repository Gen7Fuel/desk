import { createFileRoute, redirect } from '@tanstack/react-router'
import { can } from '@/lib/permissions'

export const Route = createFileRoute('/_appbar/_sidebar/hub/payables')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.payables', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Payables — coming soon
    </div>
  )
}
