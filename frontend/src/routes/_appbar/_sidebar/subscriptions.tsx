import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/_sidebar/subscriptions')({
  component: () => <Outlet />,
})
