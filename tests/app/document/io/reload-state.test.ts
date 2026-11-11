import { afterEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { parseFigFile } from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { applyImportedDocument } from '@/app/document/io/imported-document'
import { captureReloadState, restoreReloadState } from '@/app/document/io/reload-state'
import { createDeferred } from '@/app/runtime/deferred'

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

test('a superseded reload keeps the newer page viewport', async () => {
  const graph = new SceneGraph()
  const restored = graph.addPage('Restored')
  const newer = graph.addPage('Newer')
  graph.createNode('TEXT', restored.id, { text: 'Loading', fontFamily: 'Reload Test' })
  const loading = createDeferred<undefined>()
  const fontReady = createDeferred<undefined>()
  const editor = createEditor({
    graph,
    skipInitialGraphSetup: true,
    loadFont: async () => {
      loading.resolve(undefined)
      await fontReady.promise
      return null
    }
  })
  editors.push(editor)
  const restoring = restoreReloadState(editor, editor.state, {
    pageId: restored.id,
    viewport: { panX: 120, panY: 80, zoom: 2 }
  })
  try {
    await loading.promise
    await editor.switchPage(newer.id)
    editor.state.panX = 340
    editor.state.panY = 210
    editor.state.zoom = 3
  } finally {
    fontReady.resolve(undefined)
    await restoring
  }

  expect(editor.state.currentPageId).toBe(newer.id)
  expect(captureReloadState(editor.state).viewport).toEqual({ panX: 340, panY: 210, zoom: 3 })
})

test('a reload whose file no longer has the page on screen stays on its first page', async () => {
  const { bytes } = await twoPageFig()
  const editor = createEditor({ graph: new SceneGraph(), skipInitialGraphSetup: true })
  editors.push(editor)
  await applyImportedDocument(editor, await readFirstPage(bytes))
  editor.state.panX = 120
  editor.state.zoom = 2

  const snapshot = { ...captureReloadState(editor.state), pageId: 'removed:1' }
  await applyImportedDocument(editor, await readFirstPage(bytes))
  await restoreReloadState(editor, editor.state, snapshot)

  expect(editor.state.currentPageId).toBe(editor.graph.getPages()[0]?.id)
  expect(editor.state.panX).toBe(120)
  expect(editor.state.zoom).toBe(2)
})
