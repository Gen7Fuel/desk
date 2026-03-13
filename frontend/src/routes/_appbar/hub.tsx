import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/hub')({
  beforeLoad: () => {
    throw redirect({ to: '/hub/cdn' })
  },
  component: () => null,
})
