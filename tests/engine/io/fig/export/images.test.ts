import { beforeAll, describe, expect, test } from 'bun:test'

import { unzipSync } from 'fflate'

import { exportFigFile, FigmaAPI, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

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

    const zip = await exportFigFile(graph)
    const entries = unzipSync(zip)

    expect(entries[`images/${hash}`]).toBeDefined()
    expect(new Uint8Array(entries[`images/${hash}`])).toEqual(bytes)
  })

  test('graph without images has no images entries', async () => {
    const graph = new SceneGraph()
    graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Plain',
      width: 50,
      height: 50
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
      name: 'Img1',
      width: 100,
      height: 100,
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
    graph.createNode('ELLIPSE', page.id, {
      name: 'Img2',
      width: 80,
      height: 80,
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

    const zip = await exportFigFile(graph)
    const restored = await parseFigFile(zip.buffer as ArrayBuffer)

    expect(restored.images.size).toBe(2)
    expect(new Uint8Array(expectDefined(restored.images.get(hash1), 'restored image 1'))).toEqual(
      bytes1
    )
    expect(new Uint8Array(expectDefined(restored.images.get(hash2), 'restored image 2'))).toEqual(
      bytes2
    )
  })
})
