import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { openRoomSession, type RoomSession } from '@/app/collab/session'
import type { Microphone } from '@/app/collab/voice/room'
import { createEditorStore, type EditorStore } from '@/app/editor/session'

import { createMemoryRooms, type MemorySend } from '#tests/helpers/collab/memory-transport'
import { asDouble } from '#tests/helpers/doubles'

const ROOM = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const noSavedCopy = () => ({ whenSynced: Promise.resolve(), destroy: () => undefined })

function microphone(id: string): Microphone {
  return {
    track: asDouble<MediaStreamTrack>({
      id,
      kind: 'audio',
      enabled: true,
      addEventListener: () => undefined
    }),
    stream: asDouble<MediaStream>({ id: `${id}-stream` })
  }
}

async function withCall(
  run: (
    host: RoomSession,
    guest: RoomSession,
    rooms: { settle: () => Promise<void>; sends: () => MemorySend[] }
  ) => Promise<void>
) {
  const rooms = createMemoryRooms()
  const stores: EditorStore[] = []
  const open = (origin: 'shared' | 'joined') => {
    const store = createEditorStore(new SceneGraph())
    stores.push(store)
    return openRoomSession({
      roomId: ROOM,
      store,
      origin,
      joinRoom: rooms.join,
      openSavedCopy: noSavedCopy
    })
  }
  const host = open('shared')
  const guest = open('joined')
  try {
    await rooms.settle()
    await run(host, guest, rooms)
  } finally {
    host.dispose()
    guest.dispose()
    for (const store of stores) store.preparationController.dispose()
  }
}

const sentTracks = (sends: MemorySend[]) => sends.map((send) => send.track.id).toSorted()

describe('room voice calls', () => {
  test('joining, muting, and leaving reach everyone in the room', async () => {
    await withCall(async (host, guest, { settle }) => {
      host.voice.join(false)
      await settle()
      expect(guest.voice.members.value.map((peer) => peer.clientId)).toEqual([
        host.voice.localClientId
      ])
      expect(guest.voice.members.value[0]?.voice?.muted).toBe(false)

      host.voice.setMuted(true)
      await settle()
      expect(guest.voice.members.value[0]?.voice?.muted).toBe(true)

      host.voice.leave()
      await settle()
      expect(guest.voice.members.value).toEqual([])
    })
  })

  test('a microphone reaches only people in the call, and stops when they leave it', async () => {
    await withCall(async (host, guest, { settle, sends }) => {
      host.voice.join(false)
      host.voice.setMicrophone(microphone('host-mic'))
      await settle()
      expect(sends()).toEqual([])

      guest.voice.join(false)
      guest.voice.setMicrophone(microphone('guest-mic'))
      await settle()
      expect(sentTracks(sends())).toEqual(['guest-mic', 'host-mic'])
      expect(host.voice.audio.value.get(guest.voice.localClientId)?.id).toBe('guest-mic')
      expect(guest.voice.audio.value.get(host.voice.localClientId)?.id).toBe('host-mic')

      guest.voice.leave()
      await settle()
      expect(sends()).toEqual([])
      expect(host.voice.audio.value.size).toBe(0)
      expect(guest.voice.audio.value.size).toBe(0)
    })
  })

  test('switching microphones replaces what each listener hears', async () => {
    await withCall(async (host, guest, { settle, sends }) => {
      host.voice.join(false)
      guest.voice.join(false)
      host.voice.setMicrophone(microphone('built-in'))
      await settle()
      expect(sentTracks(sends())).toEqual(['built-in'])

      host.voice.setMicrophone(microphone('headset'))
      await settle()
      expect(sentTracks(sends())).toEqual(['headset'])
      expect(guest.voice.audio.value.get(host.voice.localClientId)?.id).toBe('headset')
    })
  })

  test('someone leaving the room leaves its call', async () => {
    await withCall(async (host, guest, { settle, sends }) => {
      host.voice.join(false)
      host.voice.setMicrophone(microphone('host-mic'))
      guest.voice.join(false)
      await settle()
      expect(sentTracks(sends())).toEqual(['host-mic'])

      guest.dispose()
      await settle()
      expect(host.voice.members.value).toEqual([])
      expect(sends()).toEqual([])
    })
  })
})
