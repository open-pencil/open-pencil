import type { Draft } from '#design-json/compact/tree'
import type { CompactComment } from '#design-json/compact/types'

import type { CommentThread, SceneGraph } from '@open-pencil/scene-graph'
import { commentPosition, readComments } from '@open-pencil/scene-graph/comments'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

function contains(bounds: Rect, point: Vector): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

/** A group the design made, not one inferred around overlapping layers. */
function isDesignGroup(draft: Draft): boolean {
  return draft.layer.kind === 'group' && !draft.layer.inferred
}

/**
 * The layer a pin at `point` speaks of: the topmost one under it, then the topmost of its children
 * under it, and so on down; a group the design made takes the pin itself rather than its layers.
 */
function layerUnder(drafts: readonly Draft[], point: Vector): Draft | undefined {
  const under = drafts.findLast((draft) => contains(draft.bounds, point))
  if (!under || isDesignGroup(under)) return under
  return layerUnder(under.children, point) ?? under
}

/** A comment, at `at`: its pin's place in its layer's box, or on the canvas for a loose one. */
function compactComment(thread: CommentThread, at: Vector): CompactComment {
  const replies = thread.replies
    .filter((reply) => !reply.deleted)
    .map(({ author, text }) => ({ author, text }))
  const comment: CompactComment = {
    id: thread.id,
    x: at.x,
    y: at.y,
    author: thread.author,
    text: thread.text
  }
  if (thread.resolved) comment.resolved = true
  if (replies.length > 0) comment.replies = replies
  return comment
}

/**
 * Puts each comment on the layer it was left on: the deepest layer under its pin, up to the
 * topmost layer, a group the design made taking it for its layers. A comment whose pin is over
 * none of them is loose, returned with its place on the canvas; one on a page none of the layers
 * is on is left out.
 */
export function attachComments(graph: SceneGraph, roots: readonly Draft[]): CompactComment[] {
  const pages = new Set(roots.map((root) => graph.pageOf(root.layer.id)))
  const loose: CompactComment[] = []
  for (const thread of readComments(graph)) {
    if (thread.deleted || !pages.has(thread.pageId)) continue
    const onPage = roots.filter((root) => graph.pageOf(root.layer.id) === thread.pageId)
    const pin = commentPosition(graph, thread)
    const under = layerUnder(onPage, pin)
    if (!under) {
      loose.push(compactComment(thread, pin))
      continue
    }
    const at = { x: pin.x - under.bounds.x, y: pin.y - under.bounds.y }
    under.layer.comments = [...(under.layer.comments ?? []), compactComment(thread, at)]
  }
  return loose
}
