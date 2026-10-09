import {
  captureGraphCheckpoint,
  type SceneGraph,
  type SceneNode,
  type Variable
} from '@open-pencil/scene-graph'

import type { Editor } from '#core/editor/create'
import type { FigmaAPI } from '#core/figma-api'
import { isAtomicTool, type ToolDef } from '#core/tools/schema'

import { diffFields, type FieldChanges } from './diff'

// Capture property changes across pages. Component synchronization remains editor-owned.
const MAX_TRANSACTION_NODES = 10_000

type MutationEditor = Pick<Editor, 'graph' | 'runLayoutForNode' | 'requestRender' | 'pushUndoEntry'>

function changes<T extends object>(
  before: Map<string, T>,
  after: Map<string, T>
): FieldChanges<T>[] {
  const result: FieldChanges<T>[] = []
  for (const [id, previous] of before) {
    const current = after.get(id)
    if (!current) throw new Error('Atomic tools must not remove nodes or variables')
    const change = diffFields(id, previous, current)
    if (change) result.push(change)
  }
  if (before.size !== after.size) throw new Error('Atomic tools must not create nodes or variables')
  return result
}

/**
 * No await is permitted between snapshot and commit. Browser events, other agents and
 * cancellation cannot interleave with this bounded transaction. Async tools use their
 * existing execution path and are not exposed through WebMCP.
 */
export function executeAtomicTool(
  editor: MutationEditor,
  figma: FigmaAPI,
  def: ToolDef,
  args: Record<string, unknown>,
  options: { signal?: AbortSignal; isLive?: () => boolean; label?: string } = {}
): unknown {
  if (!isAtomicTool(def)) throw new Error(`Not an atomic tool: ${def.name}`)
  options.signal?.throwIfAborted()
  if (editor.graph !== figma.graph || options.isLive?.() === false) {
    throw new Error('The target document is no longer open')
  }
  const graph = figma.graph
  if (graph.nodes.size + graph.variables.size > MAX_TRANSACTION_NODES) {
    throw new Error('Document too large for atomic agent editing (maximum 10000 nodes)')
  }
  const checkpoint = captureGraphCheckpoint(graph)
  const { nodes, variables } = checkpoint
  const pageId = figma.currentPageId

  const replay = (
    nodeChanges: FieldChanges<SceneNode>[],
    variableChanges: FieldChanges<Variable>[],
    direction: 'before' | 'after'
  ) => {
    if (editor.graph !== graph) throw new Error('The target document has been replaced')
    for (const change of variableChanges) {
      const variable = graph.variables.get(change.id)
      if (variable) {
        Object.assign(variable, structuredClone(change[direction]))
        for (const key of change.absent[direction]) Reflect.deleteProperty(variable, key)
      }
    }
    graph.preserveSourceMetadataDuring(() => {
      for (const change of nodeChanges)
        graph.restoreNodeProperties(
          change.id,
          structuredClone(change[direction]),
          change.absent[direction]
        )
    })
    layout(
      graph,
      editor,
      pageId,
      variableChanges.length > 0,
      nodeChanges.map((change) => change.id)
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
    const variableChanges = changes(variables, graph.variables)
    layout(
      graph,
      editor,
      pageId,
      variableChanges.length > 0,
      changes(nodes, graph.nodes).map((change) => change.id)
    )
    const nodeChanges = changes(nodes, graph.nodes)
    const contentChanged =
      variableChanges.length > 0 ||
      nodeChanges.some((change) => Object.keys(change.after).some((key) => key !== 'source'))
    if (!contentChanged && nodeChanges.length) replay(nodeChanges, [], 'before')
    if (contentChanged) {
      editor.pushUndoEntry({
        label: `${options.label ?? 'Agent'}: ${def.name}`,
        inverse: () => replay(nodeChanges, variableChanges, 'before'),
        forward: () => replay(nodeChanges, variableChanges, 'after')
      })
      editor.requestRender()
    }
    return result
  } catch (error) {
    checkpoint.restore()
    editor.requestRender()
    throw error
  }
}

function layout(
  graph: SceneGraph,
  editor: MutationEditor,
  pageId: string,
  allPages: boolean,
  changedIds: string[]
): void {
  const scopes = new Set(allPages ? graph.getPages().map((page) => page.id) : [pageId])
  for (const id of changedIds) {
    let node = graph.getNode(id)
    while (node && node.type !== 'CANVAS')
      node = node.parentId ? graph.getNode(node.parentId) : undefined
    if (node) scopes.add(node.id)
  }
  for (const id of scopes) editor.runLayoutForNode(id)
}
