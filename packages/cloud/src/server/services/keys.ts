import { CloudConfigError, type CloudServerConfig } from '#cloud/server/config/schema'
import { calculateJwkThumbprint, exportJWK, importPKCS8, type JWK } from 'jose'

const ALGORITHM = 'ES256'

export type ServicesSigningKey = {
  privateKey: CryptoKey
  /** The public half, as published in the JWKS. */
  publicJWK: JWK & { kid: string }
}

/**
 * Imports the P-256 key that signs service tokens. Its `kid` is the public key's thumbprint,
 * so replacing the key changes the `kid`, and a service that caches the JWKS refetches it on the
 * first token it cannot match. Tokens the old key signed fail once and are re-requested.
 */
export async function importServicesSigningKey(pem: string): Promise<ServicesSigningKey> {
  const privateKey = await importPKCS8(pem, ALGORITHM, { extractable: true })
  const { kty, crv, x, y } = await exportJWK(privateKey)
  const publicJWK = { kty, crv, x, y }
  const kid = await calculateJwkThumbprint(publicJWK)
  return {
    privateKey: await importPKCS8(pem, ALGORITHM),
    publicJWK: { ...publicJWK, kid, alg: ALGORITHM, use: 'sig' }
  }
}

/**
 * Imports the configured signing key at startup, so a key that cannot sign stops the runtime
 * instead of failing every token request after discovery has advertised services.
 */
export async function loadServicesSigningKey(
  config: Pick<CloudServerConfig, 'servicesSigningKey'>
): Promise<ServicesSigningKey | undefined> {
  if (!config.servicesSigningKey) return undefined
  try {
    return await importServicesSigningKey(config.servicesSigningKey)
  } catch {
    throw new CloudConfigError('AI signing key must be a PKCS #8 P-256 private key')
  }
}

export const SERVICES_SIGNING_ALGORITHM = ALGORITHM
