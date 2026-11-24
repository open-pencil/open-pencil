import { describe, expect, test } from 'bun:test'

import { pairingPathFor } from '@/app/cloud-portal/pairing'

describe('pairing from a sign-in', () => {
  test('keeps the signed request', () => {
    expect(pairingPathFor('/auth/authorize?client_id=a&sig=b')).toBe('/auth/pair?client_id=a&sig=b')
  })

  test('is for an app asking to connect alone', () => {
    expect(pairingPathFor('/auth/authorize')).toBeNull()
    expect(pairingPathFor('/auth/device?user_code=a')).toBeNull()
    expect(pairingPathFor('/account')).toBeNull()
  })
})
