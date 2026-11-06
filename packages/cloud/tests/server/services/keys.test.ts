import { describe, expect, test } from 'bun:test'

import { CloudConfigError, loadServicesSigningKey } from '#cloud/server'
import { exportPKCS8, generateKeyPair } from 'jose'

async function pkcs8(algorithm: 'ES256' | 'ES384') {
  const { privateKey } = await generateKeyPair(algorithm, { extractable: true })
  return exportPKCS8(privateKey)
}

describe('AI signing key', () => {
  test('a P-256 key loads with a thumbprint kid', async () => {
    const key = await loadServicesSigningKey({ servicesSigningKey: await pkcs8('ES256') })
    expect(key?.publicJWK).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' })
    expect(key?.publicJWK.kid).toBeString()
    expect(key?.publicJWK).not.toHaveProperty('d')
  })

  test('a deployment without a key loads none', async () => {
    expect(await loadServicesSigningKey({})).toBeUndefined()
  })

  test('text that is not a P-256 key stops startup', async () => {
    for (const servicesSigningKey of ['signing-key-pem', await pkcs8('ES384')]) {
      const loading = loadServicesSigningKey({ servicesSigningKey })
      expect(loading).rejects.toBeInstanceOf(CloudConfigError)
      await expect(loading).rejects.toThrow('PKCS #8 P-256')
    }
  })
})
