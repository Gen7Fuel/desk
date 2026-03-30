import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/_admin/_sidebar/site-assets')({
  component: () => <Outlet />,
})
