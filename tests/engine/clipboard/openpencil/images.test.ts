import { describe, expect, test } from 'bun:test'

import { buildOpenPencilClipboardHTML, FigmaAPI, parseOpenPencilClipboard, SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

import type { SceneNode } from '@open-pencil/core'

describe('clipboard roundtrip with images', () => {
  function graphWithImageNode(): {
    graph: SceneGraph
    node: SceneNode
    imageHash: string
    imageBytes: Uint8Array
  } {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const figma = new FigmaAPI(graph)
    const { hash } = figma.createImage(imageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'ImageRect',
      width: 100,
      height: 100,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })

    return { graph, node, imageHash: hash, imageBytes }
  }

  test('round-trips image bytes through clipboard', () => {
    const { graph, node, imageHash, imageBytes } = graphWithImageNode()

    const html = buildOpenPencilClipboardHTML([node], graph)
    const parsed = parseOpenPencilClipboard(html)

    const clipboard = expectDefined(parsed, 'OpenPencil clipboard')
    expect(clipboard.images.size).toBe(1)
    expect(clipboard.images.get(imageHash)).toEqual(imageBytes)
  })

  test('preserves imageHash on the fill', () => {
    const { graph, node, imageHash } = graphWithImageNode()

    const html = buildOpenPencilClipboardHTML([node], graph)
    const parsed = parseOpenPencilClipboard(html)

    const fill = expectDefined(parsed, 'OpenPencil clipboard').nodes[0]?.fills[0]
    expect(fill.type).toBe('IMAGE')
    expect(fill.imageHash).toBe(imageHash)
  })

  test('multiple image hashes in different nodes are all included', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const figma = new FigmaAPI(graph)

    const bytes1 = new Uint8Array([10, 20, 30])
    const bytes2 = new Uint8Array([40, 50, 60])
    const { hash: hash1 } = figma.createImage(bytes1)
    const { hash: hash2 } = figma.createImage(bytes2)

    const node1 = graph.createNode('RECTANGLE', page.id, {
      name: 'Img1',
      width: 50,
      height: 50,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash1,
          imageScaleMode: 'FILL'
        }
      ]
    })
    const node2 = graph.createNode('RECTANGLE', page.id, {
      name: 'Img2',
      width: 50,
      height: 50,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash2,
          imageScaleMode: 'FIT'
        }
      ]
    })

    const html = buildOpenPencilClipboardHTML([node1, node2], graph)
    const parsed = parseOpenPencilClipboard(html)

    const clipboard = expectDefined(parsed, 'OpenPencil clipboard')
    expect(clipboard.images.size).toBe(2)
    expect(clipboard.images.get(hash1)).toEqual(bytes1)
    expect(clipboard.images.get(hash2)).toEqual(bytes2)
  })

  test('nodes without image fills produce empty images map', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Plain',
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const html = buildOpenPencilClipboardHTML([node], graph)
    const parsed = parseOpenPencilClipboard(html)

    expect(expectDefined(parsed, 'OpenPencil clipboard').images.size).toBe(0)
  })

  test('child node image hashes are collected', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const figma = new FigmaAPI(graph)

    const bytes = new Uint8Array([99, 88, 77])
    const { hash } = figma.createImage(bytes)

    const frame = graph.createNode('FRAME', page.id, { name: 'Parent', width: 200, height: 200 })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'ChildImg',
      width: 50,
      height: 50,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'TILE'
        }
      ]
    })

    const html = buildOpenPencilClipboardHTML([frame], graph)
    const parsed = parseOpenPencilClipboard(html)

    const clipboard = expectDefined(parsed, 'OpenPencil clipboard')
    expect(clipboard.images.size).toBe(1)
    expect(clipboard.images.get(hash)).toEqual(bytes)
  })
})

