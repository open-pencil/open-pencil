/**
 * The canonical address of a Cloud server from what a person typed: HTTPS unless they wrote a
 * scheme, no query, fragment, or trailing slash. Null when it cannot be a server address.
 */
export function normalizeCloudServerURL(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname) return null
  if (url.username || url.password) return null
  url.search = ''
  url.hash = ''
  return url.href.replace(/\/+$/, '')
}

/** The host a person recognizes a server by, such as `cloud.example.com`. */
export function cloudServerHost(url: string): string {
  return new URL(url).host
}
