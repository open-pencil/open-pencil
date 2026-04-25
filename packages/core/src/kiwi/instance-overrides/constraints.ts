import { buildClonesMap } from './sync'

import type { SceneGraph, SceneNode } from '../../scene-graph'
import type { OverrideContext } from './types'

/**
 * Apply SCALE constraint resizing to children of instances whose size
 * differs from their component's original size, then propagate the
 * changes through clone chains.
 */
export function applyConstraintScaling(ctx: OverrideContext): void {
  const { graph } = ctx
  const scaled = new Set<string>()

  for (const node of graph.getAllNodes()) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const comp = graph.getNode(node.componentId)
    if (!comp || comp.width <= 0 || comp.height <= 0) continue
    const basis = resolveScaleBasis(graph, node, comp)
    if (!basis) continue

    // Skip if instance uses auto-layout — layout engine handles child sizing
    if (node.layoutMode !== 'NONE') continue

    const sx = node.width / basis.width
    const sy = node.height / basis.height
    if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) continue

    scaleChildren(graph, node, comp, sx, sy, scaled, basis !== comp)
  }

  if (scaled.size > 0) propagateScaling(graph, scaled)
}

function resolveScaleBasis(
  graph: SceneGraph,
  instance: SceneNode,
  component: SceneNode
): { width: number; height: number } | null {
  if (instance.width !== component.width || instance.height !== component.height) return component

  let source: SceneNode = component
  for (let depth = 0; depth < 10 && source.type === 'INSTANCE' && source.componentId; depth++) {
    const next = graph.getNode(source.componentId)
    if (!next || next.width <= 0 || next.height <= 0) break
    if (instance.width !== next.width || instance.height !== next.height) return next
    source = next
  }

  return null
}

function scaleChildren(
  graph: SceneGraph,
  instance: SceneNode,
  comp: SceneNode,
  sx: number,
  sy: number,
  scaled: Set<string>,
  useCurrentChildAsSource = false
): void {
  const len = Math.min(instance.childIds.length, comp.childIds.length)
  for (let i = 0; i < len; i++) {
    const child = graph.getNode(instance.childIds[i])
    const compChild = graph.getNode(comp.childIds[i])
    if (!child || !compChild) continue

    const hScale = child.horizontalConstraint === 'SCALE'
    const vScale = child.verticalConstraint === 'SCALE'
    if (!hScale && !vScale) continue

    const updates: Partial<SceneNode> = {}
    const source = useCurrentChildAsSource ? child : compChild
    if (hScale) {
      updates.x = source.x * sx
      updates.width = source.width * sx
    }
    if (vScale) {
      updates.y = source.y * sy
      updates.height = source.height * sy
    }
    graph.updateNode(child.id, updates)
    scaled.add(child.id)

    if (child.childIds.length > 0 && compChild.childIds.length > 0) {
      scaleChildren(
        graph,
        child,
        compChild,
        hScale ? sx : 1,
        vScale ? sy : 1,
        scaled,
        useCurrentChildAsSource
      )
    }
  }
}

function propagateScaling(graph: SceneGraph, scaled: Set<string>): void {
  const clonesOf = buildClonesMap(graph)
  const queue = [...scaled]
  const visited = new Set<string>()

  for (let srcId = queue.shift(); srcId !== undefined; srcId = queue.shift()) {
    const source = graph.getNode(srcId)
    if (!source) continue
    const clones = clonesOf.get(srcId)
    if (!clones) continue
    for (const cloneId of clones) {
      if (visited.has(cloneId)) continue
      visited.add(cloneId)
      const clone = graph.getNode(cloneId)
      if (!clone) continue
      const cu: Partial<SceneNode> = {}
      if (clone.width !== source.width) cu.width = source.width
      if (clone.height !== source.height) cu.height = source.height
      if (clone.x !== source.x) cu.x = source.x
      if (clone.y !== source.y) cu.y = source.y
      if (Object.keys(cu).length > 0) graph.updateNode(cloneId, cu)
      queue.push(cloneId)
    }
  }
}
