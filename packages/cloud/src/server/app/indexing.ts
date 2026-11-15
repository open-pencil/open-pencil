import { CLOUD_DISCOVERY_PATH } from '#cloud/contract'

export function shouldPreventIndexing(path: string, policy: 'allow' | 'deny'): boolean {
  return (
    policy === 'deny' ||
    path.startsWith('/api/') ||
    path.startsWith('/admin') ||
    path.startsWith('/auth') ||
    path.startsWith('/account') ||
    path === '/app' ||
    path === '/sign-in' ||
    path === '/sign-up' ||
    path === '/join' ||
    path === CLOUD_DISCOVERY_PATH ||
    // A community document in the editor; its page at `/community/:id` is the one to index.
    /^\/community\/[^/]+\/open\/?$/.test(path)
  )
}

export function withIndexingPolicy(
  response: Response,
  path: string,
  policy: 'allow' | 'deny'
): Response {
  if (!shouldPreventIndexing(path, policy)) return response
  const headers = new Headers(response.headers)
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/** What `/robots.txt` answers: everything closed, or only the server's own pages and API. */
export function robotsText(policy: 'allow' | 'deny'): string {
  return policy === 'deny'
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /app\nDisallow: /api\nDisallow: /auth\nDisallow: /sign-in\nDisallow: /sign-up\nDisallow: /join\nDisallow: /.well-known\n'
}
