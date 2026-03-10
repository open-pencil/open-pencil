import { beforeAll, describe, expect, test } from 'bun:test'
import { unzipSync } from 'fflate'

import {
  ALL_TOOLS,
  buildOpenPencilClipboardHTML,
  exportFigFile,
  FigmaAPI,
  initCodec,
  parseOpenPencilClipboard,
  parseFigFile,
  SceneGraph,
  type SceneNode,
} from '@open-pencil/core'

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma }
}

describe('FigmaAPI.createImage', () => {
  test('returns deterministic hash for same bytes', () => {
    const { figma } = setup()
    const a = figma.createImage(PNG_MAGIC)
    const b = figma.createImage(PNG_MAGIC)
    expect(a.hash).toBe(b.hash)
  })

  test('different bytes produce different hashes', () => {
    const { figma } = setup()
    const a = figma.createImage(PNG_MAGIC)
    const b = figma.createImage(JPEG_MAGIC)
    expect(a.hash).not.toBe(b.hash)
  })

  test('stores bytes in graph.images', () => {
    const { graph, figma } = setup()
    const { hash } = figma.createImage(PNG_MAGIC)
    expect(graph.images.get(hash)).toEqual(PNG_MAGIC)
  })

  test('hash is a 40-char hex string', () => {
    const { figma } = setup()
    const { hash } = figma.createImage(PNG_MAGIC)
    expect(hash).toHaveLength(40)
    expect(hash).toMatch(/^[0-9a-f]{40}$/)
  })

  test('empty data produces a valid hash', () => {
    const { figma } = setup()
    const { hash } = figma.createImage(new Uint8Array([]))
    expect(hash).toHaveLength(40)
    expect(hash).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('set_image_fill tool', () => {
  const tool = ALL_TOOLS.find((t) => t.name === 'set_image_fill')!

  test('sets an IMAGE fill with correct imageHash and scaleMode', () => {
    const { figma } = setup()
    const shape = ALL_TOOLS.find((t) => t.name === 'create_shape')!
    const node = shape.execute(figma, { type: 'RECTANGLE', x: 0, y: 0, width: 100, height: 100 }) as { id: string }

    const b64 = PNG_MAGIC.toBase64()
    const result = tool.execute(figma, { id: node.id, image_data: b64 }) as { id: string; imageHash: string; scaleMode: string }

    expect(result.imageHash).toBeTruthy()
    expect(result.scaleMode).toBe('FILL')

    const fills = figma.getNodeById(node.id)!.fills as Array<{ type: string; imageHash: string; imageScaleMode: string }>
    expect(fills).toHaveLength(1)
    expect(fills[0].type).toBe('IMAGE')
    expect(fills[0].imageHash).toBe(result.imageHash)
    expect(fills[0].imageScaleMode).toBe('FILL')
  })

  test('returns error for non-existent node', () => {
    const { figma } = setup()
    const result = tool.execute(figma, { id: 'nonexistent', image_data: PNG_MAGIC.toBase64() }) as { error: string }
    expect(result.error).toContain('not found')
  })

  test('default scale mode is FILL', () => {
    const { figma } = setup()
    const shape = ALL_TOOLS.find((t) => t.name === 'create_shape')!
    const node = shape.execute(figma, { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }) as { id: string }

    const result = tool.execute(figma, { id: node.id, image_data: PNG_MAGIC.toBase64() }) as { scaleMode: string }
    expect(result.scaleMode).toBe('FILL')
  })

  test('all scale modes work', () => {
    const modes = ['FILL', 'FIT', 'CROP', 'TILE'] as const
    for (const mode of modes) {
      const { figma } = setup()
      const shape = ALL_TOOLS.find((t) => t.name === 'create_shape')!
      const node = shape.execute(figma, { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }) as { id: string }

      const result = tool.execute(figma, { id: node.id, image_data: PNG_MAGIC.toBase64(), scale_mode: mode }) as { scaleMode: string }
      expect(result.scaleMode).toBe(mode)

      const fills = figma.getNodeById(node.id)!.fills as Array<{ imageScaleMode: string }>
      expect(fills[0].imageScaleMode).toBe(mode)
    }
  })

  test('image data is stored in graph.images', () => {
    const { graph, figma } = setup()
    const shape = ALL_TOOLS.find((t) => t.name === 'create_shape')!
    const node = shape.execute(figma, { type: 'RECTANGLE', x: 0, y: 0, width: 50, height: 50 }) as { id: string }

    const result = tool.execute(figma, { id: node.id, image_data: PNG_MAGIC.toBase64() }) as { imageHash: string }
    expect(graph.images.get(result.imageHash)).toEqual(PNG_MAGIC)
  })
})

describe('clipboard roundtrip with images', () => {
  function graphWithImageNode(): { graph: SceneGraph; node: SceneNode; imageHash: string; imageBytes: Uint8Array } {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const imageBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const figma = new FigmaAPI(graph)
    const { hash } = figma.createImage(imageBytes)

    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'ImageRect',
      width: 100,
      height: 100,
      fills: [{
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash: hash,
        imageScaleMode: 'FILL',
      }],
    })

    return { graph, node, imageHash: hash, imageBytes }
  }

  test('round-trips image bytes through clipboard', () => {
    const { graph, node, imageHash, imageBytes } = graphWithImageNode()

    const html = buildOpenPencilClipboardHTML([node], graph)
    const parsed = parseOpenPencilClipboard(html)

    expect(parsed).not.toBeNull()
    expect(parsed!.images.size).toBe(1)
    expect(parsed!.images.get(imageHash)).toEqual(imageBytes)
  })

  test('preserves imageHash on the fill', () => {
    const { graph, node, imageHash } = graphWithImageNode()

    const html = buildOpenPencilClipboardHTML([node], graph)
    const parsed = parseOpenPencilClipboard(html)

    const fill = parsed!.nodes[0].fills[0]
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
      width: 50, height: 50,
      fills: [{ type: 'IMAGE', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, imageHash: hash1, imageScaleMode: 'FILL' }],
    })
    const node2 = graph.createNode('RECTANGLE', page.id, {
      name: 'Img2',
      width: 50, height: 50,
      fills: [{ type: 'IMAGE', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, imageHash: hash2, imageScaleMode: 'FIT' }],
    })

    const html = buildOpenPencilClipboardHTML([node1, node2], graph)
    const parsed = parseOpenPencilClipboard(html)

    expect(parsed!.images.size).toBe(2)
    expect(parsed!.images.get(hash1)).toEqual(bytes1)
    expect(parsed!.images.get(hash2)).toEqual(bytes2)
  })

  test('nodes without image fills produce empty images map', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Plain',
      width: 50, height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    })

    const html = buildOpenPencilClipboardHTML([node], graph)
    const parsed = parseOpenPencilClipboard(html)

    expect(parsed!.images.size).toBe(0)
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
      width: 50, height: 50,
      fills: [{ type: 'IMAGE', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, imageHash: hash, imageScaleMode: 'TILE' }],
    })

    const html = buildOpenPencilClipboardHTML([frame], graph)
    const parsed = parseOpenPencilClipboard(html)

    expect(parsed!.images.size).toBe(1)
    expect(parsed!.images.get(hash)).toEqual(bytes)
  })
})

