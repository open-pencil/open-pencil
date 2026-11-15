import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import {
  createCommentThread,
  readComments,
  writeComments
} from '@open-pencil/scene-graph/comments'
import { uint8ArrayToArrayBuffer } from '@open-pencil/test-support/paths'

async function reopened(bytes: Uint8Array) {
  return parseFigFile(uint8ArrayToArrayBuffer(bytes))
}

function commented(): SceneGraph {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('A new document has a page')
  graph.createNode('RECTANGLE', page.id, { name: 'Card', width: 40, height: 40 })
  const thread = createCommentThread(graph, {
    pageId: page.id,
    at: { x: 10, y: 10 },
    author: { name: 'Ana' },
    text: 'Too tight',
    now: '2026-11-16T10:00:00.000Z'
  })
  writeComments(graph, [thread])
  return graph
}

describe('.fig export without comments', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('keeps comments in the file unless asked to leave them out', async () => {
    const graph = commented()
    expect(readComments(await reopened(await exportFigFile(graph)))).toHaveLength(1)
    const lean = await reopened(await exportFigFile(graph, { withoutComments: true }))
    expect(readComments(lean)).toEqual([])
    expect(lean.getPages()[0]?.childIds).toHaveLength(1)
  })

  test('leaves them out of a file opened with comments, unchanged or edited', async () => {
    const opened = await reopened(await exportFigFile(commented()))
    expect(readComments(opened)).toHaveLength(1)

    // Unchanged, the opened archive would be written again as it was, comments and all.
    const unchanged = await reopened(await exportFigFile(opened, { withoutComments: true }))
    expect(readComments(unchanged)).toEqual([])

    const card = opened.getPages()[0]?.childIds[0]
    if (!card) throw new Error('The card is missing')
    opened.updateNode(card, { width: 80 })
    const edited = await reopened(await exportFigFile(opened, { withoutComments: true }))
    expect(readComments(edited)).toEqual([])
    expect(edited.getNode(edited.getPages()[0]?.childIds[0] ?? '')?.width).toBe(80)
    // The document itself still holds them; only the file leaves them out.
    expect(readComments(opened)).toHaveLength(1)
  })
})
