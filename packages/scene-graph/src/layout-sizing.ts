import type { SceneGraph } from './index'
import type { LayoutSizing, SceneNode, TextAutoResize } from './types'

/**
 * How a node sizes along one screen axis, as Figma's `layoutSizingHorizontal` and
 * `layoutSizingVertical` report it. Fill is stored on the child, the way Figma stores it:
 * along the parent's primary axis as `layoutGrow`, across it as `layoutAlignSelf: 'STRETCH'`.
 * A grid lays its children out like a horizontal stack. Hug is stored on the node itself:
 * `primaryAxisSizing` and `counterAxisSizing` for an auto-layout frame, `textAutoResize`
 * for text.
 */
export type LayoutSizingAxis = 'HORIZONTAL' | 'VERTICAL'

type AutoLayoutMode = Exclude<SceneNode['layoutMode'], 'NONE'>

function primaryAxis(mode: AutoLayoutMode): LayoutSizingAxis {
  return mode === 'VERTICAL' ? 'VERTICAL' : 'HORIZONTAL'
}

/** The auto-layout parent that sizes a node's fill, or `undefined` when nothing does. */
function fillingParent(parent: SceneNode | undefined, node: SceneNode): SceneNode | undefined {
  if (!parent || parent.layoutMode === 'NONE' || node.layoutPositioning === 'ABSOLUTE')
    return undefined
  return parent
}

function graphParent(graph: SceneGraph, node: SceneNode): SceneNode | undefined {
  return node.parentId ? graph.getNode(node.parentId) : undefined
}

function fills(parent: SceneNode, node: SceneNode, axis: LayoutSizingAxis): boolean {
  if (parent.layoutMode === 'NONE') return false
  if (axis === primaryAxis(parent.layoutMode)) return node.layoutGrow > 0
  if (node.layoutAlignSelf === 'STRETCH') return true
  return (
    node.layoutAlignSelf === 'AUTO' &&
    parent.layoutMode !== 'GRID' &&
    parent.counterAxisAlign === 'STRETCH'
  )
}

function ownSizingField(
  node: SceneNode,
  axis: LayoutSizingAxis
): 'primaryAxisSizing' | 'counterAxisSizing' | undefined {
  if (node.layoutMode === 'NONE') return undefined
  return axis === primaryAxis(node.layoutMode) ? 'primaryAxisSizing' : 'counterAxisSizing'
}

function textHugs(autoResize: TextAutoResize, axis: LayoutSizingAxis): boolean {
  if (autoResize === 'WIDTH_AND_HEIGHT') return true
  return axis === 'VERTICAL' && autoResize === 'HEIGHT'
}

function hugs(node: SceneNode, axis: LayoutSizingAxis): boolean {
  if (node.type === 'TEXT') return textHugs(node.textAutoResize, axis)
  const field = ownSizingField(node, axis)
  return field !== undefined && node[field] === 'HUG'
}

/** The node's sizing along `axis`: fill from its parent, else its own hug, else fixed. */
export function layoutSizing(
  graph: SceneGraph,
  node: SceneNode,
  axis: LayoutSizingAxis
): LayoutSizing {
  return layoutSizingInParent(graphParent(graph, node), node, axis)
}

/** `layoutSizing` for code that holds the parent rather than the graph. */
export function layoutSizingInParent(
  parentNode: SceneNode | undefined,
  node: SceneNode,
  axis: LayoutSizingAxis
): LayoutSizing {
  const parent = fillingParent(parentNode, node)
  if (parent && fills(parent, node, axis)) return 'FILL'
  // Figma reports text outside auto-layout as fixed, though it still resizes to its content.
  if (hugs(node, axis) && (parent || node.layoutMode !== 'NONE')) return 'HUG'
  return 'FIXED'
}

/** The sizings this node accepts on either axis, in Figma's order. */
export function layoutSizingOptions(graph: SceneGraph, node: SceneNode): LayoutSizing[] {
  return (['FIXED', 'HUG', 'FILL'] as const).filter(
    (value) => layoutSizingError(graph, node, value) === undefined
  )
}

/** Figma's reason for refusing `value` on this node, or `undefined` when it applies. */
export function layoutSizingError(
  graph: SceneGraph,
  node: SceneNode,
  value: LayoutSizing
): string | undefined {
  const parent = graphParent(graph, node)
  const inAutoLayout = parent !== undefined && parent.layoutMode !== 'NONE'
  if (!inAutoLayout && node.layoutMode === 'NONE') {
    return 'node must be an auto-layout frame or a child of an auto-layout frame'
  }
  if (value === 'FILL') {
    if (!inAutoLayout) return 'FILL can only be set on children of auto-layout frames'
    if (node.layoutPositioning === 'ABSOLUTE') {
      return 'FILL cannot be set on absolute positioned auto-layout children'
    }
  }
  if (value === 'HUG' && node.layoutMode === 'NONE' && node.type !== 'TEXT') {
    return 'HUG can only be set on auto-layout frames or text children of auto-layout frames'
  }
  return undefined
}

function textAutoResizeFor(hugsWidth: boolean, hugsHeight: boolean): TextAutoResize {
  if (hugsWidth && hugsHeight) return 'WIDTH_AND_HEIGHT'
  return hugsHeight ? 'HEIGHT' : 'NONE'
}

function textSizingUpdates(
  graph: SceneGraph,
  node: SceneNode,
  axis: LayoutSizingAxis,
  value: LayoutSizing
): Partial<SceneNode> {
  const other: LayoutSizingAxis = axis === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'
  const hugsAxis = value === 'HUG'
  const hugsOther = layoutSizing(graph, node, other) === 'HUG'
  const autoResize =
    axis === 'HORIZONTAL'
      ? textAutoResizeFor(hugsAxis, hugsOther)
      : textAutoResizeFor(hugsOther, hugsAxis)
  // Truncated text keeps truncating when it stops hugging.
  if (autoResize === 'NONE' && node.textAutoResize === 'TRUNCATE') return {}
  return autoResize === node.textAutoResize ? {} : { textAutoResize: autoResize }
}

/**
 * The fields that set the node's sizing along `axis` to `value`, as Figma's setter writes
 * them. A value Figma refuses yields no updates; `layoutSizingError` says why.
 */
export function layoutSizingUpdates(
  graph: SceneGraph,
  node: SceneNode,
  axis: LayoutSizingAxis,
  value: LayoutSizing
): Partial<SceneNode> {
  if (layoutSizingError(graph, node, value) !== undefined) return {}
  const updates: Partial<SceneNode> = {}
  const parent = fillingParent(graphParent(graph, node), node)
  if (parent && parent.layoutMode !== 'NONE') {
    const fill = value === 'FILL'
    if (axis === primaryAxis(parent.layoutMode)) {
      if (fill !== node.layoutGrow > 0) updates.layoutGrow = fill ? 1 : 0
    } else if (fill && node.layoutAlignSelf !== 'STRETCH') {
      updates.layoutAlignSelf = 'STRETCH'
    } else if (!fill && fills(parent, node, axis)) {
      // A flex parent set to stretch its children stretches this one too unless it opts out.
      const inheritsStretch = parent.layoutMode !== 'GRID' && parent.counterAxisAlign === 'STRETCH'
      updates.layoutAlignSelf = inheritsStretch ? 'MIN' : 'AUTO'
    }
  }
  const field = ownSizingField(node, axis)
  if (field) {
    const own = value === 'HUG' ? 'HUG' : 'FIXED'
    if (node[field] !== own) updates[field] = own
  }
  if (node.type === 'TEXT') Object.assign(updates, textSizingUpdates(graph, node, axis, value))
  return updates
}
