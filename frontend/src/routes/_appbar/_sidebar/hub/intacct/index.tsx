import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/_sidebar/hub/intacct/')({
  beforeLoad: () => {
    throw redirect({ to: '/hub/intacct/ar-entries' })
  },
})
