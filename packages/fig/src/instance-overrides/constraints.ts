import type { SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { copyGeometryPaths, scaleGeometryPaths } from '@open-pencil/scene-graph/copy'
import { constrainedChildRect } from '@open-pencil/scene-graph/resize'

import { readEffectiveFigmaRawField } from '../source-metadata'
import { isFieldProtected } from './patches'
import { buildClonesMap } from './sync'
import type { OverrideContext } from './types'
import { overrideCandidates } from './utils'

const MAX_CLONE_CHAIN_DEPTH = 10

interface ScaleDescendantAxes {
  horizontal: boolean
  vertical: boolean
}

interface InstanceScale {
  basis: SceneNode
  scaleThroughFixedWrappers: boolean
  sx: number
  sy: number
  useCurrentChildAsSource: boolean
}

/**
 * Apply SCALE constraint resizing to children of instances whose size
 * differs from their component's original size, then propagate the
 * changes through clone chains.
 */
export function applyConstraintScaling(ctx: OverrideContext): void {
  const { graph } = ctx
  const scaled = new Set<string>()

  for (const node of overrideCandidates(graph, ctx.activeNodeIds)) {
    if (node.type !== 'INSTANCE' || !node.componentId) continue
    const comp = graph.getNode(node.componentId)
    if (!comp || comp.width <= 0 || comp.height <= 0) continue
    const scale = resolveInstanceScale(graph, node, comp)
    if (!scale) continue

    positionPinnedAbsoluteChildren(ctx, node, scale.basis)
    if (node.layoutMode !== 'NONE') continue

    const { sx, sy } = scale
    if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) continue

    const figmaId = ctx.nodeIdToGuid.get(node.id)
    const strokeScale = figmaId ? ctx.changeMap.get(figmaId)?.strokeWeight : undefined
    scaleChildren(
      graph,
      node,
      comp,
      sx,
      sy,
      scaled,
      ctx.geometryOverrideNodes,
      scale.useCurrentChildAsSource,
      strokeScale,
      scale.scaleThroughFixedWrappers
    )
  }

  if (scaled.size > 0) propagateScaling(ctx, scaled)
}

function resolveInstanceScale(
  graph: SceneGraph,
  instance: SceneNode,
  component: SceneNode
): InstanceScale | null {
  const targetAspectRatio = resolveTargetAspectRatio(instance)
  const resolvedBasis = resolveScaleBasis(graph, instance, component)
  if (!targetAspectRatio && !resolvedBasis) return null
  const basis = resolvedBasis ?? component
  const scaleThroughFixedWrappers = targetAspectRatio !== null
  return {
    basis,
    scaleThroughFixedWrappers,
    sx: instance.width / basis.width,
    sy: instance.height / basis.height,
    useCurrentChildAsSource: basis !== component
  }
}

function resolveTargetAspectRatio(instance: SceneNode): { width: number; height: number } | null {
  const rawTarget = readEffectiveFigmaRawField(instance, 'targetAspectRatio')
  if (!rawTarget || typeof rawTarget !== 'object' || !('value' in rawTarget)) return null
  const value = rawTarget.value
  if (!value || typeof value !== 'object' || !('x' in value) || !('y' in value)) return null
  const { x, y } = value
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x <= 0 ||
    y <= 0
  ) {
    return null
  }
  return { width: x, height: y }
}

function isCloneOfSource(graph: SceneGraph, child: SceneNode, sourceId: string): boolean {
  let current: SceneNode | undefined = child
  for (let depth = 0; depth < MAX_CLONE_CHAIN_DEPTH && current?.componentId; depth++) {
    if (current.componentId === sourceId) return true
    current = graph.getNode(current.componentId)
  }
  return false
}

