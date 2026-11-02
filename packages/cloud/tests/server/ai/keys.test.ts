import { describe, expect, test } from 'bun:test'

import { CloudConfigError, loadAISigningKey } from '#cloud/server'
import { exportPKCS8, generateKeyPair } from 'jose'

async function pkcs8(algorithm: 'ES256' | 'ES384') {
  const { privateKey } = await generateKeyPair(algorithm, { extractable: true })
  return exportPKCS8(privateKey)
}

describe('AI signing key', () => {
  test('a P-256 key loads with a thumbprint kid', async () => {
    const key = await loadAISigningKey({ aiSigningKey: await pkcs8('ES256') })
    expect(key?.publicJWK).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' })
    expect(key?.publicJWK.kid).toBeString()
    expect(key?.publicJWK).not.toHaveProperty('d')
  })

  test('a deployment without a key loads none', async () => {
    expect(await loadAISigningKey({})).toBeUndefined()
  })

  test('text that is not a P-256 key stops startup', async () => {
    for (const aiSigningKey of ['signing-key-pem', await pkcs8('ES384')]) {
      const loading = loadAISigningKey({ aiSigningKey })
      expect(loading).rejects.toBeInstanceOf(CloudConfigError)
      await expect(loading).rejects.toThrow('PKCS #8 P-256')
    }
  })
})
