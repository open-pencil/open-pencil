import type { SceneNode } from '@open-pencil/scene-graph'
import { copyGeometryPaths } from '@open-pencil/scene-graph/copy'

import { buildClonesMap } from '../sync'
import type { OverrideContext } from '../types'
import { overrideCandidates } from '../utils'

function buildSizeOverriddenCloneUpdates(source: SceneNode, clone: SceneNode): Partial<SceneNode> {
  if (clone.type !== 'INSTANCE' || !source.derivedLayout) return {}
  const sourceLayout = source.derivedLayout
  const updates: Partial<SceneNode> = {
    derivedLayout: {
      ...sourceLayout,
      ...clone.derivedLayout,
      x: sourceLayout.x ?? clone.derivedLayout?.x,
      y: sourceLayout.y ?? clone.derivedLayout?.y
    }
  }
  if (sourceLayout.x !== undefined) updates.x = sourceLayout.x
  if (sourceLayout.y !== undefined) updates.y = sourceLayout.y
  return updates
}

function buildCloneUpdates(
  ctx: OverrideContext,
  source: SceneNode,
  clone: SceneNode,
  cloneId: string,
  sizeSet: Set<string>
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  if (sizeSet.has(cloneId)) return buildSizeOverriddenCloneUpdates(source, clone)
  if (source.width !== clone.width) updates.width = source.width
  if (source.height !== clone.height) updates.height = source.height
  if (source.x !== clone.x) updates.x = source.x
  if (source.y !== clone.y) updates.y = source.y
  if (!ctx.geometryOverrideNodes.has(cloneId)) {
    if (source.fillGeometry !== clone.fillGeometry)
      updates.fillGeometry = copyGeometryPaths(source.fillGeometry)
    if (source.strokeGeometry !== clone.strokeGeometry)
      updates.strokeGeometry = copyGeometryPaths(source.strokeGeometry)
  }
  if (source.text === clone.text && source.derivedTextGlyphs) {
    updates.derivedTextGlyphs = structuredClone(source.derivedTextGlyphs)
  }
  if (source.text === clone.text && source.derivedLayout) {
    updates.derivedLayout = { ...source.derivedLayout }
  }
  return updates
}

export function reconcileEffectiveCloneGeometry(
  ctx: OverrideContext,
  scaledInstanceIds: Set<string>
): void {
  restoreScaledInstanceLeafBounds(ctx, scaledInstanceIds)
  restoreThinCloneCrossPositions(ctx)
}

function restoreScaledInstanceLeafBounds(
  ctx: OverrideContext,
  scaledInstanceIds: Set<string>
): void {
  for (const instanceId of scaledInstanceIds) {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.layoutMode !== 'NONE' || instance.childIds.length !== 1) continue
    const child = ctx.graph.getNode(instance.childIds[0])
    if (
      !child ||
      child.childIds.length > 0 ||
      child.horizontalConstraint !== 'SCALE' ||
      child.verticalConstraint !== 'SCALE'
    ) {
      continue
    }
    const width = child.derivedLayout?.width
    const height = child.derivedLayout?.height
    const restoresDerivedBounds = width !== undefined && height !== undefined
    const restoresImageBounds =
      !restoresDerivedBounds &&
      child.type === 'ROUNDED_RECTANGLE' &&
      child.fills.some((fill) => fill.type === 'IMAGE')
    if (!restoresDerivedBounds && !restoresImageBounds) continue
    const restoredWidth = width ?? instance.width
    const restoredHeight = height ?? instance.height
    if (child.width === restoredWidth && child.height === restoredHeight) continue
    ctx.graph.updateNode(child.id, { width: restoredWidth, height: restoredHeight })
  }
}

function isThinCenteredCrossChild(parent: SceneNode, clone: SceneNode): boolean {
  if (parent.counterAxisAlign !== 'CENTER') return false
  if (parent.layoutMode === 'HORIZONTAL') return clone.height <= 1 && clone.width > clone.height
  if (parent.layoutMode === 'VERTICAL') return clone.width <= 1 && clone.height > clone.width
  return false
}

