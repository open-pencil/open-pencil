import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { FigmaAPI } from '#core/figma-api/index'
import { compileScript } from '#core/tools/analyze/eval/wrap'

test('a script’s download leaves out of its undo step what the user does meanwhile', async () => {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 100, height: 50 })
  const other = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
  const download = Promise.withResolvers<Response>()
  const figma = new FigmaAPI(editor.graph, { fetch: () => download.promise })
  const script = compileScript(`
    const card = figma.getNodeById(${JSON.stringify(card.id)})
    card.x = 10
    const image = figma.createImageAsync('https://example.com/photo.png')
    card.y = 5
    try { await image } catch {}
    card.resize(50, 50)
  `)

  const edit = editor.recordEditAsync({ label: 'Agent: eval' }, () => script(figma))
  // The script waits on the download by the time the user moves another layer.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
  editor.recordEdit({ label: 'Move' }, () => editor.graph.updateNode(other.id, { x: 25 }))
  download.resolve(new Response(null, { status: 404 }))
  await edit

  expect(editor.graph.getNode(card.id)).toMatchObject({ x: 10, y: 5, width: 50 })
  expect(editor.undo.undo()).toBe('Agent: eval')
  expect(editor.graph.getNode(card.id)).toMatchObject({ x: 0, y: 0, width: 100 })
  expect(editor.graph.getNode(other.id)?.x).toBe(25)
  expect(editor.undo.undo()).toBe('Move')
  expect(editor.graph.getNode(other.id)?.x).toBe(0)
})
