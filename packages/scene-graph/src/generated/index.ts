import { CONNECTOR_KIND } from '../connectors/sublayers'
import type { SceneGraph } from '../graph'
import type { NodeType, SceneNode } from '../types'
import type { GeneratedFrameKind } from './kind'
import { SHAPE_WITH_TEXT_KIND } from './shape-with-text'
import { STICKY_KIND } from './sticky'

/**
 * Layers Figma generates from a template, which it calls immutable frames: their sublayers come
 * from the type and its settings, and a user edits them only through the frame. A sticky note's
 * body and author are such sublayers. They are real children here, so layout, drawing and text
 * editing treat them as any other layer, but nothing may add, move or remove them.
 *
 * Each type is described once, here; the editor and file formats ask it instead of testing for
 * the type.
 */
const GENERATED_FRAME_KINDS = {
  SHAPE_WITH_TEXT: SHAPE_WITH_TEXT_KIND,
  STICKY: STICKY_KIND,
  CONNECTOR: CONNECTOR_KIND
} satisfies Partial<Record<NodeType, GeneratedFrameKind>>

/** The layer types that are generated frames, for tables that must cover each of them. */
export type GeneratedFrameType = keyof typeof GENERATED_FRAME_KINDS

export const GENERATED_FRAME_TYPES: ReadonlySet<NodeType> = new Set(
  Object.keys(GENERATED_FRAME_KINDS) as GeneratedFrameType[]
)

/** What a generated frame's type says about it, or undefined for any other layer. */
export function generatedFrameKind(node: Pick<SceneNode, 'type'>): GeneratedFrameKind | undefined {
  return isGeneratedFrame(node) ? GENERATED_FRAME_KINDS[node.type] : undefined
}

export function isGeneratedFrame<N extends Pick<SceneNode, 'type'>>(
  node: N
): node is N & { type: GeneratedFrameType } {
  return GENERATED_FRAME_TYPES.has(node.type)
}

/** The generated frame a layer belongs to, if it is one of its sublayers. */
export function generatedFrameOwner(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  return node.parentId ? graph.closest(node.parentId, isGeneratedFrame) : undefined
}

/** The text a generated frame edits in place: a sticky note's body or a connector's label. */
export function generatedFrameText(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  return generatedFrameKind(node)?.text(graph, node)
}

/**
 * `changes` with what a width or height in them also sets on a generated frame
 * (`GeneratedFrameKind.sized`); fields `changes` sets itself, such as an undo restoring them, win.
 */
export function withGeneratedFrameSize(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
  const kind = generatedFrameKind(node)
  if (!kind?.sized || (changes.width === undefined && changes.height === undefined)) return changes
  return { ...kind.sized(changes, node), ...changes }
}

/** Whether a layer turns: any layer but a generated frame that stays upright. */
export function layerRotates(node: Pick<SceneNode, 'type'>): boolean {
  return generatedFrameKind(node)?.rotates ?? true
}

/** Whether a layer's resize handles and W and H fields resize it freely. */
export function layerResizes(node: Pick<SceneNode, 'type'>): boolean {
  return generatedFrameKind(node)?.resizes ?? true
}

export type { GeneratedFrameKind } from './kind'
export * from './shape-with-text'
export * from './sticky'
