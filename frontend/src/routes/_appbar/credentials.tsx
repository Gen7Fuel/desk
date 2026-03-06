import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/credentials')({
  beforeLoad: () => {
    throw redirect({ to: '/credentials/list' })
  },
  component: () => null,
})

