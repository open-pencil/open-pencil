import { beforeAll, describe, expect, test } from 'bun:test'

import {
  exportFigFile,
  importNodeChanges,
  initCodec,
  parseFigFile,
  SceneGraph,
  type NodeChange
} from '@open-pencil/core'
import { effectiveFigmaRawNodeFields, parseFigBuffer } from '@open-pencil/fig'
import { MAX_EXPORT_SCALE } from '@open-pencil/scene-graph'

function decodeExport(bytes: Uint8Array) {
  return parseFigBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

function doc(): NodeChange {
  return {
    guid: { sessionID: 0, localID: 0 },
    type: 'DOCUMENT',
    name: 'Document',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  } as NodeChange
}

function canvas(): NodeChange {
  return {
    guid: { sessionID: 0, localID: 1 },
    parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
    type: 'CANVAS',
    name: 'Page 1',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  } as NodeChange
}

function frame(overrides: Partial<NodeChange> = {}): NodeChange {
  return {
    guid: { sessionID: 1, localID: 10 },
    parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
    type: 'FRAME',
    name: 'Export settings frame',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    size: { x: 100, y: 100 },
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    ...overrides
  } as NodeChange
}

describe('fig roundtrip export settings', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('persists per-node export settings losslessly through plugin data', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, {
      name: 'Exportable rect',
      exportSettings: [
        { scale: 2, format: 'png' },
        { scale: 3, format: 'webp' }
      ]
    })

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const reimportedRect = [...reimported.getAllNodes()].find((node) => node.name === rect.name)

    expect(reimportedRect?.exportSettings).toEqual(rect.exportSettings)
  })

  test('maps native Figma PNG content-scale settings when plugin data is absent', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      frame({
        exportSettings: [
          {
            imageType: 'PNG',
            constraint: { type: 'CONTENT_SCALE', value: 2 }
          },
          {
            imageType: 'GIF',
            constraint: { type: 'CONTENT_SCALE', value: 4 }
          }
        ]
      })
    ])
    const importedFrame = [...graph.getAllNodes()].find(
      (node) => node.name === 'Export settings frame'
    )

    expect(importedFrame?.exportSettings).toEqual([{ scale: 2, format: 'png' }])
  })

  test('does not serialize export settings plugin data for a default node', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const rect = graph.createNode('RECTANGLE', page.id, { name: 'Default export settings rect' })

    const decoded = decodeExport(await exportFigFile(graph))
    const exportedRect = decoded.nodeChanges.find((nodeChange) => nodeChange.name === rect.name)

    expect(
      exportedRect?.pluginData?.some(
        (entry) => entry.pluginID === 'open-pencil' && entry.key === 'exportSettings'
      ) ?? false
    ).toBe(false)
  })

  test('does not resurrect native export settings after the user clears all rows', async () => {
    // Imported node carries NATIVE export settings (no plugin override).
    const graph = importNodeChanges([
      doc(),
      canvas(),
      frame({
        exportSettings: [{ imageType: 'PNG', constraint: { type: 'CONTENT_SCALE', value: 2 } }]
      })
    ])
    const node = [...graph.getAllNodes()].find((n) => n.name === 'Export settings frame')
    if (!node) throw new Error('imported frame not found')
    expect(node.exportSettings).toEqual([{ scale: 2, format: 'png' }])

    // User removes every export row; the raw native settings become stale so they
    // cannot come back through the import fallback on reopen.
    graph.updateNode(node.id, { exportSettings: [] })
    expect(effectiveFigmaRawNodeFields(node).exportSettings).toBeUndefined()
    expect(node.source.fig.rawNodeFields.exportSettings).toBeDefined()

    const reimported = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const reNode = [...reimported.getAllNodes()].find((n) => n.name === 'Export settings frame')
    expect(reNode?.exportSettings).toEqual([])
  })

  test('clamps an out-of-range native export scale at the import boundary', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      frame({
        exportSettings: [{ imageType: 'PNG', constraint: { type: 'CONTENT_SCALE', value: 999999 } }]
      })
    ])
    const node = [...graph.getAllNodes()].find((n) => n.name === 'Export settings frame')
    expect(node?.exportSettings).toEqual([{ scale: MAX_EXPORT_SCALE, format: 'png' }])
  })
})
