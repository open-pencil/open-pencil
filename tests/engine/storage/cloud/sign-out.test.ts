import { expect, test } from 'bun:test'

import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { signOutCloudSession } from '@/app/cloud/sessions/sign-out'

const discovery: CloudDiscovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://cloud.example/api',
  authURL: 'https://cloud.example/api/auth',
  authentication: { socialProviders: [], enterpriseSSO: false, enrollmentMode: 'open' },
  capabilities: { documents: true, workspaces: true, collaboration: true }
}

test('sign-out revokes using the owning profile credential before clearing it', async () => {
  const operations: string[] = []
  await signOutCloudSession(discovery, 'instance-a', {
    resolve: async (id) => {
      expect(id).toBe('instance-a')
      return 'bearer-token'
    },
    revoke: async (instance, options) => {
      expect(instance).toBe(discovery)
      expect(options?.accessToken).toBe('bearer-token')
      operations.push('revoke')
    },
    clear: async (id) => {
      expect(id).toBe('instance-a')
      operations.push('clear')
    }
  })
  expect(operations).toEqual(['revoke', 'clear'])
})

test('failed remote revocation retains the credential for retry', async () => {
  let cleared = false
  await expect(
    signOutCloudSession(discovery, 'instance-a', {
      resolve: async () => 'token',
      revoke: async () => {
        throw new Error('Offline')
      },
      clear: async () => {
        cleared = true
      }
    })
  ).rejects.toThrow('Offline')
  expect(cleared).toBe(false)
})

test('browser cookie session can be revoked without a stored bearer token', async () => {
  let revoked = false
  await signOutCloudSession(discovery, 'instance-a', {
    resolve: async () => null,
    revoke: async (_instance, options) => {
      expect(options?.accessToken).toBeUndefined()
      revoked = true
    },
    clear: async () => undefined
  })
  expect(revoked).toBe(true)
})
