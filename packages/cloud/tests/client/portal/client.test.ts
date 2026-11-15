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
    const refused = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => Response.json({ error: { code: 'forbidden' } }, { status: 403 })
    })
    await expect(refused.users({})).rejects.toMatchObject({ kind: 'authorization-required' })
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

  test('sends typed requests to the server routes', async () => {
    const requests: Array<{
      url: string
      method: string
      body: string | null
      credentials?: string
    }> = []
    const client = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      async fetch(input, init) {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? init.body : null,
          credentials: init?.credentials
        })
        return Response.json({ ok: true })
      }
    })
    await client.setAdmin('user-id', true)
    await client.userAction('revoke-sessions', 'user-id')
    expect(requests).toEqual([
      {
        url: 'https://cloud.example.com/api/admin/users/set-admin',
        method: 'POST',
        body: JSON.stringify({ userId: 'user-id', enabled: true }),
        credentials: 'include'
      },
      {
        url: 'https://cloud.example.com/api/admin/users/revoke-sessions',
        method: 'POST',
        body: JSON.stringify({ userId: 'user-id' }),
        credentials: 'include'
      }
    ])
    requests.length = 0
    await client.enrollments({ filter: 'pending' }).catch(() => undefined)
    await client.users({ search: 'ada' }).catch(() => undefined)
    await client.accountStatus().catch(() => undefined)
    expect(requests.map((request) => request.url)).toEqual([
      'https://cloud.example.com/api/admin/enrollments?filter=pending',
      'https://cloud.example.com/api/admin/users?search=ada',
      'https://cloud.example.com/api/account/status'
    ])
  })

  test('reports transport failures by kind', async () => {
    const offline = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      }
    })
    await expect(offline.operations()).rejects.toMatchObject({ kind: 'network' })

    const controller = new AbortController()
    controller.abort()
    const waiting = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
          if (init?.signal?.aborted) reject(init.signal.reason)
        }),
      timeoutMs: 10
    })
    await expect(waiting.operations(controller.signal)).rejects.toMatchObject({ kind: 'cancelled' })
    await expect(waiting.operations()).rejects.toMatchObject({ kind: 'timeout' })

    const html = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => new Response('<html>Bad gateway</html>', { status: 502 })
    })
    await expect(html.operations()).rejects.toMatchObject({ kind: 'protocol' })
    const signedOut = createCloudPortalClient({
      baseURL: 'https://cloud.example.com',
      fetch: async () => Response.json({}, { status: 401 })
    })
    await expect(signedOut.accountStatus()).rejects.toMatchObject({
      kind: 'authentication-required'
    })
  })
})
