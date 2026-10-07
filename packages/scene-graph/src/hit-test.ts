import type { SceneGraph, SceneNode, NodeType } from './'
import { getWorldMatrix } from './coordinate'
import Matrix from './matrix'

const CONTAINER_TYPES = new Set<NodeType>([
  'CANVAS',
  'FRAME',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])
const OPAQUE_CONTAINER_TYPES = new Set<NodeType>(['COMPONENT', 'INSTANCE'])

function hasVisibleFillOrStroke(node: SceneNode): boolean {
  return node.fills.some((f) => f.visible) || node.strokes.some((s) => s.visible)
}

function isTopLevel(graph: SceneGraph, node: SceneNode): boolean {
  const parent = node.parentId ? graph.nodes.get(node.parentId) : undefined
  return parent?.type === 'CANVAS' || parent?.type === 'SECTION'
}

/**
 * An open container whose empty area still belongs to it, as in Figma: a top-level frame with auto
 * layout is selected, hovered, and dragged by its gaps and padding, while its children stay one
 * click away, with or without a fill. A plain top-level frame's empty area is background, and a
 * nested frame's empty area belongs to it only as a click target (see `frameChildAt`).
 */
function ownsItsEmptyArea(graph: SceneGraph, node: SceneNode): boolean {
  return node.type === 'FRAME' && node.layoutMode !== 'NONE' && isTopLevel(graph, node)
}

function hasTransformedAncestor(
  node: SceneNode,
  graph: SceneGraph,
  cache: Map<string, boolean>
): boolean {
  const cached = cache.get(node.id)
  if (cached !== undefined) return cached
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const transformed =
    node.rotation !== 0 ||
    node.flipX ||
    node.flipY ||
    (parent ? hasTransformedAncestor(parent, graph, cache) : false)
  cache.set(node.id, transformed)
  return transformed
}

function containsPoint(
  px: number,
  py: number,
  node: SceneNode,
  graph: SceneGraph,
  transformCache: Map<string, boolean>
): boolean {
  if (!hasTransformedAncestor(node, graph, transformCache)) {
    const absolute = graph.getAbsolutePosition(node.id)
    return (
      px >= absolute.x &&
      px <= absolute.x + node.width &&
      py >= absolute.y &&
      py <= absolute.y + node.height
    )
  }

  const m = getWorldMatrix(node, graph)

  const inv = Matrix.invert(m)
  if (!inv) return false

  const [localX, localY] = Matrix.mapPoints(inv, [px, py])
  return localX >= 0 && localX <= node.width && localY >= 0 && localY <= node.height
}

function hitTestOpaqueContainer(
  graph: SceneGraph,
  px: number,
  py: number,
  child: SceneNode,
  childId: string,
  deep: boolean,
  transformCache: Map<string, boolean>
): SceneNode | null {
  if (!containsPoint(px, py, child, graph, transformCache)) return null
  const childHit = hitTestChildren(graph, px, py, childId, deep, transformCache)
  if (childHit) return child
  if (hasVisibleFillOrStroke(child)) return child
  return null
}
function hitTestTransparentContainer(
  graph: SceneGraph,
  px: number,
  py: number,
  child: SceneNode,
  childId: string,
  deep: boolean,
  transformCache: Map<string, boolean>
): SceneNode | null {
  if (child.type === 'GROUP') {
    if (!containsPoint(px, py, child, graph, transformCache)) return null

    if (deep) return hitTestChildren(graph, px, py, childId, deep, transformCache) ?? child

    return child
  }

  const childHit = hitTestChildren(graph, px, py, childId, deep, transformCache)
  if (childHit) {
    if (child.locked) return child
    return childHit
  }

  if (
    containsPoint(px, py, child, graph, transformCache) &&
    (hasVisibleFillOrStroke(child) || ownsItsEmptyArea(graph, child))
  )
    return child
  return null
}

function hitTestChildren(
  graph: SceneGraph,
  px: number,
  py: number,
  parentId: string,
  deep = false,
  transformCache = new Map<string, boolean>()
): SceneNode | null {
  const parent = graph.nodes.get(parentId)
  if (!parent) return null

  if (parent.clipsContent) {
    if (!containsPoint(px, py, parent, graph, transformCache)) return null
  }

  for (let i = parent.childIds.length - 1; i >= 0; i--) {
    const childId = parent.childIds[i]
    const child = graph.nodes.get(childId)
    if (!child || child.internalOnly || !child.visible) continue
    if (CONTAINER_TYPES.has(child.type)) {
      if (OPAQUE_CONTAINER_TYPES.has(child.type) && !deep) {
        const hit = hitTestOpaqueContainer(graph, px, py, child, childId, deep, transformCache)
        if (hit) return hit
        continue
      }

      const hit = hitTestTransparentContainer(graph, px, py, child, childId, deep, transformCache)
      if (hit) return hit
      continue
    }

    if (containsPoint(px, py, child, graph, transformCache)) return child
  }

  return null
}

