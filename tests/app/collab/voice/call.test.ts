import { describe, expect, test } from 'bun:test'

import { effectScope } from 'vue'

import { SceneGraph } from '@open-pencil/scene-graph'

import { openRoomSession } from '@/app/collab/session'
import { createVoiceCall } from '@/app/collab/voice/call'
import { createEditorStore } from '@/app/editor/session'
import { createDeferred } from '@/app/runtime/deferred'

import { createMemoryRooms } from '#tests/helpers/collab/memory-transport'
import { asDouble } from '#tests/helpers/doubles'

const ROOM = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

/** A microphone whose prompt stays open until the test answers it. */
function promptingMicrophone() {
  const answer = createDeferred<true>()
  const stopped: string[] = []
  let opened = 0
  const navigator = asDouble<Navigator>({
    mediaDevices: {
      enumerateDevices: async () => [{ kind: 'audioinput', deviceId: 'mic', label: 'Mic' }],
      getUserMedia: async () => {
        await answer.promise
        const id = `track-${++opened}`
        const track = { id, kind: 'audio', enabled: true, stop: () => stopped.push(id) }
        return asDouble<MediaStream>({
          id: `stream-${opened}`,
          getTracks: () => [track],
          getAudioTracks: () => [track]
        })
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }
  })
  return { navigator, answer: () => answer.resolve(true), stopped, opened: () => opened }
}

describe('voice call', () => {
  test('a room that goes while the microphone prompt is open gets no call and no microphone', async () => {
    const rooms = createMemoryRooms()
    const store = createEditorStore(new SceneGraph())
    const session = openRoomSession({
      roomId: ROOM,
      store,
      origin: 'shared',
      joinRoom: rooms.join,
      openSavedCopy: () => ({ whenSynced: Promise.resolve(), destroy: () => undefined })
    })
    const microphone = promptingMicrophone()
    const scope = effectScope(true)
    const call = scope.run(() => createVoiceCall({ navigator: microphone.navigator }))
    try {
      if (!call) throw new Error('Voice call did not start')
      const joining = call.join(session)
      expect(call.joining.value).toBe(true)

      session.dispose()
      microphone.answer()
      await joining

      expect(call.joining.value).toBe(false)
      expect(call.room.value).toBeNull()
      expect(call.error.value).toBeNull()
      expect(microphone.opened()).toBeGreaterThan(0)
      expect(microphone.stopped).toHaveLength(microphone.opened())
      expect(session.voice.joined.value).toBe(false)
    } finally {
      scope.stop()
      session.dispose()
      store.preparationController.dispose()
    }
  })
})
