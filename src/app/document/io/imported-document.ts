import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { loadFont } from '@/app/editor/fonts'
import type { EditorPreparationHandle as DocumentLoadSession } from '@/app/editor/preparation/types'

export async function applyImportedDocument(
  editor: Editor,
  imported: SceneGraph,
  load?: DocumentLoadSession
) {
  const firstPage = imported.getPages()[0] as SceneNode | undefined
  const pageId = firstPage?.id ?? imported.rootId
  const stagingEditor = createEditor({
    graph: imported,
    loadFont,
    skipInitialGraphSetup: true
  })
  try {
    load?.update({ phase: 'populating-page', detail: firstPage?.name ?? null })
    const prepared = await stagingEditor.preparePage(pageId, {
      signal: load?.signal,
      onProgress: (progress) => load?.update(progress)
    })
    load?.signal.throwIfAborted()
    if (!prepared) throw new Error('Imported page preparation was superseded')

    editor.replaceGraph(imported)
    editor.undo.clear()
    editor.clearSelection()
  } finally {
    stagingEditor.dispose()
  }
}