function pinnedPositionUpdates(
  ctx: OverrideContext,
  child: SceneNode,
  resized: ReturnType<typeof constrainedChildRect>
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  const horizontalPinned =
    child.horizontalConstraint === 'MAX' || child.horizontalConstraint === 'CENTER'
  const verticalPinned = child.verticalConstraint === 'MAX' || child.verticalConstraint === 'CENTER'
  if (
    horizontalPinned &&
    child.derivedLayout?.x === undefined &&
    !isFieldProtected(ctx.protectedFields, child.id, 'x') &&
    child.x !== resized.x
  ) {
    updates.x = resized.x
  }
  if (
    verticalPinned &&
    child.derivedLayout?.y === undefined &&
    !isFieldProtected(ctx.protectedFields, child.id, 'y') &&
    child.y !== resized.y
  ) {
    updates.y = resized.y
  }
  return updates
}

function stretchedChildSizeUpdates(
  ctx: OverrideContext,
  child: SceneNode,
  resized: ReturnType<typeof constrainedChildRect>
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  if (
    child.horizontalConstraint === 'STRETCH' &&
    child.derivedLayout?.width === undefined &&
    !isFieldProtected(ctx.protectedFields, child.id, 'width') &&
    child.width !== resized.width
  ) {
    updates.width = resized.width
  }
  if (
    child.verticalConstraint === 'STRETCH' &&
    child.derivedLayout?.height === undefined &&
    !isFieldProtected(ctx.protectedFields, child.id, 'height') &&
    child.height !== resized.height
  ) {
    updates.height = resized.height
  }
  return updates
}

function pinnedChildUpdates(
  ctx: OverrideContext,
  child: SceneNode,
  resized: ReturnType<typeof constrainedChildRect>
): Partial<SceneNode> {
  return {
    ...pinnedPositionUpdates(ctx, child, resized),
    ...stretchedChildSizeUpdates(ctx, child, resized)
  }
}

function positionPinnedAbsoluteChildren(
  ctx: OverrideContext,
  instance: SceneNode,
  source: SceneNode
): void {
  const count = Math.min(instance.childIds.length, source.childIds.length)
  for (let index = 0; index < count; index++) {
    const child = ctx.graph.getNode(instance.childIds[index])
    const sourceChild = ctx.graph.getNode(source.childIds[index])
    if (!child || !sourceChild || child.layoutPositioning !== 'ABSOLUTE') continue
    if (child.componentId && !isCloneOfSource(ctx.graph, child, sourceChild.id)) continue

    const resized = constrainedChildRect(
      sourceChild,
      source,
      instance,
      child.horizontalConstraint,
      child.verticalConstraint
    )
    const updates = pinnedChildUpdates(ctx, child, resized)
    if (Object.keys(updates).length > 0) ctx.graph.updateNode(child.id, updates)
  }
}

