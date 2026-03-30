import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/_admin/_sidebar/site-assets/')({
  component: () => null,
  beforeLoad: () => {
    throw redirect({ to: '/site-assets/list' })
  },
})
