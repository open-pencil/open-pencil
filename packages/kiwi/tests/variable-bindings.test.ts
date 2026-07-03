import { describe, expect, test } from 'bun:test'

import {
  encodeNodeChangeWithVariables,
  encodePaintWithVariableBinding,
  encodeVarint,
  parseVariableId
} from '../src/fig/variable-bindings'

describe('variable binding codec helpers', () => {
  test('encodes varints', () => {
    expect(encodeVarint(0)).toEqual([0])
    expect(encodeVarint(127)).toEqual([127])
    expect(encodeVarint(128)).toEqual([128, 1])
    expect(encodeVarint(16_384)).toEqual([128, 128, 1])
  })

  test('parses Figma variable IDs', () => {
    expect(parseVariableId('VariableID:123:456')).toEqual({ sessionID: 123, localID: 456 })
    expect(parseVariableId('not-a-variable')).toBeNull()
  })

  test('appends paint variable binding bytes', () => {
    const codec = {
      encodePaint: () => new Uint8Array([0x01, 0x02, 0x00]),
      encodeNodeChange: () => new Uint8Array()
    }

    const encoded = encodePaintWithVariableBinding(
      codec,
      { colorVariableBinding: { variableID: { sessionID: 5, localID: 130 } } },
      5,
      130
    )

    expect([...encoded]).toEqual([
      0x01, 0x02, 0x15, 0x01, 0x04, 0x01, 0x05, 0x82, 0x01, 0x00, 0x00, 0x02, 0x03, 0x03, 0x04,
      0x00, 0x00
    ])
  })

  test('injects node change variable bindings after paint markers', () => {
    const codec = {
      encodePaint: () => new Uint8Array(),
      encodeNodeChange: () => new Uint8Array([0x26, 0x01, 0x04, 0x01, 0x00, 0xaa])
    }

    const encoded = encodeNodeChangeWithVariables(codec, {
      fillPaints: [{ colorVariableBinding: { variableID: { sessionID: 2, localID: 3 } } }]
    })

    expect(Buffer.from(encoded).toString('hex')).toBe('260104011501040102030000020303040000aa')
  })
})
