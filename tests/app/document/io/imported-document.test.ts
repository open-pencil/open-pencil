import { expect, spyOn, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

import { applyImportedDocument } from '@/app/document/io/imported-document'
import { createEditorPreparationController } from '@/app/editor/preparation/controller'
import { createInitialAppEditorState } from '@/app/editor/session/types'

test('cancelled imported-document staging preserves the live graph', async () => {
  const liveGraph = new SceneGraph()
  const liveEditor = createEditor({ graph: liveGraph, skipInitialGraphSetup: true })
  const imported = new SceneGraph()
  const importedPage = imported.getPages()[0]
  if (!importedPage) throw new Error('Expected imported page')
  imported.updateNode(importedPage.id, { name: 'Imported' })
  const controller = createEditorPreparationController(
    createInitialAppEditorState(liveGraph.rootId)
  )
  const preparation = controller.begin({ kind: 'document-open' })
  preparation.cancel()

  await expect(applyImportedDocument(liveEditor, imported, preparation)).rejects.toHaveProperty(
    'name',
    'AbortError'
  )
  expect(liveEditor.graph).toBe(liveGraph)
  liveEditor.dispose()
})

test('prepared imported documents replace the live graph only after staging', async () => {
  const liveGraph = new SceneGraph()
  const liveEditor = createEditor({ graph: liveGraph, skipInitialGraphSetup: true })
  const imported = new SceneGraph()
  const page = imported.getPages()[0]
  if (!page) throw new Error('Expected imported page')
  imported.updateNode(page.id, { name: 'Imported' })

  await applyImportedDocument(liveEditor, imported)

  expect(liveEditor.graph).toBe(imported)
  expect(liveEditor.state.currentPageId).toBe(page.id)
  liveEditor.dispose()
})

test('deferred imported documents replace the graph without staging the first page', async () => {
  const liveGraph = new SceneGraph()
  const liveEditor = createEditor({ graph: liveGraph, skipInitialGraphSetup: true })
  const imported = new SceneGraph()
  const controller = createEditorPreparationController(
    createInitialAppEditorState(liveGraph.rootId)
  )
  const preparation = controller.begin({ kind: 'document-open' })
  const progress = spyOn(preparation, 'update')

  await applyImportedDocument(liveEditor, imported, preparation, { prepare: false })

  expect(liveEditor.graph).toBe(imported)
  // Staging reports populating the first page; the page the tab shows prepares itself later.
  expect(progress).not.toHaveBeenCalled()
  liveEditor.dispose()
})
