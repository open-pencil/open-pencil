import type { SceneNode } from '@open-pencil/scene-graph'

import type {
  DerivedSymbolOverride,
  OverrideContext
} from '#core/kiwi/fig/instance-overrides/types'
import { convertLetterSpacing, convertLineHeight } from '#core/kiwi/fig/node-change/convert'
import { convertFigmaDerivedTextGlyphs } from '#core/kiwi/fig/node-change/derived-text-glyphs'

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
  const figmaDerivedTextGlyphs = convertFigmaDerivedTextGlyphs(d.derivedTextData, blobs)
  if (figmaDerivedTextGlyphs.length > 0) updates.figmaDerivedTextGlyphs = figmaDerivedTextGlyphs
  return updates
}

export function buildDsdLayoutUpdates(
  ctx: OverrideContext,
  visibleSiblingCount: Map<string, number>,
  d: DerivedSymbolOverride,
  target: SceneNode
): { updates: Partial<SceneNode>; hasSize: boolean } {
  const updates: Partial<SceneNode> = buildDsdTextUpdates(d, ctx.blobs, target)
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
  if (Object.keys(figmaDerivedLayout).length > 0) updates.figmaDerivedLayout = figmaDerivedLayout
  Object.assign(updates, resolveDsdGeometry(d, target, ctx.blobs))
  return { updates, hasSize: d.size !== undefined }
}
