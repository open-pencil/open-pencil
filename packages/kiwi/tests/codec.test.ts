import { describe, expect, test } from 'bun:test'

import {
  createNodeChange,
  createNodeChangesMessage,
  decodeMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec,
  isCodecReady,
  peekMessageType,
  type Color,
  type NodeChange
} from '../src/fig/codec'

const red: Color = { r: 1, g: 0, b: 0, a: 1 }

describe('Figma Kiwi codec', () => {
  test('initializes schema and exposes schema bytes', async () => {
    await initCodec()

    expect(isCodecReady()).toBe(true)
    expect(getSchemaBytes().length).toBeGreaterThan(0)
  })

  test('creates normalized node changes', () => {
    const nodeChange = createNodeChange({
      sessionID: 1,
      localID: 2,
      parentSessionID: 1,
      parentLocalID: 1,
      type: 'RECTANGLE',
      name: 'Box',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      fill: red
    })

    expect(nodeChange.name).toBe('Box')
    expect(nodeChange.fillPaints?.[0]?.color).toEqual(red)
  })

  test('encodes and decodes empty node change messages', async () => {
    await initCodec()

    const encoded = encodeMessage(createNodeChangesMessage(1, 0, []))
    const decoded = decodeMessage(encoded)

    expect(peekMessageType(encoded)).toBe(1)
    expect(decoded.type).toBe('NODE_CHANGES')
  })

  test('encodes variable-bound paint messages', async () => {
    await initCodec()

    const nodeChange: NodeChange = {
      guid: { sessionID: 1, localID: 2 },
      type: 'RECTANGLE',
      fillPaints: [
        {
          type: 'SOLID',
          color: red,
          colorVariableBinding: { variableID: { sessionID: 7, localID: 9 } }
        }
      ]
    }
    const encoded = encodeMessage(createNodeChangesMessage(1, 0, [nodeChange]))

    expect(encoded.length).toBeGreaterThan(0)
  })
})
