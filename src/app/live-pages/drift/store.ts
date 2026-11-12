import type { Editor } from '@open-pencil/core'
import {
  isPluginDataEntry,
  OPEN_PENCIL_PLUGIN_DATA,
  withPluginData
} from '@open-pencil/scene-graph/plugin-data'

import { emptyDriftFile, parseDriftFile, type DriftFile } from './schema'

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
const driftField = OPEN_PENCIL_PLUGIN_DATA.drift

/**
 * The baselines the open document carries. A file anyone can edit is read reference by reference:
 * one baseline written by an older version is dropped, and the rest still compare.
 */
export function readDocumentDrift(editor: DriftEditor): DriftFile {
  const root = editor.graph.getNode(editor.graph.rootId)
  if (!root) return emptyDriftFile()
  const stored = root.pluginData.find((entry) => isPluginDataEntry(entry, driftField))?.value
  return stored === undefined ? emptyDriftFile() : parseDriftFile(stored)
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
