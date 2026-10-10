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

/** The layers in each .fig frame's flow when layout first saw them, as its page opened. */
const savedFlows = new WeakMap<SceneGraph, Map<string, string>>()
/** Frames whose flow, or a flow inside it, lost or gained a layer since; kept until reload. */
const restructured = new WeakMap<SceneGraph, Set<string>>()
/** Frames that last laid out without their saved geometry, for the frames around them. */
const reflowed = new WeakMap<SceneGraph, Set<string>>()

function graphState<T>(states: WeakMap<SceneGraph, T>, graph: SceneGraph, create: () => T): T {
  let state = states.get(graph)
  if (!state) {
    state = create()
    states.set(graph, state)
  }
  return state
}

function flowOf(graph: SceneGraph, node: SceneNode): SceneNode[] {
  return graph.getChildren(node.id).filter((child) => child.layoutPositioning !== 'ABSOLUTE')
}

/**
 * Loading a file adds, moves, and removes layers too, so structure edits are told from it by
 * comparing the layers in a frame's flow, in order, with those layout first saw. A layer that
 * ignores auto layout, or stops ignoring it, leaves or joins the flow.
 */
function flowChanged(graph: SceneGraph, node: SceneNode, flow = flowOf(graph, node)): boolean {
  const seen = graphState(savedFlows, graph, () => new Map<string, string>())
  const ids = flow.map((child) => child.id).join(',')
  const saved = seen.get(node.id)
  if (saved === undefined) seen.set(node.id, ids)
  return saved !== undefined && saved !== ids
}

/**
 * Records that a layer joined, left, or moved in `parentId`'s children, as an editor sees an edit
 * happen, so the frame stops keeping saved geometry even if layout never ran on it before.
 */
export function markFlowChanged(graph: SceneGraph, parentId: string): void {
  graphState(restructured, graph, () => new Set<string>()).add(parentId)
}

/**
 * Whether layout still keeps the geometry saved for `frame` and its flow. Any frame stops once a
 * layer joins, leaves, or moves in its flow or a flow inside it; a frame read from a .fig file
 * also stops once it or a layer in its flow has its layout edited, such as by adding auto layout
 * or a gap. Other frames otherwise keep geometry copied with them, as an instance's layers do.
 */
export function keepsSavedLayout(graph: SceneGraph, frame: SceneNode): boolean {
  const fromFig = frame.source.format === 'fig'
  const flow = flowOf(graph, frame)
  // Nothing saved to keep: the usual case outside documents read from files.
  if (!fromFig && !frame.derivedLayout && !flow.some((child) => child.derivedLayout)) return true
  const stale = graphState(restructured, graph, () => new Set<string>())
  if (stale.has(frame.id)) return false
  // Layout runs inner frames first, so a changed flow deep inside is already marked.
  if (
    flowChanged(graph, frame, flow) ||
    flow.some((child) => stale.has(child.id) || flowChanged(graph, child))
  ) {
    stale.add(frame.id)
    return false
  }
  // Geometry copied with other layers, as an instance's are, stays until their structure changes.
  if (!fromFig) return true
  // A flow inside edited by now resizes this one, but a cancelled preview gives it back.
  const last = graphState(reflowed, graph, () => new Set<string>())
  const keeps =
    !hasEditedLayout(frame) && !flow.some((child) => hasEditedLayout(child) || last.has(child.id))
  if (keeps) last.delete(frame.id)
  else last.add(frame.id)
  return keeps
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
