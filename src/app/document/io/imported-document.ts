import type { Editor } from '@inkly/core/editor'
import { computeAllLayouts } from '@inkly/core/layout'
import type { SceneGraph, SceneNode } from '@inkly/core/scene-graph'

export async function applyImportedDocument(editor: Editor, imported: SceneGraph) {
  const firstPage = imported.getPages()[0] as SceneNode | undefined
  if (firstPage) computeAllLayouts(imported, firstPage.id)
  editor.replaceGraph(imported)
  editor.undo.clear()
  editor.clearSelection()
  const pageId = firstPage?.id ?? editor.graph.rootId
  await editor.switchPage(pageId)
}
