import { canCreateInstance, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { CONTAINER_TYPES } from '@open-pencil/scene-graph/node-defaults'

import { acceptingParent } from '#core/editor/components/slots'
import type { EditorContext } from '#core/editor/types'

/**
 * Where ordinary paste and file drops insert; replacement paste uses its target's parent.
 * Never the locked part of an instance, only its slots.
 */
export function resolvePasteTarget(ctx: Pick<EditorContext, 'graph' | 'state'>): string {
  return acceptingParent(ctx, pasteTargetCandidate(ctx))
}

function pasteTargetCandidate(ctx: Pick<EditorContext, 'graph' | 'state'>): string {
  if (ctx.state.enteredContainerId) return ctx.state.enteredContainerId
  const ids = [...ctx.state.selectedIds]
  if (ids.length !== 1) return ctx.state.currentPageId
  const node = ctx.graph.getNode(ids[0])
  if (!node) return ctx.state.currentPageId
  if (CONTAINER_TYPES.has(node.type) && node.type !== 'CANVAS') return node.id
  return node.parentId ?? ctx.state.currentPageId
}

type PastedTree = SceneNode & { children?: PastedTree[] }

/** The document's components that pasted instances point at; copied components are new ones. */
export function pastedComponentIds(graph: SceneGraph, trees: readonly PastedTree[]): string[] {
  const copied = new Set<string>()
  const referenced = new Set<string>()
  const visit = (node: PastedTree) => {
    copied.add(node.id)
    if (node.type === 'INSTANCE' && node.componentId) referenced.add(node.componentId)
    for (const child of node.children ?? []) visit(child)
  }
  for (const tree of trees) visit(tree)
  return [...referenced].filter((id) => !copied.has(id) && graph.getNode(id)?.type === 'COMPONENT')
}

/**
 * `parentId`, or its nearest ancestor that can hold instances of these components without a
 * component containing itself: Figma pastes an instance next to its own main component, not in it.
 */
export function instanceSafeParent(
  graph: SceneGraph,
  parentId: string,
  componentIds: readonly string[]
): string {
  const safe = graph.closest(parentId, (node) =>
    componentIds.every((id) => canCreateInstance(graph, id, node.id))
  )
  return safe?.id ?? parentId
}
