import { expect, test } from 'bun:test'

import { resolveGeometryPaths } from '#fig/node-change/vector-geometry'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

test('decodes Kiwi ODD geometry as scene even-odd', () => {
  const paths = resolveGeometryPaths(
    [{ windingRule: 'ODD', commandsBlob: 0 }],
    [new Uint8Array([0])]
  )
  expect(paths[0].windingRule).toBe('EVENODD')
})

test('encodes scene even-odd geometry using the Kiwi enum', async () => {
  await initCodec()
  const graph = new SceneGraph()
  graph.createNode('VECTOR', graph.getPages()[0].id, {
    fillGeometry: [{ windingRule: 'EVENODD', commandsBlob: new Uint8Array([0]) }],
    strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: new Uint8Array([0]) }]
  })
  const bytes = await exportFigFile(graph)
  const restored = await parseFigFile(bytes.buffer as ArrayBuffer)
  const vector = [...restored.getAllNodes()].find((node) => node.type === 'VECTOR')
  expect(vector?.fillGeometry[0]?.windingRule).toBe('EVENODD')
  expect(vector?.strokeGeometry[0]?.windingRule).toBe('NONZERO')
})
