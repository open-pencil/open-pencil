import { describe, expect, test } from 'bun:test'

import { decodeNodeFromYjs } from '#collab/node-codec'
import * as Y from 'yjs'

describe('node codec', () => {
  test('copies a byte array from the room to its own bytes, not the update it arrived in', () => {
    const room = new Y.Doc()
    const commandsBlob = Uint8Array.from([1, 0, 0, 0, 0, 2, 0, 0, 128, 63])
    room.getMap<Y.Map<unknown>>('nodes').set('rect:1', new Y.Map())
    const written = room.getMap<Y.Map<unknown>>('nodes').get('rect:1')
    written?.set('derivedTextGlyphs', [{ commandsBlob, x: 0, y: 12, fontSize: 12 }])
    // Padding makes the update far larger than the path, as a whole document does.
    room.getMap('padding').set('bytes', new Uint8Array(1 << 20))
    const peer = new Y.Doc()
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(room))

    const ynode = peer.getMap<Y.Map<unknown>>('nodes').get('rect:1')
    if (!ynode) throw new Error('Expected the layer in the room')
    const [glyph] = decodeNodeFromYjs(ynode).derivedTextGlyphs ?? []

    expect(glyph?.commandsBlob).toEqual(commandsBlob)
    expect(glyph?.commandsBlob.buffer.byteLength).toBe(commandsBlob.byteLength)
  })
})