interface ThinCloneCrossPosition {
  axis: 'x' | 'y'
  position: number
}

function thinCloneCrossPosition(
  graph: OverrideContext['graph'],
  clone: SceneNode
): ThinCloneCrossPosition | null {
  if (
    clone.source.format !== null ||
    !clone.componentId ||
    !clone.name.endsWith('Divider') ||
    !clone.parentId ||
    clone.derivedLayout?.x !== undefined ||
    clone.derivedLayout?.y !== undefined
  ) {
    return null
  }
  const parent = graph.getNode(clone.parentId)
  const source = graph.getNode(clone.componentId)
  const sourceLayout = source?.derivedLayout
  if (!parent || !source || sourceLayout?.x === undefined || sourceLayout.y === undefined)
    return null
  if (clone.width !== source.width || clone.height !== source.height) return null
  if (!isThinCenteredCrossChild(parent, clone)) return null
  return parent.layoutMode === 'HORIZONTAL'
    ? { axis: 'y', position: sourceLayout.y }
    : { axis: 'x', position: sourceLayout.x }
}

function restoreThinCloneCrossPositions(ctx: OverrideContext): void {
  for (const clone of overrideCandidates(ctx.graph, ctx.activeNodeIds)) {
    const crossPosition = thinCloneCrossPosition(ctx.graph, clone)
    if (!crossPosition) continue
    ctx.graph.updateNode(clone.id, {
      derivedLayout: {
        ...clone.derivedLayout,
        [crossPosition.axis]: crossPosition.position
      }
    })
  }
}

export function applyGeneratedFreeformStretch(ctx: OverrideContext): void {
  for (const node of overrideCandidates(ctx.graph, ctx.activeNodeIds)) {
    if (
      node.source.format === 'fig' ||
      !node.derivedLayout ||
      !node.parentId ||
      node.layoutPositioning === 'ABSOLUTE'
    ) {
      continue
    }
    const parent = ctx.graph.getNode(node.parentId)
    if (
      !parent ||
      parent.source.format === 'fig' ||
      parent.layoutMode !== 'NONE' ||
      !parent.derivedLayout
    ) {
      continue
    }
    const updates: Partial<SceneNode> = {}
    if (
      node.horizontalConstraint === 'STRETCH' &&
      node.derivedLayout.width !== undefined &&
      node.derivedLayout.width === parent.derivedLayout.width
    ) {
      updates.width = node.derivedLayout.width
    }
    if (
      node.verticalConstraint === 'STRETCH' &&
      node.derivedLayout.height !== undefined &&
      node.derivedLayout.height === parent.derivedLayout.height
    ) {
      updates.height = node.derivedLayout.height
    }
    if (Object.keys(updates).length > 0) ctx.graph.updateNode(node.id, updates)
  }
}

export function propagateDsdChanges(
  ctx: OverrideContext,
  modified: Set<string>,
  sizeSet: Set<string>
): void {
  if (modified.size === 0) return

  const clonesOf = buildClonesMap(ctx.graph, ctx.activeNodeIds)
  const queue = [...modified]
  const visited = new Set<string>()

  let index = 0
  while (index < queue.length) {
    const sourceId = queue[index]
    index++
    const source = ctx.graph.getNode(sourceId)
    if (!source) continue
    const clones = clonesOf.get(sourceId)
    if (!clones) continue
    for (const cloneId of clones) {
      if (visited.has(cloneId)) continue
      visited.add(cloneId)
      const clone = ctx.graph.getNode(cloneId)
      if (!clone) continue
      const updates = buildCloneUpdates(ctx, source, clone, cloneId, sizeSet)
      if (Object.keys(updates).length > 0) {
        ctx.graph.preserveSourceMetadataDuring(() => ctx.graph.updateNode(cloneId, updates))
      }
      queue.push(cloneId)
    }
  }
}
