import { afterEach, describe, expect, test } from 'bun:test'

import { addCloudServer, cloudServers, removeCloudServer } from '@/app/cloud/servers/store'
import { cloudConnections, type CloudSessionState } from '@/app/cloud/sessions/connection'
import { homeLocation } from '@/app/home/location'
import { useHomeLocations } from '@/app/home/locations'

afterEach(() => {
  for (const server of cloudServers.value) removeCloudServer(server.id)
  cloudConnections.value = {}
  homeLocation.value = { kind: 'recent' }
})

/** The server Home shows, as far as Cloud has said: `checking` until its session is read. */
function connect(serverId: string, state: CloudSessionState) {
  cloudConnections.value = {
    [serverId]: { state, discovery: null, account: null, workspaces: [], failure: null }
  }
}

describe('Home locations', () => {
  test('keep a chosen workspace while Cloud checks the session, rather than show Recent', async () => {
    const server = await addCloudServer({ kind: 'self-hosted', url: 'design.acme.example' })
    homeLocation.value = { kind: 'workspace', id: 'design-team' }
    connect(server.id, 'checking')
    const places = useHomeLocations()

    expect(places.checking.value).toBe(true)
    expect(places.settling.value).toBe(true)
    expect(places.location.value).toEqual({ kind: 'workspace', id: 'design-team' })

    // Signed out after all: the workspace is out of reach, so Home shows Recent.
    connect(server.id, 'signed-out')
    expect(places.checking.value).toBe(false)
    expect(places.settling.value).toBe(false)
    expect(places.location.value).toEqual({ kind: 'recent' })
  })

  test('show Recent and storage at once, since neither needs the session', async () => {
    const server = await addCloudServer({ kind: 'self-hosted', url: 'design.acme.example' })
    connect(server.id, 'checking')
    const places = useHomeLocations()
    for (const chosen of [{ kind: 'recent' }, { kind: 'storage' }] as const) {
      homeLocation.value = chosen
      expect(places.settling.value).toBe(false)
      expect(places.location.value).toEqual(chosen)
    }
  })
})
