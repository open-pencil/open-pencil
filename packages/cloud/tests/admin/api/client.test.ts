import { describe, expect, test } from 'bun:test'

import { createCloudAdminAPIClient } from '#admin/api/client'

describe('Cloud admin API client', () => {
  test('validates successful response bodies', async () => {
    const client = createCloudAdminAPIClient({
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
    const client = createCloudAdminAPIClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => Response.json({ state: 'unknown' })
    })
    await expect(client.accountStatus()).rejects.toMatchObject({ kind: 'protocol' })
  })

  test('preserves stable domain and authorization errors', async () => {
    const forbidden = createCloudAdminAPIClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => Response.json({}, { status: 403 })
    })
    await expect(forbidden.session()).rejects.toEqual(
      expect.objectContaining({ kind: 'authorization-required' })
    )
    const domain = createCloudAdminAPIClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => Response.json({ error: { code: 'last_admin_required' } }, { status: 400 })
    })
    await expect(domain.setAdmin('user', false)).rejects.toMatchObject({
      kind: 'domain',
      code: 'last_admin_required'
    })
  })
})
