import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/_sidebar/academy/courses')({
  component: () => <Outlet />,
})
