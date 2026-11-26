import { describe, expect, test } from 'bun:test'

import { openCollabRoom, type RoomEditor } from '#collab/room/session'

import { SceneGraph } from '@open-pencil/scene-graph'
import { createMemoryRooms } from '@open-pencil/test-support/collab/memory-transport'

/** An editor of its own graph that only shows what the room sends, as an embed's is. */
function viewer(graph = new SceneGraph()): RoomEditor & { name: string } {
  const editor = {
    graph,
    name: 'Untitled',
    isReadOnly: () => true,
    onEditorEvent: () => () => undefined,
    requestRender: () => undefined,
    refreshVariables: () => undefined,
    refreshDocumentSettings: () => undefined,
    adoptChanges: (apply: () => void) => apply(),
    get currentPageId() {
      return graph.getPages()[0]?.id ?? graph.rootId
    },
    switchPage: async () => undefined,
    get documentName() {
      return editor.name
    },
    setDocumentName(name: string) {
      editor.name = name
    },
    onDocumentRenamed: () => () => undefined
  }
  return editor
}

describe('openCollabRoom', () => {
  test('a peer without presence receives the room’s document and stays out of everyone’s presence', async () => {
    const rooms = createMemoryRooms()
    const source = new SceneGraph()
    const page = source.getPages()[0]
    if (!page) throw new Error('Expected a page')
    source.createNode('RECTANGLE', page.id, { name: 'Card' })
    const owner = viewer(source)
    owner.name = 'Launch'
    const sharer = openCollabRoom({ roomId: 'room', editor: owner, joinRoom: rooms.join })
    sharer.shareDocument()

    const embed = viewer()
    const watcher = openCollabRoom({
      roomId: 'room',
      editor: embed,
      joinRoom: rooms.join,
      presence: false
    })
    await rooms.settle()

    expect(watcher.hasDocument()).toBe(true)
    expect(embed.graph.rootId).toBe(source.rootId)
    expect([...embed.graph.getAllNodes()].some((node) => node.name === 'Card')).toBe(true)
    expect(embed.name).toBe('Launch')
    // Only the sharer's own presence: the watcher published none.
    expect([...sharer.awareness.getStates().keys()]).toEqual([sharer.awareness.clientID])

    watcher.dispose()
    sharer.dispose()
  })
})
