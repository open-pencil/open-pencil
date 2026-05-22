import type { Canvas, Path, PathOp } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '#core/scene-graph'
import { getTextOutlineSupport } from '#core/text/outlines'

import { makeArcPath } from './fills'
import type { SkiaRenderer } from './renderer'
import { nodeHasRadius } from './shapes'
import { textNodeToOutlinePath } from './text-outlines'

const BOOLEAN_PATH_OP: Record<
  NonNullable<SceneNode['booleanOperation']>,
  'Union' | 'Difference' | 'Intersect' | 'XOR'
> = {
  UNION: 'Union',
  SUBTRACT: 'Difference',
  INTERSECT: 'Intersect',
  EXCLUDE: 'XOR'
}

export function nodePathTransform(r: SkiaRenderer, child: SceneNode): number[] {
  const transforms = [r.ck.Matrix.translated(child.x, child.y)]
  if (child.rotation !== 0) {
    transforms.push(
      r.ck.Matrix.rotated((child.rotation * Math.PI) / 180, child.width / 2, child.height / 2)
    )
  }
  if (child.flipX || child.flipY) {
    transforms.push(
      r.ck.Matrix.scaled(
        child.flipX ? -1 : 1,
        child.flipY ? -1 : 1,
        child.width / 2,
        child.height / 2
      )
    )
  }
  if (transforms.length === 1) return transforms[0]
  return r.ck.Matrix.multiply(...transforms)
}

function hasVisibleImageFill(node: SceneNode): boolean {
  return node.fills.some((fill) => fill.visible && fill.type === 'IMAGE')
}

function canMakeTextSourcePath(node: SceneNode): boolean {
  return getTextOutlineSupport(node).supported
}

export function canMakeBooleanSourcePath(node: SceneNode): boolean {
  if (node.type === 'TEXT') return canMakeTextSourcePath(node) && !hasVisibleImageFill(node)
  return node.type !== 'SECTION' && node.type !== 'COMPONENT_SET' && !hasVisibleImageFill(node)
}

export function canMakeBooleanSourceNode(node: SceneNode, graph: SceneGraph): boolean {
  if (!canMakeBooleanSourcePath(node)) return false
  if (!canContainFlattenableChildren(node)) return true
  return node.childIds.every((childId) => {
    const child = graph.getNode(childId)
    return !child || !child.visible || canMakeBooleanSourceNode(child, graph)
  })
}

function lineStrokePath(r: SkiaRenderer, node: SceneNode): Path | null {
  const path = new r.ck.Path()
  path.moveTo(0, 0)
  path.lineTo(node.width, node.height)
  const stroke = node.strokes.find((item) => item.visible)
  const outline = path.stroke({ width: stroke?.weight ?? 1 })
  if (outline !== path) path.delete()
  return outline
}

function baseShapePath(r: SkiaRenderer, node: SceneNode): Path | null {
  if (node.type === 'TEXT') return textNodeToOutlinePath(r, node)
  if (node.type === 'LINE') return lineStrokePath(r, node)
  if (node.type === 'ELLIPSE' && node.arcData) return makeArcPath(r, node)

  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  return r.makeNodeShapePath(node, rect, nodeHasRadius(node))
}

function nodeHasVisibleFill(node: SceneNode): boolean {
  return node.fills.some((fill) => fill.visible)
}

export function nodeHasVisibleStroke(node: SceneNode): boolean {
  return node.strokes.some((stroke) => stroke.visible && stroke.weight > 0)
}

function addVisibleStrokeOutlines(target: Path, source: Path, node: SceneNode): void {
  for (const stroke of node.strokes) {
    if (!stroke.visible || stroke.weight <= 0) continue
    const outline = source.stroke({ width: stroke.weight })
    if (!outline) continue
    target.addPath(outline)
  }
}

function canContainFlattenableChildren(node: SceneNode): boolean {
  return (
    node.type === 'GROUP' ||
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE'
  )
}

function appendVisibleChildPaths(
  r: SkiaRenderer,
  graph: SceneGraph,
  parent: SceneNode,
  target: Path,
  makeChildPath: (child: SceneNode) => Path | null,
  failOnMissing: boolean
): boolean | null {
  let hasPath = false
  for (const childId of parent.childIds) {
    const child = graph.getNode(childId)
    if (!child || !child.visible) continue
    const childPath = makeChildPath(child)
    if (!childPath) {
      if (failOnMissing) return null
      continue
    }
    childPath.transform(nodePathTransform(r, child))
    target.addPath(childPath)
    childPath.delete()
    hasPath = true
  }
  return hasPath
}

