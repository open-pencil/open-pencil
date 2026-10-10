import { describe, expect, test } from 'bun:test'

import { createCloudPortalClient } from '#cloud/client'

describe('Cloud portal client', () => {
  test('validates successful response bodies', async () => {
    const client = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () =>
        Response.json({
          user: {
            userId: 'user-id',
            email: 'person@example.com',
            name: 'Person',
            deploymentRole: 'user'
          },
          state: 'pending'
        })
    })
    await expect(client.accountStatus()).resolves.toEqual({
      user: {
        userId: 'user-id',
        email: 'person@example.com',
        name: 'Person',
        deploymentRole: 'user'
      },
      state: 'pending'
    })
  })

  test('rejects malformed success bodies as protocol errors', async () => {
    const client = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => Response.json({ state: 'unknown' })
    })
    await expect(client.accountStatus()).rejects.toMatchObject({ kind: 'protocol' })
  })

  test('preserves stable domain and authorization errors', async () => {
    const forbidden = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => Response.json({}, { status: 403 })
    })
    await expect(forbidden.session()).rejects.toEqual(
      expect.objectContaining({ kind: 'authorization-required' })
    )
    const domain = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => Response.json({ error: { code: 'last_admin_required' } }, { status: 400 })
    })
    await expect(domain.setAdmin('user', false)).rejects.toMatchObject({
      kind: 'domain',
      code: 'last_admin_required'
    })
    const account = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () =>
        Response.json({ error: { code: 'last_authentication_method' } }, { status: 400 })
    })
    await expect(account.unlinkAuthenticationMethod('method')).rejects.toMatchObject({
      kind: 'domain',
      code: 'last_authentication_method'
    })
  })
})
