import { expect, test } from 'bun:test'

import { exportFigFile } from '@lawha/core/io/formats/fig'
import { parseFigBuffer } from '@lawha/fig'
import { initCodec } from '@lawha/kiwi/fig/codec'
import { SceneGraph } from '@lawha/scene-graph'

for (const mode of ['NONE', 'HEIGHT', 'WIDTH_AND_HEIGHT'] as const) {
  test(`exports actual text sizing ${mode} inside auto-layout without importer metadata`, async () => {
    await initCodec()
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { layoutMode: 'HORIZONTAL' })
    graph.createNode('TEXT', frame.id, { text: 'Label', textAutoResize: mode })
    const bytes = await exportFigFile(graph)
    const parsed = parseFigBuffer(bytes.buffer as ArrayBuffer)
    expect(parsed.nodeChanges.find((node) => node.type === 'TEXT')?.textAutoResize).toBe(mode)
  })
}
