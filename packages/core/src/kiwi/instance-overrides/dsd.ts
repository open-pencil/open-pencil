import { copyGeometryPaths } from '../../scene-graph/copy'
import { resolveGeometryPaths } from '../convert'
import { resolveOverrideTarget } from './resolve'
import { buildClonesMap } from './sync'

import type { SceneNode, GeometryPath } from '../../scene-graph'
import type { OverrideContext, DerivedSymbolOverride } from './types'

function scaleGeometryBlobs(geom: GeometryPath[], sx: number, sy: number): GeometryPath[] {
  if (sx === 1 && sy === 1) return geom
  return geom.map((g) => {
    const scaled = g.commandsBlob.slice()
    const dv = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength)
    let o = 0
    while (o < scaled.length) {
      const cmd = scaled[o++]
      if (cmd === 0) continue
      let coords = -1
      if (cmd === 1 || cmd === 2) coords = 1
      else if (cmd === 4) coords = 3
      if (coords < 0) {
        console.warn(`scaleGeometryBlobs: unknown path command ${cmd} at offset ${o - 1}`)
        break
      }
      for (let i = 0; i < coords; i++) {
        dv.setFloat32(o, dv.getFloat32(o, true) * sx, true)
        dv.setFloat32(o + 4, dv.getFloat32(o + 4, true) * sy, true)
        o += 8
      }
    }
    return { windingRule: g.windingRule, commandsBlob: scaled }
  })
}

function resolveDsdGeometry(
  d: DerivedSymbolOverride,
  target: SceneNode,
  blobs: Uint8Array[]
): Pick<Partial<SceneNode>, 'fillGeometry' | 'strokeGeometry'> {
  const result: Pick<Partial<SceneNode>, 'fillGeometry' | 'strokeGeometry'> = {}
  const fg = resolveGeometryPaths(d.fillGeometry, blobs)
  const sg = resolveGeometryPaths(d.strokeGeometry, blobs)

  if (fg.length > 0) {
    result.fillGeometry = fg
  } else if (d.size && target.fillGeometry.length > 0 && target.width > 0 && target.height > 0) {
    result.fillGeometry = scaleGeometryBlobs(
      target.fillGeometry,
      d.size.x / target.width,
      d.size.y / target.height
    )
  }

  if (sg.length > 0) {
    result.strokeGeometry = sg
  } else if (d.size && target.strokeGeometry.length > 0 && target.width > 0 && target.height > 0) {
    result.strokeGeometry = scaleGeometryBlobs(
      target.strokeGeometry,
      d.size.x / target.width,
      d.size.y / target.height
    )
  }

  return result
}

function getVisibleSiblingCount(
  ctx: OverrideContext,
  cache: Map<string, number>,
  parentId: string
): number {
  const cached = cache.get(parentId)
  if (cached !== undefined) return cached
  const count = ctx.graph.getChildren(parentId).filter((child) => child.visible).length
  cache.set(parentId, count)
  return count
}

function hasSingleVisibleSibling(
  ctx: OverrideContext,
  visibleSiblingCount: Map<string, number>,
  node: SceneNode
): boolean {
  if (!node.parentId) return false
  return getVisibleSiblingCount(ctx, visibleSiblingCount, node.parentId) === 1
}

function resolveSizeOnlyPosition(
  ctx: OverrideContext,
  visibleSiblingCount: Map<string, number>,
  node: SceneNode
): Pick<SceneNode, 'x' | 'y'> | null {
  if (!hasSingleVisibleSibling(ctx, visibleSiblingCount, node) || !node.componentId) return null

  const source = ctx.graph.getNode(node.componentId)
  if (!source) return null
  const sourceParent = source.parentId ? ctx.graph.getNode(source.parentId) : null
  if (!sourceParent) return { x: source.x, y: source.y }

  const withinParent =
    source.x >= 0 &&
    source.y >= 0 &&
    source.x + source.width <= sourceParent.width + 0.01 &&
    source.y + source.height <= sourceParent.height + 0.01
  return withinParent ? { x: source.x, y: source.y } : { x: 0, y: 0 }
}

