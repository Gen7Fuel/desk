import { createRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
  })
}