describe('fig export/import with images', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('exported zip contains images entries', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const figma = new FigmaAPI(graph)

    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03])
    const { hash } = figma.createImage(bytes)

    graph.createNode('RECTANGLE', page.id, {
      name: 'ImageNode',
      width: 100, height: 100,
      fills: [{ type: 'IMAGE', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, imageHash: hash, imageScaleMode: 'FILL' }],
    })

    const zip = await exportFigFile(graph)
    const entries = unzipSync(zip)

    expect(entries[`images/${hash}`]).toBeDefined()
    expect(new Uint8Array(entries[`images/${hash}`])).toEqual(bytes)
  })

  test('graph without images has no images entries', async () => {
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Plain',
      width: 50, height: 50,
    })

    const zip = await exportFigFile(graph)
    const entries = unzipSync(zip)
    const imageKeys = Object.keys(entries).filter((k) => k.startsWith('images/'))

    expect(imageKeys).toHaveLength(0)
  })

  test('round-trip preserves images', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const figma = new FigmaAPI(graph)

    const bytes1 = new Uint8Array([11, 22, 33, 44, 55])
    const bytes2 = new Uint8Array([66, 77, 88, 99])
    const { hash: hash1 } = figma.createImage(bytes1)
    const { hash: hash2 } = figma.createImage(bytes2)

    graph.createNode('RECTANGLE', page.id, {
      name: 'Img1', width: 100, height: 100,
      fills: [{ type: 'IMAGE', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, imageHash: hash1, imageScaleMode: 'FILL' }],
    })
    graph.createNode('ELLIPSE', page.id, {
      name: 'Img2', width: 80, height: 80,
      fills: [{ type: 'IMAGE', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, imageHash: hash2, imageScaleMode: 'FIT' }],
    })

    const zip = await exportFigFile(graph)
    const restored = await parseFigFile(zip.buffer as ArrayBuffer)

    expect(restored.images.size).toBe(2)
    expect(new Uint8Array(restored.images.get(hash1)!)).toEqual(bytes1)
    expect(new Uint8Array(restored.images.get(hash2)!)).toEqual(bytes2)
  })
})
