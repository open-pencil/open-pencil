import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, materializeFigArchive, parseFigBuffer } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

test('archive-owned assembly matches record-based assembly and isolates returned graphs', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('TEXT', source.getPages()[0].id, { name: 'Label', text: 'Original' })
  const bytes = await exportFigFile(source)
  const parsed = parseFigBuffer(bytes.buffer as ArrayBuffer)
  const copied = materializeDocument(parsed.nodeChanges, parsed.blobs)
  const owned = materializeFigArchive(bytes.buffer as ArrayBuffer)
  const text = (graph: SceneGraph) => [...graph.getAllNodes()].find((node) => node.type === 'TEXT')
  expect(text(owned.graph)?.text).toBe(text(copied.graph)?.text)
  const node = text(owned.graph)
  if (!node) throw new Error('Missing text')
  owned.graph.updateNode(node.id, { text: 'Changed' })
  expect(text(materializeFigArchive(bytes.buffer as ArrayBuffer).graph)?.text).toBe('Original')
})
