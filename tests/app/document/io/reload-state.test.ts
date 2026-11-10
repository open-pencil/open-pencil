import { afterEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { parseFigFile } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { applyImportedDocument } from '@/app/document/io/imported-document'
import { captureReloadState, restoreReloadState } from '@/app/document/io/reload-state'

let editors: Editor[] = []

afterEach(() => {
  for (const editor of editors) editor.dispose()
  editors = []
})

/** A two-page `.fig` whose second page holds a frame, as bytes. */
async function twoPageFig(): Promise<{ bytes: Uint8Array; frameId: string }> {
  const source = new SceneGraph()
  source.createNode('FRAME', source.getPages()[0].id, { name: 'First frame' })
  const second = source.addPage('Second')
  const frame = source.createNode('FRAME', second.id, { name: 'Second frame' })
  const written = await new IORegistry(BUILTIN_IO_FORMATS).writeDocument('fig', source)
  return { bytes: written.data as Uint8Array, frameId: frame.id }
}

/** Reads the file as opening and reloading do: only the first page has its layers. */
function readFirstPage(bytes: Uint8Array): Promise<SceneGraph> {
  return parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
}

test('a reload returns to the page on screen with its layers loaded', async () => {
  const { bytes, frameId } = await twoPageFig()
  const editor = createEditor({ graph: new SceneGraph(), skipInitialGraphSetup: true })
  editors.push(editor)
  await applyImportedDocument(editor, await readFirstPage(bytes))
  const second = editor.graph.getPages().find((page) => page.name === 'Second')
  if (!second) throw new Error('Missing second page')
  await editor.switchPage(second.id)
  expect(editor.graph.getNode(frameId)).toBeDefined()
  editor.state.panX = 120
  editor.state.zoom = 2

  const snapshot = captureReloadState(editor.state)
  await applyImportedDocument(editor, await readFirstPage(bytes))
  await restoreReloadState(editor, editor.state, snapshot)

  expect(editor.state.currentPageId).toBe(second.id)
  expect(editor.graph.getNode(frameId)?.parentId).toBe(second.id)
  expect(editor.state.panX).toBe(120)
  expect(editor.state.zoom).toBe(2)
})
