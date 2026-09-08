import { describe, expect, test } from 'bun:test'

import {
  capabilityHashMatches,
  decryptContinuationToken,
  encryptContinuationToken,
  hashCapability
} from '@open-pencil/cloud/server'

const secret = 'continuation-test-secret-at-least-32-characters'

describe('sharing crypto', () => {
  test('hashes capability values and compares malformed values safely', () => {
    const digest = hashCapability('secret-value')
    expect(digest).toHaveLength(64)
    expect(capabilityHashMatches(digest, 'secret-value')).toBe(true)
    expect(capabilityHashMatches(digest, 'other-value')).toBe(false)
    expect(capabilityHashMatches('invalid-hex', 'secret-value')).toBe(false)
  })

  test('uses standard compact JWE and rejects tampered envelopes', async () => {
    const encrypted = await encryptContinuationToken(secret, 'invitation-token')
    expect(encrypted.split('.')).toHaveLength(5)
    expect(await decryptContinuationToken(secret, encrypted)).toBe('invitation-token')
    const parts = encrypted.split('.')
    const tag = parts[4] ?? ''
    const replacement = tag.startsWith('A') ? 'B' : 'A'
    parts[4] = `${replacement}${tag.slice(1)}`
    await expect(decryptContinuationToken(secret, parts.join('.'))).rejects.toThrow()
  })
})
