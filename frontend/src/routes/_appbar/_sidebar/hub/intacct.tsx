import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SidebarNavLinks } from '@/components/sidebar'

const intacctLinks = [
  { label: 'AR Entries', path: '/hub/intacct/ar-entries' },
]

export const Route = createFileRoute('/_appbar/_sidebar/hub/intacct')({
  component: RouteComponent,
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('hub.intacct', 'read')) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  return (
    <div className="flex h-full">
      <SidebarNavLinks links={intacctLinks} />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
