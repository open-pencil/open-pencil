import {
  convertFigmaTransformProps,
  convertFigmaDerivedTextGlyphs,
  convertLetterSpacing,
  convertLineHeight
} from '@open-pencil/fig/node-change'
import { getNodeLocalMatrix, type SceneNode } from '@open-pencil/scene-graph'

import type { DerivedSymbolOverride, OverrideContext } from '../types'
import { resolveDsdGeometry } from './geometry'

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

function resolveSizeOnlyPosition(
  ctx: OverrideContext,
  visibleSiblingCount: Map<string, number>,
  node: SceneNode
): Pick<SceneNode, 'x' | 'y'> | null {
  if (
    !node.parentId ||
    getVisibleSiblingCount(ctx, visibleSiblingCount, node.parentId) !== 1 ||
    !node.componentId
  )
    return null
  const source = ctx.graph.getNode(node.componentId)
  const targetParent = ctx.graph.getNode(node.parentId)
  if (!source || !targetParent) return null
  const fitsTargetParent =
    source.x >= 0 &&
    source.y >= 0 &&
    source.x + source.width <= targetParent.width + 0.01 &&
    source.y + source.height <= targetParent.height + 0.01
  return fitsTargetParent ? { x: source.x, y: source.y } : null
}

function preserveTransformedPositionAfterResize(
  node: SceneNode,
  width: number,
  height: number
): Pick<SceneNode, 'x' | 'y'> | null {
  if (node.rotation === 0 && !node.flipX && !node.flipY) return null

  // Figma's transform is anchored to the node's local coordinate system, while SceneNode
  // rotation/reflection is applied around its center. If derived symbol data changes only the
  // size, retaining x/y moves that center and therefore changes the effective transform. Keep
  // the existing matrix translation and solve x/y again for the new center instead.
  const matrix = getNodeLocalMatrix(node)
  const centerX = width / 2
  const centerY = height / 2
  return {
    x: matrix[2] - centerX + matrix[0] * centerX + matrix[1] * centerY,
    y: matrix[5] - centerY + matrix[3] * centerX + matrix[4] * centerY
  }
}

function buildDsdTextUpdates(
  d: DerivedSymbolOverride,
  blobs: Uint8Array[],
  target: SceneNode
): Partial<SceneNode> {
  const updates: Partial<SceneNode> = {}
  if (d.fontSize !== undefined) updates.fontSize = d.fontSize
  if (d.lineHeight !== undefined) updates.lineHeight = convertLineHeight(d.lineHeight, d.fontSize)
  if (d.letterSpacing !== undefined)
    updates.letterSpacing = convertLetterSpacing(d.letterSpacing, d.fontSize)
  if (d.strokeWeight !== undefined && target.strokes.length > 0) {
    updates.strokes = target.strokes.map((stroke) => ({
      ...stroke,
      weight: d.strokeWeight as number
    }))
  }
  const derivedTextGlyphs = convertFigmaDerivedTextGlyphs(d.derivedTextData, blobs)
  if (derivedTextGlyphs.length > 0) updates.derivedTextGlyphs = derivedTextGlyphs
  return updates
}

export function buildDsdLayoutUpdates(
  ctx: OverrideContext,
  _visibleSiblingCount: Map<string, number>,
  d: DerivedSymbolOverride,
  target: SceneNode
): { updates: Partial<SceneNode>; hasSize: boolean } {
  const updates: Partial<SceneNode> = buildDsdTextUpdates(d, ctx.blobs, target)
  const derivedLayout: NonNullable<SceneNode['derivedLayout']> = {}

  if (d.size) {
    updates.width = d.size.x
    updates.height = d.size.y
    derivedLayout.width = d.size.x
    derivedLayout.height = d.size.y
  }
  if (d.transform) {
    const transformed = convertFigmaTransformProps({
      transform: d.transform,
      size: d.size ?? { x: target.width, y: target.height }
    })
    updates.x = transformed.x
    updates.y = transformed.y
    updates.rotation = transformed.rotation
    updates.flipX = transformed.flipX
    updates.flipY = transformed.flipY
    derivedLayout.x = transformed.x
    derivedLayout.y = transformed.y
  } else if (d.size) {
    const position =
      preserveTransformedPositionAfterResize(target, d.size.x, d.size.y) ??
      resolveSizeOnlyPosition(ctx, _visibleSiblingCount, target)
    if (position) {
      updates.x = position.x
      updates.y = position.y
      derivedLayout.x = position.x
      derivedLayout.y = position.y
    }
  }
  if (Object.keys(derivedLayout).length > 0) updates.derivedLayout = derivedLayout
  Object.assign(updates, resolveDsdGeometry(d, target, ctx.blobs))
  return { updates, hasSize: d.size !== undefined }
}
