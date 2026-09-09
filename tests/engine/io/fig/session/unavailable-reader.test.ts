import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import {
  registerFigPopulationWorker,
  releaseFigPopulationWorker
} from '#core/kiwi/fig/population/client'

test('replacement-reader pages fail explicitly after session invalidation', async () => {
  const editor = createEditor()
  const page = editor.graph.addPage('Unloaded')
  const worker = {
    terminate: () => undefined,
    postMessage: () => undefined,
    onerror: null,
    onmessage: null
  } as Worker
  registerFigPopulationWorker(editor.graph, worker, undefined, true)
  editor.graph.updateNode(editor.graph.rootId, { name: 'User edit' })
  try {
    await expect(editor.preparePage(page.id)).rejects.toThrow(
      'No replacement reader recovery state'
    )
    expect(editor.graph.getChildren(page.id)).toEqual([])
  } finally {
    releaseFigPopulationWorker(editor.graph)
  }
})
