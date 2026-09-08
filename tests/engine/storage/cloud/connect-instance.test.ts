import { expect, test } from 'bun:test'

import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { useConnectCloudInstance } from '@/app/cloud/settings/connect-instance/use'

const discovery: CloudDiscovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://instance.example/api',
  authURL: 'https://instance.example/api/auth',
  capabilities: { documents: true, workspaces: true, collaboration: true },
  authentication: { socialProviders: [], enterpriseSSO: false, enrollmentMode: 'open' }
}

test('reset invalidates a discovery request without exposing a late result', async () => {
  const response = Promise.withResolvers<CloudDiscovery>()
  const flow = useConnectCloudInstance(() => response.promise)
  flow.serverURL.value = 'https://instance.example'
  const pending = flow.verify()
  flow.reset()
  response.resolve(discovery)
  await pending
  expect(flow.step.value).toBe('choose-kind')
  expect(flow.discovery.value).toBeNull()
  expect(flow.canConfirm.value).toBe(false)
})

test('invalid addresses never reach discovery', async () => {
  let requests = 0
  const flow = useConnectCloudInstance(async () => {
    requests++
    return discovery
  })
  for (const url of ['invalid', 'http://remote.example', 'https://user:secret@instance.example']) {
    flow.serverURL.value = url
    await flow.verify()
    expect(flow.error.value).toBe('invalid-address')
  }
  expect(requests).toBe(0)
})

test('discovery failures expose typed outcomes without server details', async () => {
  const flow = useConnectCloudInstance(async () => {
    throw new Error('private server details')
  })
  flow.serverURL.value = 'https://instance.example'
  await flow.verify()
  expect(flow.error.value).toBe('unavailable')
  expect(flow.canConfirm.value).toBe(false)
})
