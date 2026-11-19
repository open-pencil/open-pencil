import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { loadFont } from '@/app/editor/fonts'
import type { EditorPreparationHandle as DocumentLoadSession } from '@/app/editor/preparation/types'

export async function applyImportedDocument(
  editor: Editor,
  imported: SceneGraph,
  load?: DocumentLoadSession,
  { prepare = true }: { prepare?: boolean } = {}
) {
  if (prepare) {
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
    } finally {
      stagingEditor.dispose()
    }
  } else {
    load?.signal.throwIfAborted()
  }

  // The outgoing document's reader worker and archive copies go with it once it is replaced: the
  // tab never returns to that graph, and a large document does not fit in a page twice.
  const outgoing = editor.graph
  try {
    editor.replaceGraph(imported)
  } finally {
    if (editor.graph !== outgoing) editor.releaseGraphResources(outgoing)
  }
  editor.undo.clear()
  editor.clearSelection()
}
