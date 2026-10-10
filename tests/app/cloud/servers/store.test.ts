import { afterEach, describe, expect, test } from 'bun:test'

import { normalizeCloudServerURL } from '@/app/cloud/servers/address'
import {
  addCloudServer,
  cloudServers,
  homeCloudServer,
  removeCloudServer,
  showCloudServerOnHome
} from '@/app/cloud/servers/store'
import { OFFICIAL_CLOUD_URL } from '@/constants'

afterEach(() => {
  for (const server of cloudServers.value) removeCloudServer(server.id)
})

describe('Cloud server addresses', () => {
  test('read what people type as the server’s canonical address', () => {
    expect(normalizeCloudServerURL('cloud.example.com')).toBe('https://cloud.example.com')
    expect(normalizeCloudServerURL(' https://cloud.example.com/ ')).toBe(
      'https://cloud.example.com'
    )
    expect(normalizeCloudServerURL('http://localhost:8787/?x=1#y')).toBe('http://localhost:8787')
  })

  test('refuse what cannot be a server', () => {
    for (const input of ['', 'ftp://cloud.example.com', 'https://user:pass@cloud.example.com'])
      expect(normalizeCloudServerURL(input)).toBeNull()
  })
})

describe('Cloud servers', () => {
  test('get the same credential-safe id for the same address', async () => {
    const first = await addCloudServer({ kind: 'self-hosted', url: 'design.acme.example' })
    const again = await addCloudServer({ kind: 'self-hosted', url: 'https://design.acme.example/' })
    expect(again.id).toBe(first.id)
    expect(first.id).toMatch(/^[0-9a-f]{32}$/)
    expect(cloudServers.value).toHaveLength(1)
  })

  test('put the first server on Home and move Home on when it is removed', async () => {
    const official = await addCloudServer({ kind: 'official' })
    const team = await addCloudServer({ kind: 'self-hosted', url: 'design.acme.example' })
    expect(official.url).toBe(OFFICIAL_CLOUD_URL)
    expect(homeCloudServer.value?.id).toBe(official.id)
    showCloudServerOnHome(team.id)
    expect(homeCloudServer.value?.id).toBe(team.id)
    removeCloudServer(team.id)
    expect(homeCloudServer.value?.id).toBe(official.id)
  })

  test('reject an address that cannot be a server', async () => {
    await expect(addCloudServer({ kind: 'self-hosted', url: 'ftp://nope' })).rejects.toThrow()
  })
})