function resolveScaleBasis(
  graph: SceneGraph,
  instance: SceneNode,
  component: SceneNode
): SceneNode | null {
  if (instance.width !== component.width || instance.height !== component.height) return component

  let source: SceneNode = component
  for (
    let depth = 0;
    depth < MAX_CLONE_CHAIN_DEPTH && source.type === 'INSTANCE' && source.componentId;
    depth++
  ) {
    const next = graph.getNode(source.componentId)
    if (!next || next.width <= 0 || next.height <= 0) break
    if (instance.width !== next.width || instance.height !== next.height) return next
    source = next
  }

  return null
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

function scaledStrokes(
  source: SceneNode,
  child: SceneNode,
  shapeScaleX: number,
  shapeScaleY: number,
  strokeScale?: number
) {
  if (source.strokes.length !== child.strokes.length) return undefined
  if (Math.abs(shapeScaleX - shapeScaleY) >= 0.001) return undefined
  const scale = strokeScale ?? 1
  return child.strokes.map((stroke, strokeIndex) => ({
    ...stroke,
    weight: source.strokes[strokeIndex].weight * scale
  }))
}

function scaledGeometryUpdates(
  source: SceneNode,
  shapeScaleX: number,
  shapeScaleY: number,
  hasDerivedGeometry: boolean
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  if (!hasDerivedGeometry && source.fillGeometry.length > 0) {
    updates.fillGeometry = scaleGeometryPaths(source.fillGeometry, shapeScaleX, shapeScaleY)
  }
  if (!hasDerivedGeometry && source.strokeGeometry.length > 0) {
    updates.strokeGeometry = scaleGeometryPaths(source.strokeGeometry, shapeScaleX, shapeScaleY)
  }
  if (source.vectorNetwork) {
    updates.vectorNetwork = scaleVectorNetwork(source.vectorNetwork, shapeScaleX, shapeScaleY)
  }
  return updates
}

function scaleDescendantAxes(
  graph: SceneGraph,
  node: SceneNode,
  cache: Map<string, ScaleDescendantAxes>
): ScaleDescendantAxes {
  const cached = cache.get(node.id)
  if (cached) return cached
  const result: ScaleDescendantAxes = { horizontal: false, vertical: false }
  for (const child of graph.getChildren(node.id)) {
    const nested = scaleDescendantAxes(graph, child, cache)
    result.horizontal ||= child.horizontalConstraint === 'SCALE' || nested.horizontal
    result.vertical ||= child.verticalConstraint === 'SCALE' || nested.vertical
    if (result.horizontal && result.vertical) break
  }
  cache.set(node.id, result)
  return result
}

function childScaleAxes(
  graph: SceneGraph,
  child: SceneNode,
  scaleThroughFixedWrappers: boolean,
  cache: Map<string, ScaleDescendantAxes>
): ScaleDescendantAxes {
  const descendantAxes = scaleDescendantAxes(graph, child, cache)
  return {
    horizontal:
      child.horizontalConstraint === 'SCALE' ||
      (scaleThroughFixedWrappers && descendantAxes.horizontal),
    vertical:
      child.verticalConstraint === 'SCALE' || (scaleThroughFixedWrappers && descendantAxes.vertical)
  }
}

function scaleChildren(
  graph: SceneGraph,
  instance: SceneNode,
  comp: SceneNode,
  sx: number,
  sy: number,
  scaled: Set<string>,
  geometryOverrideNodes: Set<string>,
  useCurrentChildAsSource = false,
  strokeScale?: number,
  scaleThroughFixedWrappers = false,
  descendantScaleCache = new Map<string, ScaleDescendantAxes>()
): void {
  const len = Math.min(instance.childIds.length, comp.childIds.length)
  for (let i = 0; i < len; i++) {
    const child = graph.getNode(instance.childIds[i])
    const compChild = graph.getNode(comp.childIds[i])
    if (!child || !compChild) continue

    const scaleAxes = childScaleAxes(graph, child, scaleThroughFixedWrappers, descendantScaleCache)
    const hScale = scaleAxes.horizontal
    const vScale = scaleAxes.vertical
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
    Object.assign(
      updates,
      scaledGeometryUpdates(source, shapeScaleX, shapeScaleY, geometryOverrideNodes.has(child.id))
    )
    updates.strokes = scaledStrokes(source, child, shapeScaleX, shapeScaleY, strokeScale)
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
        geometryOverrideNodes,
        useCurrentChildAsSource,
        strokeScale,
        scaleThroughFixedWrappers,
        descendantScaleCache
      )
    }
  }
}

function propagateScaling(ctx: OverrideContext, scaled: Set<string>): void {
  const { graph } = ctx
  const clonesOf = buildClonesMap(graph, ctx.activeNodeIds)
  const queue = [...scaled]
  const visited = new Set<string>()

  let index = 0
  while (index < queue.length) {
    const srcId = queue[index]
    index++
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
      if (source.strokes.length === clone.strokes.length) {
        cu.strokes = clone.strokes.map((stroke, strokeIndex) => ({
          ...stroke,
          weight: source.strokes[strokeIndex].weight
        }))
      }
      if (Object.keys(cu).length > 0) graph.updateNode(cloneId, cu)
      queue.push(cloneId)
    }
  }
}
