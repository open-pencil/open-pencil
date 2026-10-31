import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { captureTouchedCheckpoint } from '@open-pencil/scene-graph/checkpoint'

import type { Editor } from '#core/editor/create'
import { ReadOnlyDocumentError } from '#core/editor/read-only'
import { resolveEditorProfile, type EditorProfileInputs } from '#core/editor/views'
import type { FigmaAPI } from '#core/figma-api'
import { isAtomicTool, type ToolDef } from '#core/tools/schema'

import {
  applyDocumentChange,
  documentChangeFromCheckpoint,
  emptyDocumentChange,
  recordChanges,
  type DocumentChange
} from './document-change'

/** The most layers one atomic edit may change; layout that follows it is not counted. */
const MAX_ATOMIC_CHANGED_LAYERS = 10_000

type MutationEditor = Pick<
  Editor,
  'graph' | 'runLayoutForNode' | 'requestRender' | 'pushUndoStep'
> & {
  state: EditorProfileInputs
}

export interface AtomicToolOptions {
  signal?: AbortSignal
  isLive?: () => boolean
  label?: string
  /**
   * Called once after preflight: the committed step's change, or an empty change for no-op,
   * source-only or rolled-back calls.
   */
  onRecorded?: (change: DocumentChange) => void
}

/**
 * Runs a tool that only changes properties of layers and variables, anywhere in the document, as
 * one undo step, and rolls it back whole when it fails. It records the layers the graph reports
 * it changing (`SceneGraph.observeNodeChanges`), so its cost follows what it touches rather than
 * the document's size. Component synchronization remains editor-owned.
 *
 * No await is permitted between snapshot and commit. Browser events, other agents and
 * cancellation cannot interleave with this bounded transaction. Async tools use their
 * existing execution path and are not exposed through WebMCP.
 */
export function executeAtomicTool(
  editor: MutationEditor,
  figma: FigmaAPI,
  def: ToolDef,
  args: Record<string, unknown>,
  options: AtomicToolOptions = {}
): unknown {
  if (!isAtomicTool(def)) throw new Error(`Not an atomic tool: ${def.name}`)
  if (!resolveEditorProfile(editor.state).edits) throw new ReadOnlyDocumentError()
  options.signal?.throwIfAborted()
  if (editor.graph !== figma.graph || options.isLive?.() === false) {
    throw new Error('The target document is no longer open')
  }
  const graph = figma.graph
  const pageId = figma.currentPageId
  const checkpoint = captureTouchedCheckpoint(graph)
  let recorded = emptyDocumentChange(pageId)

  const replay = (change: DocumentChange, side: 'before' | 'after') => {
    if (editor.graph !== graph) throw new Error('The target document has been replaced')
    applyDocumentChange(graph, change, side)
    layout(
      graph,
      editor,
      change.variables.length > 0,
      change.updated.map((update) => update.id)
    )
    editor.requestRender()
  }

  try {
    const result = def.execute(figma, args)
    if (result instanceof Promise) throw new Error('Atomic tools must execute synchronously')
    if (result && typeof result === 'object' && 'error' in result) {
      throw new Error(String(result.error))
    }
    checkpoint.assertPropertiesOnly()
    const changed = checkpoint.reported.size
    if (changed > MAX_ATOMIC_CHANGED_LAYERS) {
      throw new Error(
        `This edit changes ${changed} layers; one atomic agent edit may change at most ${MAX_ATOMIC_CHANGED_LAYERS}. Change fewer layers per call.`
      )
    }
    const records = recordChanges(graph, checkpoint)
    layout(graph, editor, records.variables.length > 0, checkpoint.reported)
    // Layout must not restructure the document either.
    checkpoint.assertPropertiesOnly()
    checkpoint.stop()
    const change = documentChangeFromCheckpoint(graph, pageId, checkpoint, records)
    const contentChanged =
      change.variables.length > 0 || change.updated.some((update) => update.fields)
    if (!contentChanged && change.updated.length) replay(change, 'before')
    if (contentChanged) {
      editor.pushUndoStep({
        label: `${options.label ?? 'Agent'}: ${def.name}`,
        inverse: () => replay(change, 'before'),
        forward: () => replay(change, 'after')
      })
      recorded = change
      editor.requestRender()
    }
    return result
  } catch (error) {
    checkpoint.restore()
    editor.requestRender()
    throw error
  } finally {
    options.onRecorded?.(recorded)
  }
}

/**
 * Lays out the layers an edit changed, as the editor lays out a user's edit: each changed layer
 * with its subtree and the auto-layout frames around it. Bound values follow variables anywhere,
 * so a variable change lays out every page.
 */
function layout(
  graph: SceneGraph,
  editor: MutationEditor,
  allPages: boolean,
  changedIds: Iterable<string>
): void {
  const pages = new Set(allPages ? graph.getPages().map((page) => page.id) : [])
  for (const id of pages) editor.runLayoutForNode(id)
  for (const id of layoutScopes(graph, changedIds)) {
    const page = graph.pageOf(id)
    if (!page || !pages.has(page)) editor.runLayoutForNode(id)
  }
}

/**
 * The layers to lay out for `ids`, each once. A layer in an auto-layout frame is laid out with
 * that frame, and the frame with any auto-layout frame around it, so changed siblings share one
 * layout of their parent rather than each laying it out again. The document node is left out,
 * as laying it out would lay out every page.
 */
function layoutScopes(graph: SceneGraph, ids: Iterable<string>): string[] {
  const inAutoLayout = (node: SceneNode) => {
    const parent = node.parentId ? graph.getNode(node.parentId) : undefined
    return parent !== undefined && parent.layoutMode !== 'NONE'
  }
  const scopes = new Set<string>()
  for (const id of ids) {
    const scope = graph.closest(id, (node) => !inAutoLayout(node))
    if (scope && scope.id !== graph.rootId) scopes.add(scope.id)
  }
  return [...scopes].filter((id) => {
    const parentId = graph.getNode(id)?.parentId
    return !parentId || !graph.closest(parentId, (node) => scopes.has(node.id))
  })
}
