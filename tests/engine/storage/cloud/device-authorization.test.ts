import { expect, test } from 'bun:test'

import { CloudDeviceAuthorizationError } from '@open-pencil/cloud/client'
import type { CloudDeviceAuthorization } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import {
  createDeviceAuthorizationSession,
  type DeviceAuthorizationDependencies
} from '@/app/cloud/sessions/device-authorization'

const discovery: CloudDiscovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://cloud.example/api',
  authURL: 'https://cloud.example/api/auth',
  authentication: { socialProviders: [], enterpriseSSO: false, enrollmentMode: 'open' },
  capabilities: { documents: true, workspaces: true, collaboration: true }
}
const profile = {
  id: 'instance',
  kind: 'self-hosted' as const,
  serverURL: 'https://cloud.example',
  label: 'Instance',
  selectedWorkspaceId: null
}
const authorization: CloudDeviceAuthorization = {
  device_code: 'device',
  user_code: 'CODE',
  verification_uri: 'https://cloud.example/cloud/device',
  verification_uri_complete: 'https://cloud.example/cloud/device?user_code=CODE',
  expires_in: 600,
  interval: 5
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}
function fixture(overrides: Partial<DeviceAuthorizationDependencies> = {}) {
  const tokens = new Map<string, string>()
  const opened: string[] = []
  const dependencies: DeviceAuthorizationDependencies = {
    request: async () => authorization,
    poll: async () => ({
      access_token: 'token',
      token_type: 'Bearer',
      expires_in: 600,
      scope: 'openid'
    }),
    open: async (url) => {
      opened.push(url)
    },
    save: async (id, token) => {
      tokens.set(id, token)
    },
    clear: async (id) => {
      tokens.delete(id)
    },
    ...overrides
  }
  return { tokens, opened, session: createDeviceAuthorizationSession(dependencies) }
}

test('protocol codes determine failure state, never English message substrings', async () => {
  const denied = fixture({
    poll: async () => {
      throw new CloudDeviceAuthorizationError('denied')
    }
  })
  expect(await denied.session.authorize(discovery, profile)).toBe(false)
  expect(denied.session.state.value[profile.id]).toEqual({ status: 'denied' })
  const unknown = fixture({
    poll: async () => {
      throw new Error('expired denied private server detail')
    }
  })
  expect(await unknown.session.authorize(discovery, profile)).toBe(false)
  expect(unknown.session.state.value[profile.id]).toEqual({
    status: 'error',
    code: 'authorizationFailed'
  })
})

test('cancelling a delayed code request never opens the browser or saves a token', async () => {
  const request = deferred<CloudDeviceAuthorization>()
  const { session, opened, tokens } = fixture({ request: () => request.promise })
  const pending = session.authorize(discovery, profile)
  session.cancel(profile.id)
  request.resolve(authorization)
  expect(await pending).toBe(false)
  expect(opened).toEqual([])
  expect(tokens.size).toBe(0)
  expect(session.state.value[profile.id]).toEqual({ status: 'idle' })
})

test('cancelling during credential persistence rolls back the saved token', async () => {
  const saving = deferred<undefined>()
  const release = deferred<undefined>()
  const tokens = new Map<string, string>()
  const { session } = fixture({
    save: async (id, token) => {
      saving.resolve(undefined)
      await release.promise
      tokens.set(id, token)
    },
    clear: async (id) => {
      tokens.delete(id)
    }
  })
  const pending = session.authorize(discovery, profile)
  await saving.promise
  session.cancel(profile.id)
  release.resolve(undefined)
  expect(await pending).toBe(false)
  expect(tokens.size).toBe(0)
  expect(session.state.value[profile.id]).toEqual({ status: 'idle' })
})

test('superseding an in-flight save rolls it back before persisting the newer token', async () => {
  const saving = deferred<undefined>()
  const release = deferred<undefined>()
  const operations: string[] = []
  let issued = 0
  const { session } = fixture({
    poll: async () => ({
      access_token: `token-${++issued}`,
      token_type: 'Bearer',
      expires_in: 600,
      scope: 'openid'
    }),
    save: async (_id, token) => {
      if (token === 'token-1') {
        saving.resolve(undefined)
        await release.promise
      }
      operations.push(`save:${token}`)
    },
    clear: async () => {
      operations.push('clear')
    }
  })
  const first = session.authorize(discovery, profile)
  await saving.promise
  const second = session.authorize(discovery, profile)
  release.resolve(undefined)
  expect(await first).toBe(false)
  expect(await second).toBe(true)
  expect(operations).toEqual(['save:token-1', 'clear', 'save:token-2'])
  expect(session.state.value[profile.id]).toEqual({ status: 'authorized' })
})

test('cancelling one instance does not cancel another instance', async () => {
  const firstRequest = deferred<CloudDeviceAuthorization>()
  const { session, tokens } = fixture({
    request: async (_discovery, id) => (id === profile.id ? firstRequest.promise : authorization)
  })
  const first = session.authorize(discovery, profile)
  const other = { ...profile, id: 'other', serverURL: 'https://other.example' }
  expect(await session.authorize(discovery, other)).toBe(true)
  session.cancel(profile.id)
  firstRequest.resolve(authorization)
  expect(await first).toBe(false)
  expect(tokens.get(other.id)).toBe('token')
  expect(session.state.value[other.id]).toEqual({ status: 'authorized' })
})
