import { describe, expect, test } from 'bun:test'

import { deflateSync } from 'fflate'
import { fromUint8Array } from 'js-base64'

import { buildOpenPencilClipboardHTML, parseOpenPencilClipboard } from '@open-pencil/core/clipboard'
import { SceneGraph } from '@open-pencil/scene-graph'

function clipboardHTML(payload: string): string {
  const compressed = deflateSync(new TextEncoder().encode(payload))
  return `<!--(openpencil)${fromUint8Array(compressed)}(/openpencil)-->`
}

function copiedNode() {
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, { name: 'Card', x: 5, y: 6 })
  return { graph, node }
}

describe('OpenPencil clipboard parsing', () => {
  test('restores nodes copied by OpenPencil', () => {
    const { graph, node } = copiedNode()
    const parsed = parseOpenPencilClipboard(buildOpenPencilClipboardHTML([node], graph))
    expect(parsed?.nodes).toHaveLength(1)
    expect(parsed?.nodes[0]).toMatchObject({ id: node.id, type: 'RECTANGLE', name: 'Card', x: 5 })
  })

  test.each([
    ['malformed JSON', '{"format": "openpencil/v1", "nodes": ['],
    ['an unknown format', JSON.stringify({ format: 'openpencil/v2', nodes: [] })],
    ['non-array nodes', JSON.stringify({ format: 'openpencil/v1', nodes: {} })],
    [
      'a node with a string coordinate',
      JSON.stringify({
        format: 'openpencil/v1',
        nodes: [{ id: '0:1', type: 'RECTANGLE', x: '5', y: 6 }]
      })
    ],
    [
      'a node with an unknown type',
      JSON.stringify({ format: 'openpencil/v1', nodes: [{ id: '0:1', type: 'WIDGET', x: 5, y: 6 }] })
    ],
    [
      'a malformed child',
      JSON.stringify({
        format: 'openpencil/v1',
        nodes: [{ id: '0:1', type: 'FRAME', x: 0, y: 0, children: [{ id: 7 }] }]
      })
    ],
    [
      'malformed geometry',
      JSON.stringify({
        format: 'openpencil/v1',
        nodes: [{ id: '0:1', type: 'VECTOR', x: 0, y: 0, fillGeometry: [null] }]
      })
    ],
    [
      'geometry bytes outside 0-255',
      JSON.stringify({
        format: 'openpencil/v1',
        nodes: [
          {
            id: '0:1',
            type: 'VECTOR',
            x: 0,
            y: 0,
            fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: { 0: 1, 1: 300 } }]
          }
        ]
      })
    ]
  ])('ignores %s', (_label, payload) => {
    expect(parseOpenPencilClipboard(clipboardHTML(payload))).toBeNull()
  })
})
