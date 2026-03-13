import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/_sidebar/hub')({
  component: () => <Outlet />,
})
