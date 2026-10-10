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

/**
 * Whether layout still keeps the geometry a file saved for `frame` and its flow: a frame read from
 * a .fig file does until it or a layer in its flow has its layout edited, such as by adding auto
 * layout or a gap. Other frames keep geometry copied with them, as an instance's layers do.
 */
export function keepsSavedLayout(graph: SceneGraph, frame: SceneNode): boolean {
  if (frame.source.format !== 'fig') return true
  if (hasEditedLayout(frame)) return false
  return graph
    .getChildren(frame.id)
    .every((child) => child.layoutPositioning === 'ABSOLUTE' || !hasEditedLayout(child))
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
