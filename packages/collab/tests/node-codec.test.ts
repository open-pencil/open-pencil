import { describe, expect, test } from 'bun:test'

import { decodeNodeFromYjs } from '#collab/node-codec'
import * as Y from 'yjs'

import type { Fill } from '@open-pencil/scene-graph'

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
  test("keeps a Figma shader paint's reference in either form a peer writes", () => {
    const shader: Fill = {
      type: 'CUSTOM',
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const fills: Fill[] = [
      { ...shader, customEffectId: '5:6' },
      { ...shader, customEffectAssetRef: { key: 'abc', version: 'v1' } }
    ]
    const room = new Y.Doc()
    const written = new Y.Map<unknown>()
    room.getMap<Y.Map<unknown>>('nodes').set('rect:1', written)
    written.set('fills', fills)
    const peer = new Y.Doc()
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(room))

    const ynode = peer.getMap<Y.Map<unknown>>('nodes').get('rect:1')
    if (!ynode) throw new Error('Expected the layer in the room')

    expect(decodeNodeFromYjs(ynode).fills).toEqual(fills)
  })
})
