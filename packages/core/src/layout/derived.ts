import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/** Edits that make saved geometry stale: layout fields, visibility, and text laid out again. */
const LAYOUT_EDIT_FIELDS: ReadonlySet<string> = new Set([
  ...SceneGraph.LAYOUT_AFFECTING_KEYS,
  'visible',
  'derivedLayout'
])

function hasEditedLayout(node: SceneNode): boolean {
  return node.source.editedFields.some((field) => LAYOUT_EDIT_FIELDS.has(field))
}

/** Each .fig frame's children when layout first saw them, which is when its page opened. */
const savedChildren = new WeakMap<SceneGraph, Map<string, string>>()
/** Frames whose flow, or a flow inside it, lost or gained a layer since; kept until reload. */
const restructured = new WeakMap<SceneGraph, Set<string>>()

function graphState<T>(states: WeakMap<SceneGraph, T>, graph: SceneGraph, create: () => T): T {
  let state = states.get(graph)
  if (!state) {
    state = create()
    states.set(graph, state)
  }
  return state
}

/**
 * Loading a file adds, moves, and removes layers too, so structure edits are told from it by
 * comparing a frame's children with those layout first saw.
 */
function childrenChanged(graph: SceneGraph, node: SceneNode): boolean {
  const seen = graphState(savedChildren, graph, () => new Map<string, string>())
  const children = node.childIds.join(',')
  const saved = seen.get(node.id)
  if (saved === undefined) seen.set(node.id, children)
  return saved !== undefined && saved !== children
}

/**
 * Whether layout still keeps the geometry a file saved for `frame` and its flow: a frame read from
 * a .fig file does until it or a layer in its flow has its layout edited, such as by adding auto
 * layout or a gap, or a layer joins, leaves, or moves in its flow or a flow inside it. Other
 * frames keep geometry copied with them, as an instance's layers do.
 */
export function keepsSavedLayout(graph: SceneGraph, frame: SceneNode): boolean {
  if (frame.source.format !== 'fig') return true
  const stale = graphState(restructured, graph, () => new Set<string>())
  if (stale.has(frame.id)) return false
  const flow = graph.getChildren(frame.id).filter((child) => child.layoutPositioning !== 'ABSOLUTE')
  // Layout runs inner frames first, so a changed flow deep inside is already marked.
  if (
    childrenChanged(graph, frame) ||
    flow.some((child) => stale.has(child.id) || childrenChanged(graph, child))
  ) {
    stale.add(frame.id)
    return false
  }
  return !hasEditedLayout(frame) && !flow.some(hasEditedLayout)
}

export function usesDetachedDerivedLayout(graph: SceneGraph, child: SceneNode): boolean {
  const derived = child.derivedLayout
  if (!derived || child.layoutMode === 'NONE' || child.layoutGrow > 0) return false
  const isRow = child.layoutMode === 'HORIZONTAL'
  const widthSizing = isRow ? child.primaryAxisSizing : child.counterAxisSizing
  const heightSizing = isRow ? child.counterAxisSizing : child.primaryAxisSizing
  return (
    ((widthSizing === 'HUG' && derived.width !== undefined) ||
      (heightSizing === 'HUG' && derived.height !== undefined)) &&
    keepsSavedLayout(graph, child)
  )
}