export function hitTest(
  graph: SceneGraph,
  px: number,
  py: number,
  scopeId?: string
): SceneNode | null {
  const scope = scopeId ?? graph.rootId
  return hitTestChildren(graph, px, py, scope, false)
}

export function hitTestDeep(
  graph: SceneGraph,
  px: number,
  py: number,
  scopeId?: string
): SceneNode | null {
  const scope = scopeId ?? graph.rootId
  return hitTestChildren(graph, px, py, scope, true)
}

/**
 * A container a click looks into by itself, as in Figma: a top-level frame (on the page or in a
 * section) or a section that holds layers, and a component set.
 */
function opensByItself(graph: SceneGraph, node: SceneNode): boolean {
  if (node.type === 'COMPONENT_SET') return true
  if (node.childIds.length === 0) return false
  if (node.type === 'SECTION') return true
  return node.type === 'FRAME' && isTopLevel(graph, node)
}

/**
 * The topmost frame among a container's children whose bounds hold the point, filled or not: in
 * Figma a click on the empty area of a frame inside an open container, or of an empty frame on the
 * page or in a section, selects that frame, while a deep (⌘) click looks through it.
 */
function frameChildAt(
  graph: SceneGraph,
  container: SceneNode,
  px: number,
  py: number
): SceneNode | null {
  const transformCache = new Map<string, boolean>()
  for (let i = container.childIds.length - 1; i >= 0; i--) {
    const child = graph.nodes.get(container.childIds[i])
    if (!child || child.internalOnly || !child.visible || child.type !== 'FRAME') continue
    // A board, such as a top-level frame in a section, keeps its empty area as background.
    if (opensByItself(graph, child) && !ownsItsEmptyArea(graph, child)) continue
    if (containsPoint(px, py, child, graph, transformCache)) return child
  }
  return null
}

/**
 * The containers the selection opens: every ancestor of a selected layer inside the scope, and a
 * selected container itself, so a click inside it selects the layer under the point, as in Figma.
 * A selected group or boolean stays closed: clicking inside it keeps it selected.
 */
function openedBySelection(
  graph: SceneGraph,
  selectedIds: ReadonlySet<string>,
  scopeId: string
): Set<string> {
  const ancestors = new Set<string>()
  for (const id of selectedIds) {
    const node = graph.nodes.get(id)
    if (
      node &&
      node.childIds.length > 0 &&
      node.type !== 'GROUP' &&
      node.type !== 'BOOLEAN_OPERATION'
    )
      ancestors.add(id)
    let parentId = node?.parentId
    while (parentId && parentId !== scopeId && !ancestors.has(parentId)) {
      ancestors.add(parentId)
      parentId = graph.nodes.get(parentId)?.parentId
    }
  }
  return ancestors
}

/**
 * The layer a click selects, as in Figma. It walks from the scope down to the deepest layer under
 * the point and stops at the first layer that is not open. Top-level frames and sections with
 * layers and component sets are open, and so is every ancestor of the selection, so clicks reach
 * the siblings of selected layers. Where every layer under the point is open, a container opened
 * by the selection is selected, so is a top-level frame with auto layout, and a plain top-level
 * frame or a section is not.
 */
export function hitTestSelectable(
  graph: SceneGraph,
  px: number,
  py: number,
  scopeId: string,
  selectedIds: ReadonlySet<string>
): SceneNode | null {
  const deepest = hitTestChildren(graph, px, py, scopeId, true)
  if (!deepest) {
    const scope = graph.nodes.get(scopeId)
    return scope ? frameChildAt(graph, scope, px, py) : null
  }

  const chain: SceneNode[] = []
  for (let node: SceneNode | undefined = deepest; node && node.id !== scopeId;) {
    chain.unshift(node)
    node = node.parentId ? graph.nodes.get(node.parentId) : undefined
  }

  const opened = openedBySelection(graph, selectedIds, scopeId)

  for (const node of chain) {
    // A locked layer stands in for everything inside it.
    if (node.locked) return node
    if (!opened.has(node.id) && !opensByItself(graph, node)) return node
  }
  const last = chain.at(-1)
  if (!last) return null
  const frame = frameChildAt(graph, last, px, py)
  if (frame) return frame
  if (ownsItsEmptyArea(graph, last)) return last
  return opened.has(last.id) && !opensByItself(graph, last) ? last : null
}

