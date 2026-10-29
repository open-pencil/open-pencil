import { describe, expect, test } from 'bun:test'

import { createDocumentShareSchema, updateDocumentShareSchema } from '#cloud/contract'
import * as v from 'valibot'

describe('document share contract', () => {
  test('accepts an ISO expiry or none', () => {
    for (const expiresAt of ['2026-10-18T12:00:00.000Z', null, undefined]) {
      expect(
        v.safeParse(createDocumentShareSchema, { permission: 'view', expiresAt }).success
      ).toBe(true)
      expect(v.safeParse(updateDocumentShareSchema, { expiresAt }).success).toBe(true)
    }
  })

  test('rejects an expiry that is not a timestamp', () => {
    for (const expiresAt of ['tomorrow', '', '2026-13-40']) {
      expect(
        v.safeParse(createDocumentShareSchema, { permission: 'view', expiresAt }).success
      ).toBe(false)
      expect(v.safeParse(updateDocumentShareSchema, { expiresAt }).success).toBe(false)
    }
  })
})
