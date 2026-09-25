import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { buildFigmaClipboardHTML } from '#core/clipboard'
import type { EditorContext } from '#core/editor/types'

import { captureClipboardSnapshot, type ClipboardSnapshot } from './snapshot'

export type { ClipboardSnapshot } from './snapshot'

export interface ClipboardPayload {
  snapshot?: ClipboardSnapshot
  html: string
  plainText: string
}

/**
 * The Figma payload is encoded from the snapshot alone, so everything the encoder resolves
 * by id — component dependencies, styles, variables — has to be indexed alongside the nodes.
 */
function graphForSnapshot(ctx: EditorContext, snapshot: ClipboardSnapshot): SceneGraph {
  const graph = new SceneGraph()
  graph.documentColorSpace = ctx.graph.documentColorSpace
  graph.images = snapshot.images
  function index(node: SceneNode & { children?: SceneNode[] }) {
    graph.nodes.set(node.id, node)
    for (const child of node.children ?? []) index(child)
  }
  for (const node of snapshot.nodes) index(node)
  for (const node of snapshot.componentDependencies) index(node)
  for (const node of snapshot.styleDefinitions) index(node)
  for (const collection of snapshot.variableDependencies.collections)
    graph.variableCollections.set(collection.id, collection)
  for (const variable of snapshot.variableDependencies.variables)
    graph.variables.set(variable.id, variable)
  return graph
}

export function createClipboardCopyActions(ctx: EditorContext) {
  async function prepareCopy(selectedNodes: SceneNode[]): Promise<ClipboardPayload> {
    if (selectedNodes.length === 0) return { html: '', plainText: '' }
    const snapshot = captureClipboardSnapshot(ctx.graph, selectedNodes)
    const plainText = snapshot.nodes.map((node) => node.name).join('\n')
    const html = await buildFigmaClipboardHTML(snapshot.nodes, graphForSnapshot(ctx, snapshot))
    if (!html) throw new Error('Could not encode selection for the clipboard')
    return { html, plainText, snapshot }
  }
  return { prepareCopy }
}
