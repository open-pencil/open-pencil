import type { Editor } from '@open-pencil/core'
import {
  jsonPluginDataField,
  readPluginData,
  withPluginData
} from '@open-pencil/scene-graph/plugin-data'

import { driftFileSchema, emptyDriftFile, type DriftFile } from './schema'

/**
 * What keeping baselines needs from the open document: its graph, and an edit that can be undone
 * like any other. Narrowed to those two so a caller need not be a whole editor.
 */
export type DriftEditor = Pick<Editor, 'graph' | 'updateNodeWithUndo'>

/**
 * The baselines of one document, kept on its root layer beside the comments and statuses it
 * already carries. They travel with the document and undo like any other edit, so a comparison
 * written by one person is what the next person compares against.
 */
const driftField = jsonPluginDataField('drift', 'bookkeeping', driftFileSchema)

/** The baselines the open document carries, or an empty set when it has none yet. */
export function readDocumentDrift(editor: DriftEditor): DriftFile {
  const root = editor.graph.getNode(editor.graph.rootId)
  if (!root) return emptyDriftFile()
  return readPluginData(root.pluginData, driftField) ?? emptyDriftFile()
}

/** Replace the document's baselines as one undoable edit. */
export function writeDocumentDrift(editor: DriftEditor, file: DriftFile): void {
  const root = editor.graph.getNode(editor.graph.rootId)
  if (!root) return
  editor.updateNodeWithUndo(
    root.id,
    { pluginData: withPluginData(root.pluginData, driftField, file) },
    'Update page baselines'
  )
}
