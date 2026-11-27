/**
 * The browser's user agent, which tells setup which platform's install commands to show. The
 * argument is injectable for testing; it is empty in non-browser contexts such as headless tests.
 */
export function detectUserAgent(): string {
  const ua = typeof navigator === 'undefined' ? undefined : navigator.userAgent
  return typeof ua === 'string' ? ua : ''
}
