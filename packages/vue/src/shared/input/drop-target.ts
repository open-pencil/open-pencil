import type { Editor } from '@open-pencil/core/editor'
import type { NodeType, SceneNode } from '@open-pencil/scene-graph'

/** Parents a layer stays in while dragged until it lands on another frame. */
const ENCLOSING_TYPES = new Set<NodeType>(['GROUP', 'BOOLEAN_OPERATION'])
/** Containers that never take a drawn layer. */
const NOT_DRAWN_INTO = new Set<NodeType>(['GROUP', 'BOOLEAN_OPERATION', 'COMPONENT_SET'])

function acceptingTarget(target: SceneNode | null, editor: Editor): SceneNode | null {
  if (!target) return null
  // Only an instance's slots take layers; anywhere else in it drops into its parent.
  const accepting = editor.graph.getNode(editor.acceptingParent(target.id))
  if (!accepting || accepting.type === 'CANVAS' || !editor.acceptsChildren(accepting.id))
    return null
  return accepting
}

/** The frame a dragged layer lands in under the cursor; null is the page. */
export function findMoveDropTarget(
  cx: number,
  cy: number,
  editor: Editor,
  excludeIds: ReadonlySet<string> = editor.state.selectedIds
): SceneNode | null {
  const moving = [...excludeIds].map((id) => editor.graph.getNode(id))
  const components = moving.length > 0 && moving.every((node) => node?.type === 'COMPONENT')
  const componentSetIds = components
    ? new Set(moving.flatMap((node) => (node?.parentId ? [node.parentId] : [])))
    : undefined
  let dropTarget = editor.graph.hitTestDropTarget(cx, cy, excludeIds, editor.state.currentPageId, {
    componentSetIds
  })
  const movingSection = moving.some((node) => node?.type === 'SECTION')
  if (movingSection && dropTarget && dropTarget.type !== 'SECTION') {
    dropTarget = null
  }
  return acceptingTarget(dropTarget, editor)
}

function takesDrawnLayer(target: SceneNode, type: NodeType) {
  if (NOT_DRAWN_INTO.has(target.type)) return false
  // Sections only go into pages and other sections.
  return type !== 'SECTION' || target.type === 'SECTION'
}

/** The parent a new layer drawn from this point goes into. */
export function findDrawParent(cx: number, cy: number, type: NodeType, editor: Editor): string {
  let target = editor.graph.hitTestDropTarget(cx, cy, new Set(), editor.state.currentPageId)
  while (target && target.type !== 'CANVAS' && !takesDrawnLayer(target, type)) {
    target = target.parentId ? (editor.graph.getNode(target.parentId) ?? null) : null
  }
  return acceptingTarget(target, editor)?.id ?? editor.state.currentPageId
}

/** The frame or page that holds a layer, looking past the groups it sits in. */
function enclosingContainer(id: string, editor: Editor): string {
  let parent = editor.graph.getNode(editor.graph.getNode(id)?.parentId ?? '')
  while (parent?.parentId && ENCLOSING_TYPES.has(parent.type)) {
    parent = editor.graph.getNode(parent.parentId)
  }
  return parent?.id ?? editor.state.currentPageId
}

/**
 * Moves dropped layers into the frame under the cursor, or onto the page. A layer that lands in
 * the frame already holding it keeps its group.
 */
export function reparentDroppedNodes(editor: Editor, ids: string[], targetId: string | null) {
  const target = targetId ?? editor.state.currentPageId
  const moving = ids.filter((id) => enclosingContainer(id, editor) !== target)
  if (moving.length > 0) editor.reparentNodes(moving, target)
}
