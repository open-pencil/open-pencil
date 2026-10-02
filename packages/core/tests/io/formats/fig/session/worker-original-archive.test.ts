import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

// parseFigFile only uses the session worker in a browser, and IS_BROWSER is read
// once at import, so set window before loading the reader.
test('saving an unedited worker-opened .fig returns its original bytes', async () => {
  const hadWindow = 'window' in globalThis
  if (!hadWindow) Reflect.set(globalThis, 'window', globalThis)
  try {
    const { exportFigFile, parseFigFile } = await import('@open-pencil/core/io')
    const { initCodec } = await import('@open-pencil/core/kiwi')
    await initCodec()
    const graph = new SceneGraph()
    graph.createNode('TEXT', graph.getPages()[0].id, { text: 'First' })
    graph.createNode('TEXT', graph.addPage('Second').id, { text: 'Second' })
    const bytes = await exportFigFile(graph)

    const opened = await parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
    const saved = await Promise.race([
      exportFigFile(opened),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('save did not finish')), 5000)
      })
    ])
    expect(saved).toEqual(bytes)
  } finally {
    if (!hadWindow) Reflect.deleteProperty(globalThis, 'window')
  }
}, 20000)
