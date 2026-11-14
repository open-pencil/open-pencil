import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { fetchStub } from '@open-pencil/test-support/fetch'

import { addCloudServer, cloudServers, removeCloudServer } from '@/app/cloud/servers/store'
import {
  checkedCloudConnection,
  cloudServerFetch,
  refreshCloudConnection
} from '@/app/cloud/sessions/connection'
import { cloudServerNeedingUpdate } from '@/app/cloud/sessions/update'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'

const user = { userId: 'user-1', email: 'ada@example.com', name: 'Ada' }
/** The server's minimum editor version, as its discovery says now. */
let minimum: string | undefined

beforeEach(() => {
  minimum = undefined
  spyOn(globalThis, 'fetch').mockImplementation(
    fetchStub(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.pathname === '/.well-known/openpencil') {
        return Response.json({
          ...cloudDiscoveryFixture(url.origin),
          ...(minimum ? { minimumEditorVersion: minimum } : {})
        })
      }
      if (url.pathname === '/api/account/status') {
        return Response.json({ user, state: 'active' })
      }
      if (url.pathname === '/api/workspaces') return Response.json({ workspaces: [] })
      // Any other request comes from an editor the server now refuses.
      return Response.json({ error: { code: 'editor_outdated' } }, { status: 426 })
    })
  )
})

afterEach(() => {
  for (const server of cloudServers.value) removeCloudServer(server.id)
})

describe('Cloud servers that need a newer editor', () => {
  test('a server whose minimum is above this editor asks for an update', async () => {
    minimum = '999.0.0'
    const server = await addCloudServer({ kind: 'self-hosted', url: 'https://gated.example.com' })
    const connection = await refreshCloudConnection(server)
    expect(connection.failure).toBe('editor-outdated')
    expect(cloudServerNeedingUpdate.value?.id).toBe(server.id)
  })

  test('a refusal mid-session asks the server again and then asks for an update', async () => {
    const server = await addCloudServer({ kind: 'self-hosted', url: 'https://raised.example.com' })
    expect((await refreshCloudConnection(server)).state).toBe('signed-in')
    expect(cloudServerNeedingUpdate.value).toBeNull()

    minimum = '999.0.0'
    const response = await cloudServerFetch(server.id)('https://raised.example.com/api/documents')
    expect(response.status).toBe(426)
    // The refusal started a new check; waiting for it reads its answer.
    expect((await checkedCloudConnection(server)).failure).toBe('editor-outdated')
    expect(cloudServerNeedingUpdate.value?.id).toBe(server.id)
  })

  test('a refusal while the server is asked again starts no other check', async () => {
    const server = await addCloudServer({ kind: 'self-hosted', url: 'https://rolling.example.com' })
    let discoveries = 0
    spyOn(globalThis, 'fetch').mockImplementation(
      fetchStub(async (input) => {
        const url = new URL(input instanceof Request ? input.url : String(input))
        if (url.pathname === '/.well-known/openpencil') {
          discoveries += 1
          return Response.json(cloudDiscoveryFixture(url.origin))
        }
        // Discovery still accepts the editor, but every account request refuses it.
        return Response.json({ error: { code: 'editor_outdated' } }, { status: 426 })
      })
    )
    await cloudServerFetch(server.id)('https://rolling.example.com/api/documents')
    await checkedCloudConnection(server)
    expect(discoveries).toBe(1)
  })
})
