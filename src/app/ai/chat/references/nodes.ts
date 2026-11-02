import type { SceneGraph } from '@lawha/scene-graph'

import { resolveReferencedNodes, type ReferencedNode } from '@/app/ai/chat/context'

import { findReferences } from './link'

/** The layers a message mentions that the document still has, which it carries as previews. */
export function mentionedNodes(graph: SceneGraph, text: string): ReferencedNode[] {
  const ids = findReferences(text).flatMap(({ reference }) =>
    reference.kind === 'node' ? [reference.id] : []
  )
  return resolveReferencedNodes(graph, ids)
}
