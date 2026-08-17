import { IS_BROWSER, WEB_APP_ORIGIN } from '@/constants'

/** Origins OpenPencil may run from when calling S3 from the browser. */
export const CLOUD_CORS_STATIC_ORIGINS = [
  // Exact production origin — providers without partial-wildcard support
  // (e.g. R2) need it verbatim even when CORS is configured from dev.
  WEB_APP_ORIGIN,
  // Wildcards: any openpencil.dev subdomain (staging, demo, …), Cloudflare
  // Pages PR previews, and any local dev port. S3/B2 allow one '*' per origin.
  // collectCloudCORSOrigins() also appends the current origin, so strict
  // providers still get an exact match for wherever the app is running when
  // CORS is applied.
  'https://*.openpencil.dev',
  'https://*.openpencil-app.pages.dev',
  'http://localhost:*',
  'http://127.0.0.1:*'
] as const

export function collectCloudCORSOrigins(extra?: string | null): string[] {
  const set = new Set<string>(CLOUD_CORS_STATIC_ORIGINS)
  if (extra?.trim()) set.add(extra.trim().replace(/\/+$/, ''))
  if (IS_BROWSER && window.location.origin) {
    set.add(window.location.origin)
  }
  return [...set].filter(Boolean).sort()
}

function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** S3 PutBucketCors XML body (AWS + B2 S3-compatible). */
export function buildCORSConfigurationXML(origins: string[]): string {
  const originTags = origins
    .map((origin) => `    <AllowedOrigin>${escapeXML(origin)}</AllowedOrigin>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
${originTags}
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-amz-request-id</ExposeHeader>
    <ExposeHeader>x-amz-id-2</ExposeHeader>
    <ExposeHeader>x-amz-version-id</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
`
}

/** AWS console / CLI JSON CORS document (copy-paste friendly). */
export function buildCORSConfigurationJSON(origins: string[]): string {
  return JSON.stringify(
    [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedOrigins: origins,
        ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-id-2', 'x-amz-version-id'],
        MaxAgeSeconds: 3600
      }
    ],
    null,
    2
  )
}

export class CloudCORSError extends Error {
  readonly kind = 'cors' as const

  constructor(message: string) {
    super(message)
    this.name = 'CloudCORSError'
  }
}

/** Best-effort detection of browser CORS / network blocks (preflight failures). */
export function isLikelyCORSOrNetworkError(error: unknown): boolean {
  if (error instanceof CloudCORSError) return true
  if (error instanceof TypeError) return true
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('cors') ||
    msg.includes('access-control') ||
    msg.includes('blocked by cors')
  )
}

export function formatBrowserCORSHelpMessage(): string {
  const origin = IS_BROWSER ? window.location.origin : WEB_APP_ORIGIN
  return (
    `The browser could not reach this bucket from ${origin}. ` +
    'Your bucket may not allow requests from this site, or the endpoint may be unavailable. ' +
    'Add this site to the bucket’s allowed CORS origins, then try again.'
  )
}