function containerSourcePath(r: SkiaRenderer, node: SceneNode, graph: SceneGraph): Path | null {
  const path = new r.ck.Path()
  let hasPath = false

  if (nodeHasVisibleFill(node) || nodeHasVisibleStroke(node)) {
    const ownPath = baseShapePath(r, node)
    if (ownPath) {
      if (nodeHasVisibleFill(node)) path.addPath(ownPath)
      addVisibleStrokeOutlines(path, ownPath, node)
      ownPath.delete()
      hasPath = true
    }
  }

  const childPaths = appendVisibleChildPaths(
    r,
    graph,
    node,
    path,
    (child) => makeBooleanSourcePath(r, child, graph),
    true
  )
  if (childPaths === null) {
    path.delete()
    return null
  }
  hasPath ||= childPaths

  if (!hasPath) {
    path.delete()
    return null
  }
  return path
}

export function makeBooleanSourcePath(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): Path | null {
  if (node.type === 'BOOLEAN_OPERATION') return makeBooleanOperationPath(r, node, graph)
  if (!canMakeBooleanSourcePath(node)) return null
  if (canContainFlattenableChildren(node)) return containerSourcePath(r, node, graph)
  if (node.type === 'LINE') return baseShapePath(r, node)

  const path = baseShapePath(r, node)
  if (!path) return null
  if (nodeHasVisibleStroke(node)) addVisibleStrokeOutlines(path, path, node)
  return path
}

export function hasVisibleStrokeSourceNode(node: SceneNode, graph: SceneGraph): boolean {
  if (nodeHasVisibleStroke(node)) return true
  if (!canContainFlattenableChildren(node)) return false
  return node.childIds.some((childId) => {
    const child = graph.getNode(childId)
    return child?.visible === true && hasVisibleStrokeSourceNode(child, graph)
  })
}

export function makeStrokeOutlinePath(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): Path | null {
  if (!canMakeBooleanSourcePath(node)) return null
  if (canContainFlattenableChildren(node)) {
    const path = new r.ck.Path()
    let hasPath = false
    if (nodeHasVisibleStroke(node)) {
      const ownPath = baseShapePath(r, node)
      if (ownPath) {
        addVisibleStrokeOutlines(path, ownPath, node)
        ownPath.delete()
        hasPath = true
      }
    }
    hasPath ||=
      appendVisibleChildPaths(
        r,
        graph,
        node,
        path,
        (child) => makeStrokeOutlinePath(r, child, graph),
        false
      ) ?? false
    if (hasPath) return path
    path.delete()
    return null
  }

  if (!nodeHasVisibleStroke(node)) return null
  const path =
    node.type === 'BOOLEAN_OPERATION'
      ? makeBooleanOperationPath(r, node, graph)
      : baseShapePath(r, node)
  if (!path) return null
  if (node.type === 'LINE') return path
  const outline = new r.ck.Path()
  addVisibleStrokeOutlines(outline, path, node)
  return outline
}

function transformedShapePath(r: SkiaRenderer, child: SceneNode, graph: SceneGraph): Path | null {
  const path = makeBooleanSourcePath(r, child, graph)
  if (!path) return null
  path.transform(nodePathTransform(r, child))
  return path
}

function operationForNode(r: SkiaRenderer, node: SceneNode): PathOp {
  const operation = node.booleanOperation ?? 'UNION'
  return r.ck.PathOp[BOOLEAN_PATH_OP[operation]]
}

export function makeBooleanOperationPath(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): Path | null {
  const childPaths: Path[] = []
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child || !child.visible) continue
    const path = transformedShapePath(r, child, graph)
    if (path) childPaths.push(path)
  }

  if (childPaths.length === 0) return null

  const first = childPaths[0]
  for (const path of childPaths.slice(1)) {
    first.op(path, operationForNode(r, node))
    path.delete()
  }
  return first
}

export function renderBooleanOperation(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const path = makeBooleanOperationPath(r, node, graph)
  if (!path) return

  for (let fillIndex = 0; fillIndex < node.fills.length; fillIndex++) {
    const fill = node.fills[fillIndex]
    if (!fill.visible || !r.applyFill(fill, node, graph, fillIndex)) continue
    r.fillPaint.setAlphaf(fill.opacity)
    // Capture any image shader created by applyFill so we can delete it
    // after the draw. Boolean operations bypass drawVisibleFills, which
    // normally handles shader cleanup via try/finally.
    const imageShader = r.imageFillShader
    if (imageShader) r.imageFillShader = null
    try {
      canvas.drawPath(path, r.fillPaint)
    } finally {
      try {
        r.fillPaint.setShader(null)
      } finally {
        if (imageShader) imageShader.delete()
      }
    }
  }

  for (const stroke of node.strokes) {
    if (!stroke.visible) continue
    const color = r.resolveStrokeColor(stroke, 0, node, graph)
    r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
    r.strokePaint.setStrokeWidth(stroke.weight)
    r.strokePaint.setAlphaf(stroke.opacity)
    canvas.drawPath(path, r.strokePaint)
  }

  path.delete()
}
