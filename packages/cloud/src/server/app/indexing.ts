import {
  CLOUD_DISCOVERY_PATH,
  COMMUNITY_SITEMAP_PATH,
  COMMUNITY_THUMBNAIL_PATH
} from '#cloud/contract'

export function shouldPreventIndexing(path: string, policy: 'allow' | 'deny'): boolean {
  return (
    policy === 'deny' ||
    // Gallery thumbnails are the previews its pages show and link previews fetch.
    (path.startsWith('/api/') && !path.startsWith(`${COMMUNITY_THUMBNAIL_PATH}/`)) ||
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

/**
 * What `/robots.txt` answers: everything closed, or only the server's own pages and API, with the
 * gallery's thumbnails left open for link previews and, where the deployment has a gallery, its
 * sitemap at `origin`.
 */
export function robotsText(policy: 'allow' | 'deny', sitemapOrigin: string | null = null): string {
  if (policy === 'deny') return 'User-agent: *\nDisallow: /\n'
  const rules = [
    'User-agent: *',
    `Allow: ${COMMUNITY_THUMBNAIL_PATH}/`,
    ...['/admin', '/account', '/app', '/api', '/auth', '/sign-in', '/sign-up', '/join'].map(
      (path) => `Disallow: ${path}`
    ),
    'Disallow: /.well-known',
    ...(sitemapOrigin
      ? ['', `Sitemap: ${new URL(COMMUNITY_SITEMAP_PATH, sitemapOrigin).href}`]
      : [])
  ]
  return `${rules.join('\n')}\n`
}
