import type { MetricsSnapshot } from '#feedback/contract'
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose'

import type { TestService } from './harness'

/** The Access team and application `tests/harness.ts` configures the service with. */
export const ACCESS_TEAM = 'https://openpencil.cloudflareaccess.com'
export const ACCESS_AUDIENCE = 'admin-audience'

/**
 * Publishes a fresh signing key as the team's Access certificates, so tokens it signs pass
 * `requireAccess`; the stranger key signs tokens Cloudflare never issued.
 */
export async function trustAccessKey(service: TestService) {
  const current = await generateKeyPair('RS256')
  const strangerKey = (await generateKeyPair('RS256')).privateKey
  const publicKey = { ...(await exportJWK(current.publicKey)), kid: 'current', alg: 'RS256' }
  service.respond(`${ACCESS_TEAM}/cdn-cgi/access/certs`, () => Response.json({ keys: [publicKey] }))
  return { signingKey: current.privateKey, strangerKey }
}

/** An Access token as Cloudflare would issue it, signed with `key`; `expiresIn` null leaves `exp` out. */
export function signAccessToken(
  key: CryptoKey,
  now: Date,
  claims: { aud?: string; iss?: string; expiresIn?: number | null } = {}
) {
  const seconds = Math.floor(now.getTime() / 1000)
  const token = new SignJWT({ email: 'dan@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'current' })
    .setIssuer(claims.iss ?? ACCESS_TEAM)
    .setAudience(claims.aud ?? ACCESS_AUDIENCE)
    .setIssuedAt(seconds - 7200)
  const expiresIn = claims.expiresIn === undefined ? 3600 : claims.expiresIn
  return (expiresIn === null ? token : token.setExpirationTime(seconds + expiresIn)).sign(key)
}

/** The metrics snapshot for a range through the typed client, signed in as the dashboard is. */
export async function requestSnapshot(
  service: TestService,
  key: CryptoKey,
  now: Date,
  start: string,
  end: string
): Promise<MetricsSnapshot> {
  const response = await service.client.admin.api.snapshot.$get(
    { query: { start, end } },
    { headers: { 'cf-access-jwt-assertion': await signAccessToken(key, now) } }
  )
  if (response.status !== 200) throw new Error(`The snapshot answered ${response.status}`)
  return response.json()
}
