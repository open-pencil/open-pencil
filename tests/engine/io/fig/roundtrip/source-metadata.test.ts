import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { guidToString } from '@open-pencil/core/kiwi/fig/node-change/convert'
import { parseFigBuffer } from '@open-pencil/core/kiwi/fig/parse/core'

function decodeExport(bytes: Uint8Array) {
  return parseFigBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

describe('fig roundtrip source metadata', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('preserves imported document, canvas, and sibling ordering metadata', async () => {
    const graph = new SceneGraph()
    const root = graph.getNode(graph.rootId)
    const page = graph.getPages()[0]

    expect(root).toBeDefined()
    if (!root) return

    root.source.format = 'fig'
    root.source.fig.rawNodeFields.strokeJoin = 'BEVEL'
    root.source.fig.rawNodeFields.strokeWeight = 0

    page.source.format = 'fig'
    page.source.id = '4:463'
    page.source.orderKey = '~"'
    page.source.fig.rawNodeFields.backgroundColor = {
      r: 0.9750000238418579,
      g: 0.9750000238418579,
      b: 0.9750000238418579,
      a: 1
    }
    page.source.fig.rawNodeFields.strokeJoin = 'BEVEL'
    page.source.fig.rawNodeFields.strokeWeight = 0

    const first = graph.createNode('COMPONENT', page.id, { name: 'icon/accessibility' })
    first.source.format = 'fig'
    first.source.id = '4:4812'
    first.source.orderKey = '~~~~~~~~~~1'

    const second = graph.createNode('COMPONENT', page.id, { name: 'icon/align-center' })
    second.source.format = 'fig'
    second.source.id = '4:4813'
    second.source.orderKey = '~~~~~~~~~~3'

    const decoded = decodeExport(await exportFigFile(graph))
    const changes = new Map(
      decoded.nodeChanges
        .filter((nodeChange) => nodeChange.guid)
        .map((nodeChange) => [guidToString(nodeChange.guid), nodeChange])
    )

    expect(changes.get('0:0')?.strokeJoin).toBe('BEVEL')
    expect(changes.get('0:0')?.strokeWeight).toBe(0)

    const canvas = changes.get('4:463')
    expect(canvas?.parentIndex?.position).toBe('~"')
    expect(canvas?.strokeJoin).toBe('BEVEL')
    expect(canvas?.strokeWeight).toBe(0)
    expect(canvas?.backgroundColor).toEqual(page.source.fig.rawNodeFields.backgroundColor)

    expect(changes.get('4:4812')?.parentIndex?.position).toBe('~~~~~~~~~~1')
    expect(changes.get('4:4813')?.parentIndex?.position).toBe('~~~~~~~~~~3')
  })

  test('edited imported nodes export current geometry and paints', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Edited imported rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })
    rect.source.format = 'fig'
    rect.source.id = '4:500'
    rect.source.fig.rawSize = { x: 80, y: 40 }
    rect.source.fig.rawTransform = { m00: 1, m01: 0, m02: 1, m10: 0, m11: 1, m12: 2 }
    rect.source.fig.rawNodeFields.fillPaints = [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]

    graph.updateNode(rect.id, {
      x: 30,
      width: 120,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 1, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const exportedRect = [...reimported.getAllNodes()].find((node) => node.name === rect.name)

    expect(exportedRect?.x).toBe(30)
    expect(exportedRect?.width).toBe(120)
    expect(exportedRect?.fills[0]?.type).toBe('SOLID')
    if (exportedRect?.fills[0]?.type === 'SOLID') {
      expect(exportedRect.fills[0].color).toEqual({ r: 0, g: 1, b: 0, a: 1 })
    }
  })

  test('exports imported raw vector payloads without regenerating vector data', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rawVectorBlob = new Uint8Array([1, 2, 3, 4, 5])

    const vector = graph.createNode('VECTOR', page.id, {
      name: 'Imported vector',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    vector.source.format = 'fig'
    vector.source.id = '4:465'
    vector.source.fig.rawNodeFields.vectorData = {
      normalizedSize: { x: 0, y: 0 },
      vectorNetworkBlob: { __openPencilFigmaBlob: rawVectorBlob }
    }

    const decoded = decodeExport(await exportFigFile(graph))
    const exported = decoded.nodeChanges.find(
      (nodeChange) => nodeChange.guid && guidToString(nodeChange.guid) === '4:465'
    )

    expect(exported?.vectorData?.normalizedSize).toEqual({ x: 0, y: 0 })
    const blobIndex = exported?.vectorData?.vectorNetworkBlob
    expect(typeof blobIndex).toBe('number')
    expect(decoded.blobs[blobIndex as number]).toEqual(rawVectorBlob)
  })
})
