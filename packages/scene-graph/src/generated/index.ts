import type { SceneGraph } from '../index'
import type { NodeType, SceneNode } from '../types'
import { CONNECTOR_KIND } from './connector'
import type { GeneratedFrameKind } from './kind'
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
const GENERATED_FRAME_KINDS: Partial<Record<NodeType, GeneratedFrameKind>> = {
  STICKY: STICKY_KIND,
  CONNECTOR: CONNECTOR_KIND
}

export const GENERATED_FRAME_TYPES: ReadonlySet<NodeType> = new Set(
  Object.keys(GENERATED_FRAME_KINDS) as NodeType[]
)

/** What a generated frame's type says about it, or undefined for any other layer. */
export function generatedFrameKind(node: Pick<SceneNode, 'type'>): GeneratedFrameKind | undefined {
  return GENERATED_FRAME_KINDS[node.type]
}

export function isGeneratedFrame(node: Pick<SceneNode, 'type'>): boolean {
  return GENERATED_FRAME_TYPES.has(node.type)
}

/** The generated frame a layer belongs to, if it is one of its sublayers. */
export function generatedFrameOwner(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  return node.parentId ? graph.closest(node.parentId, isGeneratedFrame) : undefined
}

/** The text a generated frame edits in place, such as a sticky note's body. */
export function generatedFrameText(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  return generatedFrameKind(node)?.text(graph, node)
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
export * from './connector'
export * from './sticky'