/** Whether a click looks into this container rather than selecting it; see `hitTestSelectable`. */
export function isOpenContainer(graph: SceneGraph, nodeId: string): boolean {
  const node = graph.nodes.get(nodeId)
  return node !== undefined && opensByItself(graph, node)
}

/**
 * The innermost open container under the point when every layer there is open: a marquee starting
 * here selects that container's layers, as in Figma.
 */
export function hitTestOpenContainer(
  graph: SceneGraph,
  px: number,
  py: number,
  scopeId: string
): SceneNode | null {
  const deepest = hitTestChildren(graph, px, py, scopeId, true)
  for (let node: SceneNode | undefined = deepest ?? undefined; node && node.id !== scopeId;) {
    if (!opensByItself(graph, node) || ownsItsEmptyArea(graph, node)) return null
    node = node.parentId ? graph.nodes.get(node.parentId) : undefined
  }
  return deepest
}

/** Whether the point lies inside the node's rotated and flipped bounds. */
export function isPointInNode(graph: SceneGraph, nodeId: string, px: number, py: number): boolean {
  const node = graph.nodes.get(nodeId)
  return node !== undefined && containsPoint(px, py, node, graph, new Map())
}

/** Which layers take a drop, and which are only looked through, as in Figma. */
interface DropRules {
  takes: (node: SceneNode) => boolean
  passThrough: ReadonlySet<NodeType>
}

const LAYER_TARGETS = new Set<NodeType>(['FRAME', 'SECTION', 'COMPONENT', 'INSTANCE'])
const COMPONENT_TARGETS = new Set<NodeType>(['FRAME', 'SECTION', 'INSTANCE'])

function dropRules(options: DropTargetOptions): DropRules {
  const { componentSetIds } = options
  if (!componentSetIds) {
    return {
      takes: (node) => LAYER_TARGETS.has(node.type),
      passThrough: new Set(['GROUP', 'COMPONENT_SET'])
    }
  }
  // Components never go into other components, and a set only takes back its own variants.
  return {
    takes: (node) =>
      COMPONENT_TARGETS.has(node.type) ||
      (node.type === 'COMPONENT_SET' && componentSetIds.has(node.id)),
    passThrough: new Set(['GROUP'])
  }
}

function dropTargetIn(
  graph: SceneGraph,
  px: number,
  py: number,
  parent: SceneNode,
  excludeIds: ReadonlySet<string>,
  rules: DropRules,
  transformCache: Map<string, boolean>
): SceneNode | null {
  // A clipped-away part of a child is not under the cursor.
  if (
    parent.type !== 'CANVAS' &&
    parent.clipsContent &&
    !containsPoint(px, py, parent, graph, transformCache)
  )
    return null

  for (let i = parent.childIds.length - 1; i >= 0; i--) {
    const childId = parent.childIds[i]
    if (excludeIds.has(childId)) continue
    const child = graph.nodes.get(childId)
    if (!child || child.internalOnly || !child.visible || child.locked) continue
    const target = rules.takes(child)
    if (!target && !rules.passThrough.has(child.type)) continue

    const deeper = dropTargetIn(graph, px, py, child, excludeIds, rules, transformCache)
    if (deeper) return deeper
    if (target && containsPoint(px, py, child, graph, transformCache)) return child
  }

  return null
}

export interface DropTargetOptions {
  /**
   * Set when the dropped layers are all main components: the component sets they come from.
   * Components then go only into frames, sections, instances, and those sets.
   */
  componentSetIds?: ReadonlySet<string>
}

/**
 * The topmost unlocked frame, section, component, or instance under the point, in its rotated
 * shape and inside its clipping ancestors. Groups and component sets are looked through but never
 * returned, except that a set takes dropped components; locked layers and their contents are
 * skipped.
 */
export function hitTestDropTarget(
  graph: SceneGraph,
  px: number,
  py: number,
  excludeIds: ReadonlySet<string>,
  scopeId?: string,
  options: DropTargetOptions = {}
): SceneNode | null {
  const scope = graph.nodes.get(scopeId ?? graph.rootId)
  if (!scope) return null
  return dropTargetIn(graph, px, py, scope, excludeIds, dropRules(options), new Map())
}
