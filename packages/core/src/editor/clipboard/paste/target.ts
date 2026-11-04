import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import { CONTAINER_TYPES } from '@open-pencil/scene-graph/node-defaults'
import type { Vector } from '@open-pencil/scene-graph/primitives'

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

/**
 * Where a paste with nothing selected goes, as Figma pastes it: back into the frame or section
 * the layers were copied out of, while it still exists on this page and takes layers. Null for
 * top-level layers, layers from several places, or a parent that is gone.
 */
export function sourcePasteTarget(
  ctx: Pick<EditorContext, 'graph' | 'state'>,
  sourceIds: readonly (string | null)[]
): string | null {
  const [id, ...rest] = sourceIds
  if (!id || rest.some((other) => other !== id)) return null
  if (ctx.state.selectedIds.size > 0 || ctx.state.enteredContainerId) return null
  if (!ctx.graph.getNode(id) || ctx.graph.pageOf(id) !== ctx.state.currentPageId) return null
  return acceptingParent(ctx, id) === id ? id : null
}

/**
 * Where a paste goes before cycles are checked: a replaced layer's parent, the frame a paste with
 * nothing selected came from (`returningTo`), or the selection's paste target.
 */
export function requestedPasteTarget(
  ctx: Pick<EditorContext, 'graph' | 'state'>,
  sourceIds: readonly (string | null)[],
  replacedParentId: string | null,
  atCursor: boolean
): { requestedTarget: string; returningTo: string | null } {
  const returningTo = replacedParentId || atCursor ? null : sourcePasteTarget(ctx, sourceIds)
  return {
    requestedTarget: replacedParentId ?? returningTo ?? resolvePasteTarget(ctx),
    returningTo
  }
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

/** A canvas point in the coordinates of the layer pasted into, where its new children sit. */
export function parentLocalPoint(
  ctx: Pick<EditorContext, 'graph'>,
  parentId: string,
  x: number,
  y: number
): Vector {
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return { x, y }
  const inverse = Matrix.invert(getWorldMatrix(parent, ctx.graph))
  return inverse ? Matrix.mapPoint(inverse, { x, y }) : { x, y }
}