function buildDsdLayoutUpdates(
  ctx: OverrideContext,
  visibleSiblingCount: Map<string, number>,
  d: DerivedSymbolOverride,
  target: SceneNode
): { updates: Partial<SceneNode>; hasSize: boolean } {
  const updates: Partial<SceneNode> = {}
  const figmaDerivedLayout: NonNullable<SceneNode['figmaDerivedLayout']> = {}

  if (d.size) {
    updates.width = d.size.x
    updates.height = d.size.y
    figmaDerivedLayout.width = d.size.x
    figmaDerivedLayout.height = d.size.y
  }
  if (d.transform) {
    updates.x = d.transform.m02
    updates.y = d.transform.m12
    figmaDerivedLayout.x = d.transform.m02
    figmaDerivedLayout.y = d.transform.m12
  } else if (d.size) {
    const position = resolveSizeOnlyPosition(ctx, visibleSiblingCount, target)
    if (position) {
      updates.x = position.x
      updates.y = position.y
      figmaDerivedLayout.x = position.x
      figmaDerivedLayout.y = position.y
    }
  }
  if (Object.keys(figmaDerivedLayout).length > 0) {
    updates.figmaDerivedLayout = figmaDerivedLayout
  }
  Object.assign(updates, resolveDsdGeometry(d, target, ctx.blobs))

  return { updates, hasSize: d.size !== undefined }
}

function resolveDsdUpdates(ctx: OverrideContext): { modified: Set<string>; sizeSet: Set<string> } {
  const modified = new Set<string>()
  const sizeSet = new Set<string>()
  const visibleSiblingCount = new Map<string, number>()

  for (const [ncId, nc] of ctx.changeMap) {
    if (nc.type !== 'INSTANCE') continue
    const derived = nc.derivedSymbolData
    if (!derived?.length) continue

    const nodeId = ctx.guidToNodeId.get(ncId)
    if (!nodeId || (ctx.activeNodeIds && !ctx.activeNodeIds.has(nodeId))) continue

    for (const d of derived) {
      const guids = d.guidPath?.guids
      if (!guids?.length) continue

      const targetId = resolveOverrideTarget(ctx, nodeId, guids)
      if (!targetId) continue

      const target = ctx.graph.getNode(targetId)
      if (!target) continue

      const { updates, hasSize } = buildDsdLayoutUpdates(ctx, visibleSiblingCount, d, target)
      if (d.fillGeometry?.length || d.strokeGeometry?.length) {
        ctx.geometryOverrideNodes.add(targetId)
      }

      if (Object.keys(updates).length > 0) {
        ctx.graph.updateNode(targetId, updates)
        modified.add(targetId)
        if (hasSize) sizeSet.add(targetId)
      }
    }
  }

  return { modified, sizeSet }
}

function propagateDsdChanges(
  ctx: OverrideContext,
  modified: Set<string>,
  sizeSet: Set<string>
): void {
  if (modified.size === 0) return

  const clonesOf = buildClonesMap(ctx.graph, ctx.activeNodeIds)
  const queue = [...modified]
  const visited = new Set<string>()

  for (let sourceId = queue.shift(); sourceId !== undefined; sourceId = queue.shift()) {
    const source = ctx.graph.getNode(sourceId)
    if (!source) continue
    const clones = clonesOf.get(sourceId)
    if (!clones) continue
    for (const cloneId of clones) {
      if (visited.has(cloneId)) continue
      visited.add(cloneId)
      const clone = ctx.graph.getNode(cloneId)
      if (!clone) continue
      if (!sizeSet.has(cloneId)) {
        const cu: Partial<SceneNode> = {}
        if (source.width !== clone.width) cu.width = source.width
        if (source.height !== clone.height) cu.height = source.height
        if (source.x !== clone.x) cu.x = source.x
        if (source.y !== clone.y) cu.y = source.y
        if (!ctx.geometryOverrideNodes.has(cloneId)) {
          if (source.fillGeometry !== clone.fillGeometry)
            cu.fillGeometry = copyGeometryPaths(source.fillGeometry)
          if (source.strokeGeometry !== clone.strokeGeometry)
            cu.strokeGeometry = copyGeometryPaths(source.strokeGeometry)
        }
        if (Object.keys(cu).length > 0) ctx.graph.updateNode(cloneId, cu)
      }
      queue.push(cloneId)
    }
  }
}

/**
 * Apply derivedSymbolData — Figma's pre-computed sizes, positions,
 * and geometry for instance overrides. Runs last in the pipeline.
 */
export function applyDerivedSymbolData(ctx: OverrideContext): void {
  const { modified, sizeSet } = resolveDsdUpdates(ctx)
  propagateDsdChanges(ctx, modified, sizeSet)
}
