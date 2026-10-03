import { expect, test } from 'bun:test'

import { range } from 'es-toolkit'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createRecentPages } from '@/app/editor/pages/recent'

function setup(pageCount: number) {
  const editor = createEditor()
  const first = editor.state.currentPageId
  const ids = [first, ...range(2, pageCount + 1).map((n) => editor.graph.addPage(`P${n}`).id)]
  return { editor, ids, recent: createRecentPages(editor) }
}

test('lists visited pages, most recent first, without repeats', async () => {
  const { editor, ids, recent } = setup(3)
  const [a, b, c] = ids
  await editor.switchPage(b)
  await editor.switchPage(c)
  await editor.switchPage(b)
  expect(recent.ids.value).toEqual([b, c, a])
  recent.dispose()
})

test('keeps a bounded history', async () => {
  const { editor, ids, recent } = setup(12)
  for (const id of ids) await editor.switchPage(id)
  expect(recent.ids.value).toHaveLength(8)
  expect(recent.ids.value[0]).toBe(ids.at(-1))
  recent.dispose()
})

test('starts over when the document is replaced', async () => {
  const { editor, ids, recent } = setup(2)
  await editor.switchPage(ids[1])
  editor.replaceGraph(new SceneGraph())
  expect(recent.ids.value).toEqual([editor.state.currentPageId])
  recent.dispose()
})
