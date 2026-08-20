import type { CloudDiscovery } from '#cloud/contract'
import * as v from 'valibot'

const deviceCodeSchema = v.object({
  device_code: v.string(),
  user_code: v.string(),
  verification_uri: v.pipe(v.string(), v.url()),
  verification_uri_complete: v.pipe(v.string(), v.url()),
  expires_in: v.pipe(v.number(), v.integer(), v.minValue(1)),
  interval: v.pipe(v.number(), v.integer(), v.minValue(1))
})
const deviceTokenSchema = v.object({
  access_token: v.string(),
  token_type: v.literal('Bearer'),
  expires_in: v.pipe(v.number(), v.integer(), v.minValue(1)),
  scope: v.string()
})
const deviceErrorSchema = v.object({ error: v.string(), error_description: v.optional(v.string()) })

export type CloudDeviceAuthorization = v.InferOutput<typeof deviceCodeSchema>
export type CloudDeviceToken = v.InferOutput<typeof deviceTokenSchema>

function authEndpoint(discovery: CloudDiscovery, path: string): string {
  return new URL(path, `${discovery.authURL.replace(/\/$/, '')}/`).href
}

export async function requestCloudDeviceAuthorization(
  discovery: CloudDiscovery,
  connectionId: string
): Promise<CloudDeviceAuthorization> {
  const response = await fetch(authEndpoint(discovery, 'device/code'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: `openpencil-desktop:${connectionId}`,
      scope: 'openid profile'
    })
  })
  if (!response.ok) throw new Error('Cloud device authorization could not be started')
  return v.parse(deviceCodeSchema, await response.json())
}

export async function pollCloudDeviceToken(
  discovery: CloudDiscovery,
  connectionId: string,
  authorization: CloudDeviceAuthorization,
  options: { signal?: AbortSignal; fetch?: typeof globalThis.fetch } = {}
): Promise<CloudDeviceToken> {
  const request = options.fetch ?? globalThis.fetch
  const expiresAt = Date.now() + authorization.expires_in * 1000
  let interval = authorization.interval * 1000
  while (Date.now() < expiresAt) {
    options.signal?.throwIfAborted()
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, interval)
      options.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout)
          reject(options.signal?.reason)
        },
        { once: true }
      )
    })
    const response = await request(authEndpoint(discovery, 'device/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: authorization.device_code,
        client_id: `openpencil-desktop:${connectionId}`
      }),
      signal: options.signal
    })
    const body = await response.json()
    if (response.ok) return v.parse(deviceTokenSchema, body)
    const error = v.parse(deviceErrorSchema, body)
    if (error.error === 'authorization_pending') continue
    if (error.error === 'slow_down') {
      interval += 5000
      continue
    }
    throw new Error(error.error_description ?? error.error)
  }
  throw new Error('Cloud device authorization expired')
}
