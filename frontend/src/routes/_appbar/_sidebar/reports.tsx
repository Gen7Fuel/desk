import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { can } from '@/lib/permissions'

export const Route = createFileRoute('/_appbar/_sidebar/reports')({
  beforeLoad: () => {
    if (typeof window !== 'undefined' && !can('reports', 'read')) {
      throw redirect({ to: '/' })
    }
  },
  component: () => <Outlet />,
})
