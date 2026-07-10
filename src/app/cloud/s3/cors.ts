import { IS_BROWSER, WEB_APP_ORIGIN } from '@/constants'
import { isTauri } from '@/app/tauri/env'
import { createAwsClient, normalizeEndpointForCors, S3HttpError } from '@/app/cloud/s3/client'
import { cloudFetch } from '@/app/cloud/s3/fetch'
import type { S3CompatibleConfig } from '@/app/cloud/types'

/** Origins OpenPencil may run from when calling S3 from the browser. */
export const CLOUD_CORS_STATIC_ORIGINS = [
  WEB_APP_ORIGIN,
  'http://localhost:1420',
  'http://127.0.0.1:1420',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
] as const

export function collectCloudCorsOrigins(extra?: string | null): string[] {
  const set = new Set<string>(CLOUD_CORS_STATIC_ORIGINS)
  if (extra?.trim()) set.add(extra.trim().replace(/\/+$/, ''))
  if (IS_BROWSER && window.location?.origin) {
    set.add(window.location.origin)
  }
  return [...set].filter(Boolean).sort()
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** S3 PutBucketCors XML body (AWS + B2 S3-compatible). */
export function buildCorsConfigurationXml(origins: string[]): string {
  const originTags = origins
    .map((origin) => `    <AllowedOrigin>${escapeXml(origin)}</AllowedOrigin>`)
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
export function buildCorsConfigurationJson(origins: string[]): string {
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

export class CloudCorsError extends Error {
  readonly kind = 'cors' as const

  constructor(message: string) {
    super(message)
    this.name = 'CloudCorsError'
  }
}

/** Best-effort detection of browser CORS / network blocks (preflight failures). */
export function isLikelyCorsOrNetworkError(error: unknown): boolean {
  if (error instanceof CloudCorsError) return true
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

export function formatBrowserCorsHelpMessage(): string {
  return (
    'CORS issue: the browser blocked access to your bucket. ' +
    'OpenPencil tried to set CORS automatically but could not from the web app ' +
    '(the bucket must already allow this site, or use the desktop app once). ' +
    'Click “Copy CORS JSON”, paste it into your bucket CORS settings, wait ~1 minute, then try again.'
  )
}

/**
 * Apply recommended CORS via S3 PutBucketCors — same operation as AWS CLI put-bucket-cors.
 * - Desktop: always works (no browser CORS on the request itself).
 * - Web: only works if the bucket already allows this origin for PUT, or CORS was set externally.
 */
export async function putBucketCors(
  config: S3CompatibleConfig,
  origins: string[] = collectCloudCorsOrigins()
): Promise<void> {
  const base = normalizeEndpointForCors(config.endpoint)
  const url = `${base}/${encodeURIComponent(config.bucket)}?cors`
  const body = buildCorsConfigurationXml(origins)
  const client = createAwsClient(config)
  let signed: Request
  try {
    signed = await client.sign(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xml'
      },
      body,
      credentials: 'omit'
    })
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }

  let res: Response
  try {
    res = await cloudFetch(signed)
  } catch (error) {
    if (isLikelyCorsOrNetworkError(error)) {
      throw new CloudCorsError(
        isTauri()
          ? 'Network error while applying bucket CORS.'
          : 'Could not apply CORS from the browser (preflight blocked). Use Copy CORS JSON or the desktop app.'
      )
    }
    throw error instanceof Error ? error : new Error(String(error))
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 403 || res.status === 401) {
      throw new S3HttpError(
        res.status,
        'Access key cannot update bucket CORS. Grant bucket write / PutBucketCors permission.'
      )
    }
    throw new S3HttpError(
      res.status,
      text.trim().slice(0, 200) || `PutBucketCors failed with status ${res.status}`
    )
  }
}

export type EnsureCorsResult = {
  applied: boolean
  error: string | null
}

/**
 * Always attempt PutBucketCors (automatic CORS setup for the web app origins).
 * Returns whether it worked; never throws.
 */
export async function ensureWebCorsOnBucket(config: S3CompatibleConfig): Promise<EnsureCorsResult> {
  const origins = collectCloudCorsOrigins()
  try {
    await putBucketCors(config, origins)
    return { applied: true, error: null }
  } catch (error) {
    return {
      applied: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
