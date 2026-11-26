import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import { createCommentThread, readComments, writeComments } from '@open-pencil/scene-graph/comments'

import { followCloudComments } from '@/app/cloud/comments/sync'

import { COMMENT_TIME, commentServer } from '#tests/helpers/cloud/comments'
import {
  cleanups,
  openedTwice,
  openRoom,
  runCleanups,
  startRelay,
  until
} from '#tests/helpers/collab/cloud'

afterEach(runCleanups)

describe('Cloud document rooms, comments', () => {
  test('stay out of the room, and reach another tab when the server says one changed', async () => {
    const relay = await startRelay()
    const documentId = crypto.randomUUID()
    const server = commentServer()
    const [ana, ben] = await openedTwice()
    const rooms = [ana, ben].map((store) => openRoom(relay, store, { documentId, name: 'Ana' }))
    for (const store of [ana, ben]) {
      const follower = followCloudComments(store, {
        key: documentId,
        requests: async () => server.requests
      })
      cleanups.push(() => follower.stop())
    }
    await until(() =>
      rooms.every((room) => room.session.peers.value.length > 0 && room.session.roomHasDocument())
    )
    await until(() => server.calls.filter((call) => call === 'list').length === 2)

    const pageId = ana.state.currentPageId
    const thread = createCommentThread(ana.graph, {
      pageId,
      at: { x: 4, y: 4 },
      author: { name: 'Ana' },
      text: 'Tighten the heading',
      now: COMMENT_TIME
    })
    writeComments(ana.graph, [thread])
    // A layer drawn after the comment, which the room does carry, in order.
    ana.graph.createNode('ELLIPSE', pageId, { id: 'from:ana', name: 'Marker' })
    await until(() => server.threads.has(thread.id))
    await until(() => ben.graph.getNode('from:ana') !== undefined)
    expect(readComments(ben.graph)).toEqual([])

    relay.announceComments(documentId, thread.id)
    await until(() => readComments(ben.graph).length === 1)
    expect(readComments(ben.graph)[0]).toMatchObject({ id: thread.id, text: 'Tighten the heading' })
  })
})
