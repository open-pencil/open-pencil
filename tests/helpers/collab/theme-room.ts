import { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'

import { openRoomSession, type RoomSession } from '@/app/collab/session'
import { createEditorStore, type EditorStore } from '@/app/editor/session'

import { createMemoryRooms } from '#tests/helpers/collab/memory-transport'

const ROOM = 'cccccccccccccccccccccccccccccccc'
export const RED: Color = { r: 1, g: 0, b: 0, a: 1 }
export const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 }
export const GREEN: Color = { r: 0, g: 1, b: 0, a: 1 }

const noSavedCopy = () => ({ whenSynced: Promise.resolve(), destroy: () => undefined })

export type Room = {
  host: EditorStore
  guest: EditorStore
  settle: () => Promise<void>
  ids: { collection: string; light: string; dark: string; brand: string; card: string }
}

/**
 * A host shares a document with a Theme collection, Light and Dark modes, a Brand color, and a
 * card filled with it; a guest joins.
 */
export async function withRoom(run: (room: Room) => Promise<void>) {
  const rooms = createMemoryRooms()
  const sessions: RoomSession[] = []
  const host = createEditorStore(new SceneGraph())
  const guest = createEditorStore(new SceneGraph())
  try {
    const collection = host.graph.createCollection('Theme')
    const light = collection.defaultModeId
    const dark = expectDefined(host.graph.createMode(collection.id, 'Dark'), 'Dark mode')
    const brand = host.graph.createVariable('Brand', 'COLOR', collection.id, RED)
    brand.valuesByMode[dark] = BLUE
    const page = expectDefined(host.graph.getPages()[0], 'first page').id
    const card = host.graph.createNode('RECTANGLE', page, {
      name: 'Card',
      fills: [{ type: 'SOLID', color: RED, opacity: 1, visible: true }],
      boundVariables: { 'fills/0/color': brand.id }
    })

    const open = (store: EditorStore, origin: 'shared' | 'joined') => {
      const session = openRoomSession({
        roomId: ROOM,
        store,
        origin,
        joinRoom: rooms.join,
        openSavedCopy: noSavedCopy
      })
      sessions.push(session)
      return session
    }
    open(host, 'shared').shareDocument()
    open(guest, 'joined')
    await rooms.settle()
    await run({
      host,
      guest,
      settle: rooms.settle,
      ids: { collection: collection.id, light, dark, brand: brand.id, card: card.id }
    })
  } finally {
    for (const session of sessions) session.dispose()
    host.preparationController.dispose()
    guest.preparationController.dispose()
  }
}
