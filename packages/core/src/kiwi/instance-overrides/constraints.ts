import type { GeometryPath, SceneGraph, SceneNode, VectorNetwork } from '#core/scene-graph'
import { copyGeometryPaths } from '#core/scene-graph/copy'

import { buildClonesMap } from './sync'
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
    if (ctx.activeNodeIds && !ctx.activeNodeIds.has(node.id)) continue
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

  if (scaled.size > 0) propagateScaling(ctx, scaled)
  normalizeOutOfBoundsSingleChildren(ctx)
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

function scaleGeometryBlobs(geom: GeometryPath[], sx: number, sy: number): GeometryPath[] {
  if (sx === 1 && sy === 1) return copyGeometryPaths(geom)
  return geom.map((g) => {
    const scaled = g.commandsBlob.slice()
    const dv = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength)
    let offset = 0
    while (offset < scaled.length) {
      const command = scaled[offset++]
      let coords = 0
      if (command === 1 || command === 2) coords = 1
      else if (command === 4) coords = 3
      for (let i = 0; i < coords; i++) {
        dv.setFloat32(offset, dv.getFloat32(offset, true) * sx, true)
        dv.setFloat32(offset + 4, dv.getFloat32(offset + 4, true) * sy, true)
        offset += 8
      }
    }
    return { windingRule: g.windingRule, commandsBlob: scaled }
  })
}

function scaleVectorNetwork(
  network: VectorNetwork | null,
  sx: number,
  sy: number
): VectorNetwork | null {
  if (!network) return null
  return {
    vertices: network.vertices.map((vertex) => ({ ...vertex, x: vertex.x * sx, y: vertex.y * sy })),
    segments: network.segments.map((segment) => ({
      ...segment,
      tangentStart: { x: segment.tangentStart.x * sx, y: segment.tangentStart.y * sy },
      tangentEnd: { x: segment.tangentEnd.x * sx, y: segment.tangentEnd.y * sy }
    })),
    regions: structuredClone(network.regions)
  }
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
    const shapeScaleX = hScale ? sx : 1
    const shapeScaleY = vScale ? sy : 1
    if (source.fillGeometry.length > 0) {
      updates.fillGeometry = scaleGeometryBlobs(source.fillGeometry, shapeScaleX, shapeScaleY)
    }
    if (source.strokeGeometry.length > 0) {
      updates.strokeGeometry = scaleGeometryBlobs(source.strokeGeometry, shapeScaleX, shapeScaleY)
    }
    if (source.vectorNetwork) {
      updates.vectorNetwork = scaleVectorNetwork(source.vectorNetwork, shapeScaleX, shapeScaleY)
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

function normalizeOutOfBoundsSingleChildren(ctx: OverrideContext): void {
  const { graph } = ctx
  for (const parent of graph.getAllNodes()) {
    if (ctx.activeNodeIds && !ctx.activeNodeIds.has(parent.id)) continue
    if (parent.childIds.length !== 1) continue
    const child = graph.getNode(parent.childIds[0])
    if (!child?.visible || !child.componentId) continue
    if (ctx.geometryOverrideNodes.has(child.id) || child.figmaDerivedLayout?.x !== undefined)
      continue
    const outsideParent =
      child.x < -0.01 ||
      child.y < -0.01 ||
      child.x + child.width > parent.width + 0.01 ||
      child.y + child.height > parent.height + 0.01
    if (outsideParent) {
      graph.updateNode(child.id, {
        x: 0,
        y: 0,
        figmaDerivedLayout: { ...child.figmaDerivedLayout, x: 0, y: 0 }
      })
    }
  }
}

function propagateScaling(ctx: OverrideContext, scaled: Set<string>): void {
  const { graph } = ctx
  const clonesOf = buildClonesMap(graph, ctx.activeNodeIds)
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
      if (!ctx.geometryOverrideNodes.has(cloneId)) {
        if (source.fillGeometry.length > 0) cu.fillGeometry = copyGeometryPaths(source.fillGeometry)
        if (source.strokeGeometry.length > 0)
          cu.strokeGeometry = copyGeometryPaths(source.strokeGeometry)
        if (source.vectorNetwork) cu.vectorNetwork = structuredClone(source.vectorNetwork)
      }
      if (Object.keys(cu).length > 0) graph.updateNode(cloneId, cu)
      queue.push(cloneId)
    }
  }
}
