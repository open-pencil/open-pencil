import { describe, expect, test } from 'bun:test'

import {
  joinTestRelay,
  startTestRelay,
  textOfSyncReply,
  textUpdate,
  until
} from '#cloud-tests/helpers/relay'
import {
  COLLAB_ACTIONS,
  RELAY_CLOSE,
  RELAY_FRAGMENT_BYTES,
  RELAY_SERVER_PEER,
  relayClientMessages
} from '#cloud/contract'
import * as Y from 'yjs'

const documentId = crypto.randomUUID()

/** Text that does not compress, so frames carrying it stay as large as it is. */
function noise(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length / 2))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The socket messages an editor sends for an update of `size` bytes. */
function relayFragments(size: number) {
  return relayClientMessages({
    type: 'message',
    namespace: COLLAB_ACTIONS.yjsUpdate,
    target: null,
    payload: new Uint8Array(size)
  })
}

describe('collaboration relay fragments', () => {
  test("joins an editor's large edit from fragments and passes it on in fragments", async () => {
    const { relay: hub, states } = startTestRelay()
    const alice = await joinTestRelay(hub, documentId)
    const bob = await joinTestRelay(hub, documentId)
    const text = noise(2 * 1024 * 1024)
    alice.sendFragmented({
      type: 'message',
      namespace: COLLAB_ACTIONS.yjsUpdate,
      target: null,
      payload: textUpdate(text)
    })
    await until(() => bob.messages(COLLAB_ACTIONS.yjsUpdate).length > 0)
    expect(alice.closed).toBeNull()
    const [update] = bob.messages(COLLAB_ACTIONS.yjsUpdate)
    if (!update) throw new Error('Expected the forwarded update')
    const document = new Y.Doc()
    Y.applyUpdateV2(document, update.payload)
    expect(document.getText('t').toString()).toBe(text)
    expect(bob.received).toBeGreaterThan(bob.frames.length)

    // A newcomer gets the whole room, compressed and still larger than one fragment.
    const carol = await joinTestRelay(hub, documentId)
    carol.sendFragmented({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
    await until(() => carol.messages(COLLAB_ACTIONS.syncReply).length > 0)
    const [reply] = carol.messages(COLLAB_ACTIONS.syncReply)
    if (!reply) throw new Error('Expected the sync reply')
    expect(reply.payload.byteLength).toBeGreaterThan(RELAY_FRAGMENT_BYTES)
    expect(textOfSyncReply(reply.payload)).toBe(text)
    await until(() => states.size > 0)
  })

  test('holds a viewer, and a frame between fragments, to one message', async () => {
    const { relay: hub } = startTestRelay({ maximumMessageBytes: 300_000 })
    const viewer = await joinTestRelay(hub, documentId, { permission: 'view' })
    viewer.sendFragmented({
      type: 'message',
      namespace: COLLAB_ACTIONS.awareness,
      target: null,
      payload: new Uint8Array(400_000)
    })
    expect(viewer.closed?.code).toBe(RELAY_CLOSE.messageTooLarge)

    const editor = await joinTestRelay(hub, documentId)
    const [first] = relayFragments(400_000)
    if (!first) throw new Error('Expected a fragment')
    editor.connection.receive(first)
    editor.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.awareness,
      target: null,
      payload: new Uint8Array(1)
    })
    expect(editor.closed?.code).toBe(RELAY_CLOSE.protocol)
  })
})
