import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_appbar/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full items-center justify-center">
      <h1 className="text-6xl font-bold text-muted-foreground">Desk App</h1>
    </div>
  )
}
